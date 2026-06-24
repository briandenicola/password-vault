namespace PasswordService.API
{
    public partial class PasswordService
    {

        [Function(nameof(RestorePassword))]
        [CosmosDBOutput( "%COSMOS_DATABASE_NAME%", "%COSMOS_COLLECTION_NAME%", PartitionKey = "%COSMOS_PARTITION_KEY%", Connection = "COSMOSDB")]
        public object? RestorePassword(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = "passwords/{id}/restore")] HttpRequestData req,
            [CosmosDBInput(
                "%COSMOS_DATABASE_NAME%",
                "%COSMOS_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_PARTITION_KEY%",
                Connection = "COSMOSDB",
                Id = "{id}")] AccountPassword accountPassword)
        {
            if( accountPassword.isDeleted == false) {
                _logger.LogInformation($"RestorePassword request received for {accountPassword.id} but document is not deleted");
            }
            else {
                _logger.LogInformation($"RestorePassword request for {accountPassword.id}");
                accountPassword.isDeleted = false;
                accountPassword.LastModifiedDate = DateTime.Now;
            }
            return accountPassword;
        }
    }
}
