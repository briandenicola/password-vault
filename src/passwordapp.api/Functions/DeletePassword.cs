namespace PasswordService.API
{
    public static partial class PasswordService
    {
        [FunctionName("DeletePassword")]
        public static IActionResult DeletePassword(
            [HttpTrigger(AuthorizationLevel.Function, "delete", Route = "passwords/{id}")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASE_NAME%",
                containerName: "%COSMOS_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_PARTITION_KEY%",
                Connection = "cosmosdb",
                Id = "{id}")] AccountPassword accountPassword,
            ILogger log)            
        {
            if( accountPassword.isDeleted == true) {
                log.LogInformation($"DeletePassword Request received for {accountPassword.id} but document is already marked deleted");
                return new OkObjectResult(null);
            }

            log.LogInformation($"DeletePassword request for {accountPassword.id}");
            
            accountPassword.isDeleted = true;
            accountPassword.LastModifiedDate = DateTime.Now;
            return new OkObjectResult(accountPassword);
        }
    }
}
