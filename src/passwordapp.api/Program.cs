using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.DependencyInjection;
using PasswordService.Common;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();

// AC-1/AC-2: server-side Entra token validation. HTTP triggers are Anonymous, so this middleware
// is the only guard — it is fail-closed (enabled unless AUTH_ENABLED is explicitly "false").
var authOptions = EntraAuthOptions.FromConfiguration(Environment.GetEnvironmentVariable);
builder.Services.AddSingleton(authOptions);
builder.Services.AddSingleton<JwtAuthenticationMiddleware>();
builder.UseMiddleware<JwtAuthenticationMiddleware>();

builder.Build().Run();