using System;
using System.Text;
using System.Security.Cryptography;
using System.IO;
using System.Linq;

namespace PasswordService.Common
{
    public class Encryptor
    {
        private static byte[] _key;
        private static byte[] _iv;
        private static int size = 16;

        public Encryptor(string key, string iv)
        {
            _key = Convert.FromBase64String(key);
            _iv = Convert.FromBase64String(iv);
        }

        public string Encrypt(string plainText, out string cipherText)
        {
            if (plainText == null || plainText.Length <= 0)
            {
                cipherText = default(string);
                return string.Empty;
            }

            byte[] cipherArray;
            using (HMACSHA512 hmac = new HMACSHA512(_key))
            {
                var plainTextArray = Encoding.ASCII.GetBytes(plainText);
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

        public void Decrypt(string cipherText, string hmacText, out string plainText)
        {
            if (cipherText == null || cipherText.Length <= 0)
            {
                plainText = default(string);
            }

            using (HMACSHA512 hmac = new HMACSHA512(_key))
            {
                using (Aes aes = Aes.Create())
                {
                    aes.Key = _key;
                    aes.IV = _iv;

                    var hmacArray = Convert.FromBase64String(hmacText);
                    var cipherArray = Convert.FromBase64String(cipherText);

                    ICryptoTransform decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
                    using (MemoryStream memoryStream = new MemoryStream(cipherArray))
                    {
                        using (CryptoStream cryptoStream = new CryptoStream(memoryStream, decryptor, CryptoStreamMode.Read))
                        {
                            using (BinaryReader streamReader = new BinaryReader(cryptoStream))
                            {
                                streamReader.ReadBytes(size); //Read and dump salt value 
                                var plainTextArray = streamReader.ReadBytes(cipherArray.Length - size);
                                var computedHashArray = hmac.ComputeHash(plainTextArray);

                                if (hmacArray.SequenceEqual(computedHashArray))
                                {
                                    plainText = Encoding.UTF8.GetString(plainTextArray);
                                }
                                else
                                {
                                    plainText = default(string);
                                }
                            }
                        }
                    }
                }
            }
        }

        private static byte[] GenerateSalt()
        {
            byte[] salt = new byte[size];
            using (RNGCryptoServiceProvider rng = new RNGCryptoServiceProvider())
            {
                rng.GetBytes(salt);
            }
            return salt;
        }
    }
}
