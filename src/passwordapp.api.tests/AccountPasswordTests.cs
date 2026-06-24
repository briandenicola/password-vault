using Newtonsoft.Json;
using PasswordService.Models;

namespace PasswordService.Tests;

public class AccountPasswordTests
{
    // FE-2 — Tags must survive Clone() (used by GetPasswordById) and JSON
    // round-trips (Cosmos persistence + the Post/Update request bodies).

    [Fact]
    public void Clone_PreservesTags()
    {
        var original = new AccountPassword
        {
            id = "1",
            SiteName = "google.com",
            AccountName = "gmail",
            Tags = new List<string> { "email", "personal" },
            CurrentPassword = "enc",
        };

        var clone = original.Clone();

        Assert.NotNull(clone.Tags);
        Assert.Equal(new[] { "email", "personal" }, clone.Tags);
    }

    [Fact]
    public void Clone_WithNullTags_StaysNull()
    {
        var clone = new AccountPassword { id = "1", Tags = null }.Clone();
        Assert.Null(clone.Tags);
    }

    [Fact]
    public void Tags_RoundTripThroughJson()
    {
        var original = new AccountPassword
        {
            id = "1",
            SiteName = "bank.com",
            AccountName = "checking",
            Tags = new List<string> { "finance" },
        };

        var json = JsonConvert.SerializeObject(original);
        var parsed = JsonConvert.DeserializeObject<AccountPassword>(json);

        Assert.NotNull(parsed);
        Assert.Equal(new[] { "finance" }, parsed!.Tags);
    }

    [Fact]
    public void Tags_AbsentFromJson_DeserializesToNull()
    {
        var parsed = JsonConvert.DeserializeObject<AccountPassword>(
            "{\"id\":\"1\",\"SiteName\":\"x\",\"AccountName\":\"y\"}");

        Assert.NotNull(parsed);
        Assert.Null(parsed!.Tags);
    }
}
