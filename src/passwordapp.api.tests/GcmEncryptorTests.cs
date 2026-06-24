using System.Security.Cryptography;
using PasswordService.Common;

namespace PasswordService.Tests;

public class GcmEncryptorTests
{
    private static Encryptor NewEncryptor()
    {
        var key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)); // AES-256 key
        var iv = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));  // legacy IV (unused by GCM)
        return new Encryptor(key, iv);
    }

    [Theory]
    [InlineData("simple-password")]
    [InlineData("P@ssw0rd!#$%^&*()")]
    [InlineData("contraseña")]
    [InlineData("Sén̈or-P@ss-🔐-🗝️")]
    [InlineData("")]
    public void EncryptGcm_RoundTrips_IncludingNonAscii(string plaintext)
    {
        var e = NewEncryptor();
        var blob = e.EncryptGcm(plaintext);

        Assert.StartsWith("v2.gcm.", blob);
        Assert.Equal(plaintext, e.DecryptStored(blob));
    }

    [Fact]
    public void EncryptGcm_ProducesParseableV2Envelope()
    {
        var e = NewEncryptor();
        var env = SecretEnvelope.Parse(e.EncryptGcm("hello"));
        Assert.Equal(SecretFormat.V2Gcm, env.Format);
    }

    // CR-3/CR-4: a fresh random nonce per call means identical plaintexts must NOT produce
    // identical stored blobs (no plaintext-equality fingerprint).
    [Fact]
    public void EncryptGcm_SamePlaintextTwice_ProducesDifferentBlobs()
    {
        var e = NewEncryptor();
        var a = e.EncryptGcm("repeat-me");
        var b = e.EncryptGcm("repeat-me");
        Assert.NotEqual(a, b);
    }

    [Fact]
    public void DecryptGcm_TamperedCiphertext_ReturnsNull()
    {
        var e = NewEncryptor();
        var env = SecretEnvelope.Parse(e.EncryptGcm("super-secret"));

        // Flip a byte in the ciphertext+tag so the auth tag must fail.
        var bytes = Convert.FromBase64String(env.CipherTextAndTag!);
        bytes[0] ^= 0xFF;
        var tampered = Convert.ToBase64String(bytes);

        Assert.Null(e.DecryptGcm(env.Iv!, tampered));
    }

    [Fact]
    public void DecryptGcm_WrongKey_ReturnsNull()
    {
        var e1 = NewEncryptor();
        var env = SecretEnvelope.Parse(e1.EncryptGcm("super-secret"));

        var e2 = NewEncryptor(); // different key
        Assert.Null(e2.DecryptGcm(env.Iv!, env.CipherTextAndTag!));
    }

    // The migration-critical guarantee: after the v2 refactor, a legacy v1 blob produced by the
    // old AES-CBC + HMAC path must still decrypt through the unified version-routing entry point.
    [Theory]
    [InlineData("legacy-secret")]
    [InlineData("café-£99")]
    public void DecryptStored_LegacyV1Blob_StillDecrypts(string plaintext)
    {
        var e = NewEncryptor();
        var hmac = e.Encrypt(plaintext, out string? cipher);
        var v1Blob = $"{hmac}:{cipher}"; // exactly what the old app stored

        Assert.Equal(plaintext, e.DecryptStored(v1Blob));
    }

    [Fact]
    public void DecryptStored_RoutesV1AndV2_FromSameEncryptor()
    {
        var e = NewEncryptor();

        var hmac = e.Encrypt("old-way", out string? cipher);
        var v1 = $"{hmac}:{cipher}";
        var v2 = e.EncryptGcm("new-way");

        Assert.Equal("old-way", e.DecryptStored(v1));
        Assert.Equal("new-way", e.DecryptStored(v2));
    }
}
