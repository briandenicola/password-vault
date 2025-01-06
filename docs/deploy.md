API Build & Deployment
=============
* The Vault API is built on dotnet8 and uses Azure Functions with HTTP Triggers.
* It runs as a serverless API on an Linux based Azure Function
* The build and deploy is part of the same process.
* The deployment uploads the published code to an Azure Storage Account and the Function references the code from the storage account using the WEBSITE_RUN_FROM_PACKAGE environment variable.

# Steps
- :one: `task deploy-api`          - Builds and deploys the API to Azure Functions
<p align="right">(<a href="#build">back to top</a>)</p>


UI Build & Deployment
=============
* The Vault UI is built on VUE and uses Azure Static Web Apps.
* The build and deploy is part of the same process.
* The deployment uses the Azure Static Web Apps cli to deploy the application to Azure.

# Steps
- :one: Create a .env.production file in the src/passwordapp.ui folder with the following values:
```
    VUE_APP_AAD_REDIRECT_URL=https://${AZURE_STATIC_WEB_APP_NAME}.azurestaticapps.net || CUSTOM_DOMAIN_NAME }
    VUE_APP_API_ENDPOINT=https://${appName}-functions.azurewebsites.net
    VUE_APP_API_KEY={AZURE_FUNCTION_HOST_KEY} #`task host-key` will get the host key
    VUE_APP_AAD_CLIENT_ID=${AAD_CLIENT_ID_OF_API_APP_REG_CREATED_EARLIER}
    VUE_APP_AAD_TENANT_ID=${ENTRA_ID_TENANT_ID}
    VUE_APP_AAD_SCOPE=https://${appName}-functions.azurewebsites.net
```
- :two: `task deploy-ui`          - Builds and deploys the UI to Azure Static Web Apps
<p align="right">(<a href="#build">back to top</a>)</p>

MaintenanceDeployment
=============
* The Maintenance API is built on Python and uses timer job with Azure Functions 
* The Keep Alive function is used to keep the Azure Functions warm and responsive
* The maintenance function is deployed to a separate Azure Function App
* The build and deploy is part of the same process.

# Steps
- :one: `task deploy-maintenance`          - Builds and deploys the API to Azure Functions
<p align="right">(<a href="#build">back to top</a>)</p>


# Navigation
[Previous Section ⏪](./entra.md) ‖ [Return to Main Index 🏠](../README.md) ‖ 
<p align="right">(<a href="#build">back to top</a>)</p>