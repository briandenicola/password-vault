
using System.Collections.Generic;
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
        [FunctionName("GetAllPasswords")]
        public static IActionResult GetAllPasswords(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASENAME%",
                collectionName: "%COSMOS_COLLECTIONNAME%",
                PartitionKey = "%COSMOS_PARTITIONKEY%",
                ConnectionStringSetting = "cosmosdb",
                SqlQuery = "SELECT * FROM c where c.isDeleted = false")]
                IEnumerable<AccountPassword> passwordCollection,
            ILogger log)
        {
            log.LogInformation($"GetAllPasswords request received");
            return (ActionResult)new OkObjectResult(passwordCollection);
        }
    }
}
