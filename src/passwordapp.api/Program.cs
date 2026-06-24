using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.DependencyInjection;
using PasswordService.Common;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();

// AC-1: server-side Entra token validation. Gated by AUTH_ENABLED (default off) so it can be
// rolled out per environment without breaking the existing function-key path.
var authOptions = EntraAuthOptions.FromConfiguration(Environment.GetEnvironmentVariable);
builder.Services.AddSingleton(authOptions);
builder.Services.AddSingleton<JwtAuthenticationMiddleware>();
builder.UseMiddleware<JwtAuthenticationMiddleware>();

builder.Build().Run();