using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace PasswordService.Common
{
    /// <summary>
    /// Isolated-worker middleware that enforces a valid Entra (Azure AD) bearer token on every
    /// HTTP-triggered function (AC-1). Security-critical validation lives in the pure, unit-tested
    /// <see cref="EntraTokenValidator"/>; this class is only the glue that wires in Entra's OIDC
    /// signing keys and short-circuits the pipeline with 401 on failure.
    ///
    /// Behaviour is gated by <see cref="EntraAuthOptions.Enabled"/> (AUTH_ENABLED). When disabled
    /// the middleware is a no-op, so existing function-key auth keeps working until an operator
    /// turns validation on per-environment.
    /// </summary>
    public sealed class JwtAuthenticationMiddleware : IFunctionsWorkerMiddleware
    {
        // Health check stays open so probes don't need a token.
        private static readonly HashSet<string> AnonymousFunctions =
            new(StringComparer.OrdinalIgnoreCase) { "GetApiStatus" };

        private readonly EntraAuthOptions _options;
        private readonly ILogger<JwtAuthenticationMiddleware> _logger;
        private readonly ConfigurationManager<OpenIdConnectConfiguration>? _configManager;

        public JwtAuthenticationMiddleware(EntraAuthOptions options, ILogger<JwtAuthenticationMiddleware> logger)
        {
            _options = options;
            _logger = logger;

            if (_options.Enabled)
            {
                // Caches the JWKS and refreshes on its own schedule.
                _configManager = new ConfigurationManager<OpenIdConnectConfiguration>(
                    _options.MetadataAddress,
                    new OpenIdConnectConfigurationRetriever());
            }
        }

        public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
        {
            if (!_options.Enabled || AnonymousFunctions.Contains(context.FunctionDefinition.Name))
            {
                await next(context);
                return;
            }

            var httpContext = context.GetHttpContext();
            if (httpContext is null)
            {
                // Not an HTTP trigger (e.g. timer) — nothing to authenticate.
                await next(context);
                return;
            }

            string? authHeader = httpContext.Request.Headers.Authorization.FirstOrDefault();

            var oidcConfig = await _configManager!.GetConfigurationAsync(context.CancellationToken);
            var validationParameters = new TokenValidationParameters
            {
                ValidIssuer = oidcConfig.Issuer,
                ValidateIssuer = true,
                ValidAudiences = _options.Audiences,
                ValidateAudience = _options.Audiences.Count > 0,
                IssuerSigningKeys = oidcConfig.SigningKeys,
                ValidateIssuerSigningKey = true,
                ValidateLifetime = true,
            };

            var result = await EntraTokenValidator.ValidateAsync(
                authHeader, validationParameters, _options.AllowedObjectIds, context.CancellationToken);

            if (!result.Succeeded)
            {
                _logger.LogWarning("Rejected {Function}: {Reason}",
                    context.FunctionDefinition.Name, result.FailureReason);

                httpContext.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await httpContext.Response.WriteAsJsonAsync(new { error = "unauthorized" });
                return; // short-circuit: do not invoke the function
            }

            await next(context);
        }
    }
}
