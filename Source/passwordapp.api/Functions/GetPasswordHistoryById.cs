
using System;
using System.Linq;
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
        [FunctionName("GetPasswordHistoryById")]
        public static IActionResult GetPasswordHistoryById(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords/{id}/history")] HttpRequest req,
            [CosmosDB(
                databaseName: "%COSMOS_DATABASENAME%",
                collectionName: "%COSMOS_COLLECTIONNAME%",
                PartitionKey = "%COSMOS_PARTITIONKEY%",
                ConnectionStringSetting = "cosmosdb",
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

            return (ActionResult)new OkObjectResult(history.OrderByDescending(x => x.TimeStamp));
        }

        public class PasswordTrail {
            public string SiteName { get; set;}
            public string Password { get; set;}
            public DateTime TimeStamp { get; set;}
        }

    }
}
