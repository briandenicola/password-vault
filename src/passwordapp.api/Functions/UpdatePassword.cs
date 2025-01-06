using Newtonsoft.Json;

namespace PasswordService.API
{
    public partial class PasswordService
    {
        [Function(nameof(UpdatePassword))]
        [CosmosDBOutput( "%COSMOS_DATABASE_NAME%", "%COSMOS_COLLECTION_NAME%", PartitionKey = "%COSMOS_PARTITION_KEY%", Connection = "COSMOSDB")] 
        public async Task<object> UpdatePassword( 
            [HttpTrigger(AuthorizationLevel.Function, "put", Route = "passwords/{id}")] HttpRequestData req, 
            [CosmosDBInput(
                "%COSMOS_DATABASE_NAME%", 
                "%COSMOS_COLLECTION_NAME%", 
                PartitionKey = "%COSMOS_PARTITION_KEY%", 
                Connection = "COSMOSDB",
                Id = "{id}")] AccountPassword accountPassword)
        {
            _logger.LogInformation($"UpdatePassword request for {accountPassword.id}");
            
            var postedBody = await req.ReadAsStringAsync();
            if( postedBody == null) {
                return new BadRequestObjectResult("Invalid request body");
            }
            AccountPassword? updates = JsonConvert.DeserializeObject<AccountPassword>(postedBody);

            if( accountPassword == null || accountPassword.CurrentPassword == null ) {
                return new BadRequestObjectResult("Invalid request body");
            }

            if( updates == null || updates.CurrentPassword == null ) {
                return new BadRequestObjectResult("Invalid request body");
            }

            accountPassword.SiteName = updates.SiteName;
            accountPassword.AccountName = updates.AccountName;
            accountPassword.Notes = updates.Notes; 
            accountPassword.SecurityQuestions = updates.SecurityQuestions;
            accountPassword.UpdatePassword(_encryptor, updates.CurrentPassword, accountPassword.LastModifiedDate);
            accountPassword.LastModifiedDate = DateTime.Now;
            accountPassword.LastModifiedBy   = updates.LastModifiedBy;

            return accountPassword;
        }
            
    }
}
