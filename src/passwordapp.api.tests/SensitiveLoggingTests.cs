using System.Text.RegularExpressions;

namespace PasswordService.Tests;

// AC-4 regression guard: no HTTP trigger may log a password / secret value.
// PostPassword previously logged the stored password blob; this scans the
// Functions source so any reintroduction (here or in a new trigger) fails CI.
public class SensitiveLoggingTests
{
    private static string FindFunctionsDir()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "src", "passwordapp.api", "Functions");
            if (Directory.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("Could not locate passwordapp.api/Functions source directory");
    }

    [Fact]
    public void No_function_logs_password_or_secret_fields()
    {
        var functionsDir = FindFunctionsDir();
        var sensitive = new Regex(@"CurrentPassword|newPassword|postedPassword|\bPassword\b|\bsecret\b",
            RegexOptions.IgnoreCase);

        var offenders = new List<string>();
        foreach (var file in Directory.EnumerateFiles(functionsDir, "*.cs", SearchOption.AllDirectories))
        {
            var lines = File.ReadAllLines(file);
            for (int i = 0; i < lines.Length; i++)
            {
                if (!lines[i].Contains("_logger.Log")) continue;
                if (sensitive.IsMatch(lines[i]))
                    offenders.Add($"{Path.GetFileName(file)}:{i + 1}: {lines[i].Trim()}");
            }
        }

        Assert.True(offenders.Count == 0,
            "HTTP triggers must never log password/secret values:\n" + string.Join("\n", offenders));
    }
}
