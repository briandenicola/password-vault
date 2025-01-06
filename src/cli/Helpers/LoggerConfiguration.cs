using System;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace password.vault.cli
{
    public class LoggerConfiguration
    {
        public static LogLevel ReadFromJsonFile(string path)
        {
            IConfigurationRoot config = new ConfigurationBuilder()
                .SetBasePath(AppContext.BaseDirectory)
                .AddJsonFile(path)
                .Build();

            var level = config.GetValue<LogLevel>("Logging:LogLevel:Default");
            return level;
        }
    }
}


