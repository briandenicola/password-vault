using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using PasswordService.Common;

namespace PasswordService.Tests;

public class BlueGreenVaultTransformerTests
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

    private static JObject SourceDoc(Encryptor oldEncryptor, string current = "current-secret", params string[] history)
    {
        var currentSecret = V1(oldEncryptor, current);
        var doc = new JObject
        {
            ["PartitionKey"] = "vault",
            ["id"] = "acct-1",
            ["SiteName"] = "example.com",
            ["AccountName"] = "brian",
            ["CurrentPassword"] = currentSecret.blob,
            ["OldPasswords"] = new JArray(),
        };

        var historyArray = (JArray)doc["OldPasswords"]!;
        for (var i = 0; i < history.Length; i++)
        {
            var old = V1(oldEncryptor, history[i]);
            historyArray.Add(new JObject
            {
                ["Password"] = new JObject
                {
                    ["EncryptedPassword"] = old.cipher,
                    ["HmacHash"] = old.hmac,
                },
                ["CreatedDate"] = $"2024-01-0{i + 1}T00:00:00Z",
            });
        }

        return doc;
    }

    [Fact]
    public void TransformDocument_HappyPath_WritesNewSchemaAndDecryptsWithDek()
    {
        var oldEncryptor = NewEncryptor();
        var dekEncryptor = NewEncryptor();
        var doc = SourceDoc(oldEncryptor);

        var result = BlueGreenVaultTransformer.TransformDocument(oldEncryptor, dekEncryptor, doc);

        Assert.True(result.Success);
        Assert.NotNull(result.Document);
        Assert.Equal(1, result.SecretsTransformed);
        Assert.Equal("vault", (string?)result.Document["PartitionKey"]);
        Assert.Equal("acct-1", (string?)result.Document["id"]);
        Assert.Equal("example.com", (string?)result.Document["SiteName"]);
        Assert.Equal("brian", (string?)result.Document["AccountName"]);
        Assert.Equal("current-secret", dekEncryptor.DecryptStored((string)result.Document["CurrentPassword"]!));
        Assert.DoesNotContain("HmacHash", result.Document.ToString());
    }

    [Fact]
    public void TransformDocument_HistoryEntries_BecomeV2BlobStrings()
    {
        var oldEncryptor = NewEncryptor();
        var dekEncryptor = NewEncryptor();
        var doc = SourceDoc(oldEncryptor, "current", "old-1", "old-2");

        var result = BlueGreenVaultTransformer.TransformDocument(oldEncryptor, dekEncryptor, doc);

        Assert.True(result.Success);
        Assert.Equal(3, result.SecretsTransformed);
        var history = (JArray)result.Document!["OldPasswords"]!;
        Assert.Equal(2, history.Count);
        Assert.Equal("old-1", dekEncryptor.DecryptStored((string)history[0]!["Password"]!));
        Assert.Equal("old-2", dekEncryptor.DecryptStored((string)history[1]!["Password"]!));
        Assert.StartsWith("v2.gcm.", (string)history[0]!["Password"]!);
        Assert.Equal("2024-01-01T00:00:00Z", (string?)history[0]!["CreatedDate"]);
    }

    [Fact]
    public void TransformDocument_NonAscii_RoundTripsByValue()
    {
        var oldEncryptor = NewEncryptor();
        var dekEncryptor = NewEncryptor();
        var plaintext = "Sén̈or-P@ss-🔐-🗝️";
        var doc = SourceDoc(oldEncryptor, plaintext);

        var result = BlueGreenVaultTransformer.TransformDocument(oldEncryptor, dekEncryptor, doc);

        Assert.True(result.Success);
        Assert.Equal(plaintext, dekEncryptor.DecryptStored((string)result.Document!["CurrentPassword"]!));
    }

    [Fact]
    public void TransformDocument_CorruptEntry_FailsWithoutDocument()
    {
        var oldEncryptor = NewEncryptor();
        var dekEncryptor = NewEncryptor();
        var doc = SourceDoc(oldEncryptor);
        doc["CurrentPassword"] = "not-a-valid-secret";

        var result = BlueGreenVaultTransformer.TransformDocument(oldEncryptor, dekEncryptor, doc);

        Assert.False(result.Success);
        Assert.Null(result.Document);
        Assert.Contains(result.Errors, e => e.Contains("CurrentPassword", StringComparison.Ordinal));
    }

    [Fact]
    public void TransformDocument_IsIdempotentForNewSchemaInput()
    {
        var oldEncryptor = NewEncryptor();
        var dekEncryptor = NewEncryptor();
        var first = BlueGreenVaultTransformer.TransformDocument(oldEncryptor, dekEncryptor, SourceDoc(oldEncryptor, "current", "old")).Document!;

        var second = BlueGreenVaultTransformer.TransformDocument(oldEncryptor, dekEncryptor, first);

        Assert.True(second.Success);
        Assert.Equal(0, second.SecretsTransformed);
        Assert.Equal(2, second.AlreadyNew);
        Assert.Equal((string)first["CurrentPassword"]!, (string)second.Document!["CurrentPassword"]!);
        Assert.Equal((string)first["OldPasswords"]![0]!["Password"]!, (string)second.Document["OldPasswords"]![0]!["Password"]!);
    }

    [Fact]
    public void PlanImport_RefusesPartialFailure()
    {
        var oldEncryptor = NewEncryptor();
        var dekEncryptor = NewEncryptor();
        var good = SourceDoc(oldEncryptor);
        var bad = SourceDoc(oldEncryptor);
        bad["id"] = "acct-bad";
        bad["CurrentPassword"] = "corrupt";

        var plan = BlueGreenVaultTransformer.PlanImport(oldEncryptor, dekEncryptor, new[] { good, bad });

        Assert.Equal(1, plan.DocumentsReady);
        Assert.Equal(1, plan.DocumentsFailed);
        Assert.Single(plan.Documents);
        Assert.Contains(plan.Errors, e => e.Contains("acct-bad", StringComparison.Ordinal));
    }

    [Fact]
    public void VerifyParity_HappyPath_ChecksCurrentAndHistory()
    {
        var oldEncryptor = NewEncryptor();
        var dekEncryptor = NewEncryptor();
        var oldDoc = SourceDoc(oldEncryptor, "current", "old");
        var newDoc = BlueGreenVaultTransformer.TransformDocument(oldEncryptor, dekEncryptor, oldDoc).Document!;

        var parity = BlueGreenVaultTransformer.VerifyParity(oldEncryptor, dekEncryptor, new[] { oldDoc }, new[] { newDoc });

        Assert.True(parity.Success);
        Assert.Equal(1, parity.AccountsChecked);
        Assert.Equal(2, parity.SecretsChecked);
    }

    [Fact]
    public void VerifyParity_ReportsMismatchAndUndecryptableEntry()
    {
        var oldEncryptor = NewEncryptor();
        var dekEncryptor = NewEncryptor();
        var oldDoc = SourceDoc(oldEncryptor, "current", "old");
        var newDoc = BlueGreenVaultTransformer.TransformDocument(oldEncryptor, dekEncryptor, oldDoc).Document!;
        newDoc["CurrentPassword"] = dekEncryptor.EncryptGcm("wrong");
        newDoc["OldPasswords"]![0]!["Password"] = "v2.gcm.bad.bad";

        var parity = BlueGreenVaultTransformer.VerifyParity(oldEncryptor, dekEncryptor, new[] { oldDoc }, new[] { newDoc });

        Assert.False(parity.Success);
        Assert.Contains(parity.Errors, e => e.Contains("CurrentPassword: value mismatch", StringComparison.Ordinal));
        Assert.Contains(parity.Errors, e => e.Contains("OldPasswords[0].Password: new decrypt failed", StringComparison.Ordinal));
    }
}
