
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
        private static string partitionKey      = Environment.GetEnvironmentVariable("COSMOS_PARTITIONKEY", EnvironmentVariableTarget.Process);

        private static string searchServiceName = Environment.GetEnvironmentVariable("SEARCH_SERVICENAME", EnvironmentVariableTarget.Process);
        private static string searchAdminKey    = Environment.GetEnvironmentVariable("SEARCH_ADMINKEY", EnvironmentVariableTarget.Process);
        private static string searchIndexName   = Environment.GetEnvironmentVariable("SEARCH_INDEXNAME", EnvironmentVariableTarget.Process);

        private static Encryptor e = new Encryptor(
            Environment.GetEnvironmentVariable("AesKey", EnvironmentVariableTarget.Process),
            Environment.GetEnvironmentVariable("AesIV", EnvironmentVariableTarget.Process)
        );

        private static SearchServiceClient serviceClient = new SearchServiceClient(
            searchServiceName, 
            new SearchCredentials(searchAdminKey)
        );
    }
}
