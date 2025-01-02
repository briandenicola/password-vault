using Newtonsoft.Json;

namespace PasswordService.API
{
    public partial class PasswordService
    {
        [FunctionName("PostPassword")]
        public async Task<IActionResult> PostPassword(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = "passwords")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASE_NAME%",
                containerName: "%COSMOS_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_PARTITION_KEY%",
                Connection = "cosmosdb")] IAsyncCollector<AccountPassword> passwordCollection)
        {
            var accountPassword = new AccountPassword();
            accountPassword.GenerateId();

            _logger.LogInformation($"PostPassword request new account received");

            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var postedPassword = JsonConvert.DeserializeObject<AccountPassword>(requestBody);

            if( postedPassword == null) {
                return new BadRequestObjectResult("Invalid request body");
            }   

            accountPassword.PartitionKey        = _partitionKey;
            accountPassword.SiteName            = postedPassword?.SiteName;
            accountPassword.AccountName         = postedPassword?.AccountName;
            accountPassword.Notes               = postedPassword?.Notes;
            accountPassword.SecurityQuestions   = postedPassword?.SecurityQuestions;
            accountPassword.LastModifiedBy      = accountPassword.CreatedBy   = postedPassword?.CreatedBy;
            accountPassword.LastModifiedDate    = accountPassword.CreatedDate = DateTime.Now;

            if( postedPassword?.CurrentPassword == null ) {
                return new BadRequestObjectResult("Invalid request body");
            }   
            accountPassword.SavePassword(_encryptor, postedPassword.CurrentPassword);

            await passwordCollection.AddAsync(accountPassword);
            return new OkObjectResult(accountPassword);
        }
    }
}
