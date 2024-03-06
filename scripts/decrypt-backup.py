#!/usr/bin/python3

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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

key=base64.urlsafe_b64decode(os.environ["AesKey"])
nonce=base64.urlsafe_b64decode(os.environ["AesIV"])

with open("passwords.enc", 'rb') as encrypted_file:
    cipher_file_content = encrypted_file.read()

aesgcm = AESGCM(key)
decrypted_cipher_text_bytes = aesgcm.decrypt(
    nonce=nonce,
    data=cipher_file_content,
    associated_data=None
)
decrypted_cipher_text = decrypted_cipher_text_bytes.decode('utf-8')

with open("passwords.json", 'wb') as decrypted_file:
    decrypted_file.write(decrypted_cipher_text_bytes)
