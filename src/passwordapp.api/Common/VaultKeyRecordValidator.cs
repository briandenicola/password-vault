using PasswordService.Models;

namespace PasswordService.Common
{
    // Pure, unit-tested validation for the OFF-4 §5B vault key record. The server is
    // zero-knowledge: it never inspects or decrypts the wrapped DEKs / PRF salt. It only
    // checks the envelope is well-formed so a malformed or empty record can't be written
    // and silently lock the family out of the vault.
    public static class VaultKeyRecordValidator
    {
        // Singleton per vault — the server always forces this id.
        public const string RecordId = "vault-key-record";

        // Returns null when valid, otherwise a human-readable error message.
        public static string? Validate(VaultKeyRecord? record)
        {
            if (record is null)
                return "vault key record is required";

            if (!string.IsNullOrEmpty(record.id) && record.id != RecordId)
                return $"id must be '{RecordId}'";

            if (string.IsNullOrWhiteSpace(record.PrfSalt) || !IsBase64(record.PrfSalt))
                return "prfSalt must be a non-empty base64 string";

            if (record.WrappedDeks is null || record.WrappedDeks.Count == 0)
                return "at least one wrapped DEK is required";

            var credentialIds = new HashSet<string>(StringComparer.Ordinal);
            foreach (var dek in record.WrappedDeks)
            {
                if (dek is null)
                    return "wrapped DEK entry cannot be null";
                if (string.IsNullOrWhiteSpace(dek.CredentialId))
                    return "wrapped DEK credentialId is required";
                if (string.IsNullOrWhiteSpace(dek.Wrapped) || !IsBase64(dek.Wrapped))
                    return "wrapped DEK 'wrapped' must be a non-empty base64 string";
                if (!credentialIds.Add(dek.CredentialId!))
                    return "wrapped DEK credentialIds must be unique";
            }

            return null;
        }

        private static bool IsBase64(string value)
        {
            var buffer = new byte[value.Length];
            return Convert.TryFromBase64String(value, buffer, out _);
        }
    }
}
