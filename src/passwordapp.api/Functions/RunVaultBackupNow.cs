using System.Net;

namespace PasswordService.API
{
    public partial class PasswordService
    {
        public class RunVaultBackupNowOutput
        {
            [CosmosDBOutput(
                "%COSMOS_DATABASE_NAME%",
                "%COSMOS_KEY_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_KEY_PARTITION_KEY%",
                Connection = "COSMOSDB")]
            public BackupSettingsRecord? Settings { get; set; }

            [HttpResult]
            public HttpResponseData Response { get; set; } = default!;
        }

        [Function(nameof(RunVaultBackupNow))]
        public async Task<RunVaultBackupNowOutput> RunVaultBackupNow(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "backup-settings/run-now")] HttpRequestData req,
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
            _logger.LogInformation("RunVaultBackupNow request received");

            var now = DateTimeOffset.UtcNow;
            settings ??= BackupSettingsValidator.Defaults(_keyPartitionKey);
            settings.id = BackupSettingsRecord.RecordId;
            settings.PartitionKey = _keyPartitionKey;
            settings.LastCheckedAt = now.UtcDateTime;

            if (BackupSettingsValidator.Validate(settings) is { } validationError)
            {
                settings.LastStatus = "Invalid settings";
                settings.LastError = validationError;
                return new RunVaultBackupNowOutput
                {
                    Settings = settings,
                    Response = await JsonResponse(req, HttpStatusCode.BadRequest, settings),
                };
            }

            try
            {
                await CreateVaultBackupAsync(passwordCollection, settings, now, "Manual vault backup");
                return new RunVaultBackupNowOutput
                {
                    Settings = settings,
                    Response = await JsonResponse(req, HttpStatusCode.OK, settings),
                };
            }
            catch (Exception ex) when (ex is InvalidOperationException or Azure.RequestFailedException)
            {
                settings.LastStatus = "Backup failed";
                settings.LastError = ex.Message;
                _logger.LogError(ex, "Manual vault backup failed.");
                return new RunVaultBackupNowOutput
                {
                    Settings = settings,
                    Response = await JsonResponse(req, HttpStatusCode.InternalServerError, settings),
                };
            }
        }

        private static async Task<HttpResponseData> JsonResponse(HttpRequestData req, HttpStatusCode statusCode, BackupSettingsRecord settings)
        {
            var response = req.CreateResponse(statusCode);
            await response.WriteAsJsonAsync(settings);
            return response;
        }
    }
}
