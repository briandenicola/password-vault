using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using PasswordService.Common;

namespace PasswordService.Tests;

public class DocumentMigratorTests
{
    private static Encryptor NewEncryptor()
    {
        var key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var iv = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        return new Encryptor(key, iv);
    }

    private static (string hmac, string cipher) V1Parts(Encryptor e, string plaintext)
    {
        var hmac = e.Encrypt(plaintext, out string? cipher);
        return (hmac, cipher!);
    }

    [Fact]
    public void MigrateDocument_RewritesCurrentAndHistory_AndVerifies()
    {
        var e = NewEncryptor();
        var (curHmac, curCipher) = V1Parts(e, "current-secret");
        var (oldHmac, oldCipher) = V1Parts(e, "old-secret");

        var doc = new JObject
        {
            ["id"] = "abc",
            ["siteName"] = "example.com",
            ["currentPassword"] = $"{curHmac}:{curCipher}",
            ["oldPasswords"] = new JArray
            {
                new JObject
                {
                    ["password"] = new JObject
                    {
                        ["encryptedPassword"] = oldCipher,
                        ["hmacHash"] = oldHmac,
                    },
                    ["createdDate"] = "2024-01-01T00:00:00",
                },
            },
        };

        var report = DocumentMigrator.MigrateDocument(e, doc);

        Assert.True(report.Changed);
        Assert.Equal(2, report.Migrated);
        Assert.Equal(0, report.Failed);

        // Current password is now a v2 blob that decrypts to the original.
        var newCurrent = (string)doc["currentPassword"]!;
        Assert.StartsWith("v2.gcm.", newCurrent);
        Assert.Equal("current-secret", e.DecryptStored(newCurrent));

        // History entry now holds a v2-shaped object (iv + ciphertext+tag, no hmac) that decrypts.
        var secret = (JObject)doc["oldPasswords"]![0]!["password"]!;
        var iv = (string?)secret["iv"];
        var cipher = (string?)secret["encryptedPassword"];
        Assert.False(string.IsNullOrEmpty(iv));
        var rebuilt = SecretEnvelope.FromV2Gcm(iv!, cipher!).Serialize();
        Assert.Equal("old-secret", e.DecryptStored(rebuilt));

        // Untouched fields are preserved.
        Assert.Equal("example.com", (string?)doc["siteName"]);
        Assert.Equal("2024-01-01T00:00:00", (string?)doc["oldPasswords"]![0]!["createdDate"]);
    }

    [Fact]
    public void MigrateDocument_IsCaseInsensitiveOnFieldNames()
    {
        var e = NewEncryptor();
        var (hmac, cipher) = V1Parts(e, "pascal-cased");

        // Documents stored with PascalCase property names must also migrate.
        var doc = new JObject
        {
            ["id"] = "x",
            ["CurrentPassword"] = $"{hmac}:{cipher}",
        };

        var report = DocumentMigrator.MigrateDocument(e, doc);

        Assert.True(report.Changed);
        Assert.Equal(1, report.Migrated);
        // Original casing of the property is preserved.
        Assert.NotNull(doc["CurrentPassword"]);
        Assert.Null(doc["currentPassword"]);
        Assert.Equal("pascal-cased", e.DecryptStored((string)doc["CurrentPassword"]!));
    }

    [Fact]
    public void MigrateDocument_AlreadyV2_NoChange()
    {
        var e = NewEncryptor();
        var doc = new JObject
        {
            ["id"] = "x",
            ["currentPassword"] = e.EncryptGcm("modern"),
        };
        var before = doc["currentPassword"]!.ToString();

        var report = DocumentMigrator.MigrateDocument(e, doc);

        Assert.False(report.Changed);
        Assert.Equal(1, report.AlreadyV2);
        Assert.Equal(before, doc["currentPassword"]!.ToString());
    }

    [Fact]
    public void MigrateDocument_RunTwice_SecondRunIsNoOp()
    {
        var e = NewEncryptor();
        var (hmac, cipher) = V1Parts(e, "twice");
        var doc = new JObject { ["id"] = "x", ["currentPassword"] = $"{hmac}:{cipher}" };

        DocumentMigrator.MigrateDocument(e, doc);
        var afterFirst = doc["currentPassword"]!.ToString();
        var report2 = DocumentMigrator.MigrateDocument(e, doc);

        Assert.False(report2.Changed);
        Assert.Equal(1, report2.AlreadyV2);
        Assert.Equal(afterFirst, doc["currentPassword"]!.ToString());
    }

    [Fact]
    public void MigrateDocument_NoSecretFields_IsNoOp()
    {
        var e = NewEncryptor();
        var doc = new JObject { ["id"] = "x", ["siteName"] = "no-secrets-here" };

        var report = DocumentMigrator.MigrateDocument(e, doc);

        Assert.False(report.Changed);
        Assert.Equal(0, report.Migrated);
        Assert.Equal(0, report.Failed);
    }
}
