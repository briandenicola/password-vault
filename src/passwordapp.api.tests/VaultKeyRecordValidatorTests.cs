using PasswordService.Common;
using PasswordService.Models;

namespace PasswordService.Tests;

public class VaultKeyRecordValidatorTests
{
    private static string B64(string raw) => Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(raw));

    private static VaultKeyRecord ValidRecord() => new()
    {
        id = VaultKeyRecordValidator.RecordId,
        PrfSalt = B64("sixteen-byte-salt"),
        WrappedDeks = new List<WrappedDek>
        {
            new() { CredentialId = "cred-1", Label = "Brian-iPhone", Wrapped = B64("wrapped-dek-1") }
        }
    };

    [Fact]
    public void Valid_record_passes()
    {
        Assert.Null(VaultKeyRecordValidator.Validate(ValidRecord()));
    }

    [Fact]
    public void Null_id_is_allowed_server_assigns_it()
    {
        var r = ValidRecord();
        r.id = null;
        Assert.Null(VaultKeyRecordValidator.Validate(r));
    }

    [Fact]
    public void Multiple_unique_deks_pass()
    {
        var r = ValidRecord();
        r.WrappedDeks!.Add(new WrappedDek { CredentialId = "recovery-key", Label = "recovery-key", Wrapped = B64("wrapped-dek-2") });
        Assert.Null(VaultKeyRecordValidator.Validate(r));
    }

    [Fact]
    public void Null_record_fails()
    {
        Assert.NotNull(VaultKeyRecordValidator.Validate(null));
    }

    [Fact]
    public void Wrong_id_fails()
    {
        var r = ValidRecord();
        r.id = "something-else";
        Assert.NotNull(VaultKeyRecordValidator.Validate(r));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not base64!!")]
    public void Bad_prf_salt_fails(string? salt)
    {
        var r = ValidRecord();
        r.PrfSalt = salt;
        Assert.NotNull(VaultKeyRecordValidator.Validate(r));
    }

    [Fact]
    public void Null_wrapped_deks_fails()
    {
        var r = ValidRecord();
        r.WrappedDeks = null;
        Assert.NotNull(VaultKeyRecordValidator.Validate(r));
    }

    [Fact]
    public void Empty_wrapped_deks_fails()
    {
        var r = ValidRecord();
        r.WrappedDeks = new List<WrappedDek>();
        Assert.NotNull(VaultKeyRecordValidator.Validate(r));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Missing_credential_id_fails(string? credentialId)
    {
        var r = ValidRecord();
        r.WrappedDeks![0].CredentialId = credentialId;
        Assert.NotNull(VaultKeyRecordValidator.Validate(r));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not base64!!")]
    public void Bad_wrapped_value_fails(string? wrapped)
    {
        var r = ValidRecord();
        r.WrappedDeks![0].Wrapped = wrapped;
        Assert.NotNull(VaultKeyRecordValidator.Validate(r));
    }

    [Fact]
    public void Duplicate_credential_ids_fail()
    {
        var r = ValidRecord();
        r.WrappedDeks!.Add(new WrappedDek { CredentialId = "cred-1", Label = "dup", Wrapped = B64("wrapped-dek-2") });
        Assert.NotNull(VaultKeyRecordValidator.Validate(r));
    }
}
