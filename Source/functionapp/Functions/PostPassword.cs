
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using Newtonsoft.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Search;
using Microsoft.Azure.Search.Models;
using Microsoft.Azure.Documents;
using Microsoft.Azure.Documents.Client;
using Microsoft.Azure.Documents.Linq;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Host;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using PasswordService.Common;
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
                collectionName: "%COSMOS_COLLECTIONNAME%",
                ConnectionStringSetting = "cosmosdb")] IAsyncCollector<AccountPassword> passwordCollection,
            ILogger log)
        {
            log.LogInformation($"PostPassword request new account received");

            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();

            AccountPassword accountPassword = JsonConvert.DeserializeObject<AccountPassword>(requestBody);
            accountPassword.PartitionKey = partitionKey;
            accountPassword.LastModifiedDate = accountPassword.CreatedDate = DateTime.Now;
            accountPassword.EncryptPassword(e);

            await passwordCollection.AddAsync(accountPassword);
            return (ActionResult)new OkObjectResult(accountPassword);
        }
    }
}
