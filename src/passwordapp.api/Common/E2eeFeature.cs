namespace PasswordService.Common
{
    // OFF-4 Phase 2: gate the client-side-encryption (E2EE) endpoints (vault key store).
    // Default OFF — only the explicit string "true" enables it, mirroring the UI's
    // VUE_APP_E2EE flag so server and client roll out together.
    public static class E2eeFeature
    {
        public const string EnvVar = "E2EE_ENABLED";

        public static bool IsEnabled(Func<string, string?> getEnv)
        {
            if (getEnv is null) return false;
            var value = getEnv(EnvVar);
            return string.Equals(value?.Trim(), "true", StringComparison.OrdinalIgnoreCase);
        }
    }
}
