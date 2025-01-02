namespace PasswordService.API
{
    public partial class PasswordService
    {
        [FunctionName("GetPasswordById")]
        public IActionResult GetPasswordById(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords/{id}")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASE_NAME%",
                containerName: "%COSMOS_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_PARTITION_KEY%",
                Connection = "cosmosdb",
                Id = "{id}")] AccountPassword accountPassword,
            ILogger log)            
        {
            _logger.LogInformation($"GetPasswordById request for {accountPassword.id}");

            var clone = accountPassword.Clone();
            clone.CurrentPassword = clone.DecryptPassword(_encryptor);

            return new OkObjectResult(clone);
        }
    }
}
