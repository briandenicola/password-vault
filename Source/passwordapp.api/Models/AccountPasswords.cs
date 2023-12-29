using System;
using System.Collections.Generic;
using PasswordService.Common;

namespace PasswordService.Models
{
    public class AccountPassword
    {
        public string PartitionKey { get; set; }
        public string id { get; set; }
        public string SiteName { get; set; }
        public string AccountName { get; set; }
        public string CurrentPassword { get; set; }
        public List<PasswordHistory> OldPasswords { get; set; }
        public string Notes { get; set; }
        public List<Questions> SecurityQuestions { get; set; }
        public bool isDeleted { get; set; }
        public DateTime CreatedDate { get; set; }
        public string CreatedBy { get; set; }
        public DateTime LastModifiedDate { get; set; }
        public string LastModifiedBy { get; set; }

        public AccountPassword Clone() 
        {
            return new AccountPassword()
            {
                id = this.id,
                PartitionKey = this.PartitionKey,
                SiteName = this.SiteName,
                AccountName = this.AccountName,
                Notes = this.Notes,
                SecurityQuestions = this.SecurityQuestions,
                CreatedDate = this.CreatedDate,
                CreatedBy = this.CreatedBy,
                LastModifiedDate = this.LastModifiedDate,
                LastModifiedBy = this.LastModifiedBy,
                CurrentPassword = this.CurrentPassword
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
            string originalEncryptedPassword = this.CurrentPassword;
            string currentPassword = this.DecryptPassword(e);

            if (String.Compare(newPassword, currentPassword, false) != 0)
            {
                if (this.OldPasswords == null) {
                    this.OldPasswords = new List<PasswordHistory>();
                }
                this.OldPasswords.Add(new PasswordHistory()
                {
                    Password = new PasswordEntity(originalEncryptedPassword),
                    CreatedDate = lastModifiedDate
                });
            }

            this.CurrentPassword = this.EncryptPassword(e, newPassword);
        }

        public string DecryptPassword( Encryptor e ) 
        {
            var p = new PasswordEntity(this.CurrentPassword);
            e.Decrypt(p.EncryptedPassword, p.HmacHash, out string decryptedPassword);
            return decryptedPassword;
        }   

        public string EncryptPassword( Encryptor e ) 
        {
            var hash = e.Encrypt(this.CurrentPassword, out string encryptedPassword);
            return new PasswordEntity(hash,encryptedPassword).ToString();
        } 

        public string EncryptPassword( Encryptor e, string newPassword ) 
        {
            var hash = e.Encrypt(newPassword, out string encryptedPassword);
            return new PasswordEntity(hash,encryptedPassword).ToString();
        }   

    }

}
