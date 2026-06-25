using PasswordService.Models;

namespace PasswordService.Common
{
    public static class BackupSettingsValidator
    {
        private static readonly HashSet<string> Frequencies = new(StringComparer.OrdinalIgnoreCase)
        {
            "daily",
            "weekly",
            "monthly",
        };

        public static string? Validate(BackupSettingsRecord? settings)
        {
            if (settings is null)
            {
                return "Backup settings are required.";
            }

            if (!Frequencies.Contains(settings.Frequency))
            {
                return "Frequency must be daily, weekly, or monthly.";
            }

            if (!TimeOnly.TryParse(settings.TimeOfDay, out _))
            {
                return "TimeOfDay must be HH:mm.";
            }

            if (settings.DayOfMonth < 1 || settings.DayOfMonth > 31)
            {
                return "DayOfMonth must be between 1 and 31.";
            }

            if (settings.RetentionCount < 1 || settings.RetentionCount > 365)
            {
                return "RetentionCount must be between 1 and 365.";
            }

            return null;
        }

        public static BackupSettingsRecord Defaults(string partitionKey) => new()
        {
            id = BackupSettingsRecord.RecordId,
            PartitionKey = partitionKey,
            Enabled = false,
            Frequency = "daily",
            TimeOfDay = "02:00",
            TimeZoneId = "UTC",
            DayOfWeek = DayOfWeek.Sunday,
            DayOfMonth = 1,
            RetentionCount = 30,
            LastStatus = "Not configured",
        };
    }
}
