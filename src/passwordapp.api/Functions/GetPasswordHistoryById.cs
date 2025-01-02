namespace PasswordService.API
{
    public partial class PasswordService
    {
        [FunctionName("GetPasswordHistoryById")]
        public IActionResult GetPasswordHistoryById(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords/{id}/history")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASE_NAME%",
                containerName: "%COSMOS_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_PARTITION_KEY%",
                Connection = "cosmosdb",
                Id = "{id}")] AccountPassword accountPassword)            
        {
            _logger.LogInformation($"GetPasswordHistoryById request for {accountPassword.id}");

            var history = new List<PasswordTrail>();

             var currentPassword = new PasswordTrail(){
                SiteName = accountPassword.SiteName,
                Password = accountPassword.DecryptPassword(_encryptor),
                TimeStamp = accountPassword.CreatedDate
            };
            history.Add(currentPassword);

            if(accountPassword.OldPasswords != null) {
                var oldPasswords = from oldPassword in accountPassword.OldPasswords
                    select new PasswordTrail(){ 
                        SiteName = accountPassword.SiteName,
                        Password = oldPassword.DecryptPassword(_encryptor),
                        TimeStamp = oldPassword.CreatedDate
                    };
                history.AddRange(oldPasswords);
            }

            return new OkObjectResult(history.OrderByDescending(x => x.TimeStamp));
        }
    }
}
