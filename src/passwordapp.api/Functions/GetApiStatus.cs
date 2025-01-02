namespace PasswordService.API
{
    public partial class PasswordService
    {
        [FunctionName("GetApiStatus")]
        public IActionResult GetApiStatus(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords/healthz")] HttpRequest req,
            ILogger log)            
        {
            _logger.LogInformation($"GetApiStatus - health check");
            return new OkObjectResult( new { state = "OK!" });
        }
    }
}
