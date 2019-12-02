using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using PasswordService.Common;

namespace PasswordService.Models
{
    public class PasswordHistory
    {
        public PasswordEntity Password { get; set; }
        public DateTime CreatedDate { get; set; }

        public string DecryptPassword( Encryptor e ) {
            e.Decrypt(Password.EncryptedPassword, Password.HmacHash, out string decryptedPassword);
            return decryptedPassword;
        }   
    }

}

