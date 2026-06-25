using System.Security.Cryptography;
using System.Text;

namespace PasswordService.Common
{
    /// <summary>
    /// AES-GCM protector for client-side E2EE vault DEKs. Unlike <see cref="Encryptor"/>,
    /// this uses the raw DEK bytes directly because the browser imports the same bytes
    /// as an AES-GCM CryptoKey.
    /// </summary>
    public sealed class E2eeDekProtector : ISecretProtector
    {
        private const int GcmNonceSize = 12;
        private const int GcmTagSize = 16;
        private readonly byte[] _dek;

        public E2eeDekProtector(string dekBase64)
            : this(Convert.FromBase64String(dekBase64))
        {
        }

        public E2eeDekProtector(byte[] dek)
        {
            if (dek.Length != 32)
            {
                throw new ArgumentException("Vault DEK must be 32 bytes for AES-256-GCM.", nameof(dek));
            }

            _dek = dek.ToArray();
        }

        public string EncryptGcm(string plainText)
        {
            var plain = Encoding.UTF8.GetBytes(plainText ?? string.Empty);
            var nonce = RandomNumberGenerator.GetBytes(GcmNonceSize);
            var cipher = new byte[plain.Length];
            var tag = new byte[GcmTagSize];

            using (var aes = new AesGcm(_dek, GcmTagSize))
            {
                aes.Encrypt(nonce, plain, cipher, tag);
            }

            var cipherAndTag = new byte[cipher.Length + tag.Length];
            Buffer.BlockCopy(cipher, 0, cipherAndTag, 0, cipher.Length);
            Buffer.BlockCopy(tag, 0, cipherAndTag, cipher.Length, tag.Length);

            return SecretEnvelope.FromV2Gcm(
                Convert.ToBase64String(nonce),
                Convert.ToBase64String(cipherAndTag)).Serialize();
        }

        public string? DecryptStored(string stored)
        {
            var envelope = SecretEnvelope.Parse(stored);
            if (envelope.Format != SecretFormat.V2Gcm)
            {
                return null;
            }

            byte[] nonce, cipherAndTag;
            try
            {
                nonce = Convert.FromBase64String(envelope.Iv!);
                cipherAndTag = Convert.FromBase64String(envelope.CipherTextAndTag!);
            }
            catch (FormatException)
            {
                return null;
            }

            if (nonce.Length != GcmNonceSize || cipherAndTag.Length < GcmTagSize)
            {
                return null;
            }

            var cipherLength = cipherAndTag.Length - GcmTagSize;
            var cipher = new byte[cipherLength];
            var tag = new byte[GcmTagSize];
            Buffer.BlockCopy(cipherAndTag, 0, cipher, 0, cipherLength);
            Buffer.BlockCopy(cipherAndTag, cipherLength, tag, 0, GcmTagSize);

            var plain = new byte[cipherLength];
            try
            {
                using var aes = new AesGcm(_dek, GcmTagSize);
                aes.Decrypt(nonce, cipher, tag, plain);
            }
            catch (CryptographicException)
            {
                return null;
            }

            return Encoding.UTF8.GetString(plain);
        }
    }
}
