using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace PasswordService.Common
{
    public sealed class VaultBackupBlobStore
    {
        private readonly string _accountName;
        private readonly string _containerName;

        public VaultBackupBlobStore(string accountName, string containerName)
        {
            _accountName = accountName;
            _containerName = containerName;
        }

        public async Task UploadAsync(string blobName, byte[] zipBytes, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(_accountName))
            {
                throw new InvalidOperationException("BACKUP_STORAGE_ACCOUNT_NAME is not configured.");
            }

            if (string.IsNullOrWhiteSpace(_containerName))
            {
                throw new InvalidOperationException("BACKUP_STORAGE_CONTAINER_NAME is not configured.");
            }

            var service = new BlobServiceClient(
                new Uri($"https://{_accountName}.blob.core.windows.net"),
                new DefaultAzureCredential());
            var container = service.GetBlobContainerClient(_containerName);
            await container.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: cancellationToken);

            var blob = container.GetBlobClient(blobName);
            await using var stream = new MemoryStream(zipBytes);
            await blob.UploadAsync(stream, overwrite: false, cancellationToken);
        }
    }
}
