using Newtonsoft.Json;

namespace PasswordService.API
{
    public partial class PasswordService
    {
        [FunctionName("UpdatePassword")]
        public async Task<IActionResult> UpdatePassword(
            [HttpTrigger(AuthorizationLevel.Function, "put", Route = "passwords/{id}")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASE_NAME%",
                containerName: "%COSMOS_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_PARTITION_KEY%",
                Connection = "cosmosdb",
                Id = "{id}")] AccountPassword accountPassword)            
        {
            if( accountPassword.isDeleted == true ) {
                _logger.LogInformation($"UpdatePassword Request received for {accountPassword.id} but document is marked deleted");
                return new OkObjectResult(null);
            }

            _logger.LogInformation($"UpdatePassword request for {accountPassword.id}");

            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();

            if( string.IsNullOrEmpty(requestBody) ) {
                return new BadRequestObjectResult("Invalid request body");
            }   
            AccountPassword? updates = JsonConvert.DeserializeObject<AccountPassword>(requestBody);

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

            return new OkObjectResult(accountPassword);
        
        }
            
    }
}
