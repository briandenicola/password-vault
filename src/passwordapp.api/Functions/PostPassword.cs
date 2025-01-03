using System.Threading.Tasks;
using Newtonsoft.Json;

namespace PasswordService.API
{
    public partial class PasswordService
    {
        [Function(nameof(PostPassword))]
        [CosmosDBOutput( "%COSMOS_DATABASE_NAME%", "%COSMOS_COLLECTION_NAME%", PartitionKey = "%COSMOS_PARTITION_KEY%", Connection = "COSMOSDB")] 
        public async Task<object> PostPassword(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = "passwords")] HttpRequestData  req)
        {
            var accountPassword = new AccountPassword();
            accountPassword.GenerateId();

            _logger.LogInformation($"PostPassword request new account received");

            var postedBody = await req.ReadAsStringAsync();
            if( postedBody == null) {
                return new BadRequestObjectResult("Invalid request body");
            }
            AccountPassword? postedPassword = JsonConvert.DeserializeObject<AccountPassword>(postedBody);

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
            _logger.LogInformation($"PostPassword request for {accountPassword.id} with a password of {accountPassword.CurrentPassword}");
            return accountPassword;
        }
    }
}
