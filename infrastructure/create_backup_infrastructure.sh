#!/bin/bash

while (( "$#" )); do
  case "$1" in
    -n|--name)
      appName=$2
      shift 2
      ;;
    -r|--region)
      regions=($2)
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./create_infrastructure.sh -r {region} -n {Application Name}
        --name(n)    - A defined name for the Application.
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

if [[ -z "${regions}" ]]; then
  echo "This script requires a region defined"
  exit 1
fi 

if [[ -z "${name}" ]]; then
  echo "This script requires the Application Name defined"
  exit 1
fi 

#Resource Names
RG=${appName}_maintenance_rg
maintenanceFuncName=${appName}-maintenance
funcStorageName=func-${appName}sa02
storageName=${appName}-backup-sa01
keyVaultName=kv-${appName}02

az account show  >> /dev/null 2>&1
if [[ $? -ne 0 ]]; then
  az login
fi
az extension add --name webapp
az extension add --name storage-preview

if ! `az group exists -g ${RG}`; then az group create -n ${RG} -l ${region}; fi

# Create an Azure Function with storage accouunt in the resource group.
if ! `az functionapp show --name ${maintenanceFuncName} --resource-group ${RG} -o none`
then
    az storage account create --name ${funcStorageName} --region ${region} --resource-group ${RG} --sku Standard_LRS
    az functionapp create --name ${maintenanceFuncName} --storage-account ${funcStorageName} --consumption-plan-location ${region} --resource-group ${RG} --os-type Linux --functions-version 3 --runtime python
    az functionapp identity assign --name ${maintenanceFuncName} --resource-group ${RG}
fi
functionAppId="$(az functionapp identity show --name ${maintenanceFuncName} --resource-group ${RG} --query 'principalId' --output tsv)"

# Create AES Key for backup file encryption
aesKey=`openssl rand -base64 32`
aesIV=`openssl rand -base64 16`

# Create Client ID and Secret
clientSPN=`az ad sp create-for-rbac --name ${appName}-maintenance --skip-assignment true`
clientID=`echo ${clientSPN}| jq -r .appId`
clientSecret=`echo ${clientSPN} | jq -r .password`

# Get Password Vault Details
appRG=${appName}_${region}_rg
appCosmosAccount=db-${appName}01
appFunctionName=func-${appName}01
appKeyVaultName=kv-${appName}01
appKeyVaultUri=https://${appKeyVaultName}.vault.azure.net/

#Create Host Key for App Functions
userName=`az functionapp deployment list-publishing-profiles -n ${appFunctionName} -g ${appRG} --query '[0].userName' --output tsv`
userPassword=`az functionapp deployment list-publishing-profiles -n ${appFunctionName} -g ${appRG} --query '[0].userPWD' --output tsv`
kuduUrl=`az functionapp deployment list-publishing-profiles -n ${appFunctionName} -g ${appRG} --query '[0].publishUrl' --output tsv`
adminUrl="https://${kuduUrl}/api/functions/admin/token"
keyUrl="https://${appFunctionName}.azurewebsites.net/admin/host/keys/backup"
JWT=`curl -s -X GET -u ${userName}:${userPassword} ${adminUrl} | tr -d '"'`

passwordVaultCode=`curl -s -X POST -H "Authorization: Bearer ${JWT}" -H "Content-Type: application/json" -d "Content-Length: 0" ${keyUrl} | jq -r '.value'`
passwordVaultUrl=https://${appFunctionName}.azurewebsites.net/api/passwords
passwordVaultID=`az ad sp list --all --filter "displayname eq '${appName}-api'" -o json | jq -r ".[0]".appId`
 
# Create an storage accouunt in the resource group the backups
az storage account create --kind StorageV2 --name ${storageName} --location ${region} --resource-group ${RG} --sku Standard_LRS
key=$(az storage account keys list -n ${storageName} --query "[0].value" -o tsv)
az storage container create --name 'backups' --account-key ${key} --account-name ${storageName}

# Create Key Vault for Maintenance 
az keyvault create --name ${keyVaultName} --resource-group ${RG} --location ${region} 
az keyvault set-policy --name ${keyVaultName} --object-id ${functionAppId} --secret-permissions get

# Set Secrets
clientSecretId="$(az keyvault secret set --vault-name ${keyVaultName} --name clientSecret --value ${clientSecret} --query 'id' --output tsv)"
aesKeySecretId="$(az keyvault secret set --vault-name ${keyVaultName} --name AesKey  --value ${aesKey} --query 'id' --output tsv)"
funcCodeId="$(az keyvault secret set --vault-name ${keyVaultName} --name passwordVaultCode --value ${passwordVaultCode} --query 'id' --output tsv)"

tenant=`az account  show --query tenantId -o tsv`
subId=`az account  show --query id -o tsv`
loginUrl="https://login.microsoftonline.com/${tenant}/oauth2/token"
passwordStorageConString="DefaultEndpointsProtocol=https;AccountName=${storageName};AccountKey=${key};EndpointSuffix=core.windows.net"

# Set Function Confguration
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings SpnSecret="@Microsoft.KeyVault(SecretUri=${clientSecretId})"
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings AesKey="@Microsoft.KeyVault(SecretUri=${aesKeySecretId})"
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings FunctionCode="@Microsoft.KeyVault(SecretUri=${funcCodeId})"
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings AesIV=${aesIV}
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings PasswordStorage=${passwordStorageConString}
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings Clientid=${clientID}
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings VaultSpnId=${passwordVaultID}
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings AppUrl=${passwordVaultUrl}
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings LoginUrl=${loginUrl}
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings SUBSCRIPTION_ID=${subId}
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings RESOURCE_GROUP_NAME=${appRG}
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings COSMOS_DB_ACCOUNT=${appCosmosAccount}
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings FUNCTION_ACCOUNT=${appFunctionName}
az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings KEY_VAULT_URL=${appKeyVaultUri}
