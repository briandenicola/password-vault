#!/bin/bash

aesKey=`openssl rand -base64 32`
aesIV=`openssl rand -base64 16`

echo "ENCRYPTION_KEY=$aesKey" > ../infrastructure/.env
echo "ENCRYPTION_IV=$aesIV" >> ../infrastructure/.env