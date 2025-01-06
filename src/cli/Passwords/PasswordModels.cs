using System;

namespace password.vault.models
{
    public class PasswordHistory
    {
        public string   Password    { get; set; }
        public string   SiteName    { get; set; }
        public DateTime TimeStamp   { get; set; }  
    }

}