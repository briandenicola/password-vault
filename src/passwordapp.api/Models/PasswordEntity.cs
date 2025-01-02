namespace PasswordService.Models
{
    public class PasswordEntity
    {
        public string? EncryptedPassword { get; set;}
        public string? HmacHash { get; set; }

        public PasswordEntity()
        {
            EncryptedPassword = HmacHash = string.Empty;
        }

        public PasswordEntity( string encryptedPassword ) 
        {
            var cipherText = encryptedPassword.Split(':');
            EncryptedPassword = cipherText[1];
            HmacHash = cipherText[0];
        }

        public PasswordEntity( string hmacHash, string encryptedPassword ) 
        {
            EncryptedPassword = encryptedPassword;
            HmacHash = hmacHash;
        }

        public override string ToString() 
        {
            return $"{ HmacHash }:{ EncryptedPassword }";
        }
    }

}

