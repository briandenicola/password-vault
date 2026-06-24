# 
Entra ID Application Registrations
============
* This Password uses Entra ID for authentication and authorization.  The following steps are required to configure the application registrations in Azure AD.

# Application Registrations
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
   | Expose an API | Set App Id value: https://${appName}-functions.azurewebsites.net |
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
| `AUTH_ENABLED` | `true` / `false` | Master switch. Default `false` (driven by the `app_requires_authentication` Terraform variable). |
| `AAD_TENANT_ID` | tenant (directory) id | Builds the issuer `https://login.microsoftonline.com/<tenant>/v2.0` and fetches signing keys. |
| `AAD_AUDIENCE` | `https://${appName}-functions.azurewebsites.net` | The API App Registration's App ID URI (and/or its client id), comma-separated if more than one. |
| `AAD_ALLOWED_OIDS` | _(empty)_ | Optional `oid` allowlist. Leave empty to rely on the Enterprise App group assignment (e.g. the "parents" group). |

When `AUTH_ENABLED=true`, every HTTP function except the anonymous health check (`passwords/healthz`)
requires a valid bearer token (issuer + audience + signature + lifetime). Invalid/missing tokens get `401`.

## Cutover runbook
1. **Deploy** the API with `AUTH_ENABLED=false` (current default) — no behaviour change.
2. **Configure** `AAD_TENANT_ID` and `AAD_AUDIENCE`, set `AUTH_ENABLED=true`, redeploy. The SPA already
   sends the bearer token, so it keeps working; tokens are now actually enforced. Verify sign-in + CRUD.
3. **AC-2 — drop the browser key:** once step 2 is verified, change the HTTP triggers from
   `AuthorizationLevel.Function` to `AuthorizationLevel.Anonymous`, and remove `VUE_APP_API_KEY` /
   the `x-functions-key` header from the SPA (`main.js`). The token is now the only credential.
4. **Rotate** the old function key (it lived in `ui/.env` and git history) so the leaked value is dead.


# Navigation
[Previous Section ⏪](../README.md.md) ‖ [Return to Main Index 🏠](../README.md) ‖ [Next Section ⏩](./infrastructure.md)
<p align="right">(<a href="#infrastructure">back to top</a>)</p>