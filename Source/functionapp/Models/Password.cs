using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace PasswordService.Models
{
    public class AccountPasswords
    {
        public string PartitionKey { get; set; }
        public string id { get; set; }
        public string SiteName { get; set; }
        public string AccountName { get; set; }
        public string CurrentPassword { get; set; }
        public List<Password> OldPasswords { get; set; }
        public string Notes { get; set; }
        public List<Questions> SecurityQuestions { get; set; }
        public bool isDeleted { get; set; }
        public DateTime CreatedDate { get; set; }
        public string CreatedBy { get; set; }
        public DateTime LastModifiedDate { get; set; }
        public string LastModifiedBy { get; set; }
    }

    public class Password
    {
        public string PreviousPassword { get; set; }
        public DateTime CreatedDate { get; set; }
    }

    public class Questions
    {
        public string Question { get; set; }
        public string Answer { get; set; }
    }
}

