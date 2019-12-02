#!/bin/bash

export RG=$1
export location=$2
export functionAppName=$3
export cosmosdb=$4
export storageName=$5
export aesKey=$6
export aesIV=$7
export searchServiceRG=$8
export searchServiceName=$9
export searchIndexName=${10}
export clientID=${11}

#az login 
az extension add --name webapp
az extension add --name storage-preview

if ! `az group exists -g $RG`; then az group create -n $RG -l $location; fi

funcStorageName=${functionAppName}sa001
keyVaultName=${functionAppName}keyvault001

# Create an Azure Function with storage accouunt in the resource group.
az storage account create --name $funcStorageName --location $location --resource-group $RG --sku Standard_LRS
az functionapp create --name $functionAppName --storage-account $funcStorageName --consumption-plan-location $location --resource-group $RG
az functionapp identity assign --name $functionAppName --resource-group $RG
functionAppId="$(az functionapp identity show --name $functionAppName --resource-group $RG --query 'principalId' --output tsv)"

#Cosmos DB
az cosmosdb create -g $RG -n $cosmosdb --kind GlobalDocumentDB 
az cosmosdb database create  -g $RG -n $cosmosdb -d AccountPasswords
az cosmosdb collection create -g $RG -n $cosmosdb -d AccountPasswords -c Passwords --partition-key-path '/PartitionKey'

# Create an storage accouunt in the resource group for the SPA UI
az storage account create --kind StorageV2 --name $storageName --location $location --resource-group $RG --sku Standard_LRS
az storage blob service-properties update --account-name $storageName --static-website --404-document "404.html" --index-document "index.html"

# Setup CORS from Storage Account
webUrl=$(az storage account show -n $storageName -g $RG --query "primaryEndpoints.web" --output tsv)
az functionapp cors add -g $RG -n $functionAppName --allowed-origins $webUrl

# Create Key Vault 
az keyvault create --name $keyVaultName --resource-group $RG --location $location 
az keyvault set-policy --name $keyVaultName --object-id $functionAppId --secret-permissions get

primaryMasterKey="$(az cosmosdb list-keys -g $RG -n $cosmosdb --query 'primaryMasterKey' --output tsv )"
primaryConnectionString="AccountEndpoint=https://${cosmosdb}.documents.azure.com:443/;AccountKey=${primaryMasterKey};"
aesKeySecretId="$(az keyvault secret set --vault-name $keyVaultName --name AesKey --value $aesKey --query 'id' --output tsv)"
primaryConnectionStringSecretId="$(az keyvault secret set --vault-name $keyVaultName --name cosmosdb --value $primaryConnectionString --query 'id' --output tsv)"

az functionapp config appsettings set -g $RG -n $functionAppName --settings cosmosdb="@Microsoft.KeyVault(SecretUri=$primaryConnectionStringSecretId)"
az functionapp config appsettings set -g $RG -n $functionAppName --settings AesKey="@Microsoft.KeyVault(SecretUri=$aesKeySecretId)"
az functionapp config appsettings set -g $RG -n $functionAppName --settings AesIV=$aesIV
az functionapp config appsettings set -g $RG -n $functionAppName --settings COSMOS_DATABASENAME="AccountPasswords"
az functionapp config appsettings set -g $RG -n $functionAppName --settings COSMOS_COLLECTIONNAME="Passwords"
az functionapp config appsettings set -g $RG -n $functionAppName --settings COSMOS_LEASENAME="leases"
az functionapp config appsettings set -g $RG -n $functionAppName --settings COSMOS_PARTITIONKEY="Passwords"

#Host Key for Functions
userName=$(az functionapp deployment list-publishing-profiles -n $functionAppName -g $RG --query '[0].userName' --output tsv)
userPassword=$(az functionapp deployment list-publishing-profiles -n $functionAppName -g $RG --query '[0].userPWD' --output tsv)
kuduUrl=$(az functionapp deployment list-publishing-profiles -n $functionAppName -g $RG --query '[0].publishUrl' --output tsv)
adminUrl="https://$kuduUrl/api/functions/admin/token"
keyUrl="https://$functionAppName.azurewebsites.net/admin/host/keys/main"

JWT=$(curl -s -X GET -u $userName:$userPassword $adminUrl | tr -d '"')
functionHostKey=$(curl -s -X POST -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" -d "Content-Length: 0" $keyUrl | jq -r '.value')
az keyvault secret set --vault-name $keyVaultName --name functionSecret --value $functionHostKey

# Update Functions with Azure Search Configuration
searchAdminKey=`az search admin-key show --resource-group ${searchServiceRG} --service-name ${searchServiceName} -o tsv --query "primaryKey"`
searchAdminKeyId="$(az keyvault secret set --vault-name $keyVaultName --name searchAdminKey --value $searchAdminKey --query 'id' --output tsv)"
az functionapp config appsettings set -g $RG -n $functionAppName --settings SEARCH_SERVICENAME=${searchServiceName}
az functionapp config appsettings set -g $RG -n $functionAppName --settings SEARCH_ADMINKEY="@Microsoft.KeyVault(SecretUri=$searchAdminKeyId)"
az functionapp config appsettings set -g $RG -n $functionAppName --settings SEARCH_INDEXNAME=${searchIndexName}

# Update Function App for Azure AD Authentication 
az webapp auth update -g $RG -n $functionAppName --enabled true --action LoginWithAzureActiveDirectory --aad-client-id ${clientID}