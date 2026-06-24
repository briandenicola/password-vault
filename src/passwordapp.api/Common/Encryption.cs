using System.Text;
using System.Security.Cryptography;

namespace PasswordService.Common
{
    public class Encryptor
    {
        // Instance state: these were previously static, which let the most recently constructed
        // Encryptor overwrite the key/IV for every other instance process-wide (a real bug under
        // DI and a race in parallel tests). Keeping them per-instance fixes that (CR-6).
        private readonly byte[] _key = Array.Empty<byte>();
        private readonly byte[] _iv = Array.Empty<byte>();
        private const int size = 16;

        // v2 (AES-GCM) parameters. See CR-2..CR-5 and docs/design/e2ee.md §5.
        private const int GcmNonceSize = 12; // 96-bit nonce, recommended for AES-GCM
        private const int GcmTagSize = 16;   // 128-bit auth tag
        private static readonly byte[] GcmKeyInfo = Encoding.UTF8.GetBytes("passwordvault:v2:gcm");

        public Encryptor(string key, string iv)
        {
            _key = Convert.FromBase64String(key) ?? Array.Empty<byte>();
            _iv = Convert.FromBase64String(iv) ?? Array.Empty<byte>();
        }

        public string Encrypt(string plainText, out string? cipherText)
        {
            if (plainText == null || plainText.Length <= 0)
            {
                cipherText = default;
                return string.Empty;
            }

            byte[] cipherArray;
            using (HMACSHA512 hmac = new HMACSHA512(_key))
            {
                var plainTextArray = Encoding.UTF8.GetBytes(plainText);
                var hash = hmac.ComputeHash(plainTextArray);
                var salt = GenerateSalt();

                using (Aes aes = Aes.Create())
                {
                    aes.Key = _key;
                    aes.IV = _iv;

                    ICryptoTransform encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
                    using (MemoryStream memoryStream = new MemoryStream())
                    {
                        using (CryptoStream cryptoStream = new CryptoStream(memoryStream, encryptor, CryptoStreamMode.Write))
                        {
                            cryptoStream.Write(salt, 0, salt.Length);
                            cryptoStream.Write(plainTextArray, 0, plainTextArray.Length);
                            cryptoStream.FlushFinalBlock();
                        }
                        cipherArray = memoryStream.ToArray();
                    }
                }
                cipherText = Convert.ToBase64String(cipherArray);
                return Convert.ToBase64String(hash);
            }
        }

        public void Decrypt(string cipherText, string hmacText, out string? plainText)
        {
            plainText = default;
            if (string.IsNullOrEmpty(cipherText) || string.IsNullOrEmpty(hmacText))
            {
                return;
            }

            try
            {
                using (HMACSHA512 hmac = new HMACSHA512(_key))
                using (Aes aes = Aes.Create())
                {
                    aes.Key = _key;
                    aes.IV = _iv;

                    var hmacArray = Convert.FromBase64String(hmacText);
                    var cipherArray = Convert.FromBase64String(cipherText);

                    // Must be at least the prepended salt block; otherwise it is not our format.
                    if (cipherArray.Length <= size)
                    {
                        return;
                    }

                    ICryptoTransform decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
                    using (MemoryStream memoryStream = new MemoryStream(cipherArray))
                    using (CryptoStream cryptoStream = new CryptoStream(memoryStream, decryptor, CryptoStreamMode.Read))
                    using (BinaryReader streamReader = new BinaryReader(cryptoStream))
                    {
                        streamReader.ReadBytes(size); //Read and dump salt value 
                        var plainTextArray = streamReader.ReadBytes(cipherArray.Length - size);
                        var computedHashArray = hmac.ComputeHash(plainTextArray);

                        if (hmacArray.SequenceEqual(computedHashArray))
                        {
                            plainText = Encoding.UTF8.GetString(plainTextArray);
                        }
                    }
                }
            }
            catch (Exception ex) when (ex is CryptographicException or FormatException)
            {
                // Corrupt/tampered/foreign data: fail safe so a bad entry never crashes a bulk
                // operation (e.g. MIG-2 migration) and never yields unauthenticated plaintext.
                plainText = default;
            }
        }

