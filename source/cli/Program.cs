using System.CommandLine;
using System.CommandLine.Invocation;
using Microsoft.Identity.Client;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Console;

using password.vault.cli;

if(args.Length == 0 ) 
    args = new string[1] { "-h" };

var rootCommand = new RootCommand
{
    new Option<string>(new [] {"--passwordid", "-i"},description: "The id of the password to get the history from."),
};

rootCommand.Description = "A console app display a account's password history from the vault";
rootCommand.Handler = CommandHandler.Create<string>( async (passwordid) => {

    ILoggerFactory loggerFactory = LoggerFactory.Create(builder =>
        builder
            .AddFilter("Password.Vault.Cli.Passwords", LoggerConfiguration.ReadFromJsonFile("appsettings.json"))
            .AddConsole()
            .AddSimpleConsole(options =>
            {
                options.SingleLine = true;
                options.TimestampFormat = "hh:mm:ss ";
            })
        
    );

    PasswordConfiguration config = PasswordConfiguration.ReadFromJsonFile("appsettings.json");

    var appConfig = config.PublicClientApplicationOptions;
    var app = PublicClientApplicationBuilder.CreateWithApplicationOptions(appConfig)
        .WithRedirectUri("http://localhost")  
        .Build();

    ILogger<Passwords> logger = loggerFactory.CreateLogger<Passwords>();
    Passwords p = new Passwords(app, config, logger);
    await p.GetPasswordHistory(passwordid);
});

return  rootCommand.InvokeAsync(args).Result;