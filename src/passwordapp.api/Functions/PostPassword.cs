
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
using System.Collections.Generic;

namespace PasswordService
{
    public static partial class PasswordService
    {
        [FunctionName("PostPassword")]
        public static async Task<IActionResult> PostPassword(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = "passwords")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASENAME%",
                containerName: "%COSMOS_COLLECTIONNAME%",
                PartitionKey = "%COSMOS_PARTITIONKEY%",
                Connection = "cosmosdb")] IAsyncCollector<AccountPassword> passwordCollection,

            ILogger log)
        {
            var accountPassword = new AccountPassword();
            accountPassword.GenerateId();

            log.LogInformation($"PostPassword request new account received");

            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var postedPassword = JsonConvert.DeserializeObject<AccountPassword>(requestBody);

            accountPassword.PartitionKey        = partitionKey;
            accountPassword.SiteName            = postedPassword.SiteName;
            accountPassword.AccountName         = postedPassword.AccountName;
            accountPassword.Notes               = postedPassword.Notes;
            accountPassword.SecurityQuestions   = postedPassword.SecurityQuestions;
            accountPassword.LastModifiedBy      = accountPassword.CreatedBy   = postedPassword.CreatedBy;
            accountPassword.LastModifiedDate    = accountPassword.CreatedDate = DateTime.Now;
                    
            accountPassword.SavePassword(e, postedPassword.CurrentPassword);

            await passwordCollection.AddAsync(accountPassword);
            return (ActionResult)new OkObjectResult(accountPassword);
        }
    }
}
