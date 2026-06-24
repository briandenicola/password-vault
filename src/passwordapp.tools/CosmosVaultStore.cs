using Microsoft.Azure.Cosmos;
using Newtonsoft.Json.Linq;

namespace PasswordService.Tools
{
    /// <summary>
    /// Thin wrapper over the Cosmos SDK for the vault container. Intentionally minimal: read every
    /// document and upsert documents back. All non-trivial logic (crypto, migration, verification)
    /// lives in the unit-tested PasswordService.Common types.
    /// </summary>
    public interface IVaultStore : IAsyncDisposable
    {
        Task<List<JObject>> ReadAllAsync();
        Task UpsertAsync(JObject doc);
    }

    public sealed class CosmosVaultStore : IVaultStore
    {
        private const string PartitionKeyField = "PartitionKey";

        private readonly CosmosClient _client;
        private readonly Container _container;

        public CosmosVaultStore(string connectionString, string database, string collection)
        {
            _client = new CosmosClient(connectionString);
            _container = _client.GetContainer(database, collection);
        }

        public async Task<List<JObject>> ReadAllAsync()
        {
            var results = new List<JObject>();
            using var iterator = _container.GetItemQueryIterator<JObject>(new QueryDefinition("SELECT * FROM c"));
            while (iterator.HasMoreResults)
            {
                foreach (var item in await iterator.ReadNextAsync())
                {
                    results.Add(item);
                }
            }
            return results;
        }

        public Task UpsertAsync(JObject doc)
        {
            var pk = (string?)doc[PartitionKeyField]
                     ?? (string?)doc.Properties()
                         .FirstOrDefault(p => string.Equals(p.Name, PartitionKeyField, StringComparison.OrdinalIgnoreCase))?.Value;

            return pk is null
                ? _container.UpsertItemAsync(doc)
                : _container.UpsertItemAsync(doc, new PartitionKey(pk));
        }

        public ValueTask DisposeAsync()
        {
            _client.Dispose();
            return ValueTask.CompletedTask;
        }
    }
}
