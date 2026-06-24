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


Automated CI/CD (GitHub Actions)
=============
The same `task` targets above are also driven by GitHub Actions, so local and
pipeline deploys never drift (**CD-7**):

* **CI** (`.github/workflows/ci.yml`) — runs on every PR and push to `main`:
  API build + tests, UI lint + unit tests + build, and `terraform fmt`/`validate`.
* **Infrastructure** (`.github/workflows/infra.yml`) — `task plan` on PRs that
  touch `infrastructure/**`, and `task apply` on merge to `main`. State lives in
  the `azurerm` remote backend (`providers.tf`).
* **Deploy** (`.github/workflows/deploy.yml`) — runs `task deploy-api` /
  `deploy-ui` / `deploy-maintenance`. Trigger manually (pick a component) or on
  merge to `main` for the paths that changed.

**Authentication is OIDC only (CD-3)** — Azure login uses
[federated credentials](https://learn.microsoft.com/azure/active-directory/workload-identities/workload-identity-federation),
so no service-principal password or publish profile is stored as a secret.

One-time setup (operator):
1. Create an Entra app registration (or reuse the API one) and add **federated
   credentials** trusting this repo's `pull_request` events and the
   `production` environment.
2. Grant it `Contributor` on the subscription and access to the Terraform state
   storage account (`denicolafamily/state`).
3. Add repository **secrets**: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
   `AZURE_SUBSCRIPTION_ID`, `TF_ENCRYPTION_KEY`, `TF_ENCRYPTION_IV`, and
   `AAD_CLIENT_ID`.
4. Create a **`production` GitHub Environment** and require a reviewer — every
   `apply`/deploy then waits for approval before touching live Azure.

Secrets are never passed on the command line: the encryption key/IV reach
Terraform through `TF_VAR_*` environment variables (**CD-5**), and they are
marked `sensitive` in `variables.tf`.
<p align="right">(<a href="#build">back to top</a>)</p>



# Navigation
[Previous Section ⏪](./entra.md) ‖ [Return to Main Index 🏠](../README.md) ‖ 
<p align="right">(<a href="#build">back to top</a>)</p>