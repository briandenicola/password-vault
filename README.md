# Introduction 
This project is a demo on how to use Azure Functions with HTTP Triggers, Cosmosdb, and a VUE SPA application protected by Azure AD
It can be deployed using Azure Dev Ops.
It was built locally using Azure Functions Core Tools and Azure Cosmosdb Development Containter

# Folders
* BuildPipelines - YAML files for Azure Dev Ops Build pipelines
* Infrastructure - Script using Azure CLI to create resources in Azure - Azure Functions, Key Vault, Cosmos DB.  
    * Will need to create Azure AD application manually
    * An Azure Functions Host Key will need to be created and manually stored in to Azure Key Vault
* Scripts - Various PowerShell scripts to start up the local environment and to test the Functions API
* Source\functionapp - C# Code for Azure Functions
* Source\\passwordapp.ui - VUE Code for UI

# To DO
- [ ] Script creation of Azure AD application
- [ ] Script to create/rotate Azure Function Host Key