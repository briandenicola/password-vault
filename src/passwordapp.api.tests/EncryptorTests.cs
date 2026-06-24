using System.Security.Cryptography;
using PasswordService.Common;

namespace PasswordService.Tests;

public class EncryptorTests
{
    private static Encryptor NewEncryptor()
    {
        var key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)); // AES-256 key
        var iv = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));  // 128-bit IV
        return new Encryptor(key, iv);
    }

    private static string RoundTrip(Encryptor e, string plaintext)
    {
        var hmac = e.Encrypt(plaintext, out string? cipher);
        e.Decrypt(cipher!, hmac, out string? decrypted);
        return decrypted ?? string.Empty;
    }

    [Theory]
    [InlineData("simple-password")]
    [InlineData("P@ssw0rd!#$%^&*()")]
    [InlineData("with spaces and 12345")]
    public void RoundTrip_AsciiPassword_ReturnsOriginal(string plaintext)
    {
        var e = NewEncryptor();
        Assert.Equal(plaintext, RoundTrip(e, plaintext));
    }

    // Regression for CR-1: encryption previously used Encoding.ASCII, which silently
    // replaced non-ASCII characters with '?' and made these passwords unrecoverable.
    [Theory]
    [InlineData("contraseña")]            // Spanish ñ + accent
    [InlineData("naïve-café-£99")]        // accents + currency symbol
    [InlineData("Sén̈or-P@ss-🔐-🗝️")]      // combining marks + emoji
    [InlineData("Ω≈ç√∫˜µ≤")]              // assorted Unicode
    public void RoundTrip_NonAsciiPassword_IsPreserved(string plaintext)
    {
        var e = NewEncryptor();
        var decrypted = RoundTrip(e, plaintext);
        Assert.Equal(plaintext, decrypted);
        Assert.DoesNotContain('?', decrypted); // would appear if ASCII mangling regressed
    }

    [Fact]
    public void Decrypt_WithTamperedHmac_DoesNotReturnPlaintext()
    {
        var e = NewEncryptor();
        var hmac = e.Encrypt("super-secret", out string? cipher);

        // Flip the HMAC so integrity verification must fail.
        var bytes = Convert.FromBase64String(hmac);
        bytes[0] ^= 0xFF;
        var tamperedHmac = Convert.ToBase64String(bytes);

        e.Decrypt(cipher!, tamperedHmac, out string? decrypted);
        Assert.NotEqual("super-secret", decrypted);
    }

    [Fact]
    public void Encrypt_EmptyString_ReturnsEmptyAndNullCipher()
    {
        var e = NewEncryptor();
        var hmac = e.Encrypt(string.Empty, out string? cipher);
        Assert.Equal(string.Empty, hmac);
        Assert.Null(cipher);
    }

    [Fact]
    public void Encrypt_SamePlaintextTwice_ProducesDifferentCiphertext()
    {
        // A random salt block is prepended before encryption, so ciphertext should differ
        // even for identical plaintext under the same key/IV.
        var e = NewEncryptor();
        e.Encrypt("repeat-me", out string? cipher1);
        e.Encrypt("repeat-me", out string? cipher2);
        Assert.NotEqual(cipher1, cipher2);
    }
}
