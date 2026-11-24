using System.Text.Json;
using PasswordService.Models;

namespace PasswordService.Tests;

public class AccountSummaryTests
{
    private static AccountPassword FullAccount() => new()
    {
        PartitionKey = "Passwords",
        id = "1",
        SiteName = "google.com",
        AccountName = "gmail",
        CurrentPassword = "enc-current",
        OldPasswords = new List<PasswordHistory>
        {
            new() { Password = new PasswordEntity("enc-old-hmac:enc-old-cipher"), CreatedDate = new DateTime(2025, 1, 1) },
        },
        Tags = new List<string> { "email" },
        Notes = "note",
        SecurityQuestions = new List<Questions> { new() { Question = "q", Answer = "a" } },
        CreatedDate = new DateTime(2024, 1, 1),
        CreatedBy = "creator@example.com",
        LastModifiedDate = new DateTime(2025, 6, 1),
        LastModifiedBy = "editor@example.com",
    };

    [Fact]
    public void From_CopiesListFields()
    {
        var source = FullAccount();
        var summary = AccountSummary.From(source);

        Assert.Equal(source.id, summary.id);
        Assert.Equal(source.SiteName, summary.SiteName);
        Assert.Equal(source.AccountName, summary.AccountName);
        Assert.Equal(source.Tags, summary.Tags);
        Assert.Equal(source.Notes, summary.Notes);
        Assert.Same(source.SecurityQuestions, summary.SecurityQuestions);
        Assert.Equal(source.CreatedDate, summary.CreatedDate);
        Assert.Equal(source.CreatedBy, summary.CreatedBy);
        Assert.Equal(source.LastModifiedDate, summary.LastModifiedDate);
        Assert.Equal(source.LastModifiedBy, summary.LastModifiedBy);
    }

    [Fact]
    public void Serialized_ExcludesPasswordAndHistory()
    {
        var json = JsonSerializer.Serialize(AccountSummary.From(FullAccount()));

        Assert.DoesNotContain("CurrentPassword", json);
        Assert.DoesNotContain("OldPasswords", json);
        Assert.DoesNotContain("enc-current", json);
        Assert.DoesNotContain("enc-old", json);
        Assert.Contains("gmail", json);
    }
}
