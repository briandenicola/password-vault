using PasswordService.Common;

namespace PasswordService.Models
{
    public class PasswordEntity
    {
        public string? EncryptedPassword { get; set;}
        public string? HmacHash { get; set; }

        /// <summary>v2 (AES-GCM) nonce/IV. Null for legacy v1 entries (MIG-1).</summary>
        public string? Iv { get; set; }

        /// <summary>The on-disk format this entity was parsed from (MIG-1). Defaults to legacy v1.</summary>
        public SecretFormat Format { get; private set; } = SecretFormat.V1CbcHmac;

        public PasswordEntity()
        {
            EncryptedPassword = HmacHash = string.Empty;
        }

        public PasswordEntity( string encryptedPassword ) 
        {
            var envelope = SecretEnvelope.Parse(encryptedPassword);
            Format = envelope.Format;
            if (envelope.Format == SecretFormat.V2Gcm)
            {
                Iv = envelope.Iv;
                EncryptedPassword = envelope.CipherTextAndTag;
            }
            else
            {
                EncryptedPassword = envelope.Ciphertext;
                HmacHash = envelope.HmacHash;
            }
        }

        public PasswordEntity( string hmacHash, string encryptedPassword ) 
        {
            EncryptedPassword = encryptedPassword;
            HmacHash = hmacHash;
        }

        // Reconstruct the canonical stored blob. Uses Iv (not Format) to pick the version so it
        // round-trips correctly even after JSON (de)serialization of stored history records.
        public override string ToString() 
        {
            return string.IsNullOrEmpty(Iv)
                ? SecretEnvelope.FromV1(HmacHash ?? string.Empty, EncryptedPassword ?? string.Empty).Serialize()
                : SecretEnvelope.FromV2Gcm(Iv, EncryptedPassword ?? string.Empty).Serialize();
        }
    }

}

