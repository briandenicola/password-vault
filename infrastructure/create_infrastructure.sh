#!/bin/bash

while (( "$#" )); do
  case "$1" in
    -n|--name)
      appName=$2
      shift 2
      ;;
    -r|--region)
      region=$2
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./create_infrastructure.sh -r {region} [-n {Application Name}]
        --name(n)    - A defined name for the Application. Will be auto-generated if not supplied (Optional)
        --region(r)  - Azure Region 
      "
      exit 0
      ;;
    --) 
      shift
      break
      ;;
    -*|--*=) 
      echo "Error: Unsupported flag $1" >&2
      exit 1
      ;;
  esac
done

today=`date +"%Y%m%d"`
uuid=`uuidgen | sed 's/-//g'`
version=`git rev-parse HEAD | fold -w 8 | head -n1`

if [[ -z "${appName}" ]]; then
  appName=`cat /dev/urandom | tr -dc 'a-z' | fold -w 8 | head -n 1`
fi 

if [[ -z "${region}" ]]; then
  echo "This script requires a region defined"
  exit 1
fi 

#Resource Names
RG=${appName}_app_rg
cosmosDBAccountName=db-${appName}01
storageAccountName=ui${appName}01
functionAppName=func-${appName}01
funcStorageName=${appName}sa01
keyVaultName=kv-${appName}01
searchServiceName=search-${appName}01

az account show  >> /dev/null 2>&1
if [[ $? -ne 0 ]]; then
  az login
fi
az extension add --name webapp
az extension add --name storage-preview

if ! `az group exists -g ${RG}`; then az group create -n ${RG} -l ${region}; fi

account=`az account show -o json`
user=`echo ${account} | jq -r .user.name`
tenantid=`echo ${account} | jq -r .tenantId`
subscriptionId=`echo ${account} | jq -r .id`
resourceId=/subscriptions/${subscriptionId}/resourcegroups/${RG}
az tag create --resource-id ${resourceId} --tags Version=${version} AppName=PasswordVault DeployDate=${today} Deployer=${user}

#Create AES Key and IV
aesKey=`openssl rand -base64 32`
aesIV=`openssl rand -base64 16`

#Create Azure Search Engine
searchIndexName=cosmosdb-index

az search service create -g ${RG} -n ${searchServiceName} --sku free -l ${region}
searchAdminKey=`az search admin-key show --resource-group ${RG} --service-name ${searchServiceName} -o tsv --query "primaryKey"`

#Create Service Principals
apiClientID=`az ad app create --display-name ${appName}-api -o tsv --query appId`
uiClientID=`az ad app create --display-name ${appName}-ui -o tsv --query appId`

# Create an Azure Function with storage accouunt in the resource group.
if ! `az functionapp show --name ${functionAppName} --resource-group ${RG} -o none`
then
    az storage account create --name ${funcStorageName} --location ${region} --resource-group ${RG} --sku Standard_LRS
    az functionapp create --name ${functionAppName} --storage-account ${funcStorageName} --consumption-plan-location ${region} --resource-group ${RG}  --functions-version 3  --runtime dotnet
    az functionapp identity assign --name ${functionAppName} --resource-group ${RG}
fi
functionAppId=`az functionapp identity show --name ${functionAppName} --resource-group ${RG} --query 'principalId' --output tsv`

#Cosmos DB 
database=AccountPasswords
collection=Passwords
az cosmosdb create -g ${RG} -n ${cosmosDBAccountName} --kind GlobalDocumentDB --enable-free-tier true
az cosmosdb database create  -g ${RG} -n ${cosmosDBAccountName} -d ${database}
az cosmosdb collection create -g ${RG} -n ${cosmosDBAccountName} -d ${database} -c ${collection} --partition-key-path '/PartitionKey'
primaryConnectionString=`az cosmosdb keys list --type connection-strings -n ${cosmosDBAccountName} -g ${RG} --query 'connectionStrings[0].connectionString' -o tsv`

# Create an storage accouunt in the resource group for the SPA UI
az storage account create --kind StorageV2 --name ${storageAccountName} --location ${region} --resource-group ${RG} --sku Standard_LRS
az storage blob service-properties update --account-name ${storageAccountName} --static-website --404-document "404.html" --index-document "index.html"

# Setup CORS from Storage Account
url=`az storage account show -n ${storageAccountName} -g ${RG} --query "primaryEndpoints.web" --output tsv | sed -e 's/\/$//g'`
az functionapp cors add -g ${RG} -n ${functionAppName} --allowed-origins ${url}

# Create Key Vault 
az keyvault create --name ${keyVaultName} --resource-group ${RG} --location ${region} 
az keyvault set-policy --name ${keyVaultName} --object-id ${functionAppId} --secret-permissions get

searchAdminKeyId=`az keyvault secret set --vault-name ${keyVaultName} --name searchAdminKey --value ${searchAdminKey} --query 'id' --output tsv`

aesKeySecretId=`az keyvault secret set --vault-name ${keyVaultName} --name AesKey --value ${aesKey} --query 'id' --output tsv`
primaryConnectionStringSecretId=`az keyvault secret set --vault-name ${keyVaultName} --name cosmosdb --value ${primaryConnectionString} --query 'id' --output tsv`

az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings cosmosdb="@Microsoft.KeyVault(SecretUri=${primaryConnectionStringSecretId})"
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings AesKey="@Microsoft.KeyVault(SecretUri=${aesKeySecretId})"
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings AesIV=$aesIV
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings COSMOS_DATABASENAME="AccountPasswords"
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings COSMOS_COLLECTIONNAME="Passwords"
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings COSMOS_LEASENAME="leases"
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings COSMOS_PARTITIONKEY="Passwords"

#Host Key for Functions
userName=`az functionapp deployment list-publishing-profiles -n ${functionAppName} -g ${RG} --query '[0].userName' --output tsv`
userPassword=`az functionapp deployment list-publishing-profiles -n ${functionAppName} -g ${RG} --query '[0].userPWD' --output tsv`
kuduUrl=`az functionapp deployment list-publishing-profiles -n ${functionAppName} -g ${RG} --query '[0].publishUrl' --output tsv`
adminUrl="https://${kuduUrl}/api/functions/admin/token"
keyUrl="https://${functionAppName}.azurewebsites.net/admin/host/keys/main"

JWT=`curl -s -X GET -u ${userName}:${userPassword} ${adminUrl} | tr -d '"'`
functionHostKey=`curl -s -X POST -H "Authorization: Bearer ${JWT}" -H "Content-Type: application/json" -d "Content-Length: 0" ${keyUrl} | jq -r '.value'`
az keyvault secret set --vault-name ${keyVaultName} --name functionSecret --value ${functionHostKey}

# Update Functions with Azure Search Configuration
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings SEARCH_SERVICENAME=${searchServiceName}
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings SEARCH_ADMINKEY="@Microsoft.KeyVault(SecretUri=${searchAdminKeyId})"
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings SEARCH_INDEXNAME=${searchIndexName}

# Update Function App for Azure AD Authentication 
az webapp auth update -g ${RG} -n $functionAppName --enabled true --action LoginWithAzureActiveDirectory --aad-client-id ${apiClientID} --aad-token-issuer-url "https://login.microsoftonline.com/${tenantid}/v2.0"

echo ------------------------------------
echo "Infrastructure built successfully. Application Name: ${appName}"
echo "API SPN Client Id: ${apiClientID}"
echo "API Key: ${functionHostKey}"
echo ------------------------------------
