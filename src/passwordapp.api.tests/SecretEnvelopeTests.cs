using System.Security.Cryptography;
using PasswordService.Common;

namespace PasswordService.Tests;

public class SecretEnvelopeTests
{
    // --- Legacy (v1) compatibility: the critical MIG-1 regression guarantee ---

    [Fact]
    public void Parse_LegacyV1Blob_DetectedAsV1AndSplitsParts()
    {
        var env = SecretEnvelope.Parse("aGVsbG8=:d29ybGQ=");

        Assert.Equal(SecretFormat.V1CbcHmac, env.Format);
        Assert.Equal("aGVsbG8=", env.HmacHash);
        Assert.Equal("d29ybGQ=", env.Ciphertext);
    }

    [Fact]
    public void Parse_LegacyV1Blob_SerializesByteIdentical()
    {
        const string stored = "aGVsbG8=:d29ybGQ=";
        Assert.Equal(stored, SecretEnvelope.Parse(stored).Serialize());
    }

    // The exact failing path MIG-1 must not break: a real Encryptor v1 output must still
    // parse as v1 and decrypt to the original plaintext via the legacy fields.
    [Theory]
    [InlineData("simple-password")]
    [InlineData("contraseña")]
    [InlineData("P@ss🔐word")]
    public void Parse_RealEncryptorOutput_RoundTripsThroughEnvelope(string plaintext)
    {
        var key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var iv = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        var e = new Encryptor(key, iv);

        // Produce a stored v1 blob exactly as the app does ("<hmac>:<cipher>").
        var hmac = e.Encrypt(plaintext, out string? cipher);
        var stored = $"{hmac}:{cipher}";

        var env = SecretEnvelope.Parse(stored);
        Assert.Equal(SecretFormat.V1CbcHmac, env.Format);

        e.Decrypt(env.Ciphertext!, env.HmacHash!, out string? decrypted);
        Assert.Equal(plaintext, decrypted);
    }

    // --- v2 (AES-GCM) format: parsed/serialized now, crypto lands in CR-2 ---

    [Fact]
    public void Parse_V2GcmBlob_DetectedAndFieldsExtracted()
    {
        var env = SecretEnvelope.Parse("v2.gcm.aXZpdg==.Y3RhbmR0YWc=");

        Assert.Equal(SecretFormat.V2Gcm, env.Format);
        Assert.Equal("aXZpdg==", env.Iv);
        Assert.Equal("Y3RhbmR0YWc=", env.CipherTextAndTag);
    }

    [Fact]
    public void V2Gcm_RoundTripsThroughSerialize()
    {
        var env = SecretEnvelope.FromV2Gcm("aXZpdg==", "Y3RhbmR0YWc=");
        var serialized = env.Serialize();

        Assert.Equal("v2.gcm.aXZpdg==.Y3RhbmR0YWc=", serialized);
        var reparsed = SecretEnvelope.Parse(serialized);
        Assert.Equal(SecretFormat.V2Gcm, reparsed.Format);
        Assert.Equal(env.Iv, reparsed.Iv);
        Assert.Equal(env.CipherTextAndTag, reparsed.CipherTextAndTag);
    }

    // --- Fail loudly on malformed/unknown input (no silent corruption) ---

    [Theory]
    [InlineData("")]                       // empty
    [InlineData("no-delimiter-at-all")]    // legacy split yields one part
    [InlineData(":onlycipher")]            // empty hmac
    [InlineData("onlyhmac:")]              // empty cipher
    [InlineData("v2.gcm.onlyonepart")]     // v2 missing fields
    [InlineData("v2.gcm..emptyiv")]        // v2 empty iv
    [InlineData("v9.unknown.a.b")]         // unknown version prefix
    public void Parse_MalformedInput_ThrowsFormatException(string stored)
    {
        Assert.Throws<FormatException>(() => SecretEnvelope.Parse(stored));
    }
}
