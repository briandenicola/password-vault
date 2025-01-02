
namespace PasswordService.API
{
    public static partial class PasswordService
    {
        private static string partitionKey = Environment.GetEnvironmentVariable("COSMOS_PARTITION_KEY", EnvironmentVariableTarget.Process) ?? string.Empty;

        private static Encryptor e = new Encryptor(
            Environment.GetEnvironmentVariable("AesKey", EnvironmentVariableTarget.Process) ?? string.Empty,
            Environment.GetEnvironmentVariable("AesIV", EnvironmentVariableTarget.Process) ?? string.Empty
        );
    }
}
