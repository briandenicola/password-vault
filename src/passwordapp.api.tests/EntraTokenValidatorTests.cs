using System.Security.Cryptography;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using PasswordService.Common;

namespace PasswordService.Tests
{
    public class EntraTokenValidatorTests
    {
        private const string Issuer = "https://login.microsoftonline.com/test-tenant/v2.0";
        private const string Audience = "api://password-vault";
        private const string Oid = "11111111-1111-1111-1111-111111111111";

        // A stable symmetric key for signing/validating in tests. Entra uses RSA, but the
        // validation logic under test is signature-algorithm agnostic; symmetric keeps the
        // tests deterministic and dependency-free.
        private static readonly byte[] KeyBytes = CreateKey();
        private static readonly SymmetricSecurityKey SigningKey = new(KeyBytes);

        private static byte[] CreateKey()
        {
            var bytes = new byte[32];
            RandomNumberGenerator.Fill(bytes);
            return bytes;
        }

        private static string CreateToken(
            SecurityKey key,
            string issuer = Issuer,
            string audience = Audience,
            string? oid = Oid,
            DateTime? expires = null,
            DateTime? notBefore = null)
        {
            var claims = new Dictionary<string, object>();
            if (oid is not null)
            {
                claims["oid"] = oid;
            }

            var descriptor = new SecurityTokenDescriptor
            {
                Issuer = issuer,
                Audience = audience,
                IssuedAt = DateTime.UtcNow.AddMinutes(-2),
                NotBefore = notBefore ?? DateTime.UtcNow.AddMinutes(-2),
                Expires = expires ?? DateTime.UtcNow.AddMinutes(10),
                SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
                Claims = claims,
            };

            return new JsonWebTokenHandler().CreateToken(descriptor);
        }

        private static TokenValidationParameters Params(
            SecurityKey key,
            string issuer = Issuer,
            string audience = Audience)
        {
            return new TokenValidationParameters
            {
                ValidIssuer = issuer,
                ValidateIssuer = true,
                ValidAudience = audience,
                ValidateAudience = true,
                IssuerSigningKey = key,
                ValidateIssuerSigningKey = true,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero,
            };
        }

        private static string Bearer(string token) => $"Bearer {token}";

        [Fact]
        public async Task Valid_token_succeeds_and_extracts_oid()
        {
            var token = CreateToken(SigningKey);

            var result = await EntraTokenValidator.ValidateAsync(
                Bearer(token), Params(SigningKey), Array.Empty<string>());

            Assert.True(result.Succeeded);
            Assert.Null(result.FailureReason);
            Assert.Equal(Oid, result.ObjectId);
        }

        [Fact]
        public async Task Missing_header_fails()
        {
            var result = await EntraTokenValidator.ValidateAsync(
                null, Params(SigningKey), Array.Empty<string>());

            Assert.False(result.Succeeded);
            Assert.Contains("Authorization", result.FailureReason);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("Basic abc123")]
        [InlineData("Bearer")]
        [InlineData("Bearer    ")]
        public async Task Malformed_header_fails(string header)
        {
            var result = await EntraTokenValidator.ValidateAsync(
                header, Params(SigningKey), Array.Empty<string>());

            Assert.False(result.Succeeded);
        }

        [Fact]
        public async Task Expired_token_fails()
        {
            var token = CreateToken(
                SigningKey,
                notBefore: DateTime.UtcNow.AddMinutes(-10),
                expires: DateTime.UtcNow.AddMinutes(-5));

            var result = await EntraTokenValidator.ValidateAsync(
                Bearer(token), Params(SigningKey), Array.Empty<string>());

            Assert.False(result.Succeeded);
        }

        [Fact]
        public async Task Wrong_audience_fails()
        {
            var token = CreateToken(SigningKey, audience: "api://someone-else");

            var result = await EntraTokenValidator.ValidateAsync(
                Bearer(token), Params(SigningKey), Array.Empty<string>());

            Assert.False(result.Succeeded);
        }

        [Fact]
        public async Task Wrong_issuer_fails()
        {
            var token = CreateToken(SigningKey, issuer: "https://login.microsoftonline.com/evil/v2.0");

            var result = await EntraTokenValidator.ValidateAsync(
                Bearer(token), Params(SigningKey), Array.Empty<string>());

            Assert.False(result.Succeeded);
        }

        [Fact]
        public async Task Token_signed_with_other_key_fails()
        {
            var attackerKey = new SymmetricSecurityKey(CreateKey());
            var token = CreateToken(attackerKey);

            // Validate against the legitimate key.
            var result = await EntraTokenValidator.ValidateAsync(
                Bearer(token), Params(SigningKey), Array.Empty<string>());

            Assert.False(result.Succeeded);
        }

        [Fact]
        public async Task Allowlist_rejects_oid_not_in_list()
        {
            var token = CreateToken(SigningKey, oid: Oid);

            var result = await EntraTokenValidator.ValidateAsync(
                Bearer(token), Params(SigningKey), new[] { "different-oid" });

            Assert.False(result.Succeeded);
            Assert.Contains("allowed users", result.FailureReason);
        }

