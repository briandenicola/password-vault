using System;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace password.vault.cli
{
    public class LoggerConfiguration
    {
        public static LogLevel ReadFromJsonFile(string path)
        {
            IConfigurationRoot Configuration;

            var builder = new ConfigurationBuilder()
                .SetBasePath(AppContext.BaseDirectory)
                .AddJsonFile(path);

            Configuration = builder.Build();

            var level = Configuration.GetValue<LogLevel>("Logging:LogLevel:Default");
            return level;
        }
    }
}


