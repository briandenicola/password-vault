#!/bin/bash

export RG=$1
export location=$2
export searchServiceName=$3

if ! `az group exists -g $RG`; then az group create -n $RG -l $location; fi

# Create Azure Search Service
az search service create -g ${RG} -n ${searchServiceName} --sku free -l ${location}
