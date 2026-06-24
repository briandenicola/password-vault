using System.Security.Cryptography;
using PasswordService.Common;

namespace PasswordService.Tests;

public class VaultMigrationTests
{
    private static Encryptor NewEncryptor()
    {
        var key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var iv = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        return new Encryptor(key, iv);
    }

    private static string LegacyV1Blob(Encryptor e, string plaintext)
    {
        var hmac = e.Encrypt(plaintext, out string? cipher);
        return $"{hmac}:{cipher}";
    }

    [Theory]
    [InlineData("legacy-secret")]
    [InlineData("café-£99")]
    [InlineData("Sén̈or-P@ss-🔐-🗝️")]
    public void MigrateBlob_V1_ReencryptsToVerifiedV2(string plaintext)
    {
        var e = NewEncryptor();
        var v1 = LegacyV1Blob(e, plaintext);

        var result = VaultMigration.MigrateBlob(e, v1);

        Assert.Equal(MigrationStatus.Migrated, result.Status);
        Assert.NotNull(result.NewBlob);
        Assert.StartsWith("v2.gcm.", result.NewBlob);
        // The new blob must decrypt back to the original — verified, not hopeful.
        Assert.Equal(plaintext, e.DecryptStored(result.NewBlob!));
    }

    [Fact]
    public void MigrateBlob_AlreadyV2_IsSkippedUnchanged()
    {
        var e = NewEncryptor();
        var v2 = e.EncryptGcm("already-modern");

        var result = VaultMigration.MigrateBlob(e, v2);

        Assert.Equal(MigrationStatus.AlreadyV2, result.Status);
        Assert.Equal(v2, result.NewBlob);
        Assert.False(result.ShouldRewrite);
    }

    [Fact]
    public void MigrateBlob_IsIdempotent()
    {
        var e = NewEncryptor();
        var v1 = LegacyV1Blob(e, "rotate-me");

        var first = VaultMigration.MigrateBlob(e, v1);
        var second = VaultMigration.MigrateBlob(e, first.NewBlob);

        Assert.Equal(MigrationStatus.Migrated, first.Status);
        Assert.Equal(MigrationStatus.AlreadyV2, second.Status);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void MigrateBlob_EmptyInput_IsNoOp(string? blob)
    {
        var result = VaultMigration.MigrateBlob(NewEncryptor(), blob);
        Assert.Equal(MigrationStatus.Empty, result.Status);
        Assert.False(result.ShouldRewrite);
    }

    [Fact]
    public void MigrateBlob_UnparseableBlob_FailsWithoutRewrite()
    {
        var result = VaultMigration.MigrateBlob(NewEncryptor(), "this is not a valid blob");
        Assert.Equal(MigrationStatus.Failed, result.Status);
        Assert.Null(result.NewBlob);
        Assert.True(result.IsFailure);
    }

    [Fact]
    public void MigrateBlob_V1ThatCannotDecrypt_Fails()
    {
        // A v1-shaped blob with a valid-base64 but bogus hmac/cipher: HMAC verify must fail,
        // so we must NOT fabricate a v2 entry from it.
        var bogus = $"{Convert.ToBase64String(new byte[64])}:{Convert.ToBase64String(new byte[48])}";
        var result = VaultMigration.MigrateBlob(NewEncryptor(), bogus);
        Assert.Equal(MigrationStatus.Failed, result.Status);
    }

    [Fact]
    public void VerifyBlob_GoodV1_ReportsOk()
    {
        var e = NewEncryptor();
        var v = VaultMigration.VerifyBlob(e, LegacyV1Blob(e, "ok"));
        Assert.True(v.Ok);
        Assert.Equal(SecretFormat.V1CbcHmac, v.Format);
    }

    [Fact]
    public void VerifyBlob_Garbage_ReportsFailure()
    {
        var v = VaultMigration.VerifyBlob(NewEncryptor(), "nonsense");
        Assert.False(v.Ok);
        Assert.NotNull(v.Error);
    }
}
