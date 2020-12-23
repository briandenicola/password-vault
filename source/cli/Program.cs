using System.Net.Http;
using System.Threading.Tasks;
using System.CommandLine;
using System.CommandLine.Invocation;
using Microsoft.Identity.Client;
using password.vault.cli;

if(args.Length == 0 ) 
    args = new string[1] { "-h" };

var rootCommand = new RootCommand
{
    new Option<string>(new [] {"--passwordid", "-i"},description: "The id of the password to get the history from."),
};

rootCommand.Description = "A console app display a account's password history from the vault";
rootCommand.Handler = CommandHandler.Create<string>( async (passwordid) => {   
    PasswordConfiguration config = PasswordConfiguration.ReadFromJsonFile("appsettings.json");

    var appConfig = config.PublicClientApplicationOptions;
    var app = PublicClientApplicationBuilder.CreateWithApplicationOptions(appConfig)
        .WithRedirectUri("http://localhost")  
        .Build();

    var httpClient = new HttpClient();

    Passwords p = new Passwords(app, httpClient, config.PasswordApiEndpoint, config.PasswordApiCode, config.PasswordAPiScope, passwordid);
    await p.DisplayPasswwordHistory();

});

return  rootCommand.InvokeAsync(args).Result;