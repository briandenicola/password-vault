using System.Security.Cryptography;
using System.Text;
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
            ["Notes"] = "keep this note",
            ["Tags"] = new JArray("finance", "shared"),
            ["SecurityQuestions"] = new JArray(
                new JObject
                {
                    ["Question"] = "first pet",
                    ["Answer"] = "waffles",
                }),
            ["isDeleted"] = false,
            ["CreatedDate"] = "2023-12-01T00:00:00Z",
            ["CreatedBy"] = "creator@example.com",
            ["LastModifiedDate"] = "2024-01-02T00:00:00Z",
            ["LastModifiedBy"] = "editor@example.com",
            ["_rid"] = "cosmos-rid",
            ["_self"] = "cosmos-self",
            ["_etag"] = "cosmos-etag",
            ["_attachments"] = "attachments/",
            ["_ts"] = 123456,
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
                ["ChangedBy"] = "history-editor@example.com",
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
        Assert.Equal("keep this note", (string?)result.Document["Notes"]);
        Assert.Equal(new[] { "finance", "shared" }, result.Document["Tags"]!.Values<string>().ToArray());
        Assert.Equal("first pet", (string?)result.Document["SecurityQuestions"]![0]!["Question"]);
        Assert.Equal(false, (bool?)result.Document["isDeleted"]);
        Assert.Equal("2023-12-01T00:00:00Z", (string?)result.Document["CreatedDate"]);
        Assert.Equal("creator@example.com", (string?)result.Document["CreatedBy"]);
        Assert.Equal("2024-01-02T00:00:00Z", (string?)result.Document["LastModifiedDate"]);
        Assert.Equal("editor@example.com", (string?)result.Document["LastModifiedBy"]);
        Assert.Null(result.Document["_rid"]);
        Assert.Null(result.Document["_self"]);
        Assert.Null(result.Document["_etag"]);
        Assert.Null(result.Document["_attachments"]);
        Assert.Null(result.Document["_ts"]);
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
        Assert.Equal("history-editor@example.com", (string?)history[0]!["ChangedBy"]);
    }

    [Fact]
    public void TransformDocument_UsesRawDekProtectorForBrowserCompatibleE2ee()
    {
        var oldEncryptor = NewEncryptor();
        var rawDek = RandomNumberGenerator.GetBytes(32);
        var dekProtector = new E2eeDekProtector(rawDek);
        var doc = SourceDoc(oldEncryptor, "client-secret");

        var result = BlueGreenVaultTransformer.TransformDocument(oldEncryptor, dekProtector, doc);

        Assert.True(result.Success);
        var blob = (string)result.Document!["CurrentPassword"]!;
        Assert.Equal("client-secret", DecryptWithRawAesGcm(rawDek, blob));
        Assert.Null(new Encryptor(Convert.ToBase64String(rawDek), Convert.ToBase64String(new byte[16])).DecryptStored(blob));
    }

    [Fact]
    public void E2eeDekProtector_DecryptsRawAesGcmEnvelope()
    {
        var rawDek = Enumerable.Range(0, 32).Select(i => (byte)i).ToArray();
        var envelope = EncryptWithRawAesGcm(rawDek, "browser-compatible");
        var protector = new E2eeDekProtector(rawDek);

        Assert.Equal("browser-compatible", protector.DecryptStored(envelope));
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

    private static string EncryptWithRawAesGcm(byte[] key, string plaintext)
    {
        var nonce = Enumerable.Range(0, 12).Select(i => (byte)(i + 1)).ToArray();
        var plain = Encoding.UTF8.GetBytes(plaintext);
        var cipher = new byte[plain.Length];
        var tag = new byte[16];
        using (var aes = new AesGcm(key, tag.Length))
        {
            aes.Encrypt(nonce, plain, cipher, tag);
        }

        var cipherAndTag = new byte[cipher.Length + tag.Length];
        Buffer.BlockCopy(cipher, 0, cipherAndTag, 0, cipher.Length);
        Buffer.BlockCopy(tag, 0, cipherAndTag, cipher.Length, tag.Length);
        return SecretEnvelope.FromV2Gcm(Convert.ToBase64String(nonce), Convert.ToBase64String(cipherAndTag)).Serialize();
    }

    private static string? DecryptWithRawAesGcm(byte[] key, string envelope)
    {
        var parsed = SecretEnvelope.Parse(envelope);
        var nonce = Convert.FromBase64String(parsed.Iv!);
        var cipherAndTag = Convert.FromBase64String(parsed.CipherTextAndTag!);
        var cipherLength = cipherAndTag.Length - 16;
        var cipher = new byte[cipherLength];
        var tag = new byte[16];
        Buffer.BlockCopy(cipherAndTag, 0, cipher, 0, cipherLength);
        Buffer.BlockCopy(cipherAndTag, cipherLength, tag, 0, tag.Length);
        var plain = new byte[cipherLength];
        using (var aes = new AesGcm(key, tag.Length))
        {
            aes.Decrypt(nonce, cipher, tag, plain);
        }
        return Encoding.UTF8.GetString(plain);
    }
}
