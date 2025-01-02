namespace PasswordService.API
{
    public static partial class PasswordService
    {
        [FunctionName("GetPasswordById")]
        public static IActionResult GetPasswordById(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords/{id}")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASE_NAME%",
                containerName: "%COSMOS_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_PARTITION_KEY%",
                Connection = "cosmosdb",
                Id = "{id}")] AccountPassword accountPassword,
            ILogger log)            
        {
            log.LogInformation($"GetPasswordById request for {accountPassword.id}");

            var clone = accountPassword.Clone();
            clone.CurrentPassword = clone.DecryptPassword(e);

            return new OkObjectResult(clone);
        }
    }
}
