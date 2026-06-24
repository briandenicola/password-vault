namespace PasswordService.Models
{
    // OFF-4 §5B: the per-vault "vault key record". The server stores this opaquely
    // (zero-knowledge): it holds the non-secret PRF salt and the DEK wrapped once per
    // enrolled passkey / recovery key. The server never sees the DEK, the KEK, or any
    // plaintext — it cannot unwrap anything here.
    public class VaultKeyRecord
    {
        public string? id { get; set; }
        public string? PartitionKey { get; set; }
        public string? PrfSalt { get; set; }
        public List<WrappedDek>? WrappedDeks { get; set; }
        public DateTime LastModifiedDate { get; set; }
    }

    public class WrappedDek
    {
        public string? CredentialId { get; set; }
        public string? Label { get; set; }
        public string? Wrapped { get; set; }
    }
}
