namespace PasswordService.Models
{
    public class PasswordHistory
    {
        public PasswordEntity? Password { get; set; }
        public DateTime CreatedDate { get; set; }

        public string DecryptPassword( Encryptor e ) {
            if(Password?.EncryptedPassword == null || Password.HmacHash == null) {
                return string.Empty;
            }
            else {
                e.Decrypt(Password.EncryptedPassword, Password.HmacHash, out string? decryptedPassword);
                return decryptedPassword ?? string.Empty;
            }
        }   
    }

}

