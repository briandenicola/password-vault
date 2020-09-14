import datetime
import logging
import requests
import json 
import os
import base64

from cryptography.exceptions import AlreadyFinalized
from cryptography.exceptions import InvalidTag
from cryptography.exceptions import UnsupportedAlgorithm
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

import azure.functions as func

key=base64.urlsafe_b64decode(os.environ["AesKey"])
nonce=base64.urlsafe_b64decode(os.environ["AesIV"])
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

def getPasswords(token):
    header = {'Authorization': token}
    r = requests.get("{}?code={}".format(app_url,code), headers=header)
    return json.loads(r.text)

def getPassword(password, token):
    header = {'Authorization': token}
    password_history_url = "{}/{}/history?code={}".format(app_url,password['id'], code)
    r = requests.get(password_history_url, headers=header)
    
    if (r.status_code == 200):
        return json.loads(r.text)

def encrytPasswordFile(backups):
    aesgcm = AESGCM(key)
    cipher_text_bytes = aesgcm.encrypt(
        nonce=nonce,
        data=json.dumps(backups).encode('utf-8'),
        associated_data=None
    )
    return cipher_text_bytes

def main(mytimer: func.TimerRequest,
         outputblob: func.Out[func.InputStream]):

    utc_timestamp = datetime.datetime.utcnow().replace(
        tzinfo=datetime.timezone.utc).isoformat()

    logging.info('Python timer trigger function ran at %s', utc_timestamp)

    logging.info('Authenticating against Azure AD')
    bearer_token = getLoginToken()

    logging.info('Getting all Passwords')
    passwords = getPasswords(bearer_token)

    logging.info('Getting each Password History')
    backups = [getPassword(p, bearer_token) for p in passwords]

    logging.info('Encrypting output')
    #with open("encrypted_file.enc", 'wb') as encrypted_file:
    outputblob.set(encrytPasswordFile(backups))
   