        [Fact]
        public async Task Allowlist_allows_oid_in_list()
        {
            var token = CreateToken(SigningKey, oid: Oid);

            var result = await EntraTokenValidator.ValidateAsync(
                Bearer(token), Params(SigningKey), new[] { "other", Oid });

            Assert.True(result.Succeeded);
            Assert.Equal(Oid, result.ObjectId);
        }

        [Fact]
        public async Task Allowlist_set_but_token_has_no_oid_fails()
        {
            var token = CreateToken(SigningKey, oid: null);

            var result = await EntraTokenValidator.ValidateAsync(
                Bearer(token), Params(SigningKey), new[] { Oid });

            Assert.False(result.Succeeded);
        }

        [Theory]
        [InlineData(null, null)]
        [InlineData("", null)]
        [InlineData("Bearer ", null)]
        [InlineData("token-without-scheme", null)]
        [InlineData("Bearer abc.def.ghi", "abc.def.ghi")]
        [InlineData("bearer abc.def.ghi", "abc.def.ghi")]
        [InlineData("Bearer   spaced.token  ", "spaced.token")]
        public void ExtractBearer_parses_header(string? header, string? expected)
        {
            Assert.Equal(expected, EntraTokenValidator.ExtractBearer(header));
        }

        [Fact]
        public void Options_from_configuration_parses_flag_and_lists()
        {
            var settings = new Dictionary<string, string?>
            {
                ["AUTH_ENABLED"] = "true",
                ["AAD_TENANT_ID"] = "test-tenant",
                ["AAD_AUDIENCE"] = "api://password-vault, api://alt",
                ["AAD_ALLOWED_OIDS"] = "oid-1, oid-2",
            };

            var options = EntraAuthOptions.FromConfiguration(k => settings.GetValueOrDefault(k));

            Assert.True(options.Enabled);
            Assert.Equal(new[] { "api://password-vault", "api://alt" }, options.Audiences);
            Assert.Equal(new[] { "oid-1", "oid-2" }, options.AllowedObjectIds);
            Assert.Equal("https://login.microsoftonline.com/test-tenant/v2.0", options.V2Issuer);
        }

        [Fact]
        public void Options_are_fail_closed_when_nothing_is_configured()
        {
            // AC-2: HTTP triggers are Anonymous, so a missing/unset AUTH_ENABLED must leave
            // validation ON (fail-closed) — never expose the API by default.
            var options = EntraAuthOptions.FromConfiguration(_ => null);

            Assert.True(options.Enabled);
            Assert.Empty(options.Audiences);
            Assert.Empty(options.AllowedObjectIds);
        }

        [Fact]
        public void Enabled_options_require_tenant_id()
        {
            var settings = new Dictionary<string, string?>
            {
                ["AAD_AUDIENCE"] = Audience,
            };
            var options = EntraAuthOptions.FromConfiguration(k => settings.GetValueOrDefault(k));

            var ex = Assert.Throws<InvalidOperationException>(options.Validate);

            Assert.Contains("AAD_TENANT_ID", ex.Message);
        }

        [Fact]
        public void Enabled_options_require_audience()
        {
            var settings = new Dictionary<string, string?>
            {
                ["AAD_TENANT_ID"] = "test-tenant",
            };
            var options = EntraAuthOptions.FromConfiguration(k => settings.GetValueOrDefault(k));

            var ex = Assert.Throws<InvalidOperationException>(options.Validate);

            Assert.Contains("AAD_AUDIENCE", ex.Message);
        }

        [Fact]
        public void Enabled_options_validate_when_tenant_and_audience_are_present()
        {
            var settings = new Dictionary<string, string?>
            {
                ["AAD_TENANT_ID"] = "test-tenant",
                ["AAD_AUDIENCE"] = Audience,
            };
            var options = EntraAuthOptions.FromConfiguration(k => settings.GetValueOrDefault(k));

            options.Validate();
        }

        [Fact]
        public void Disabled_options_do_not_require_tenant_or_audience()
        {
            var settings = new Dictionary<string, string?> { ["AUTH_ENABLED"] = "false" };
            var options = EntraAuthOptions.FromConfiguration(k => settings.GetValueOrDefault(k));

            options.Validate();
        }

        [Theory]
        [InlineData("true")]
        [InlineData("TRUE")]
        [InlineData("anything-else")]
        [InlineData("")]
        public void Options_stay_enabled_unless_flag_is_explicitly_false(string value)
        {
            var settings = new Dictionary<string, string?> { ["AUTH_ENABLED"] = value };
            var options = EntraAuthOptions.FromConfiguration(k => settings.GetValueOrDefault(k));
            Assert.True(options.Enabled);
        }

        [Theory]
        [InlineData("false")]
        [InlineData("False")]
        [InlineData("FALSE")]
        public void Options_only_disable_on_explicit_false(string value)
        {
            // The single deliberate escape hatch for local/offline dev.
            var settings = new Dictionary<string, string?> { ["AUTH_ENABLED"] = value };
            var options = EntraAuthOptions.FromConfiguration(k => settings.GetValueOrDefault(k));
            Assert.False(options.Enabled);
        }
    }
}
