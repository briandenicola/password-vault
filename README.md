# Introduction 
This project is a demo on how to use Azure Functions with HTTP Triggers, Cosmosdb, and a VUE SPA application all protected by Azure AD
It can be deployed using Azure Dev Ops.
It was built locally using Azure Functions Core Tools and Azure Cosmosdb Development Container

# Folders
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

# Infrastucture Setup
* ./Infrastructure/create_infrastructure.sh --region southcentralus
   * Script will output the generated AppName and Azure AD ClientID for the API and UI Service Principals
* ./Infrastructure/create_backup_infrastructure.sh --region southcentralus --name ${AppName} _(Optional)_

# Azure AD Configurations
* Password Vault API
   * Name - ${AppName}-api
   * Owners
      * Add yourself as owner
   * Authentication
      * Add Web Platform
      * Redirect Uris
         - https://func-${appName}01.azurewebsites.net/.auth/login/aad/callback
      * Deselect Implicit Grant
   * Certificates & Secrets
      * Ensure that no Client Secrets is defined. It is not needed. 
   * App Roles
      * Name - Default Access 
      * Allow Member Types - Both (Users + applications) 
      * Value - Default.Access
   * Expose an API
      * Set App Id
         - https://func-${appName}01.azurewebsites.net
      * Add Scopes
         - PasswordHistory.Read
         - Password.All
   * Edit Manifest
      * Update accessTokenAcceptedVersion from null to 2
   * Enterprise Application Settings 
      * Visible To Users: false
* Password Vault UI
   * Name - ${AppName}-ui
   * Owners
      * Add yourself as owner
   * Authentication 
      * Add Single-page Application.
      * Redirect URIs
         - http://localhost:8080
         - https://ui${appName}01.z21.web.core.windows.net
      * Deselect Implicit Grant
   * Certificates & Secrets
      * Ensure that no Client Secrets is defined. It is not needed. 
   * API Permissions
      * Grant access ${AppName}-api's 'Password.All' Scope as a delegated role under API
   * Edit Manifest
      * Update accessTokenAcceptedVersion from null to 2 
   * Enterprise Application Settings 
      * Visible To Users: false
* Password Vault Maintenance _(Optional)_
   * Name - ${AppName}-maintenance
   * Owners
      * Add yourself as owner
   * Create a client secret but not Authenication Plaform.
   * Add ${AppName}-api's 'Default Access' permission as an application role under API Permissions
   * Enterprise Application Settings 
      * Visible To Users: false
* Password Vault Cli _(Optional)_
   * Name - ${AppName}-cli
   * Add Mobile and Desktop Application Platform under Authentication 
   * Select _https://login.microsoftonline.com/common/oauth2/nativeclient_ for Redirect URL
   * Enable Public Client Flow
   * No Client Secrets is required because we're using Public Client flow.
   * Grant ${AppName}-api's 'PasswordHistory.Read' Scope as a delegated role under API Permissions
   * Enterprise Application Settings 
      * Visible To Users: false

# Code Deploy
## API Function App
* cd ./Source/functionapp/
* func azure functionapp publish func-${appName}

## Front End UI
* cd ./Source/passwordapp.ui
* Copy and Paste output of create_infrastructure.sh script into .env.production 
   * VUE_APP_API_ENDPOINT=https://func-${appName}01.azurewebsites.net
   * VUE_APP_AAD_REDIRECT_URL=https://ui${appName}01.z21.web.core.windows.net/
   * VUE_APP_API_KEY=(API Key from output of create_infrastructure.sh script)
   * VUE_APP_AAD_CLIENT_ID=(API Client ID from output of create_infrastructure.sh script)
   * VUE_APP_AAD_SCOPE=https://func-${appName}01.azurewebsites.net/Password.All
* npm install
* yarn build
* az storage copy --source-local-path "dist/*" --destination-account-name ui${appName}01 --destination-container \$web --recursive --put-md5

## Maintenance Function App
* cd ./Source/maintenance/
* func azure functionapp publish ${appName}-maintenance --python