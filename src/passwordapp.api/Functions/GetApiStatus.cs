
using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using PasswordService.Models;

namespace PasswordService
{
    public static partial class PasswordService
    {
        [FunctionName("GetApiStatus")]
        public static IActionResult GetApiStatus(
            [HttpTrigger(AuthorizationLevel.Function, "get", Route = "passwords/healthz")] HttpRequest req,
            ILogger log)            
        {
            log.LogInformation($"GetApiStatus - health check");
            return (ActionResult)new OkObjectResult( new { state = "OK!" });
        }
    }
}
