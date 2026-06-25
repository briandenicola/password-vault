# 
Entra ID Application Registrations
============
* This Password uses Entra ID for authentication and authorization.  The following steps are required to configure the application registrations in Azure AD.

# Application Registrations
## Automated setup
After Terraform creates the Function App and Static Web App, run:

```powershell
task entra:configure
task apply
```

`task entra:configure` creates or updates the API and UI app registrations, exposes the API scopes, configures the SPA redirect URIs, declares the UI app's delegated access to the API scope, and writes the generated values to `infrastructure/.env`. The follow-up `task apply` pushes `AAD_TENANT_ID` and `AAD_AUDIENCE` into the Function App settings.

If your account can grant tenant-wide admin consent, run:

```powershell
task entra:configure -- -GrantAdminConsent
task apply
```

Manual setup is still documented below as a fallback for locked-down tenants.

## Password Vault API
> __Note:__ This App Registration is used to secure the Azure Functions API.  The API is secured using Azure AD and is restricted to groups/apps assigned to the Default App Role

   | Setting | Value |
   | ------ | ------ |
   | Name | ${AppName}-api |
   | Owners |   Add yourself as owner |
   | Authentication | Add Web Platform 
   |                | https://${appName}-functions.azurewebsites.net/.auth/login/aad/callback
   |                | Deselect Implicit Grant
   |Certificates & Secrets | None defined  |
   | App Roles      | Name - Default Access |
   |                | Allow Member Types - Both (Users + applications) |
   |                | Value - Default.Access |
   | Expose an API | Set App ID URI value: https://${appName}-functions.azurewebsites.net |
   |               | Scopes: PasswordHistory.Read & Password.All |
   | Enterprise Application Settings |  Visible To Users: false |
   
## Password Vault UI
> __Note:__ This App Registration is used to secure the Azure Static Web App.  The UI is secured using Azure AD and has access to call the Password Vault API

   | Setting | Value |
   | ------ | ------ |
   | Name | ${AppName}-ui |
   | Owners | Add yourself as owner |
   | Authentication | Add Single-page Application. |
   | Redirect URIs | http://localhost:8080 |
   |               | {{DEFAULT_SWA_URL}} |
   |               | {{ANY_CUSTOM_NAMES_REQUIRED}} |
   |               | Deselect Implicit Grant |
   | Certificates & Secrets | None defined. |
   | API Permissions | Grant access ${AppName}-api's 'Password.All' Scope as a delegated role under API |
   | Enterprise Application Settings | Visible To Users: false |

## Password Vault Cli _(Optional)_
> __Note:__ This App Registration is used to secure the cli application that can be used to interact with the Password Vault API and retrieve password history.

   | Setting | Value |
   | ------ | ------ |
   | Name | ${AppName}-cli |
   | Authentication |  Mobile and Desktop Application Platform  |
   | Redirect Url | https://login.microsoftonline.com/common/oauth2/nativeclient |
   | Enable Public Client Flow | selected |
   | Client Secrets | None defined  |
   | API Permissions | Grant ${AppName}-api's 'PasswordHistory.Read' Scope as a delegated role |
   | Enterprise Application Settings | Visible To Users: false |

## Password Vault Maintenance _(Optional)_
> __Note:__ This use to be required but the code has been/will be migrated over to Azure Managed Identities 


# Server-side token validation (AC-1 / AC-2)
> __Note:__ Historically the API trusted only the function key embedded in the SPA bundle; the
> Entra bearer token was sent but never checked. The API now validates the token server-side,
> gated by a feature flag so it can be rolled out safely.

## API app settings
| Setting | Value | Notes |
| ------ | ------ | ------ |
| `AUTH_ENABLED` | `true` / `false` | Master switch, **fail-closed: defaults to ON**. The HTTP triggers are `Anonymous` (AC-2), so token validation is the only guard — it is only skipped when this is the explicit string `false` (local/offline dev). |
| `AAD_TENANT_ID` | tenant (directory) id | Builds the issuer `https://login.microsoftonline.com/<tenant>/v2.0` and fetches signing keys. |
| `AAD_AUDIENCE` | `https://${appName}-functions.azurewebsites.net,<api-client-id>` | The accepted token audiences. Include both the API App ID URI and the API app registration client id because Entra may issue access tokens with either value in `aud`. |
| `AAD_ALLOWED_OIDS` | _(empty)_ | Optional `oid` allowlist. Leave empty to rely on the Enterprise App group assignment (e.g. the "parents" group). |

When `AUTH_ENABLED=true`, every HTTP function except the anonymous health check (`passwords/healthz`)
requires a valid bearer token (issuer + audience + signature + lifetime). Invalid/missing tokens get `401`.

## Cutover runbook
> **AC-2 landed in code:** HTTP triggers are now `Anonymous`, the SPA no longer sends a function
> key, and `AUTH_ENABLED` is **fail-closed (defaults ON)**. So a deploy of this code enforces tokens
> unless `AUTH_ENABLED=false` is set. Run the steps below in order against the live environment.

1. **Configure** `AAD_TENANT_ID` and `AAD_AUDIENCE` on the Function App (see the table above) **before**
   deploying, so the now-Anonymous triggers have working validation to fall back on.
2. **Deploy** the API. With `AUTH_ENABLED` unset (or `true`), every HTTP function except the anonymous
   health check requires a valid bearer token. The SPA already sends one — verify sign-in + full CRUD.
   *Safety:* if the AAD settings are wrong, requests are denied (401), never served unauthenticated.
3. **Deploy the SPA** (`.github/workflows/deploy.yml`, component `ui`) — it no longer writes `VUE_APP_API_KEY` or sends the
   `x-functions-key` header. The Entra token is the only credential.
4. **Rotate** the old function/host key (it lived in `ui/.env` and git history) so the leaked value is
   dead. In the portal/CLI, regenerate the host key; nothing references it anymore.
5. *(Local/offline dev only)* set `AUTH_ENABLED=false` in `local.settings.json` to bypass validation.


# Navigation
[Previous Section ⏪](../README.md.md) ‖ [Return to Main Index 🏠](../README.md) ‖ [Next Section ⏩](./infrastructure.md)
<p align="right">(<a href="#infrastructure">back to top</a>)</p>