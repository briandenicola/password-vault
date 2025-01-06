using System.CommandLine;
using System.CommandLine.Invocation;
using Microsoft.Extensions.Logging;

using password.vault.cli;

if(args.Length == 0 ) 
    args = new string[1] { "-h" };

var rootCommand = new RootCommand
{
    new Option<string>(new [] {"--passwordid", "-i"},description: "The id of the password to get the history from."),
    new Option<LogLevel?>(new [] {"--logLevel", "-l"},description: "Set logging level."),
};

rootCommand.Description = "A console app display a account's password history from the vault";
rootCommand.Handler = CommandHandler.Create<string,LogLevel?>(PasswordHandler.SendRequest);
return rootCommand.InvokeAsync(args).Result;