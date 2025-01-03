namespace PasswordService.API
{
    public partial class PasswordService
    {
        [Function(nameof(GetPasswordHistoryById))]
        [CosmosDBOutput( "%COSMOS_DATABASE_NAME%", "%COSMOS_COLLECTION_NAME%", PartitionKey = "%COSMOS_PARTITION_KEY%", Connection = "COSMOSDB")] 
        public object GetPasswordHistoryById(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords/{id}/history")] HttpRequestData req,
            [CosmosDBInput(
                "%COSMOS_DATABASE_NAME%", 
                "%COSMOS_COLLECTION_NAME%", 
                PartitionKey = "%COSMOS_PARTITION_KEY%", 
                Connection = "COSMOSDB",
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

            return history.OrderByDescending(x => x.TimeStamp);
        }
    }
}
