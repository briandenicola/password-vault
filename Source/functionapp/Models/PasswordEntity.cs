using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace PasswordService.Models
{
    public class PasswordEntity
    {
        public string EncryptedPassword { get; set;}
        public string HmacHash { get; set; }

        public PasswordEntity()
        {
            this.EncryptedPassword = this.HmacHash = string.Empty;
        }

        public PasswordEntity( string encryptedPassword ) 
        {
            var cipherText = encryptedPassword.Split(':');
            this.EncryptedPassword = cipherText[1];
            this.HmacHash = cipherText[0];
        }

        public PasswordEntity( string hmacHash, string encryptedPassword ) 
        {
            this.EncryptedPassword = encryptedPassword;
            this.HmacHash = hmacHash;
        }

        public override string ToString() 
        {
            return $"{ this.HmacHash }:{ this.EncryptedPassword }";
        }
    }

}

