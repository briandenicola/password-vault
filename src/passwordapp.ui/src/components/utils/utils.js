import {
  generatePassword,
  generatePassphrase,
  passwordEntropyBits,
  passphraseEntropyBits,
  DEFAULT_PASSWORD_OPTIONS,
  DEFAULT_PASSPHRASE_OPTIONS,
} from './generator.js';

export default {
  // Backward-compatible: a strong password using all character classes.
  // Now backed by an unbiased generator (GE-4) with configurable options (GE-1/GE-2).
  generatePassword(lengthOrOptions = {}) {
    const options =
      typeof lengthOrOptions === 'number'
        ? { length: lengthOrOptions }
        : lengthOrOptions;
    return generatePassword(options);
  },

  // Diceware-style passphrase from the EFF large wordlist (GE-3).
  generatePassphrase(options = {}) {
    return generatePassphrase(options);
  },

  passwordEntropyBits,
  passphraseEntropyBits,
  DEFAULT_PASSWORD_OPTIONS,
  DEFAULT_PASSPHRASE_OPTIONS,
};
