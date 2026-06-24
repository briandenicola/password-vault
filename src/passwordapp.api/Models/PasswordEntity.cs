using PasswordService.Common;

namespace PasswordService.Models
{
    public class PasswordEntity
    {
        public string? EncryptedPassword { get; set;}
        public string? HmacHash { get; set; }

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
            EncryptedPassword = envelope.Ciphertext;
            HmacHash = envelope.HmacHash;
        }

        public PasswordEntity( string hmacHash, string encryptedPassword ) 
        {
            EncryptedPassword = encryptedPassword;
            HmacHash = hmacHash;
        }

        public override string ToString() 
        {
            return SecretEnvelope.FromV1(HmacHash ?? string.Empty, EncryptedPassword ?? string.Empty).Serialize();
        }
    }

}

