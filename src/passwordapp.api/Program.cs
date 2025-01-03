using Microsoft.Azure.Functions.Worker.Builder;


var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();
builder.Build().Run();