
using System;
using Microsoft.Azure.Search;
using PasswordService.Common;

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
