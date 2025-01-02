namespace PasswordService.API
{
    public partial class PasswordService
    {
        [FunctionName("GetAllPasswords")]
        public IActionResult GetAllPasswords(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASE_NAME%",
                containerName: "%COSMOS_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_PARTITION_KEY%",
                Connection = "cosmosdb",
                SqlQuery = "SELECT * FROM c where c.isDeleted = false")]
                IEnumerable<AccountPassword> passwordCollection)
        {
            _logger.LogInformation($"GetAllPasswords request received");
            return new OkObjectResult(passwordCollection);
        }
    }
}
