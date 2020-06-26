# Introduction 
This project is a demo on how to use Azure Functions with HTTP Triggers, Cosmosdb, and a VUE SPA application protected by Azure AD
It can be deployed using Azure Dev Ops.
It was built locally using Azure Functions Core Tools and Azure Cosmosdb Development Containter


# Folders
* deploy - YAML files for Azure Dev Ops Build pipelines (exports from Azure DevOps only)
* infrastructure - Script using Azure CLI to create resources in Azure - Azure Functions, Key Vault, Cosmos DB.  
* test - Various PowerShell scripts to start up the local environment and to test the Functions API
* source\functionapp - C# Code for Azure Functions
* source\passwordapp.ui - VUE Code for UI
* source\maintenance - Python Code for Keep Alives and Backups

# Prerequistes 
* An Azure AD Application
   * Be sure to copy it client id down
* An Azure Functions Host Key  in Azure Key Vault
   * The create_azure_resource.sh script will create a secret in KeyVault under the name functionSecret
   * Due to a quirk in automation at this time, this key will have to be copied to a secret named functionSecretDev
   * This is on the backlog to be addressed. 

# Infrastucture Setup
* ./Infrastructure/create_azure_search.sh <RG_Name> <RG_Location> <Search_Name>
* ./Infrastructure/create_azure_resource.sh <RG_Name> <Location> <Func_Name> <DB_Name> <Storage_Name> <AES_KEY> <AES_IV> <Search_Name> <Search_RG_Name> <Search_RG_Index>

# Code Deploy
## Function App
* cd ./Source/functionapp/
* func azure functionapp publish <FUNC_Name> --csharp

## Front End
* cd ./Source/passwordapp.ui
* Update .env.production 
* npm install
* npm build
* copy dist to $web container in <Storage_Name> 

# Search Index Setup
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

# To Do
- [X] Refactor UpdatePassword and DeletePassword to eliminate duplicate code
- [ ] Upgrade API to .net core 3.1
- [ ] Upgrade UI to Vue 3
- [ ] Fix text wrapping on mobile
