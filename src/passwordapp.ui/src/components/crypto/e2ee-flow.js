import { generateDek, deriveKek, wrapDek, importDek, generateRecoveryKey, recoveryKeyToBytes } from './dek.js';
import { buildEnrollOptions, buildUnlockOptions, enrollPasskey, unlockPasskey } from './passkey.js';
import { getRpId, getRpName } from './passkey-config.js';
import {
  generatePrfSalt,
  createVaultKeyRecord,
  getPrfSaltBytes,
  addWrappedDek,
  unwrapWithKek,
  tryUnwrapAny,
  RECOVERY_CREDENTIAL_ID,
} from './vault-key-record.js';
import { getVaultKeyRecord, putVaultKeyRecord } from './vault-key-api.js';
import { vaultSession } from './vault-session.js';

const textEncoder = new TextEncoder();

function userHandle(userName) {
  return textEncoder.encode(userName || 'password-vault-user');
}

function passkeyCredentialIds(record) {
  return record.wrappedDeks
    .filter(w => w.credentialId !== RECOVERY_CREDENTIAL_ID)
    .map(w => w.credentialId);
}

export async function enrollFirstPasskey({
  label,
  userName,
  displayName,
  rpId = getRpId(),
  rpName = getRpName(),
  createFn,
  http,
  session = vaultSession,
} = {}) {
  const existing = await getVaultKeyRecord(http);
  if (existing && existing.wrappedDeks.length > 0) {
    throw new Error('A vault key record already exists. Use additional passkey enrollment.');
  }

  const prfSalt = generatePrfSalt();
  let record = createVaultKeyRecord(prfSalt);
  const saltBytes = getPrfSaltBytes(record);
  const { bytes: dekBytes, key: dekKey } = await generateDek();
  const options = buildEnrollOptions({
    rpId,
    rpName,
    userId: userHandle(userName),
    userName: userName || 'password-vault-user',
    displayName: displayName || userName || 'Password Vault User',
    prfSalt,
  });
  const enrolled = await enrollPasskey(options, createFn);
  const passkeyKek = await deriveKek(enrolled.prfSecret, saltBytes);
  record = addWrappedDek(record, {
    credentialId: enrolled.credentialId,
    label: label || enrolled.credentialId,
    wrapped: await wrapDek(passkeyKek, dekBytes),
  });

  const recovery = generateRecoveryKey();
  const recoveryKek = await deriveKek(recovery.bytes, saltBytes);
  record = addWrappedDek(record, {
    credentialId: RECOVERY_CREDENTIAL_ID,
    label: 'recovery-key',
    wrapped: await wrapDek(recoveryKek, dekBytes),
  });

  const saved = await putVaultKeyRecord(record, http);
  session.unlock(dekKey);
  return { record: saved, credentialId: enrolled.credentialId, recoveryKey: recovery.display };
}

export async function enrollAdditionalPasskey({
  label,
  userName,
  displayName,
  rpId = getRpId(),
  rpName = getRpName(),
  createFn,
  getFn,
  http,
} = {}) {
  let record = await getVaultKeyRecord(http);
  if (!record || record.wrappedDeks.length === 0) {
    throw new Error('Enroll the first passkey before adding another.');
  }
  const saltBytes = getPrfSaltBytes(record);
  const unlockOptions = buildUnlockOptions({
    rpId,
    prfSalt: saltBytes,
    allowCredentials: passkeyCredentialIds(record),
  });
  const existing = await unlockPasskey(unlockOptions, getFn);
  const existingKek = await deriveKek(existing.prfSecret, saltBytes);
  const dekBytes = await unwrapWithKek(record, existing.credentialId, existingKek);

  const enrollOptions = buildEnrollOptions({
    rpId,
    rpName,
    userId: userHandle(userName),
    userName: userName || 'password-vault-user',
    displayName: displayName || userName || 'Password Vault User',
    prfSalt: saltBytes,
  });
  const enrolled = await enrollPasskey(enrollOptions, createFn);
  const newKek = await deriveKek(enrolled.prfSecret, saltBytes);
  record = addWrappedDek(record, {
    credentialId: enrolled.credentialId,
    label: label || enrolled.credentialId,
    wrapped: await wrapDek(newKek, dekBytes),
  });
  const saved = await putVaultKeyRecord(record, http);
  return { record: saved, credentialId: enrolled.credentialId };
}

export async function unlockVaultWithPasskey({
  rpId = getRpId(),
  getFn,
  http,
  session = vaultSession,
} = {}) {
  const record = await getVaultKeyRecord(http);
  if (!record || record.wrappedDeks.length === 0) {
    throw new Error('No passkey has been enrolled for this vault.');
  }
  const saltBytes = getPrfSaltBytes(record);
  const options = buildUnlockOptions({
    rpId,
    prfSalt: saltBytes,
    allowCredentials: passkeyCredentialIds(record),
  });
  const unlocked = await unlockPasskey(options, getFn);
  const kek = await deriveKek(unlocked.prfSecret, saltBytes);
  const dekBytes = await unwrapWithKek(record, unlocked.credentialId, kek);
  const dek = await importDek(dekBytes);
  session.unlock(dek);
  return { record, credentialId: unlocked.credentialId };
}

export async function unlockVaultWithRecoveryKey({
  recoveryKey,
  http,
  session = vaultSession,
} = {}) {
  const record = await getVaultKeyRecord(http);
  if (!record || record.wrappedDeks.length === 0) {
    throw new Error('No vault key record has been enrolled.');
  }
  const kek = await deriveKek(recoveryKeyToBytes(recoveryKey), getPrfSaltBytes(record));
  const dekBytes = await tryUnwrapAny(record, kek);
  const dek = await importDek(dekBytes);
  session.unlock(dek);
  return { record };
}
