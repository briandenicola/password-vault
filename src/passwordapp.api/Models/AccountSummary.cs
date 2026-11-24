namespace PasswordService.Models
{
    /// <summary>
    /// The account-list view of an <see cref="AccountPassword"/>. GetAllPasswords returns this
    /// instead of the full document so the list response does not carry the encrypted current
    /// password or the full password history. The UI never uses either from the list: passwords
    /// come from GetPasswordById and history from GetPasswordHistoryById. History in particular
    /// grows with every password change, and it made the first load slower over time.
    /// </summary>
    public sealed class AccountSummary
    {
        public string? id { get; init; }
        public string? SiteName { get; init; }
        public string? AccountName { get; init; }
        public List<string>? Tags { get; init; }
        public string? Notes { get; init; }
        public List<Questions>? SecurityQuestions { get; init; }
        public bool isDeleted { get; init; }
        public DateTime CreatedDate { get; init; }
        public string? CreatedBy { get; init; }
        public DateTime LastModifiedDate { get; init; }
        public string? LastModifiedBy { get; init; }

        public static AccountSummary From(AccountPassword account) => new()
        {
            id = account.id,
            SiteName = account.SiteName,
            AccountName = account.AccountName,
            Tags = account.Tags,
            Notes = account.Notes,
            SecurityQuestions = account.SecurityQuestions,
            isDeleted = account.isDeleted,
            CreatedDate = account.CreatedDate,
            CreatedBy = account.CreatedBy,
            LastModifiedDate = account.LastModifiedDate,
            LastModifiedBy = account.LastModifiedBy,
        };
    }
}
