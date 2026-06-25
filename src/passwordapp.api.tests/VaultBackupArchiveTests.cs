using System.IO.Compression;
using Newtonsoft.Json;
using PasswordService.Common;
using PasswordService.Models;

namespace PasswordService.Tests;

public class VaultBackupArchiveTests
{
    [Fact]
    public void Create_ZipsEncryptedPasswordDocumentsWithoutDecrypting()
    {
        var accounts = new[]
        {
            new AccountPassword
            {
                id = "acct-1",
                PartitionKey = "Passwords",
                SiteName = "example.com",
                AccountName = "alice",
                CurrentPassword = "v2.gcm.iv.cipher",
                OldPasswords = new List<PasswordHistory>
                {
                    new()
                    {
                        Password = new PasswordEntity("v2.gcm.oldiv.oldcipher"),
                        CreatedDate = DateTime.Parse("2026-01-01T00:00:00Z"),
                    },
                },
                Notes = "metadata stays",
            },
        };

        var result = VaultBackupArchive.Create(accounts, DateTimeOffset.Parse("2026-06-25T20:00:00Z"));

        Assert.Equal("vault-backups/vault-backup-20260625-200000.zip", result.BlobName);
        Assert.Equal(1, result.DocumentCount);

        using var zip = new ZipArchive(new MemoryStream(result.ZipBytes), ZipArchiveMode.Read);
        var passwordsEntry = zip.GetEntry("passwords.json");
        Assert.NotNull(passwordsEntry);
        using var reader = new StreamReader(passwordsEntry!.Open());
        var json = reader.ReadToEnd();

        Assert.Contains("v2.gcm.iv.cipher", json);
        Assert.Contains("\"Iv\": \"oldiv\"", json);
        Assert.Contains("\"EncryptedPassword\": \"oldcipher\"", json);
        Assert.Contains("metadata stays", json);
        Assert.DoesNotContain("alice-password", json);

        var restored = JsonConvert.DeserializeObject<List<AccountPassword>>(json);
        Assert.Single(restored!);
        Assert.Equal("v2.gcm.iv.cipher", restored![0].CurrentPassword);
    }
}
