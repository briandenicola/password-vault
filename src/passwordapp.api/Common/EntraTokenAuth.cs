using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace PasswordService.Common
{
    /// <summary>
    /// Configuration for server-side Entra (Azure AD) token validation.
    /// Sourced from environment / app settings so it can be toggled per environment
    /// without a redeploy. Access is gated by <see cref="Enabled"/> (AC-1 feature flag).
    /// </summary>
    public sealed class EntraAuthOptions
    {
        /// <summary>Master switch. When false the API does not validate bearer tokens.</summary>
        public bool Enabled { get; init; }

        /// <summary>Entra tenant (directory) id. Used to build the issuer + metadata address.</summary>
        public string? TenantId { get; init; }

        /// <summary>Accepted audiences (the API's app-id-URI and/or client id).</summary>
        public IReadOnlyList<string> Audiences { get; init; } = Array.Empty<string>();

        /// <summary>
        /// Optional allowlist of caller object-ids (<c>oid</c>). Empty means "rely on the
        /// Enterprise App group assignment" — any validly-issued token for the audience is accepted.
        /// </summary>
        public IReadOnlyList<string> AllowedObjectIds { get; init; } = Array.Empty<string>();

        /// <summary>The v2.0 issuer Entra stamps into tokens for this tenant.</summary>
        public string V2Issuer => $"https://login.microsoftonline.com/{TenantId}/v2.0";

        /// <summary>The OIDC metadata document Entra publishes for this tenant.</summary>
        public string MetadataAddress => $"https://login.microsoftonline.com/{TenantId}/v2.0/.well-known/openid-configuration";

        /// <summary>Build options from a key/value lookup (typically environment variables).</summary>
        public static EntraAuthOptions FromConfiguration(Func<string, string?> get)
        {
            return new EntraAuthOptions
            {
                Enabled = string.Equals(get("AUTH_ENABLED"), "true", StringComparison.OrdinalIgnoreCase),
                TenantId = get("AAD_TENANT_ID"),
                Audiences = Split(get("AAD_AUDIENCE")),
                AllowedObjectIds = Split(get("AAD_ALLOWED_OIDS")),
            };
        }

        private static IReadOnlyList<string> Split(string? raw) =>
            string.IsNullOrWhiteSpace(raw)
                ? Array.Empty<string>()
                : raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    /// <summary>Outcome of validating an incoming Authorization header.</summary>
    public readonly record struct AuthResult(bool Succeeded, string? FailureReason, string? ObjectId)
    {
        public static AuthResult Ok(string? oid) => new(true, null, oid);
        public static AuthResult Fail(string reason) => new(false, reason, null);
    }

    /// <summary>
    /// Pure Entra token validation — no network, no Functions dependencies — so it can be
    /// unit-tested in isolation. The production middleware supplies the signing keys and issuer
    /// (fetched from Entra's OIDC metadata) via <paramref name="validationParameters"/>.
    /// </summary>
    public static class EntraTokenValidator
    {
        private const string ObjectIdClaim = "oid";

        public static async Task<AuthResult> ValidateAsync(
            string? authorizationHeader,
            TokenValidationParameters validationParameters,
            IReadOnlyCollection<string> allowedObjectIds,
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var token = ExtractBearer(authorizationHeader);
            if (token is null)
            {
                return AuthResult.Fail("Missing or malformed Authorization header.");
            }

            var handler = new JsonWebTokenHandler();
            var result = await handler.ValidateTokenAsync(token, validationParameters);
            if (!result.IsValid)
            {
                return AuthResult.Fail(result.Exception?.Message ?? "Token validation failed.");
            }

            string? objectId = null;
            if (result.Claims.TryGetValue(ObjectIdClaim, out var oidValue))
            {
                objectId = oidValue?.ToString();
            }

            if (allowedObjectIds.Count > 0 &&
                (objectId is null || !allowedObjectIds.Contains(objectId)))
            {
                return AuthResult.Fail("Caller is not in the allowed users list.");
            }

            return AuthResult.Ok(objectId);
        }

        /// <summary>Extract the raw JWT from a <c>Bearer &lt;token&gt;</c> header, or null if absent/malformed.</summary>
        public static string? ExtractBearer(string? header)
        {
            if (string.IsNullOrWhiteSpace(header))
            {
                return null;
            }

            const string prefix = "Bearer ";
            if (!header.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            var token = header.Substring(prefix.Length).Trim();
            return token.Length == 0 ? null : token;
        }
    }
}
