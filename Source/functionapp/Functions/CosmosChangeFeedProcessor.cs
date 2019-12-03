
using System;
using System.Collections.Generic;
using Microsoft.Azure.Search;
using Microsoft.Azure.Search.Models;
using Microsoft.Azure.WebJobs;
using Microsoft.Extensions.Logging;
using PasswordService.Models;

namespace PasswordService
{
    public static partial class PasswordService
    {
        [FunctionName("CosmosChangeFeedProcessor")]
        public static void CosmosChangeFeedProcessor(
            [CosmosDBTrigger(
                databaseName: "%COSMOS_DATABASENAME%",
                collectionName: "%COSMOS_COLLECTIONNAME%",
                ConnectionStringSetting = "cosmosdb",
                LeaseCollectionName= "%COSMOS_LEASENAME%",
                LeaseCollectionPrefix="blob",
                CreateLeaseCollectionIfNotExists=true
            )]IReadOnlyList<Microsoft.Azure.Documents.Document> inputStream,  
            ILogger log)
        {
            if (inputStream == null || inputStream.Count <= 0) {
                log.LogInformation($"CosmosChangeFeedProcessor - Fired but inputStream is null");
                return;
            }

            try {
                log.LogInformation($"{inputStream.Count} - Documents will be added to Search");

                var indexClient = serviceClient.Indexes.GetClient(searchIndexName);
                var data = new List<AccountPassword>();
                
                foreach( var document in inputStream ) {
                    data.Add((AccountPassword)(dynamic)document);
                }

                var batch = IndexBatch.MergeOrUpload<AccountPassword>(data);
                indexClient.Documents.Index(batch);
            }
            catch( Exception e ) {
                log.LogInformation($"Failed to index some of the documents: {e.ToString()}");
            }
        }
    }
}
