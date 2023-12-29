#!/bin/bash

while (( "$#" )); do
  case "$1" in
    -n|--name)
      appName=$2
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./create_infrastructure.sh -n {Application Name}
            --name(n)    - A defined name for the Application. 
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

if [[ -z "${appName}" ]]; then
  echo "This script requires a application name defined"
  exit 1
fi 

az account show  >> /dev/null 2>&1
if [[ $? -ne 0 ]]; then
  az login
fi

RG=${appName}_app_rg
if `az functionapp show --name ${appName} --resource-group ${RG} -o none`
then
    az functionapp config appsettings set --settings FUNCTIONS_EXTENSION_VERSION=~4 -g ${RG} -n ${appName}
    az functionapp config set --net-framework-version v6.0 -g ${RG} -n ${appName}
fi 

maintenanceFuncName=${appName}-maintenance
maintenanceRG=${appName}_maintenance_rg

if `az functionapp show --name ${maintenanceFuncName} --resource-group ${maintenanceRG} -o none`
then
    az functionapp config appsettings set --settings FUNCTIONS_EXTENSION_VERSION=~4 -g ${maintenanceRG} -n ${appName}
fi