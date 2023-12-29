
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
        [FunctionName("PostPassword")]
        public static async Task<IActionResult> PostPassword(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = "passwords")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASENAME%",
                containerName: "%COSMOS_COLLECTIONNAME%",
                Connection = "cosmosdb")] IAsyncCollector<AccountPassword> passwordCollection,
            ILogger log)
        {
            log.LogInformation($"PostPassword request new account received");

            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();

            AccountPassword accountPassword = JsonConvert.DeserializeObject<AccountPassword>(requestBody);
            accountPassword.PartitionKey = partitionKey;
            accountPassword.LastModifiedDate = accountPassword.CreatedDate = DateTime.Now;
            accountPassword.CurrentPassword = accountPassword.EncryptPassword(e);

            await passwordCollection.AddAsync(accountPassword);
            return (ActionResult)new OkObjectResult(accountPassword);
        }
    }
}
