namespace PasswordService.Models
{
    public class AccountPassword
    {
        public string? PartitionKey { get; set; }
        public string? id { get; set; }
        public string? SiteName { get; set; }
        public string? AccountName { get; set; }
        public string? CurrentPassword { get; set; }
        public List<PasswordHistory>? OldPasswords { get; set; }
        public string? Notes { get; set; }
        public List<Questions>? SecurityQuestions { get; set; }
        public bool isDeleted { get; set; }
        public DateTime CreatedDate { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime LastModifiedDate { get; set; }
        public string? LastModifiedBy { get; set; }

        public AccountPassword Clone() 
        {
            return new AccountPassword()
            {
                id = id,
                PartitionKey = PartitionKey,
                SiteName = SiteName,
                AccountName = AccountName,
                Notes = Notes,
                SecurityQuestions = SecurityQuestions,
                CreatedDate = CreatedDate,
                CreatedBy = CreatedBy,
                LastModifiedDate = LastModifiedDate,
                LastModifiedBy = LastModifiedBy,
                CurrentPassword = CurrentPassword
            };
        }

        public void GenerateId( ) {
            id = Guid.NewGuid().ToString();
        }

        public void SavePassword(Encryptor e, string password) 
        {   
            this.CurrentPassword = this.EncryptPassword(e, password);
        }

        public void UpdatePassword(Encryptor e, string newPassword, DateTime lastModifiedDate )
        {
            if (CurrentPassword == null) return;
    
            string originalEncryptedPassword = CurrentPassword;
            string currentPasswordDecrypted = DecryptPassword(e);

            if (String.Compare(newPassword, currentPasswordDecrypted, false) != 0)
            {
                if (OldPasswords == null) {
                    OldPasswords = new List<PasswordHistory>();
                }
                OldPasswords.Add(new PasswordHistory()
                {
                    Password = new PasswordEntity(originalEncryptedPassword),
                    CreatedDate = lastModifiedDate
                });
            }

            this.CurrentPassword = EncryptPassword(e, newPassword);
        }

        public string DecryptPassword( Encryptor e ) 
        {
            if (CurrentPassword == null) return string.Empty;
            
            var p = new PasswordEntity(CurrentPassword);
            if(p.EncryptedPassword == null || p.HmacHash == null) {
                return string.Empty;
            }

            e.Decrypt(p.EncryptedPassword, p.HmacHash, out string? decryptedPassword);
            return decryptedPassword ?? string.Empty;
        }   

        public string EncryptPassword( Encryptor e ) 
        {
            if (CurrentPassword == null) return string.Empty;
            var hash = e.Encrypt(CurrentPassword, out string? encryptedPassword);

            if(encryptedPassword == null) return string.Empty;
            return new PasswordEntity(hash,encryptedPassword).ToString();
        } 

        public string EncryptPassword( Encryptor e, string newPassword ) 
        {
            if (newPassword == null) return string.Empty;   
            var hash = e.Encrypt(newPassword, out string? encryptedPassword);

            if(encryptedPassword == null) return string.Empty;
            return new PasswordEntity(hash,encryptedPassword).ToString();
        }   

    }

}
