
using System;
using System.IO;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using PasswordService.Models;

namespace PasswordService
{
    public static partial class PasswordService
    {
        [FunctionName("UpdatePassword")]
        public static async Task<IActionResult> UpdatePassword(
            [HttpTrigger(AuthorizationLevel.Function, "put", Route = "passwords/{id}")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASENAME%",
                containerName: "%COSMOS_COLLECTIONNAME%",
                PartitionKey = "%COSMOS_PARTITIONKEY%",
                Connection = "cosmosdb",
                Id = "{id}")] AccountPassword accountPassword,
            ILogger log)            
        {
            if( accountPassword.isDeleted == true ) {
                log.LogInformation($"UpdatePassword Request received for {accountPassword.id} but document is marked deleted");
                return (ActionResult)new OkObjectResult(null);
            }

            log.LogInformation($"UpdatePassword request for {accountPassword.id}");

            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            AccountPassword updates = JsonConvert.DeserializeObject<AccountPassword>(requestBody);

            accountPassword.SiteName = updates.SiteName;
            accountPassword.AccountName = updates.AccountName;
            accountPassword.Notes = updates.Notes; 
            accountPassword.SecurityQuestions = updates.SecurityQuestions;
            accountPassword.UpdatePassword(e, updates.CurrentPassword, accountPassword.LastModifiedDate);
            accountPassword.LastModifiedDate = DateTime.Now;

            return (ActionResult)new OkObjectResult(accountPassword);
        
        }
            
    }
}
