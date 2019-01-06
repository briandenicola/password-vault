
using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Documents;
using Microsoft.Azure.Documents.Client;
using Microsoft.Azure.Documents.Linq;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Host;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System.Collections.Generic;
using PasswordService.Common;
using PasswordService.Models;

namespace PasswordService
{
    public static class PasswordService
    {
        private static string databaseName = "AccountPasswords";
        private static string collectionName = "Passwords";

        private static string partitionKey = "Passwords";

        private static Encryptor e = new Encryptor(
            Environment.GetEnvironmentVariable("AesKey", EnvironmentVariableTarget.Process), 
            Environment.GetEnvironmentVariable("AesIV", EnvironmentVariableTarget.Process)
        );

        [FunctionName("GetAllPasswords")]
        public static IActionResult GetAllPasswords(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords")] HttpRequest req,
            [CosmosDB(
                databaseName: "AccountPasswords",
                collectionName: "Passwords",
                ConnectionStringSetting = "cosmosdb",
                PartitionKey = "Passwords",
                SqlQuery = "SELECT * FROM c where c.isDeleted = false")]
                IEnumerable<AccountPasswords> accountPasswords,
            ILogger log)
        {
            log.LogInformation("C# HTTP trigger function processed a GET ALL request.");
            return (ActionResult) new OkObjectResult(accountPasswords);
        }

        [FunctionName("GetPasswordById")]
        public static IActionResult GetPasswordById(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords/{id}")] HttpRequest req,
            [CosmosDB(
                databaseName: "AccountPasswords",
                collectionName: "Passwords",
                ConnectionStringSetting = "cosmosdb",
                PartitionKey = "Passwords",
                Id = "{id}")] AccountPasswords accountPassword,
            ILogger log) 
        {
            log.LogInformation($"C# HTTP trigger function processed a GET request.");
            e.Decrypt(accountPassword.CurrentPassword, out string decryptedPassword);

            return (ActionResult)new OkObjectResult(new AccountPasswords(){
                id = accountPassword.id,
                PartitionKey = accountPassword.PartitionKey,
                SiteName = accountPassword.SiteName,
                AccountName = accountPassword.AccountName,
                Notes = accountPassword.Notes,
                SecurityQuestions = accountPassword.SecurityQuestions,
                CreatedDate = accountPassword.CreatedDate,
                CreatedBy = accountPassword.CreatedBy,
                LastModifiedDate = accountPassword.LastModifiedDate,
                LastModifiedBy = accountPassword.LastModifiedBy,
                CurrentPassword = decryptedPassword
            });
        }

        [FunctionName("PostPassword")]
        public static async Task<IActionResult> PostPasswords(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = "passwords")] HttpRequest req,
            [CosmosDB(
                databaseName: "AccountPasswords",
                collectionName: "Passwords",
                ConnectionStringSetting = "cosmosdb")] IAsyncCollector<AccountPasswords> accountPasswords,
            ILogger log)
        {
            log.LogInformation("C# HTTP trigger function processed a POST request.");
        
            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            AccountPasswords data = JsonConvert.DeserializeObject<AccountPasswords>(requestBody);
            
            e.Encrypt(data.CurrentPassword, out string encryptedPassword);
            data.PartitionKey = partitionKey;
            data.CurrentPassword = encryptedPassword;
            //data.CreatedBy = data.LastModifiedBy = System.Threading.Thread.CurrentPrincipal.Identity.Name.ToString();
            //data.CreatedBy = data.LastModifiedBy = "Brian";
            data.LastModifiedDate = data.CreatedDate = DateTime.Now;

            await accountPasswords.AddAsync(data);
            return (ActionResult)new OkObjectResult(data); 
        }

        [FunctionName("UpdatePassword")]
        public static async Task<IActionResult> Post(
            [HttpTrigger(AuthorizationLevel.Function, "put", Route = "passwords/{id}")] HttpRequest req,
            string id,
            [CosmosDB(
                databaseName: "AccountPasswords",
                collectionName: "Passwords",
                ConnectionStringSetting = "cosmosdb")] DocumentClient client,
            ILogger log) 
        {
            log.LogInformation("C# HTTP trigger function processed a PUT request.");
            
            var opts =  new RequestOptions{
                PartitionKey = new PartitionKey(partitionKey)
            };

            Document document = await client.ReadDocumentAsync(UriFactory.CreateDocumentUri(databaseName, collectionName, id), opts);
            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();

			AccountPasswords data = JsonConvert.DeserializeObject<AccountPasswords>(requestBody);
            data.OldPasswords = document.GetPropertyValue<List<Password>>("OldPasswords");

            var originalEncryptedPassword = document.GetPropertyValue<string>("CurrentPassword");
            e.Decrypt(originalEncryptedPassword, out string originalPassword);

            if( String.Compare(data.CurrentPassword, originalPassword, false) != 0 ) {
                if(data.OldPasswords == null) {
                    data.OldPasswords = new List<Password>();
                }
                data.OldPasswords.Add(new Password(){
                    PreviousPassword = originalEncryptedPassword,
                    CreatedDate = DateTime.Now
                });
            } 

            e.Encrypt(data.CurrentPassword, out string newPassword);
            data.CurrentPassword = newPassword;
            data.PartitionKey = partitionKey;
            //data.LastModifiedBy = System.Threading.Thread.CurrentPrincipal.Identity.Name.ToString();
            //data.LastModifiedBy = "Brian";
            data.LastModifiedDate = DateTime.Now;

            await client.ReplaceDocumentAsync(document.SelfLink, data);
            return (ActionResult)new OkObjectResult(data); 
        }

        [FunctionName("DeletePassword")]
        public static async Task<IActionResult> DeletePassword(
            [HttpTrigger(AuthorizationLevel.Function, "delete", Route = "passwords/{id}")] HttpRequest req,
            string id,
            [CosmosDB(
                databaseName: "AccountPasswords",
                collectionName: "Passwords",
                ConnectionStringSetting = "cosmosdb")] DocumentClient client,
           ILogger log) 

        {
            log.LogInformation("C# HTTP trigger function processed a DELETE request.");

            var opts =  new RequestOptions{
                PartitionKey = new PartitionKey(partitionKey)
            };

            Document document = await client.ReadDocumentAsync(UriFactory.CreateDocumentUri(databaseName, collectionName, id), opts);
			AccountPasswords data = (AccountPasswords)(dynamic)document;
            data.isDeleted = true;
            await client.ReplaceDocumentAsync(document.SelfLink, data);
            return (ActionResult)new OkObjectResult(data); 
        }
    }
}
