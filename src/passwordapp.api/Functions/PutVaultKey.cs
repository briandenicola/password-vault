using System.Net;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace PasswordService.API
{
    public partial class PasswordService
    {
        // Multi-output: only write to Cosmos when Record is non-null, so an invalid
        // request never persists a malformed (or empty) record that could lock the
        // vault out.
        public class PutVaultKeyOutput
        {
            [CosmosDBOutput(
                "%COSMOS_DATABASE_NAME%",
                "%COSMOS_KEY_COLLECTION_NAME%",
                PartitionKey = "%COSMOS_KEY_PARTITION_KEY%",
                Connection = "COSMOSDB")]
            public VaultKeyRecord? Record { get; set; }

            [HttpResult]
            public HttpResponseData Response { get; set; } = default!;
        }

        // OFF-4 Phase 2a: upsert the per-vault key record. The body carries only the
        // PRF salt and wrapped DEKs; the server forces the singleton id + partition key
        // and stores the rest opaquely (it cannot unwrap anything).
        [Function(nameof(PutVaultKey))]
        public async Task<PutVaultKeyOutput> PutVaultKey(
            [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "vault-key")] HttpRequestData req)
        {
            if (!E2eeFeature.IsEnabled(name => Environment.GetEnvironmentVariable(name)))
                return new PutVaultKeyOutput { Response = await TextResponse(req, HttpStatusCode.NotFound, "E2EE is not enabled") };

            _logger.LogInformation("PutVaultKey request received");

            var body = await req.ReadAsStringAsync();
            VaultKeyRecord? record = null;
            if (!string.IsNullOrWhiteSpace(body))
            {
                try { record = JsonConvert.DeserializeObject<VaultKeyRecord>(body); }
                catch (JsonException) { record = null; }
            }

            var error = VaultKeyRecordValidator.Validate(record);
            if (error != null)
                return new PutVaultKeyOutput { Response = await TextResponse(req, HttpStatusCode.BadRequest, error) };

            // Server owns the routing fields — never trust client-supplied id/partition key.
            record!.id = VaultKeyRecordValidator.RecordId;
            record.PartitionKey = Environment.GetEnvironmentVariable("COSMOS_KEY_PARTITION_KEY") ?? "VaultKeys";
            record.LastModifiedDate = DateTime.UtcNow;

            var ok = req.CreateResponse(HttpStatusCode.OK);
            await ok.WriteAsJsonAsync(record);
            return new PutVaultKeyOutput { Record = record, Response = ok };
        }

        private static async Task<HttpResponseData> TextResponse(HttpRequestData req, HttpStatusCode code, string message)
        {
            var res = req.CreateResponse(code);
            await res.WriteStringAsync(message);
            return res;
        }
    }
}
