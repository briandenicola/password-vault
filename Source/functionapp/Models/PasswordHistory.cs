using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace PasswordService.Models
{
    public class PasswordHistory
    {
        public PasswordEntity Password { get; set; }
        public DateTime CreatedDate { get; set; }
    }

}

