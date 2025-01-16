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
    headers = {'Authorization': 'Bearer ' + token}
    r = requests.get(vault_url, headers=headers, timeout=15)

def main(keepalivetimer: func.TimerRequest) -> None:
    utc_timestamp = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).isoformat()
    logging.info('[%s] - Health Check fired', utc_timestamp)
    
    if vaul_auth_enabled == 'false':
        keepSiteAlive('')
        return
    
    managed_identity = msal.SystemAssignedManagedIdentity(
        http_client=requests.Session(),
        token_cache=msal.TokenCache() # Let this app (re)use an existing token cache and the TokenCache() is in-memory.
    )
    app = msal.ManagedIdentityClient(managed_identity, http_client=requests.Session())
    result = app.acquire_token_for_client(resource=vault_resource_id)
    
    if "access_token" in result:
        keepSiteAlive(result['access_token'])
    else:
        logging.Error('[%s] - Access Token could not be obtained', utc_timestamp)