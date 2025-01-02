namespace PasswordService.API
{
    public static partial class PasswordService
    {
        [FunctionName("GetPasswordHistoryById")]
        public static IActionResult GetPasswordHistoryById(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords/{id}/history")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASE_NAME%",
                containerName: "%COSMOS_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_PARTITION_KEY%",
                Connection = "cosmosdb",
                Id = "{id}")] AccountPassword accountPassword,
            ILogger log)            
        {
            log.LogInformation($"GetPasswordHistoryById request for {accountPassword.id}");

            var history = new List<PasswordTrail>();

             var currentPassword = new PasswordTrail(){
                SiteName = accountPassword.SiteName,
                Password = accountPassword.DecryptPassword(e),
                TimeStamp = accountPassword.CreatedDate
            };
            history.Add(currentPassword);

            if(accountPassword.OldPasswords != null) {
                var oldPasswords = from oldPassword in accountPassword.OldPasswords
                    select new PasswordTrail(){ 
                        SiteName = accountPassword.SiteName,
                        Password = oldPassword.DecryptPassword(e),
                        TimeStamp = oldPassword.CreatedDate
                    };
                history.AddRange(oldPasswords);
            }

            return new OkObjectResult(history.OrderByDescending(x => x.TimeStamp));
        }
    }
}
