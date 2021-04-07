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
        public string PasswordApiScope { get; set; }
        public string PasswordClientId { get; set; }
       
        public static PasswordConfiguration ReadFromJsonFile(string path, string id)
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
            config.PasswordApiScope = Configuration.GetValue<string>("PasswordApi:Scope");
            config.PasswordClientId = id;

            return config;
        }
    }
}


