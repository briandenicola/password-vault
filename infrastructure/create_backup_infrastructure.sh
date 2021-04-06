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

today=`date +"%Y%m%d"`
uuid=`uuidgen | sed 's/-//g'`
version=`git rev-parse HEAD | fold -w 8 | head -n1`

if [[ -z "${region}" ]]; then
  echo "This script requires a region defined"
  exit 1
fi 

if [[ -z "${appName}" ]]; then
  echo "This script requires the Application Name defined"
  exit 1
fi 

#Resource Names
RG=${appName}_maintenance_rg
maintenanceFuncName=${appName}-maintenance
funcStorageName=${appName}sa02
storageName=${appName}backupsa01
keyVaultName=kv-${appName}02

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
az tag create --resource-id ${resourceId} --tags Version=${version} AppName=PasswordVault-Maintenance DeployDate=${today} Deployer=${user}

# Create an Azure Function with storage accouunt in the resource group.
if ! `az functionapp show --name ${maintenanceFuncName} --resource-group ${RG} -o none`
then
    az storage account create --name ${funcStorageName} --location ${region} --resource-group ${RG} --sku Standard_LRS
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
appRG=${appName}_app_rg
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

loginUrl="https://login.microsoftonline.com/${tenantid}/oauth2/token"
passwordStorageConString="DefaultEndpointsProtocol=https;AccountName=${storageName};AccountKey=${key};EndpointSuffix=core.windows.net"

# Set Function Confguration
az functionapp config appsettings set -g ${RG} -n ${maintenanceFuncName} --settings SpnSecret="@Microsoft.KeyVault(SecretUri=${clientSecretId})"
az functionapp config appsettings set -g ${RG} -n ${maintenanceFuncName} --settings AesKey="@Microsoft.KeyVault(SecretUri=${aesKeySecretId})"
az functionapp config appsettings set -g ${RG} -n ${maintenanceFuncName} --settings FunctionCode="@Microsoft.KeyVault(SecretUri=${funcCodeId})"
az functionapp config appsettings set -g ${RG} -n ${maintenanceFuncName} --settings AesIV=${aesIV}
az functionapp config appsettings set -g ${RG} -n ${maintenanceFuncName} --settings PasswordStorage=${passwordStorageConString}
az functionapp config appsettings set -g ${RG} -n ${maintenanceFuncName} --settings Clientid=${clientID}
az functionapp config appsettings set -g ${RG} -n ${maintenanceFuncName} --settings VaultSpnId=${passwordVaultID}
az functionapp config appsettings set -g ${RG} -n ${maintenanceFuncName} --settings AppUrl=${passwordVaultUrl}
az functionapp config appsettings set -g ${RG} -n ${maintenanceFuncName} --settings LoginUrl=${loginUrl}
az functionapp config appsettings set -g ${RG} -n ${maintenanceFuncName} --settings SUBSCRIPTION_ID=${subscriptionId}
az functionapp config appsettings set -g ${RG} -n ${maintenanceFuncName} --settings RESOURCE_GROUP_NAME=${appRG}
az functionapp config appsettings set -g ${RG} -n ${maintenanceFuncName} --settings COSMOS_DB_ACCOUNT=${appCosmosAccount}
az functionapp config appsettings set -g ${RG} -n ${maintenanceFuncName} --settings FUNCTION_ACCOUNT=${appFunctionName}
az functionapp config appsettings set -g ${RG} -n ${maintenanceFuncName} --settings KEY_VAULT_URL=${appKeyVaultUri}

# Assign RBAC Roles ${functionAppId}
scope=/subscriptions/${subscriptionId}/resourcegroups/${appRG}
az role assignment create --role "DocumentDB Account Contributor" --assignee ${functionAppId} --scope ${scope}
az role assignment create --role "Website Contributor" --assignee ${functionAppId} --scope ${scope}
az keyvault set-policy --name ${appKeyVaultName} --object-id ${functionAppId} --secret-permissions get list set
