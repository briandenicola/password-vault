API Build & Deployment
=============
* The Vault API is built on dotnet10 and uses Azure Functions with HTTP Triggers.
* It runs as a serverless API on Azure Functions Flex Consumption for Linux.
* Infrastructure is provisioned with Task/Terraform. Code is deployed by GitHub Actions using the Azure Functions deploy action and Flex remote build.

# Steps
- :one: `task up` / `task apply` - Creates or updates infrastructure
- :two: `task entra:configure` - Creates or updates Entra app registrations after infrastructure exists
- :three: `task github:configure` - Writes Terraform outputs and required secret values to GitHub Actions variables/secrets
- :four: Run `.github/workflows/deploy.yml` with component `api`, or merge API changes to `main`
- :five: `task cors` - Configures CORS for the API to allow access from the UI
<p align="right">(<a href="#build">back to top</a>)</p>


UI Build & Deployment
=============
* The Vault UI is built on VUE and uses Azure Static Web Apps.
* GitHub Actions builds and deploys it with the Azure Static Web Apps CLI.
* `.github/workflows/deploy.yml` generates the full `.env` for the build from GitHub Actions variables/secrets created by `task github:configure` — **no manual `.env.production` file is required**:
    * App Insights comes from the `APP_INSIGHTS_CONNECTION_STRING` repository secret.
    * API endpoint and redirect URL come from `FUNCTION_URL` and `SWA_DEFAULT_URL` repository variables.
    * `VUE_APP_AAD_SCOPE` is derived as `${FUNCTION_URL}/Password.All`.
    * `VUE_APP_AAD_CLIENT_ID` comes from the `AAD_CLIENT_ID` repository secret.
* For development, you can disable Entra ID authentication by setting `VUE_APP_REQUIRES_AUTHENTICATION` to false in the `.env` file. This is not recommended for production.

# Steps
- :one: Run `task entra:configure` after the infrastructure exists, then `task apply` to push the generated API auth settings.
- :two: Run `task github:configure` so the deploy workflow has `FUNCTION_URL`, `SWA_NAME`, `SWA_DEFAULT_URL`, and the required secrets.
- :three: Run `.github/workflows/deploy.yml` with component `ui`, or merge UI changes to `main`
<p align="right">(<a href="#build">back to top</a>)</p>

MaintenanceDeployment
=============
* The Maintenance API is built on Python and uses timer job with Azure Functions 
* The Keep Alive function is used to keep the Azure Functions warm and responsive
* The maintenance function is deployed to a separate Azure Function App
* GitHub Actions deploys the maintenance function with the Azure Functions deploy action when maintenance infrastructure is enabled.

# Steps
- :one: Run `.github/workflows/deploy.yml` with component `maintenance`, or merge maintenance changes to `main`
<p align="right">(<a href="#build">back to top</a>)</p>


Automated code deployment (GitHub Actions)
=============
Taskfile owns infrastructure/setup. GitHub Actions owns code deployment:

* **CI** (`.github/workflows/ci.yml`) — runs on every PR and push to `main`:
  API build + tests, UI lint + unit tests + build, and `terraform fmt`/`validate`.
* **Infrastructure** (`.github/workflows/infra.yml`) — `task plan` on PRs that
  touch `infrastructure/**`, and `task apply` on merge to `main`. State lives in
  the `azurerm` remote backend (`providers.tf`).
* **Deploy** (`.github/workflows/deploy.yml`) — deploys API, UI, and maintenance code directly. Trigger manually (pick a component) or on merge to `main` for the paths that changed.

**Authentication is OIDC only (CD-3)** — Azure login uses
[federated credentials](https://learn.microsoft.com/azure/active-directory/workload-identities/workload-identity-federation),
so no service-principal password or publish profile is stored as a secret.

One-time setup (operator):
1. Create an Entra app registration (or reuse the API one) and add **federated
   credentials** trusting this repo's `pull_request` events and the
   `production` environment.
2. Grant it `Contributor` on the subscription and access to the Terraform state
   storage account (`denicolafamily/state`).
3. Run `task github:configure` to populate repository variables/secrets from
   Terraform outputs and local environment values. `AZURE_CLIENT_ID`,
   `TF_ENCRYPTION_KEY`, and `TF_ENCRYPTION_IV` must be present in your local
   environment or `.env` before running it because Terraform can't derive them.
4. Create a **`production` GitHub Environment** and require a reviewer — every
   `apply`/deploy then waits for approval before touching live Azure.

`task github:configure` writes these repository variables from Terraform outputs:

| Variable | Source |
|----------|--------|
| `FUNCTION_NAME` | `terraform output FUNCTION_NAME` |
| `FUNCTION_URL` | `terraform output FUNCTION_URL` |
| `SWA_NAME` | `terraform output SWA_NAME` |
| `SWA_DEFAULT_URL` | `terraform output SWA_DEFAULT_URL` |
| `MAINTENANCE_FUNCTION_NAME` | `terraform output MAINTENANCE_FUNCTION_NAME` when maintenance infra exists |

It also writes these repository secrets:

| Secret | Source |
|--------|--------|
| `APP_INSIGHTS_CONNECTION_STRING` | `terraform output APP_INSIGHTS_CONNECTION_STRING` |
| `AAD_CLIENT_ID` | local `AAD_CLIENT_ID` or `VUE_APP_AAD_CLIENT_ID` |
| `AZURE_CLIENT_ID` | local `AZURE_CLIENT_ID` or `ARM_CLIENT_ID` |
| `AZURE_TENANT_ID` | local `AZURE_TENANT_ID`/`ARM_TENANT_ID`, else current `az account` tenant |
| `AZURE_SUBSCRIPTION_ID` | local `AZURE_SUBSCRIPTION_ID`/`ARM_SUBSCRIPTION_ID`, else current `az account` subscription |
| `TF_ENCRYPTION_KEY` | local `TF_ENCRYPTION_KEY`, `TF_VAR_password_encryption_key`, or `ENCRYPTION_KEY` |
| `TF_ENCRYPTION_IV` | local `TF_ENCRYPTION_IV`, `TF_VAR_password_encryption_initialization_vector`, or `ENCRYPTION_IV` |

Secrets are never passed on the command line: the encryption key/IV reach
Terraform through `TF_VAR_*` environment variables (**CD-5**), and they are
marked `sensitive` in `variables.tf`.
<p align="right">(<a href="#build">back to top</a>)</p>



# Navigation
[Previous Section ⏪](./entra.md) ‖ [Return to Main Index 🏠](../README.md) ‖ 
<p align="right">(<a href="#build">back to top</a>)</p>