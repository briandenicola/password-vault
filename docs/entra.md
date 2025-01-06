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