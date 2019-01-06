#!/bin/bash

export RG=$1
export location=$2
export functionAppName=$3
export cosmosdb=$4
export storageName=$5
export aesKey=$6
export aesIV=$7

az login 
az extension add --name webapp
az group create -n $RG -l $location

funcStorageName=${functionAppName}sa005
keyVaultName=${functionAppName}keyvault001

# Create an Azure Function with storage accouunt in the resource group.
az storage account create --name $funcStorageName --location $location --resource-group $RG --sku Standard_LRS
az functionapp create --name $functionAppName --storage-account $funcStorageName --consumption-plan -location $location --resource-group $RG
az functionapp identity assign --name $functionAppName --resource-group $RG
functionAppId="$(az functionapp identity show --name $functionAppName --resource-group $RG | jq ".principalId" | sed -e 's/^"//' -e 's/"$//' )"

#Cosmos DB
az cosmosdb create -g $RG -n $cosmosdb --kind GlobalDocumentDB 
az cosmosdb database create  -g $RG -n $cosmosdb -d AccountPasswords
az cosmosdb collection create -g $RG -n $cosmosdb -d AccountPasswords -c Passwords --partition-key-path '/PartitionKey'

# Create an storage accouunt in the resource group for the SPA UI
az storage account create --name $storageName --location $location --resource-group $RG --sku Standard_LRS
az storage blob service-properties update --account-name $storageName --static-website --404-document "404.html" --index-document "index.html"

# Create Key Vault 
az keyvault create --name $keyVaultName --resource-group $RG --location $location 
az keyvault set-policy --name $keyVaultName --object-id $functionAppId --secret-permissions get

primaryMasterKey="$(az cosmosdb list-keys -g $RG -n $cosmosdb | jq ".primaryMasterKey" | sed -e 's/^"//' -e 's/"$//' )"
primaryConnectionString="AccountEndpoint=https://${cosmosdb}.documents.azure.com:443/;AccountKey=${primaryMasterKey};"
aesKeySecretId="$(az keyvault secret set --vault-name $keyVaultName --name AesKey --value $aesKey | jq '.id'  | sed -e 's/^"//' -e 's/"$//')"
primaryConnectionStringSecretId="$(az keyvault secret set --vault-name $keyVaultName --name cosmosdb --value $primaryConnectionString | jq '.id'  | sed -e 's/^"//' -e 's/"$//')"

az functionapp config appsettings set -g $RG -n $functionAppName --settings cosmosdb="@Microsoft.KeyVault(SecretUri=$primaryConnectionStringSecretId)"
az functionapp config appsettings set -g $RG -n $functionAppName --settings AesKey="@Microsoft.KeyVault(SecretUri=$aesKeySecretId)"
az functionapp config appsettings set -g $RG -n $functionAppName --settings AesIV=$aesIV