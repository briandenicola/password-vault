API Build & Deployment
=============
* The Vault API is built on dotnet10 and uses Azure Functions with HTTP Triggers.
* It runs as a serverless API on an Linux based Azure Function
* The build and deploy is part of the same process.
* The deployment uploads the published code to an Azure Storage Account and the Function references the code from the storage account using the WEBSITE_RUN_FROM_PACKAGE environment variable.

# Steps
- :one: `task deploy-api`          - Builds and deploys the API to Azure Functions
- :two: `task cors`                - Configures CORS for the API to allow access from the UI
<p align="right">(<a href="#build">back to top</a>)</p>


UI Build & Deployment
=============
* The Vault UI is built on VUE and uses Azure Static Web Apps.
* The build and deploy is part of the same process.
* The deployment uses the Azure Static Web Apps cli to deploy the application to Azure.
* `task deploy-ui` generates the full `.env` for the build from Terraform outputs and the Azure CLI — **no manual `.env.production` file is required**:
    * App Insights, API endpoint, and Function host key come from Terraform outputs.
    * `VUE_APP_AAD_REDIRECT_URL` defaults to the Static Web App URL (`SWA_DEFAULT_URL`).
    * `VUE_APP_AAD_TENANT_ID` defaults to the signed-in `az` tenant.
    * `VUE_APP_AAD_SCOPE` defaults to the Function App URL (the API App ID URI).
    * `VUE_APP_AAD_CLIENT_ID` has **no** Terraform/az source (the app registration is created manually — see [entra.md](./entra.md)), so it must be set in `infrastructure/.env`.
* Any value can be overridden by exporting the matching `VUE_APP_AAD_*` variable (e.g. in `infrastructure/.env`) — useful for a custom domain redirect URL.
* If `APP_REQUIRES_AUTHENTICATION=true` and `AAD_CLIENT_ID` is empty, `deploy-ui` fails fast rather than shipping a broken sign-in.
* For development, you can disable Entra ID authentication by setting `VUE_APP_REQUIRES_AUTHENTICATION` to false in the `.env` file. This is not recommended for production.

# Steps
- :one: Add the app-registration client id to `infrastructure/.env` (one-time, created per [entra.md](./entra.md)):
```
    AAD_CLIENT_ID=<client id of the API app registration>
    # Optional overrides (otherwise derived automatically):
    # AAD_TENANT_ID=<entra tenant id>
    # VUE_APP_AAD_REDIRECT_URL=https://<custom-domain>
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