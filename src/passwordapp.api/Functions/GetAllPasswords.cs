namespace PasswordServiceAPI
{
    public static partial class PasswordService
    {
        [FunctionName("GetAllPasswords")]
        public static IActionResult GetAllPasswords(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASE_NAME%",
                containerName: "%COSMOS_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_PARTITION_KEY%",
                Connection = "cosmosdb",
                SqlQuery = "SELECT * FROM c where c.isDeleted = false")]
                IEnumerable<AccountPassword> passwordCollection,
            ILogger log)
        {
            log.LogInformation($"GetAllPasswords request received");
            return new OkObjectResult(passwordCollection);
        }
    }
}
