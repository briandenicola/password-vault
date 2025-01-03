namespace PasswordService.API
{
    public partial class PasswordService
    {
        [Function(nameof(GetPasswordById))]
        public IActionResult GetPasswordById(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords/{id}")] HttpRequestData req,
            [CosmosDBInput(
                "%COSMOS_DATABASE_NAME%", 
                "%COSMOS_COLLECTION_NAME%", 
                PartitionKey = "%COSMOS_PARTITION_KEY%", 
                Connection = "COSMOSDB",
                Id = "{id}")] AccountPassword accountPassword)            
        {
            _logger.LogInformation($"GetPasswordById request for {accountPassword.id}");

            var clone = accountPassword.Clone();
            clone.CurrentPassword = clone.DecryptPassword(_encryptor);

            return new OkObjectResult(clone);
        }
    }
}
