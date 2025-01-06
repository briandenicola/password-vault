using Microsoft.Azure.Functions.Worker.Http;
using System.Diagnostics;
using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace PasswordService.API
{
    public partial class PasswordService
    {

        [Function(nameof(GetApiStatus))]
        public IActionResult GetApiStatus(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "passwords/healthz")] HttpRequestData req)
        {
            _logger.LogInformation($"GetApiStatus - health check");
            return new OkObjectResult(new { state = "OK!" });
        }       
    }
}

