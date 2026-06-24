namespace PasswordService.API
{
    public partial class PasswordService
    {
        [Function(nameof(GetDeletedPasswords))]
        public IActionResult GetDeletedPasswords(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "passwords/deleted")] HttpRequestData req,
            [CosmosDBInput(
                "%COSMOS_DATABASE_NAME%",
                "%COSMOS_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_PARTITION_KEY%",
                Connection = "COSMOSDB")] IReadOnlyList<AccountPassword> passwordCollection)
        {
            _logger.LogInformation($"GetDeletedPasswords request received");
            if (passwordCollection != null && passwordCollection.Any())
            {
                var deletedAccounts = (from p in passwordCollection
                    where p.isDeleted == true
                    select p).ToList();
                return new OkObjectResult(deletedAccounts);
            }
            return new OkObjectResult(new List<AccountPassword>());
        }
    }
}
