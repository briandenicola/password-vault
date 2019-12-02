# Introduction 
This project is a demo on how to use Azure Functions with HTTP Triggers, Cosmosdb, and a VUE SPA application protected by Azure AD
It can be deployed using Azure Dev Ops.
It was built locally using Azure Functions Core Tools and Azure Cosmosdb Development Containter

# Folders
* BuildPipelines - YAML files for Azure Dev Ops Build pipelines (exports from Azure DevOps only)
* Infrastructure - Script using Azure CLI to create resources in Azure - Azure Functions, Key Vault, Cosmos DB.  
    * Will need to create Azure AD application and Azure Search Index manually
    * An Azure Functions Host Key will need to be created and manually stored in to Azure Key Vault
      * Currently the Host Key name is different between Prod and Stage - functionSecretDev vs functionSecret. 
      * You have to manually create the functionSecretDev Secret for now in Stage. 
* Scripts - Various PowerShell scripts to start up the local environment and to test the Functions API
* Kubernetes - Deployment Yaml to deploy to a Kuberentes cluster (alpha quality)
* Source\functionapp - C# Code for Azure Functions
* Source\passwordapp.ui - VUE Code for UI

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
- [ ] Remove manual step for functionSecretDev Secret creation
- [ ] Vue.js Dependency injection
- [ ] Script creation of Azure AD application
- [ ] Script to create/rotate Azure Function Host Key