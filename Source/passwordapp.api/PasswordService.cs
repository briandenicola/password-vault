
using System;

using PasswordService.Common;

namespace PasswordService
{
    public static partial class PasswordService
    {
        private static string partitionKey      = Environment.GetEnvironmentVariable("COSMOS_PARTITIONKEY", EnvironmentVariableTarget.Process);

        private static Encryptor e = new Encryptor(
            Environment.GetEnvironmentVariable("AesKey", EnvironmentVariableTarget.Process),
            Environment.GetEnvironmentVariable("AesIV", EnvironmentVariableTarget.Process)
        );
    }
}
