import datetime
import logging
import requests
import json 
import os

import azure.functions as func

passwordvaultid=os.environ["VaultSpnId"]
clientid=os.environ["Clientid"]
secret=os.environ["SpnSecret"]
login_url=os.environ["LoginUrl"]
app_url=os.environ["AppUrl"]
code=os.environ["FunctionCode"]

def getLoginToken():
    body = { 
        "resource": passwordvaultid, 
        "scope": "openid",
        "grant_type": "client_credentials",
        "client_id": clientid,
        "client_secret": secret
    }
    r = requests.post(login_url, data=body)

    token = json.loads(r.text)
    return "{} {}".format(token['token_type'], token['access_token'])

def getKeepAlive(token):
    header = {'Authorization': token}
    heatlh_check_url = "{}/healthz?code={}".format(app_url, code)
    r = requests.get(heatlh_check_url, headers=header)

def main(mytimer: func.TimerRequest):

    utc_timestamp = datetime.datetime.utcnow().replace(
        tzinfo=datetime.timezone.utc).isoformat()

    logging.info('Health Check ran at %s', utc_timestamp)

    logging.info('Authenticating against Azure AD')
    bearer_token = getLoginToken()

    logging.info('Hit Keep Alive Url')
    getKeepAlive(bearer_token)
