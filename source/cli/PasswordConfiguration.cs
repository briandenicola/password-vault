using System;
using Microsoft.Extensions.Configuration;
using Microsoft.Identity.Client;

namespace password.vault.cli
{
    public class PasswordConfiguration
    {
        public PublicClientApplicationOptions PublicClientApplicationOptions { get; set; }
        public string PasswordApiEndpoint { get; set; }
        public string PasswordApiUri { get; set; }
        public string PasswordApiCode { get; set; }
        public string PasswordAPiScope { get; set; }
       
        public static PasswordConfiguration ReadFromJsonFile(string path)
        {
            IConfigurationRoot Configuration;

            var builder = new ConfigurationBuilder()
                .SetBasePath(AppContext.BaseDirectory)
                .AddJsonFile(path);

            Configuration = builder.Build();
            PasswordConfiguration config = new PasswordConfiguration()
            {
                PublicClientApplicationOptions = new PublicClientApplicationOptions()
            };
            Configuration.Bind("Authentication", config.PublicClientApplicationOptions);

            config.PasswordApiEndpoint = Configuration.GetValue<string>("PasswordApi:Endpoint");
            config.PasswordApiCode = Configuration.GetValue<string>("PasswordApi:ApiCode");
            config.PasswordAPiScope = Configuration.GetValue<string>("PasswordApi:Scope");

            return config;
        }
    }
}


