using PasswordService.Common;
using PasswordService.Models;

namespace PasswordService.Tests;

public class VaultBackupSchedulerTests
{
    [Fact]
    public void DisabledSettingsDoNotRun()
    {
        var settings = new BackupSettingsRecord
        {
            Enabled = false,
            Frequency = "daily",
            TimeOfDay = "02:00",
            TimeZoneId = "UTC",
        };

        Assert.False(VaultBackupScheduler.ShouldRun(settings, DateTimeOffset.Parse("2026-06-25T03:00:00Z")));
    }

    [Fact]
    public void DailyBackupRunsWhenDueAndNotAlreadyRun()
    {
        var settings = new BackupSettingsRecord
        {
            Enabled = true,
            Frequency = "daily",
            TimeOfDay = "02:00",
            TimeZoneId = "UTC",
            LastBackupAt = new DateTime(2026, 6, 24, 2, 30, 0, DateTimeKind.Utc),
        };

        Assert.True(VaultBackupScheduler.ShouldRun(settings, DateTimeOffset.Parse("2026-06-25T02:01:00Z")));
    }

    [Fact]
    public void DailyBackupDoesNotRunTwiceForSameDueTime()
    {
        var settings = new BackupSettingsRecord
        {
            Enabled = true,
            Frequency = "daily",
            TimeOfDay = "02:00",
            TimeZoneId = "UTC",
            LastBackupAt = new DateTime(2026, 6, 25, 2, 1, 0, DateTimeKind.Utc),
        };

        Assert.False(VaultBackupScheduler.ShouldRun(settings, DateTimeOffset.Parse("2026-06-25T03:00:00Z")));
    }

    [Fact]
    public void WeeklyBackupUsesConfiguredDay()
    {
        var settings = new BackupSettingsRecord
        {
            Enabled = true,
            Frequency = "weekly",
            TimeOfDay = "02:00",
            TimeZoneId = "UTC",
            DayOfWeek = DayOfWeek.Thursday,
            LastBackupAt = new DateTime(2026, 6, 18, 2, 1, 0, DateTimeKind.Utc),
        };

        Assert.True(VaultBackupScheduler.ShouldRun(settings, DateTimeOffset.Parse("2026-06-25T02:01:00Z")));
    }
}
