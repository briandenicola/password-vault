
namespace PasswordService.API
{
    public partial class PasswordService
    {
        private readonly ILogger<PasswordService> _logger;
        private string _partitionKey;

        private Encryptor _encryptor; 

        public PasswordService(ILogger<PasswordService> logger)
        {
            _logger = logger;
            _encryptor = new Encryptor(
                Environment.GetEnvironmentVariable("AesKey", EnvironmentVariableTarget.Process) ?? string.Empty,    
                Environment.GetEnvironmentVariable("AesIV", EnvironmentVariableTarget.Process) ?? string.Empty
            );
            _partitionKey = Environment.GetEnvironmentVariable("COSMOS_PARTITION_KEY", EnvironmentVariableTarget.Process) ?? string.Empty;
        }
    }
}
