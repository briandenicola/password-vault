import datetime
import logging
import requests
import os 

import azure.functions as func

vault_url=os.environ["VAULT_HEALTH_URL"]

def keepSiteAlive():
    r = requests.get(vault_url, timeout=15)

def main(mytimer: func.TimerRequest) -> None:
    utc_timestamp = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).isoformat()
    logging.info('Health Check ran at %s', utc_timestamp)
    keepSiteAlive()
