using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using PasswordService.Common;

namespace PasswordService.Tests;

public class VaultBackupImporterTests
{
    private static Encryptor NewEncryptor()
    {
        var key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var iv = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        return new Encryptor(key, iv);
    }

    private static (string hmac, string cipher, string blob) V1(Encryptor e, string plaintext)
    {
        var hmac = e.Encrypt(plaintext, out string? cipher);
        return (hmac, cipher!, $"{hmac}:{cipher}");
    }

    [Fact]
    public void PlanRestore_ImportsCurrentBackupJsonShape_AndStripsCosmosMetadata()
    {
        var encryptor = NewEncryptor();
        var current = V1(encryptor, "current-secret");
        var old = V1(encryptor, "old-secret");
        var backupDoc = new JObject
        {
            ["PartitionKey"] = "Passwords",
            ["id"] = "01d87788-6ec7-40d3-b087-3ed398b7e3a8",
            ["SiteName"] = "Fidelity",
            ["AccountName"] = "US32784",
            ["CurrentPassword"] = current.blob,
            ["OldPasswords"] = new JArray
            {
                new JObject
                {
                    ["Password"] = new JObject
                    {
                        ["EncryptedPassword"] = old.cipher,
                        ["HmacHash"] = old.hmac,
                    },
                    ["CreatedDate"] = "2022-12-21T15:50:57.8518294+00:00",
                },
            },
            ["Notes"] = "Microsoft HSA, 401K and stock holdings",
            ["SecurityQuestions"] = new JArray
            {
                new JObject
                {
                    ["Question"] = "",
                    ["Answer"] = "",
                },
            },
            ["isDeleted"] = false,
            ["CreatedDate"] = "2019-01-14T04:31:56.3005029+00:00",
            ["CreatedBy"] = "brian@example.com",
            ["LastModifiedDate"] = "2025-11-17T16:51:53.883871+00:00",
            ["LastModifiedBy"] = "brian@example.com",
            ["_rid"] = "CC5WAO7IJokBAAAAAAAAAA==",
            ["_self"] = "dbs/CC5WAA==/colls/CC5WAO7IJok=/docs/CC5WAO7IJokBAAAAAAAAAA==/",
            ["_etag"] = "\"3400ecff-0000-0300-0000-691b52a90000\"",
            ["_attachments"] = "attachments/",
            ["_ts"] = 1763398313,
        };

        var plan = VaultBackupImporter.PlanRestore(encryptor, new[] { backupDoc });

        Assert.Equal(1, plan.DocumentsReady);
        Assert.Equal(0, plan.DocumentsFailed);
        Assert.Equal(2, plan.SecretsTransformed);
        Assert.Equal(2, plan.SecretsVerified);
        Assert.Empty(plan.Errors);

        var restored = plan.Documents.Single();
        Assert.Equal("Fidelity", (string?)restored["SiteName"]);
        Assert.Equal("Microsoft HSA, 401K and stock holdings", (string?)restored["Notes"]);
        Assert.Equal("2019-01-14T04:31:56.3005029+00:00", (string?)restored["CreatedDate"]);
        Assert.NotNull(restored["SecurityQuestions"]);
        Assert.Null(restored["_etag"]);
        Assert.Null(restored["_ts"]);

        var restoredCurrent = (string)restored["CurrentPassword"]!;
        Assert.StartsWith("v2.gcm.", restoredCurrent);
        Assert.Equal("current-secret", encryptor.DecryptStored(restoredCurrent));

        var historySecret = (JObject)restored["OldPasswords"]![0]!["Password"]!;
        Assert.False(string.IsNullOrWhiteSpace((string?)historySecret["iv"]));
        Assert.Equal(JTokenType.Null, historySecret["HmacHash"]?.Type);
        var historyBlob = SecretEnvelope.FromV2Gcm((string)historySecret["iv"]!, (string)historySecret["EncryptedPassword"]!).Serialize();
        Assert.Equal("old-secret", encryptor.DecryptStored(historyBlob));
    }

    [Fact]
    public void PlanRestore_DecryptsWithSourceKeyAndReencryptsWithTargetKey()
    {
        var sourceEncryptor = NewEncryptor();
        var targetEncryptor = NewEncryptor();
        var current = V1(sourceEncryptor, "source-secret");
        var backupDoc = new JObject
        {
            ["PartitionKey"] = "Passwords",
            ["id"] = "cross-key",
            ["CurrentPassword"] = current.blob,
        };

        var plan = VaultBackupImporter.PlanRestore(sourceEncryptor, targetEncryptor, new[] { backupDoc });

        Assert.Equal(1, plan.DocumentsReady);
        var restoredBlob = (string)plan.Documents.Single()["CurrentPassword"]!;
        Assert.Equal("source-secret", targetEncryptor.DecryptStored(restoredBlob));
        Assert.Null(sourceEncryptor.DecryptStored(restoredBlob));
    }

    [Fact]
    public void PlanRestore_RefusesPartialFailure()
    {
        var encryptor = NewEncryptor();
        var good = new JObject
        {
            ["PartitionKey"] = "Passwords",
            ["id"] = "good",
            ["CurrentPassword"] = V1(encryptor, "current").blob,
        };
        var bad = new JObject
        {
            ["PartitionKey"] = "Passwords",
            ["id"] = "bad",
            ["CurrentPassword"] = "not-a-valid-secret",
        };

        var plan = VaultBackupImporter.PlanRestore(encryptor, new[] { good, bad });

        Assert.Equal(1, plan.DocumentsReady);
        Assert.Equal(1, plan.DocumentsFailed);
        Assert.Single(plan.Documents);
        Assert.Contains(plan.Errors, e => e.Contains("bad", StringComparison.Ordinal));
        Assert.Contains(plan.Errors, e => e.Contains("currentPassword", StringComparison.OrdinalIgnoreCase));
    }
}
