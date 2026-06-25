namespace PasswordService.API
{
    public partial class PasswordService
    {
        public class RunScheduledVaultBackupOutput
        {
            [CosmosDBOutput(
                "%COSMOS_DATABASE_NAME%",
                "%COSMOS_KEY_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_KEY_PARTITION_KEY%",
                Connection = "COSMOSDB")]
            public BackupSettingsRecord? SavedSettings { get; set; }
        }

        [Function(nameof(RunScheduledVaultBackup))]
        public async Task<RunScheduledVaultBackupOutput> RunScheduledVaultBackup(
            [TimerTrigger("0 */15 * * * *")] TimerInfo timer,
            [CosmosDBInput(
                "%COSMOS_DATABASE_NAME%",
                "%COSMOS_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_PARTITION_KEY%",
                Connection = "COSMOSDB")] IReadOnlyList<AccountPassword> passwordCollection,
            [CosmosDBInput(
                "%COSMOS_DATABASE_NAME%",
                "%COSMOS_KEY_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_KEY_PARTITION_KEY%",
                Connection = "COSMOSDB",
                Id = BackupSettingsRecord.RecordId)] BackupSettingsRecord? settings)
        {
            var now = DateTimeOffset.UtcNow;
            if (settings is null || !settings.Enabled)
            {
                _logger.LogInformation("Scheduled vault backup skipped because backups are not enabled.");
                return new RunScheduledVaultBackupOutput();
            }

            settings.id = BackupSettingsRecord.RecordId;
            settings.PartitionKey = _keyPartitionKey;
            settings.LastCheckedAt = now.UtcDateTime;

            if (BackupSettingsValidator.Validate(settings) is { } validationError)
            {
                settings.LastStatus = "Invalid settings";
                settings.LastError = validationError;
                _logger.LogWarning("Scheduled vault backup skipped: {Reason}", validationError);
                return new RunScheduledVaultBackupOutput { SavedSettings = settings };
            }

            if (!VaultBackupScheduler.ShouldRun(settings, now))
            {
                _logger.LogInformation("Scheduled vault backup is not due.");
                return new RunScheduledVaultBackupOutput();
            }

            try
            {
                await CreateVaultBackupAsync(passwordCollection, settings, now, "Scheduled vault backup");
            }
            catch (Exception ex) when (ex is InvalidOperationException or Azure.RequestFailedException)
            {
                settings.LastStatus = "Backup failed";
                settings.LastError = ex.Message;
                _logger.LogError(ex, "Scheduled vault backup failed.");
            }

            return new RunScheduledVaultBackupOutput { SavedSettings = settings };
        }

        private async Task CreateVaultBackupAsync(
            IReadOnlyList<AccountPassword> passwordCollection,
            BackupSettingsRecord settings,
            DateTimeOffset now,
            string operationName)
        {
            var archive = VaultBackupArchive.Create(passwordCollection, now);
            var store = new VaultBackupBlobStore(_backupStorageAccountName, _backupStorageContainerName);
            await store.UploadAsync(archive.BlobName, archive.ZipBytes, CancellationToken.None);

            settings.LastBackupAt = now.UtcDateTime;
            settings.LastBackupBlobName = archive.BlobName;
            settings.LastStatus = $"Backed up {archive.DocumentCount} document(s).";
            settings.LastError = null;
            _logger.LogInformation("{OperationName} wrote {BlobName} with {DocumentCount} document(s).", operationName, archive.BlobName, archive.DocumentCount);
        }
    }
}
