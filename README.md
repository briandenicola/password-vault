# Introduction 
This project is a demo on how to use Azure Functions with HTTP Triggers, Cosmosdb, and a VUE SPA application all protected by Azure AD
It can be deployed using Azure Dev Ops.
It was built locally using Azure Functions Core Tools and Azure Cosmosdb Development Container

# Folders
* Pipelines - YAML files for Azure Dev Ops Build pipelines (exports from Azure DevOps only)
* Infrastructure - Script using Azure CLI to create resources in Azure - Azure Functions, Key Vault, Cosmos DB.  
* Scripts - A place for various automations
* Tests - Various PowerShell scripts to start up the local environment and to test the Functions API
* Source\cli - A C# command line interface for the Vault
* Source\maintenance - Python Functions to backup Cosmos and keep alive the Azure Function
* Source\functionapp - C# Code for Azure Functions
* Source\passwordapp.ui - VUE Code for UI

# Prerequistes 
* [The Azure Function commandline tool](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=linux%2Ccsharp%2Cbash#v2)
* [The Azure cli](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-linux?pivots=apt)

# Azure AD Configurations
* Password Vault API
   * Name - passwordvault-api
   * Redirect Urls - _URL of the UI Storage Account such as https://{{function app name}}.azurewebsites.net/.auth/login/aad/callback_
   * No Client Secrets
   * Create Appp Role
      * Name - Default Access 
      * Allow Member Types - Both (Users + applications) 
      * Value - Default Access
   * Add Scopes
      * PasswordHistory.Read
      * Password.All
   * Edit Manifest
      * Update accessTokenAcceptedVersion from null to 2
   * Enterprise Application Settings 
      * Visible To Users: false
* Password Vault UI
   * Name - Password Vault
   * Branding - Set Home page URL to domain name hosting UI and upload cool logo
   * Authentication 
      * Add Single-page Application.
      * Redirect URIs will be the URI of the domain name hosting UI and any testing URIs like http://localhost:8080
   * No Client Secrets
   * Grant 'Password.All' Scope as a delegated role under API Permissions
   * Enterprise Application Settings
      * Require User Assignment 
      * Visible To Users: true
* Password Vault Cli SPN
   * Name - passwordvault-cli
   * Add Mobile and Desktop Application Platform under Authentication 
   * Select _https://login.microsoftonline.com/common/oauth2/nativeclient_ for Redirect URL
   * Enable Public Client Flow
   * No Client Secrets
   * Grant 'PasswordHistory.Read' Scope as a delegated role under API Permissions
   * Enterprise Application Settings 
      * Visible To Users: false
* Password Vault Maintenance SPN
   * Name - passwordvault-backup
   * Create Client Secret. Save off.
   * Add 'Default Access' permission as an application role under API Permissions
   * Enterprise Application Settings 
      * Visible To Users: false

# Infrastucture Setup
* ./Infrastructure/create_azure_search.sh <RG_Name> <RG_Location> <Search_Name>
* ./Infrastructure/create_azure_resources.sh <RG_Name> <Location> <Func_Name> <DB_Name> <Storage_Name> <AES_KEY> <AES_IV> <Search_Name> <Search_RG_Name> <Search_RG_Index>
   * The create_azure_resource.sh script will create a secret in KeyVault under the name functionSecret
   * Due to a quirk in automation at this time, this key will have also have to be copied to a secret named functionSecretDev
* ./Infrastructure/create_azure_backup_resoures.sh <RG_Name> <Location> <Backup_Func_Name> <Backup_Storage_Name> <AES_KEY> <AES_IV> <Password_Vault_Client_ID> <Password_Vault_Uri> <Password_Vault_Function_key> <Backup_Client_ID> <Backup_Client_Secret> <APP_RESOURCE_GROUP_NAME> <DB_Name> <FUNC_NAME>

# Code Deploy
## API Function App
* cd ./Source/functionapp/
* func azure functionapp publish <FUNC_Name> --python

## Front End UI
* cd ./Source/passwordapp.ui
* Update .env.production 
* npm install
* npm build
* Copy dist folder to <Storage_Name> $web container

## Maintenance Function App
* cd ./Source/maintenance/
* func azure functionapp publish <FUNC_Name> --python
* Grant the Function App Managed Identity the following Roles on the Function App Resource Group
   * DocumentDB Account Contributor 
   * Website Contributor
   * Key Vault Access Policy - get/list/set for Secrets 

## Search Index Configuration 
_Can only be completed after documents have been created in Cosmos_
1. Click `Import Data`
2. Data Source - 'Cosmos DB'
3. Name - vault
4. Choose exsiting connection and select Cosmos DB Account
5. Select Database and Collection. Leave Query empty
6. Next
7. Skip to: Customize Target Index
8. Key: id
9. Suggester Name: suggester
10. Select the following:
   * rid: Delete
   * Retrievalble: All
   * Filterable: SiteName, AccountName
   * Sortable:  SiteName, AccountName
   * Searchable: SiteName, AccountName
   * Suggester: SiteName, AccountName
11. Create Indexer
   * Custom Schedule: Interval - Every 5 minutes
   * Track Deletions. Soft Delete Column - isDeleted. Marker Value - true
12. Submit

# Roadmap
- [X] Refactor UpdatePassword and DeletePassword to eliminate duplicate code
- [X] Upgrade API to .net core 3.1
- [X] Create cli to pull Password History
- [X] Function to Rotate Cosmos Account Keys 
- [ ] ~~Remove Function Secrets~~
- [X] Migrate to MSAL.js/ Auth Code Flow from ADAL.js / Implicit Flow 
- [X] Migrate to Azure AD v2 JWT token format
- [ ] ~~Upgrade UI to Vue 3~~
- [ ] Migrate environmental setup to Terraform or Azure Bicep