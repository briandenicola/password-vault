import datetime
import logging
import os

import azure.functions as func

from azure.identity import DefaultAzureCredential
from azure.mgmt.cosmosdb import CosmosDBManagementClient
from azure.mgmt.cosmosdb.models import DatabaseAccountRegenerateKeyParameters

from azure.keyvault.secrets import SecretClient
from azure.mgmt.web.models import NameValuePair 
from azure.mgmt.web import WebSiteManagementClient 

SUBSCRIPTION_ID     = os.eniron["SUBSCRIPTION_ID"]
RESOURCE_GROUP_NAME = os.environ["RESOURCE_GROUP_NAME"]
KEY_VAULT_URL       = os.environ["KEY_VAULT_URL"]
COSMOS_DB_ACCOUNT   = os.environ["COSMOS_DB_ACCOUNT"]
FUNCTION_ACCOUNT    = os.environ["FUNCTION_ACCOUNT"]

def main(mytimer: func.TimerRequest) -> None:

    utc_timestamp = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).isoformat()

    logging.info('[%s] - Key Rotation Function triggered', utc_timestamp)

    credential = DefaultAzureCredential()

    cosmos_connection_string_secret = "cosmosdb"
    function_app_setting_value = "cosmosdb"

    key_to_rotate="secondary"
    if datetime.datetime.now().weekday() % 2 == 0:
        key_to_rotate="primary"

    cosmosdb_client = CosmosDBManagementClient(
        credential=credential,
        subscription_id=SUBSCRIPTION_ID
    )

    logging.info('[%s] - Update Cosmos DB %s key', utc_timestamp, key_to_rotate)
    cosmosdb_client.database_accounts.begin_regenerate_key(
        RESOURCE_GROUP_NAME, 
        COSMOS_DB_ACCOUNT, 
        DatabaseAccountRegenerateKeyParameters(key_kind=key_to_rotate)
    )
    keys = cosmosdb_client.database_accounts.list_keys(RESOURCE_GROUP_NAME, COSMOS_DB_ACCOUNT)
    new_connection_string = "AccountEndpoint=https://{0}.documents.azure.com:443/;AccountKey={1};".format(COSMOS_DB_ACCOUNT, keys.primary_master_key)

    logging.info('[%s] - Update Key Vault', utc_timestamp)
    keyvault_client = SecretClient(
        vault_url=KEY_VAULT_URL, 
        credential=credential
    )
    keyvault_client.set_secret(cosmos_connection_string_secret, new_connection_string )
    new_secret_id = keyvault_client.get_secret(cosmos_connection_string_secret)

    new_secret_kv_reference = "@Microsoft.KeyVault(SecretUri={0}/secrets/{1}/{2})".format(KEY_VAULT_URL, cosmos_connection_string_secret, new_secret_id.properties.version)

    logging.info('[%s] - Update Function Configuration Reference', utc_timestamp)
    web_client = WebSiteManagementClient(
        credential=credential,
        subscription_id=SUBSCRIPTION_ID
    )
    app_settings = web_client.web_apps.list_application_settings(RESOURCE_GROUP_NAME, FUNCTION_ACCOUNT)
    app_settings.properties.update({ function_app_setting_value: new_secret_kv_reference })
    web_client.web_apps.update_application_settings(RESOURCE_GROUP_NAME, FUNCTION_ACCOUNT, app_settings=app_settings)
