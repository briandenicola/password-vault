namespace PasswordService.API
{
    public static partial class PasswordService
    {
        [FunctionName("GetApiStatus")]
        public static IActionResult GetApiStatus(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords/healthz")] HttpRequest req,
            ILogger log)            
        {
            log.LogInformation($"GetApiStatus - health check");
            return new OkObjectResult( new { state = "OK!" });
        }
    }
}
