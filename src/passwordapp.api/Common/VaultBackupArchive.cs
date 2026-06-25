using System.IO.Compression;
using Newtonsoft.Json;
using PasswordService.Models;

namespace PasswordService.Common
{
    public sealed record VaultBackupArchiveResult(string BlobName, byte[] ZipBytes, int DocumentCount);

    public static class VaultBackupArchive
    {
        public static VaultBackupArchiveResult Create(IEnumerable<AccountPassword> accounts, DateTimeOffset createdAt)
        {
            var documents = accounts?.ToList() ?? new List<AccountPassword>();
            var blobName = $"vault-backups/vault-backup-{createdAt:yyyyMMdd-HHmmss}.zip";

            using var output = new MemoryStream();
            using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
            {
                WriteEntry(archive, "passwords.json", JsonConvert.SerializeObject(documents, Formatting.Indented));
                WriteEntry(archive, "manifest.json", JsonConvert.SerializeObject(new
                {
                    createdAtUtc = createdAt.UtcDateTime,
                    documentCount = documents.Count,
                    passwordsRemainEncrypted = true,
                }, Formatting.Indented));
            }

            return new VaultBackupArchiveResult(blobName, output.ToArray(), documents.Count);
        }

        private static void WriteEntry(ZipArchive archive, string name, string content)
        {
            var entry = archive.CreateEntry(name, CompressionLevel.Optimal);
            using var writer = new StreamWriter(entry.Open());
            writer.Write(content);
        }
    }
}
