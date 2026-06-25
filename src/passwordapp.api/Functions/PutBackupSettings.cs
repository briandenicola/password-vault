using System.Net;
using Newtonsoft.Json;

namespace PasswordService.API
{
    public partial class PasswordService
    {
        public class PutBackupSettingsOutput
        {
            [CosmosDBOutput(
                "%COSMOS_DATABASE_NAME%",
                "%COSMOS_KEY_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_KEY_PARTITION_KEY%",
                Connection = "COSMOSDB")]
            public BackupSettingsRecord? Record { get; set; }

            [HttpResult]
            public HttpResponseData Response { get; set; } = default!;
        }

        [Function(nameof(PutBackupSettings))]
        public async Task<PutBackupSettingsOutput> PutBackupSettings(
            [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "backup-settings")] HttpRequestData req,
            [CosmosDBInput(
                "%COSMOS_DATABASE_NAME%",
                "%COSMOS_KEY_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_KEY_PARTITION_KEY%",
                Connection = "COSMOSDB",
                Id = BackupSettingsRecord.RecordId)] BackupSettingsRecord? existing)
        {
            _logger.LogInformation("PutBackupSettings request received");

            var body = await req.ReadAsStringAsync();
            BackupSettingsRecord? posted = null;
            if (!string.IsNullOrWhiteSpace(body))
            {
                try { posted = JsonConvert.DeserializeObject<BackupSettingsRecord>(body); }
                catch (JsonException) { posted = null; }
            }

            var error = BackupSettingsValidator.Validate(posted);
            if (error is not null)
            {
                return new PutBackupSettingsOutput { Response = await TextResponse(req, HttpStatusCode.BadRequest, error) };
            }

            posted!.id = BackupSettingsRecord.RecordId;
            posted.PartitionKey = _keyPartitionKey;
            posted.LastModifiedDate = DateTime.UtcNow;
            posted.LastBackupAt = existing?.LastBackupAt;
            posted.LastBackupBlobName = existing?.LastBackupBlobName;
            posted.LastCheckedAt = existing?.LastCheckedAt;
            posted.LastStatus = existing?.LastStatus;
            posted.LastError = existing?.LastError;

            var ok = req.CreateResponse(HttpStatusCode.OK);
            await ok.WriteAsJsonAsync(posted);
            return new PutBackupSettingsOutput { Record = posted, Response = ok };
        }
    }
}
