using PasswordService.Common;

namespace PasswordService.Tests;

public class E2eeFeatureTests
{
    private static Func<string, string?> Env(string? value) => _ => value;

    [Theory]
    [InlineData("true")]
    [InlineData("True")]
    [InlineData("TRUE")]
    [InlineData("  true  ")]
    public void Enabled_only_for_explicit_true(string value)
    {
        Assert.True(E2eeFeature.IsEnabled(Env(value)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("false")]
    [InlineData("0")]
    [InlineData("1")]
    [InlineData("yes")]
    [InlineData("enabled")]
    public void Disabled_by_default_and_for_anything_else(string? value)
    {
        Assert.False(E2eeFeature.IsEnabled(Env(value)));
    }

    [Fact]
    public void Null_accessor_is_disabled()
    {
        Assert.False(E2eeFeature.IsEnabled(null!));
    }

    [Fact]
    public void Reads_the_expected_variable_name()
    {
        var enabled = E2eeFeature.IsEnabled(name => name == E2eeFeature.EnvVar ? "true" : "false");
        Assert.True(enabled);
    }
}
