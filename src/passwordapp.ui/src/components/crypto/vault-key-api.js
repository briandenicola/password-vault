import Axios from 'axios';
import { parseRecord, serializeRecord } from './vault-key-record.js';

const API_ENDPOINT = '/api/vault-key';

function normalizeEntry(entry) {
  return {
    credentialId: entry.credentialId ?? entry.CredentialId,
    label: entry.label ?? entry.Label,
    wrapped: entry.wrapped ?? entry.Wrapped,
  };
}

export function normalizeVaultKeyRecord(record) {
  if (!record) {
    return null;
  }
  return parseRecord({
    prfSalt: record.prfSalt ?? record.PrfSalt,
    wrappedDeks: (record.wrappedDeks ?? record.WrappedDeks ?? []).map(normalizeEntry),
  });
}

export async function getVaultKeyRecord(http = Axios) {
  try {
    const response = await http.get(API_ENDPOINT);
    return normalizeVaultKeyRecord(response.data);
  } catch (error) {
    if (error && error.response && error.response.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function putVaultKeyRecord(record, http = Axios) {
  const response = await http.put(API_ENDPOINT, JSON.parse(serializeRecord(record)));
  return normalizeVaultKeyRecord(response.data);
}
