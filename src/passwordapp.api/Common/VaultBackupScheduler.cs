using PasswordService.Models;

namespace PasswordService.Common
{
    public static class VaultBackupScheduler
    {
        public static bool ShouldRun(BackupSettingsRecord settings, DateTimeOffset utcNow)
        {
            if (!settings.Enabled)
            {
                return false;
            }

            var due = LatestDueAtOrBefore(settings, utcNow);
            if (due is null)
            {
                return false;
            }

            return settings.LastBackupAt is null ||
                   new DateTimeOffset(DateTime.SpecifyKind(settings.LastBackupAt.Value, DateTimeKind.Utc)) < due.Value;
        }

        public static DateTimeOffset? LatestDueAtOrBefore(BackupSettingsRecord settings, DateTimeOffset utcNow)
        {
            if (!TimeOnly.TryParse(settings.TimeOfDay, out var time))
            {
                return null;
            }

            var zone = ResolveTimeZone(settings.TimeZoneId);
            var localNow = TimeZoneInfo.ConvertTime(utcNow, zone);

            return settings.Frequency.ToLowerInvariant() switch
            {
                "daily" => Candidate(localNow.Date),
                "weekly" => LatestWeekly(settings, localNow),
                "monthly" => LatestMonthly(settings, localNow),
                _ => null,
            };

            DateTimeOffset? Candidate(DateTime date)
            {
                var localDue = date.Add(time.ToTimeSpan());
                if (localDue > localNow.DateTime)
                {
                    return null;
                }
                return TimeZoneInfo.ConvertTimeToUtc(localDue, zone);
            }
        }

        private static DateTimeOffset? LatestWeekly(BackupSettingsRecord settings, DateTimeOffset localNow)
        {
            var daysSince = ((int)localNow.DayOfWeek - (int)settings.DayOfWeek + 7) % 7;
            var date = localNow.Date.AddDays(-daysSince);
            var due = DailyDue(settings, date, localNow);
            return due ?? DailyDue(settings, date.AddDays(-7), localNow);
        }

        private static DateTimeOffset? LatestMonthly(BackupSettingsRecord settings, DateTimeOffset localNow)
        {
            var day = Math.Min(settings.DayOfMonth, DateTime.DaysInMonth(localNow.Year, localNow.Month));
            var date = new DateTime(localNow.Year, localNow.Month, day);
            var due = DailyDue(settings, date, localNow);
            if (due is not null)
            {
                return due;
            }

            var priorMonth = localNow.AddMonths(-1);
            day = Math.Min(settings.DayOfMonth, DateTime.DaysInMonth(priorMonth.Year, priorMonth.Month));
            return DailyDue(settings, new DateTime(priorMonth.Year, priorMonth.Month, day), localNow);
        }

        private static DateTimeOffset? DailyDue(BackupSettingsRecord settings, DateTime date, DateTimeOffset localNow)
        {
            if (!TimeOnly.TryParse(settings.TimeOfDay, out var time))
            {
                return null;
            }

            var zone = ResolveTimeZone(settings.TimeZoneId);
            var localDue = date.Add(time.ToTimeSpan());
            if (localDue > localNow.DateTime)
            {
                return null;
            }

            return TimeZoneInfo.ConvertTimeToUtc(localDue, zone);
        }

        private static TimeZoneInfo ResolveTimeZone(string? timeZoneId)
        {
            if (string.IsNullOrWhiteSpace(timeZoneId))
            {
                return TimeZoneInfo.Utc;
            }

            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            }
            catch (TimeZoneNotFoundException)
            {
                return TimeZoneInfo.Utc;
            }
            catch (InvalidTimeZoneException)
            {
                return TimeZoneInfo.Utc;
            }
        }
    }
}
