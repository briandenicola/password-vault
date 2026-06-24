namespace PasswordService.Common
{
    public enum MigrationStatus
    {
        /// <summary>Blob was null/empty — nothing to do.</summary>
        Empty,

        /// <summary>Already in the v2 (AES-GCM) format — left unchanged (idempotent).</summary>
        AlreadyV2,

        /// <summary>Legacy v1 blob successfully re-encrypted to v2 and verified.</summary>
        Migrated,

        /// <summary>Could not decrypt the legacy blob, or the re-encryption failed verification.
        /// The caller MUST NOT write anything for this entry.</summary>
        Failed,
    }

    /// <summary>Result of attempting to migrate a single stored secret blob.</summary>
    public sealed record EntryMigration(MigrationStatus Status, string? NewBlob, string? Error)
    {
        public bool IsFailure => Status == MigrationStatus.Failed;

        /// <summary>True when a new v2 blob should replace the stored value.</summary>
        public bool ShouldRewrite => Status == MigrationStatus.Migrated;
    }

    /// <summary>
    /// MIG-2/MIG-3 core: pure, Cosmos-free logic for verifying and re-encrypting stored secret
    /// blobs from the legacy v1 (AES-CBC + HMAC) format to v2 (AES-GCM). All crypto goes through
    /// the existing <see cref="Encryptor"/>, so nothing is re-implemented. Every migration is
    /// verified by decrypting the freshly written v2 blob before it is accepted — an entry that
    /// cannot be decrypted or fails verification is reported as <see cref="MigrationStatus.Failed"/>
    /// and never silently rewritten.
    /// </summary>
    public static class VaultMigration
    {
        /// <summary>
        /// Attempt to read a blob and (if legacy) re-encrypt it to v2. Idempotent: a v2 blob is
        /// returned unchanged. The returned <see cref="EntryMigration.NewBlob"/> is only meant to
        /// replace stored data when <see cref="MigrationStatus.Migrated"/>.
        /// </summary>
        public static EntryMigration MigrateBlob(Encryptor encryptor, string? stored)
        {
            if (string.IsNullOrWhiteSpace(stored))
            {
                return new EntryMigration(MigrationStatus.Empty, null, null);
            }

            SecretEnvelope envelope;
            try
            {
                envelope = SecretEnvelope.Parse(stored);
            }
            catch (FormatException ex)
            {
                return new EntryMigration(MigrationStatus.Failed, null, $"unparseable blob: {ex.Message}");
            }

            if (envelope.Format == SecretFormat.V2Gcm)
            {
                return new EntryMigration(MigrationStatus.AlreadyV2, stored, null);
            }

            // Legacy v1: decrypt with the existing path.
            var plaintext = encryptor.DecryptStored(stored);
            if (plaintext is null)
            {
                return new EntryMigration(MigrationStatus.Failed, null, "legacy (v1) decrypt failed (auth/format)");
            }

            // Re-encrypt under AES-GCM and verify the round-trip before accepting it.
            var v2Blob = encryptor.EncryptGcm(plaintext);
            var verify = encryptor.DecryptStored(v2Blob);
            if (!string.Equals(verify, plaintext, StringComparison.Ordinal))
            {
                return new EntryMigration(MigrationStatus.Failed, null, "re-encryption failed verification");
            }

            return new EntryMigration(MigrationStatus.Migrated, v2Blob, null);
        }

        /// <summary>Result of a read-only verification of one stored blob.</summary>
        public sealed record EntryVerification(bool Ok, SecretFormat Format, string? Error);

        /// <summary>
        /// Read-only check (MIG-3): can this blob be parsed and decrypted? Does not modify anything.
        /// Note: a CR-1-corrupted entry (non-ASCII silently mangled to '?') still decrypts cleanly,
        /// so it cannot be detected cryptographically — only genuinely broken blobs are caught here.
        /// </summary>
        public static EntryVerification VerifyBlob(Encryptor encryptor, string? stored)
        {
            if (string.IsNullOrWhiteSpace(stored))
            {
                return new EntryVerification(true, SecretFormat.V1CbcHmac, null); // nothing to decrypt
            }

            SecretEnvelope envelope;
            try
            {
                envelope = SecretEnvelope.Parse(stored);
            }
            catch (FormatException ex)
            {
                return new EntryVerification(false, SecretFormat.V1CbcHmac, $"unparseable blob: {ex.Message}");
            }

            var plaintext = encryptor.DecryptStored(stored);
            return plaintext is null
                ? new EntryVerification(false, envelope.Format, "decrypt failed (auth/format)")
                : new EntryVerification(true, envelope.Format, null);
        }
    }
}
