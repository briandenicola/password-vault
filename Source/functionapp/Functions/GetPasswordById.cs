
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
        [FunctionName("GetPasswordById")]
        public static IActionResult GetPasswordById(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords/{id}")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASENAME%",
                collectionName: "%COSMOS_COLLECTIONNAME%",
                PartitionKey = "%COSMOS_PARTITIONKEY%",
                ConnectionStringSetting = "cosmosdb",
                Id = "{id}")] AccountPassword accountPassword,
            ILogger log)            
        {
            log.LogInformation($"GetPasswordById request for {accountPassword.id}");

            var clone = accountPassword.Clone();
            clone.DecryptPassword(e);

            return (ActionResult)new OkObjectResult(clone);
        }
    }
}
