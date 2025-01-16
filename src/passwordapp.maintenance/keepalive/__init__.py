import datetime
import logging
import requests
import os 
import msal
import azure.functions as func

vaul_auth_enabled=os.environ["VAULT_API_AUTH_ENABLED"]
vault_url=os.environ["VAULT_HEALTH_URL"]
vault_resource_id=os.environ["VAULT_APP_ID_URL"]

def keepSiteAlive(token):
    header = {'Authorization': token}
    r = requests.get(vault_url, headers=header, timeout=15)

def main(mytimer: func.TimerRequest) -> None:
    utc_timestamp = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).isoformat()
    logging.info('[%s] - Health Check fired', utc_timestamp)
    
    if vaul_auth_enabled == 'false':
        keepSiteAlive('')
        return
    
    managed_identity = msal.SystemAssignedManagedIdentity()
    global_app = msal.ManagedIdentityClient(managed_identity, http_client=requests.Session())
    result = global_app.acquire_token_for_client(resource=env.VAULT_RESOURCE_ID)')
    
    if "access_token" in result:
        keepSiteAlive(result['access_token'])
    else:
        logging.Error('[%s] - Access Token could not be obtained', utc_timestamp)