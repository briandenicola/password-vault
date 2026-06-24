using Newtonsoft.Json.Linq;

namespace PasswordService.Common
{
    /// <summary>
    /// MIG-2 document walker: given a single account document (as parsed JSON), re-encrypt its
    /// secret fields from v1 to v2 in place, touching nothing else. It is deliberately surgical and
    /// casing-preserving — it finds fields case-insensitively and only rewrites the secret values —
    /// so the rest of the document (and the field naming the running app expects) is left intact.
    ///
    /// Two secret shapes exist:
    ///  - <c>currentPassword</c>: a blob STRING ("hmac:cipher" or "v2.gcm...").
    ///  - <c>oldPasswords[].password</c>: an OBJECT serialized from <see cref="PasswordService.Models"/>'s
    ///    PasswordEntity — v1 = { HmacHash, EncryptedPassword }, v2 = { Iv, EncryptedPassword }.
    /// </summary>
    public static class DocumentMigrator
    {
        public sealed record DocumentMigration(bool Changed, int Migrated, int AlreadyV2, int Failed, IReadOnlyList<string> Errors);

        public static DocumentMigration MigrateDocument(Encryptor encryptor, JObject doc)
        {
            ArgumentNullException.ThrowIfNull(doc);

            var changed = false;
            int migrated = 0, alreadyV2 = 0, failed = 0;
            var errors = new List<string>();

            void Tally(EntryMigration result, string where)
            {
                switch (result.Status)
                {
                    case MigrationStatus.Migrated: migrated++; break;
                    case MigrationStatus.AlreadyV2: alreadyV2++; break;
                    case MigrationStatus.Failed:
                        failed++;
                        errors.Add($"{where}: {result.Error}");
                        break;
                }
            }

            // --- current password (string blob) ---
            var currentProp = FindProperty(doc, "currentPassword");
            if (currentProp?.Value.Type == JTokenType.String)
            {
                var result = VaultMigration.MigrateBlob(encryptor, (string?)currentProp.Value);
                Tally(result, "currentPassword");
                if (result.ShouldRewrite)
                {
                    currentProp.Value = result.NewBlob;
                    changed = true;
                }
            }

            // --- history (oldPasswords[].password object) ---
            var oldProp = FindProperty(doc, "oldPasswords");
            if (oldProp?.Value is JArray history)
            {
                for (var i = 0; i < history.Count; i++)
                {
                    if (history[i] is not JObject entry)
                    {
                        continue;
                    }

                    var passwordProp = FindProperty(entry, "password");
                    if (passwordProp?.Value is not JObject secret)
                    {
                        continue;
                    }

                    var blob = ReadEntityBlob(secret);
                    if (blob is null)
                    {
                        continue;
                    }

                    var result = VaultMigration.MigrateBlob(encryptor, blob);
                    Tally(result, $"oldPasswords[{i}]");
                    if (result.ShouldRewrite)
                    {
                        WriteEntityBlob(secret, result.NewBlob!);
                        changed = true;
                    }
                }
            }

            return new DocumentMigration(changed, migrated, alreadyV2, failed, errors);
        }

        public sealed record DocumentVerification(int Ok, int Failed, IReadOnlyList<string> Errors);

        /// <summary>
        /// Read-only verification (MIG-3): decrypt every secret in the document and report which
        /// (if any) cannot be decrypted. Modifies nothing.
        /// </summary>
        public static DocumentVerification VerifyDocument(Encryptor encryptor, JObject doc)
        {
            ArgumentNullException.ThrowIfNull(doc);
            int ok = 0, failed = 0;
            var errors = new List<string>();

            void Check(string? blob, string where)
            {
                if (string.IsNullOrEmpty(blob))
                {
                    return;
                }
                var v = VaultMigration.VerifyBlob(encryptor, blob);
                if (v.Ok) { ok++; }
                else { failed++; errors.Add($"{where}: {v.Error}"); }
            }

            var currentProp = FindProperty(doc, "currentPassword");
            if (currentProp?.Value.Type == JTokenType.String)
            {
                Check((string?)currentProp.Value, "currentPassword");
            }

            if (FindProperty(doc, "oldPasswords")?.Value is JArray history)
            {
                for (var i = 0; i < history.Count; i++)
                {
                    if (history[i] is JObject entry && FindProperty(entry, "password")?.Value is JObject secret)
                    {
                        Check(ReadEntityBlob(secret), $"oldPasswords[{i}]");
                    }
                }
            }

            return new DocumentVerification(ok, failed, errors);
        }

        // Reconstruct the stored blob from a PasswordEntity-shaped object, regardless of version.
        private static string? ReadEntityBlob(JObject secret)
        {
            var cipher = (string?)FindProperty(secret, "encryptedPassword")?.Value;
            if (string.IsNullOrEmpty(cipher))
            {
                return null;
            }

            var iv = (string?)FindProperty(secret, "iv")?.Value;
            if (!string.IsNullOrEmpty(iv))
            {
                return SecretEnvelope.FromV2Gcm(iv, cipher).Serialize();
            }

            var hmac = (string?)FindProperty(secret, "hmacHash")?.Value;
            if (string.IsNullOrEmpty(hmac))
            {
                return null;
            }
            return SecretEnvelope.FromV1(hmac, cipher).Serialize();
        }

        // Rewrite a PasswordEntity-shaped object to hold the new v2 blob: set Iv + EncryptedPassword
        // (the combined ciphertext+tag) and drop the now-meaningless HmacHash.
        private static void WriteEntityBlob(JObject secret, string v2Blob)
        {
            var env = SecretEnvelope.Parse(v2Blob); // expected v2
            SetProperty(secret, "encryptedPassword", env.CipherTextAndTag);
            SetProperty(secret, "iv", env.Iv);

            var hmacProp = FindProperty(secret, "hmacHash");
            if (hmacProp is not null)
            {
                hmacProp.Value = JValue.CreateNull();
            }
        }

        private static JProperty? FindProperty(JObject obj, string name) =>
            obj.Properties().FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));

        // Update an existing property (preserving its original casing) or add one if absent.
        private static void SetProperty(JObject obj, string name, string? value)
        {
            var existing = FindProperty(obj, name);
            if (existing is not null)
            {
                existing.Value = value;
            }
            else
            {
                obj.Add(name, value);
            }
        }
    }
}
