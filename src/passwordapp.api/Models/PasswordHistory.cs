namespace PasswordService.Models
{
    public class PasswordHistory
    {
        public PasswordEntity? Password { get; set; }
        public DateTime CreatedDate { get; set; }

        public string DecryptPassword( Encryptor e ) {
            if(Password?.EncryptedPassword == null) {
                return string.Empty;
            }
            // Reconstruct the stored blob (v1 or v2) and let the encryptor route by version.
            return e.DecryptStored(Password.ToString()) ?? string.Empty;
        }   
    }

}