        // --- v2: AES-GCM authenticated encryption (CR-2/CR-3/CR-4) ---

        /// <summary>
        /// Encrypt with AES-GCM and return a fully-serialized v2 envelope
        /// ("v2.gcm.&lt;ivB64&gt;.&lt;ciphertext+tagB64&gt;"). A fresh 96-bit nonce is generated per
        /// call, and the GCM key is HKDF-derived so it is separated from the legacy AES/HMAC key (CR-5).
        /// </summary>
        public string EncryptGcm(string plainText)
        {
            var plain = Encoding.UTF8.GetBytes(plainText ?? string.Empty);
            var nonce = RandomNumberGenerator.GetBytes(GcmNonceSize);
            var cipher = new byte[plain.Length];
            var tag = new byte[GcmTagSize];

            var gcmKey = DeriveGcmKey();
            using (var aes = new AesGcm(gcmKey, GcmTagSize))
            {
                aes.Encrypt(nonce, plain, cipher, tag);
            }

            // Store ciphertext and tag together as a single blob.
            var cipherAndTag = new byte[cipher.Length + tag.Length];
            Buffer.BlockCopy(cipher, 0, cipherAndTag, 0, cipher.Length);
            Buffer.BlockCopy(tag, 0, cipherAndTag, cipher.Length, tag.Length);

            return SecretEnvelope.FromV2Gcm(
                Convert.ToBase64String(nonce),
                Convert.ToBase64String(cipherAndTag)).Serialize();
        }

        /// <summary>
        /// Decrypt an AES-GCM payload. Returns <c>null</c> if the auth tag does not verify
        /// (tampering, wrong key, or corruption) so callers never see unauthenticated plaintext.
        /// </summary>
        public string? DecryptGcm(string ivB64, string cipherAndTagB64)
        {
            byte[] nonce, cipherAndTag;
            try
            {
                nonce = Convert.FromBase64String(ivB64);
                cipherAndTag = Convert.FromBase64String(cipherAndTagB64);
            }
            catch (FormatException)
            {
                return null;
            }

            if (cipherAndTag.Length < GcmTagSize)
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
                var gcmKey = DeriveGcmKey();
                using var aes = new AesGcm(gcmKey, GcmTagSize);
                aes.Decrypt(nonce, cipher, tag, plain);
            }
            catch (CryptographicException)
            {
                return null; // authentication failed
            }

            return Encoding.UTF8.GetString(plain);
        }

        /// <summary>
        /// Version-aware decrypt entry point: parses the stored blob and routes to the legacy
        /// (v1) or AES-GCM (v2) handler. This is how callers read data regardless of when it was
        /// written, enabling incremental migration (MIG-1/MIG-2).
        /// </summary>
        public string? DecryptStored(string stored)
        {
            var envelope = SecretEnvelope.Parse(stored);
            switch (envelope.Format)
            {
                case SecretFormat.V2Gcm:
                    return DecryptGcm(envelope.Iv!, envelope.CipherTextAndTag!);
                case SecretFormat.V1CbcHmac:
                    Decrypt(envelope.Ciphertext!, envelope.HmacHash!, out string? plainText);
                    return plainText;
                default:
                    return null;
            }
        }

        // Separate the GCM key from the raw configured key (which legacy v1 also used for HMAC),
        // so the two schemes never share key material (CR-5).
        private byte[] DeriveGcmKey() =>
            HKDF.DeriveKey(HashAlgorithmName.SHA256, _key, outputLength: 32, salt: null, info: GcmKeyInfo);

        private static byte[] GenerateSalt()
        {
            byte[] salt = new byte[size];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(salt);
            }
            
            return salt;
        }
    }
}
