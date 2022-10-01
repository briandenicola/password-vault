#!/bin/bash

while (( "$#" )); do
  case "$1" in
    -g|--resource-group)
      RG=$2
      shift 2
      ;;
    -n|--name)
      funcName=$2
      shift 2
      ;;
      ;;
    -h|--help)
      echo "Usage: ./upgrade-v4.sh -g <resource-group> -n <function-name>
        --resource-group|-g: Resource group name
        --name|-n: Function app name
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

az functionapp config appsettings set --settings FUNCTIONS_EXTENSION_VERSION=~4 -g ${RG} -n ${funcName}
az functionapp config set --net-framework-version v6.0 -g ${RG} -n ${funcName}