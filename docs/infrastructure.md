Infrastructure
============
* The infrastructure is deployed to Azure using **Terraform** (`infrastructure/`).
* `task up` runs `init` → `keys` → `apply` → `cors`. A full create can take up to ~30 minutes.
* Resource names are derived from a Terraform-generated `random_pet` + `random_id` (e.g. `airedale-60249`). Save this name — it appears throughout the deployment.
* The default region is `canadacentral` (`DEFAULT_REGION` in `Taskfile.yaml`).

### State & authentication
* **Remote state:** Terraform uses an `azurerm` backend (`providers.tf` → `denicolafamily/state`, `use_oidc = true`). The first `init` against existing local state needs `terraform init -migrate-state`.
* **OIDC everywhere:** CI/CD (and the backend) authenticate with Entra **federated credentials** — no service-principal password or publish profile is stored (see [`deploy.md`](deploy.md)).
* **Secrets:** the AES key/IV are *source-of-truth* secrets generated locally (`task keys`) into `infrastructure/.env` (`ENCRYPTION_KEY`/`ENCRYPTION_IV`) and pushed into Key Vault. They are marked `sensitive` and passed to Terraform via `TF_VAR_*` env (never on the CLI). The Cosmos connection string is *derived* (Key Vault secret + Terraform output `COSMOSDB_CONNECTION_STRING`).
* **Feature flags (app settings):** `AUTH_ENABLED` (Entra validation, fail-closed default ON via `app_requires_authentication`) and `E2EE_ENABLED` (OFF-4 vault-key endpoints, default OFF via `app_e2ee_enabled`).

# Steps
## :heavy_check_mark: Deploy Task Steps
> _**Note**: If Terraform fails for any reason, you can run these commands individually to retry._
- :one: `task init`     - Initializes Terraform (remote backend; needs `az login` + state access)
- :two: `task apply`    - Applies the Terraform plan to create the Azure infrastructure

<p align="right">(<a href="#infrastructure">back to top</a>)</p>

# Infrastructure Components

## Application resource group
The main resource group hosts the running vault:

| Component | Resource(s) | Notes |
|-----------|-------------|-------|
| **Cosmos DB** | `azurerm_cosmosdb_account` + SQL database `AccountPasswords` | Session consistency, system-assigned identity, optional free tier. |
| → Containers | `Passwords`, `VaultKeys` | Both partitioned on `/PartitionKey`. `VaultKeys` (OFF-4 §5B) holds the opaque vault-key record and is isolated so it never appears in the passwords list. |
| **Key Vault** | `azurerm_key_vault` + secrets | RBAC-authorized. Secrets: `aes-encryption-key`, `aes-encryption-iv`, `host-key`, `cosmosdb-connection-string`, `appinsights-connection-string`, `appinsights-key`. |
| **Function App** | `azurerm_linux_function_app` on a Linux `azurerm_service_plan` | .NET 10 isolated worker; **run-from-package** from the storage `app` container. HTTP triggers are `Anonymous` (guarded by Entra middleware, AC-2). |
| **Identity & RBAC** | `azurerm_user_assigned_identity.functions_identity` + role assignments | Function reads Key Vault (`Key Vault Secrets User`) and storage (`Blob Owner`/`Contributor`) via managed identity. A deployer KV access assignment supports `task` runs. |
| **Storage** | `azurerm_storage_account` + `app` container | Holds the published `vault.zip` consumed by `WEBSITE_RUN_FROM_PACKAGE`. |
| **Observability** | `azurerm_log_analytics_workspace` + `azurerm_application_insights` | Connection string/key stored in Key Vault and referenced by the Function App. |
| **UI hosting** | `azurerm_static_web_app` (+ optional `..._custom_domain`) | Vue 3 SPA deployed via the SWA CLI (`task deploy-ui`). Custom domain gated by `add_custom_domain`. |

## Maintenance resource group _(optional)_
Created when `deploy_maintenance_infrastructure = true` (`infrastructure/maintenance/`): its own resource group, storage account + `app` container, Linux service plan, **Python Function App** (keep-alive + backup), a user-assigned identity and the matching storage role assignments.

## CI/CD & supply chain
* **Workflows** (`.github/workflows/`): `ci.yml` (build/test/lint + `terraform fmt`/`validate` on every PR), `infra.yml` (`task plan` on PR, `task apply` on `main` behind the `production` Environment), `deploy.yml` (`task deploy-*`, OIDC, Environment-gated).
* **Dependabot** (`.github/dependabot.yml`): weekly nuget / npm / pip / terraform / github-actions updates.

<p align="right">(<a href="#infrastructure">back to top</a>)</p>

# Navigation
[Previous Section ⏪](./entra.md) ‖ [Return to Main Index 🏠](../README.md) ‖ [Next Section ⏩](./deploy.md)
<p align="right">(<a href="#infrastructure">back to top</a>)</p>
