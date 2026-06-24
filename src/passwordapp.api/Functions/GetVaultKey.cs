namespace PasswordService.API
{
    public partial class PasswordService
    {
        // OFF-4 Phase 2a: read the per-vault key record (PRF salt + wrapped DEKs).
        // Flag-gated (E2EE_ENABLED, default off) and isolated in its own Cosmos
        // container so it never appears in the passwords list.
        [Function(nameof(GetVaultKey))]
        public IActionResult GetVaultKey(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "vault-key")] HttpRequestData req,
            [CosmosDBInput(
                "%COSMOS_DATABASE_NAME%",
                "%COSMOS_KEY_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_KEY_PARTITION_KEY%",
                Connection = "COSMOSDB",
                Id = VaultKeyRecordValidator.RecordId)] VaultKeyRecord? record)
        {
            if (!E2eeFeature.IsEnabled(name => Environment.GetEnvironmentVariable(name)))
                return new NotFoundObjectResult("E2EE is not enabled");

            _logger.LogInformation("GetVaultKey request received");

            if (record is null)
                return new NotFoundObjectResult("No vault key record has been enrolled");

            return new OkObjectResult(record);
        }
    }
}
