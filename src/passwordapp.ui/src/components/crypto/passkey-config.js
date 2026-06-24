export const DEFAULT_RP_ID = 'denicolafamily.com';
export const DEFAULT_RP_NAME = 'Denicola Family Password Vault';

export function getRpId(env = process.env) {
  return env.VUE_APP_RP_ID || DEFAULT_RP_ID;
}

export function getRpName() {
  return DEFAULT_RP_NAME;
}
