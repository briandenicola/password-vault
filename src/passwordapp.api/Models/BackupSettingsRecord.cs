namespace PasswordService.Models
{
    public class BackupSettingsRecord
    {
        public const string RecordId = "backup-settings";

        public string? id { get; set; } = RecordId;
        public string? PartitionKey { get; set; }
        public bool Enabled { get; set; }
        public string Frequency { get; set; } = "daily";
        public string TimeOfDay { get; set; } = "02:00";
        public string TimeZoneId { get; set; } = "UTC";
        public DayOfWeek DayOfWeek { get; set; } = DayOfWeek.Sunday;
        public int DayOfMonth { get; set; } = 1;
        public int RetentionCount { get; set; } = 30;
        public DateTime? LastBackupAt { get; set; }
        public string? LastBackupBlobName { get; set; }
        public DateTime? LastCheckedAt { get; set; }
        public string? LastStatus { get; set; }
        public string? LastError { get; set; }
        public DateTime LastModifiedDate { get; set; }
    }
}
