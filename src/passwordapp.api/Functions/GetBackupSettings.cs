namespace PasswordService.API
{
    public partial class PasswordService
    {
        [Function(nameof(GetBackupSettings))]
        public IActionResult GetBackupSettings(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "backup-settings")] HttpRequestData req,
            [CosmosDBInput(
                "%COSMOS_DATABASE_NAME%",
                "%COSMOS_KEY_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_KEY_PARTITION_KEY%",
                Connection = "COSMOSDB",
                Id = BackupSettingsRecord.RecordId)] BackupSettingsRecord? settings)
        {
            _logger.LogInformation("GetBackupSettings request received");
            return new OkObjectResult(settings ?? BackupSettingsValidator.Defaults(_keyPartitionKey));
        }
    }
}
