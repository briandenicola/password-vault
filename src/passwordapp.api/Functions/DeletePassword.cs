namespace PasswordService.API
{
    public partial class PasswordService
    {

        [Function(nameof(DeletePassword))]
        [CosmosDBOutput( "%COSMOS_DATABASE_NAME%", "%COSMOS_COLLECTION_NAME%", PartitionKey = "%COSMOS_PARTITION_KEY%", Connection = "COSMOSDB")] 
        public object? DeletePassword(
            [HttpTrigger(AuthorizationLevel.Function, "delete", Route = "passwords/{id}")] HttpRequestData req,
            [CosmosDBInput(
                "%COSMOS_DATABASE_NAME%", 
                "%COSMOS_COLLECTION_NAME%", 
                PartitionKey = "%COSMOS_PARTITION_KEY%", 
                Connection = "COSMOSDB",
                Id = "{id}")] AccountPassword accountPassword)            
        {
            if( accountPassword.isDeleted == true) {
                _logger.LogInformation($"DeletePassword Request received for {accountPassword.id} but document is already marked deleted");
            }
            else {
                _logger.LogInformation($"DeletePassword request for {accountPassword.id}");
                accountPassword.isDeleted = true;
                accountPassword.LastModifiedDate = DateTime.Now;
            }
            return accountPassword;
        }
    }
}
