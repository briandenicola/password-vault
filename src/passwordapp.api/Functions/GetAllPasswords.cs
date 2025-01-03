namespace PasswordService.API
{
    public partial class PasswordService
    {
        [Function(nameof(GetAllPasswords))]
        public IActionResult GetAllPasswords(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords")] HttpRequestData req, 
            [CosmosDBInput(
                "%COSMOS_DATABASE_NAME%", 
                "%COSMOS_COLLECTION_NAME%", 
                PartitionKey = "%COSMOS_PARTITION_KEY%", 
                Connection = "COSMOSDB")] IReadOnlyList<AccountPassword> passwordCollection)
        {
            _logger.LogInformation($"GetAllPasswords request received");
            if (passwordCollection != null && passwordCollection.Any())
            {
                var activeAccounts = (from p in passwordCollection
                    where p.isDeleted == false
                    select p).ToList();
                return new OkObjectResult(activeAccounts);
            }
            return new NotFoundObjectResult("No passwords found");
        }
    }
}
