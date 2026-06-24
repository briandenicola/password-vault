namespace PasswordService.Common
{
    /// <summary>
    /// On-disk ciphertext format versions. See docs/design/e2ee.md §5 and MIG-1.
    /// </summary>
    public enum SecretFormat
    {
        /// <summary>Legacy server-side AES-CBC + HMAC-SHA512, stored as "hmacB64:cipherB64".</summary>
        V1CbcHmac,

        /// <summary>AES-GCM (CR-2 / E2EE), stored as "v2.gcm.ivB64.cipherTagB64".</summary>
        V2Gcm,
    }

    /// <summary>
    /// Versioned representation of a stored secret. This is the single source of truth for how
    /// a ciphertext blob is parsed and serialized, so that legacy (<c>v1</c>) data and any future
    /// format (<c>v2</c> AES-GCM, etc.) can coexist during migration (MIG-1).
    ///
    /// Discriminator: a legacy blob is two base64 tokens joined by ':' and therefore never
    /// contains '.', while every versioned blob carries a "vN.&lt;cipher&gt;." prefix. So the
    /// presence of '.' unambiguously distinguishes the two families.
    /// </summary>
    public sealed class SecretEnvelope
    {
        private const string V2GcmPrefix = "v2.gcm.";

        public SecretFormat Format { get; }

        // V1 (legacy CBC + HMAC) payload.
        public string? HmacHash { get; }
        public string? Ciphertext { get; }

        // V2 (AES-GCM) payload.
        public string? Iv { get; }
        public string? CipherTextAndTag { get; }

        private SecretEnvelope(
            SecretFormat format,
            string? hmacHash = null,
            string? ciphertext = null,
            string? iv = null,
            string? cipherTextAndTag = null)
        {
            Format = format;
            HmacHash = hmacHash;
            Ciphertext = ciphertext;
            Iv = iv;
            CipherTextAndTag = cipherTextAndTag;
        }

        /// <summary>Build a legacy (v1) envelope from its HMAC and ciphertext parts.</summary>
        public static SecretEnvelope FromV1(string hmacHash, string ciphertext)
        {
            ArgumentNullException.ThrowIfNull(hmacHash);
            ArgumentNullException.ThrowIfNull(ciphertext);
            return new SecretEnvelope(SecretFormat.V1CbcHmac, hmacHash: hmacHash, ciphertext: ciphertext);
        }

        /// <summary>Build a v2 AES-GCM envelope from its IV and combined ciphertext+tag.</summary>
        public static SecretEnvelope FromV2Gcm(string ivB64, string cipherTextAndTagB64)
        {
            ArgumentNullException.ThrowIfNull(ivB64);
            ArgumentNullException.ThrowIfNull(cipherTextAndTagB64);
            return new SecretEnvelope(SecretFormat.V2Gcm, iv: ivB64, cipherTextAndTag: cipherTextAndTagB64);
        }

        /// <summary>
        /// Parse a stored blob, selecting the handler by its version prefix. Anything without a
        /// recognized version tag is treated as the legacy v1 format, so existing data needs no
        /// rewrite. Throws <see cref="FormatException"/> on malformed or unknown input.
        /// </summary>
        public static SecretEnvelope Parse(string stored)
        {
            if (string.IsNullOrEmpty(stored))
            {
                throw new FormatException("Secret blob is null or empty.");
            }

            // Versioned blobs always contain '.'; legacy base64 tokens never do.
            if (stored.Contains('.'))
            {
                if (stored.StartsWith(V2GcmPrefix, StringComparison.Ordinal))
                {
                    // v2.gcm.<ivB64>.<cipherTagB64>
                    var parts = stored.Split('.');
                    if (parts.Length != 4 || parts[2].Length == 0 || parts[3].Length == 0)
                    {
                        throw new FormatException("Malformed v2.gcm secret blob; expected 'v2.gcm.<iv>.<ciphertext+tag>'.");
                    }
                    return FromV2Gcm(parts[2], parts[3]);
                }

                throw new FormatException($"Unknown secret format prefix in blob starting '{Prefix(stored)}'.");
            }

            // Legacy v1: "<hmacB64>:<cipherB64>".
            var v1 = stored.Split(':');
            if (v1.Length != 2 || v1[0].Length == 0 || v1[1].Length == 0)
            {
                throw new FormatException("Malformed legacy (v1) secret blob; expected '<hmac>:<ciphertext>'.");
            }
            return FromV1(hmacHash: v1[0], ciphertext: v1[1]);
        }

        /// <summary>Serialize back to the canonical stored form for this envelope's version.</summary>
        public string Serialize() => Format switch
        {
            SecretFormat.V1CbcHmac => $"{HmacHash}:{Ciphertext}",
            SecretFormat.V2Gcm => $"{V2GcmPrefix}{Iv}.{CipherTextAndTag}",
            _ => throw new InvalidOperationException($"Unsupported secret format: {Format}."),
        };

        public override string ToString() => Serialize();

        private static string Prefix(string s) => s.Length <= 8 ? s : s[..8];
    }
}
