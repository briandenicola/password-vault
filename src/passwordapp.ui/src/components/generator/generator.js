import PasswordUtils from '@/components/utils/utils.js';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';
import { loadSettings } from '@/components/settings/settings.store.js';
import {
  DEFAULT_PASSWORD_OPTIONS,
  DEFAULT_PASSPHRASE_OPTIONS,
} from '@/components/utils/generator.js';

export default {
  name: 'PasswordGenerator',
  emits: ['generated'],
  data() {
    const settings = loadSettings(Authentication.getUserProfile());
    return {
      showOptions: false,
      mode: settings.generator.mode, // 'password' | 'passphrase'
      errorMessage: '',
      passwordOptions: { ...DEFAULT_PASSWORD_OPTIONS, ...settings.generator.password },
      passphraseOptions: { ...DEFAULT_PASSPHRASE_OPTIONS, ...settings.generator.passphrase },
      separatorChoices: [
        { value: '-', text: 'Dash ( - )' },
        { value: '.', text: 'Dot ( . )' },
        { value: '_', text: 'Underscore ( _ )' },
        { value: ' ', text: 'Space (   )' },
      ],
    };
  },
  computed: {
    entropyBits() {
      try {
        return this.mode === 'password'
          ? PasswordUtils.passwordEntropyBits(this.passwordOptions)
          : PasswordUtils.passphraseEntropyBits(this.passphraseOptions);
      } catch {
        return 0;
      }
    },
    strengthLabel() {
      const bits = this.entropyBits;
      if (bits < 40) return 'Weak';
      if (bits < 60) return 'Fair';
      if (bits < 80) return 'Strong';
      return 'Excellent';
    },
    strengthVariant() {
      const bits = this.entropyBits;
      if (bits < 40) return 'danger';
      if (bits < 60) return 'warn';
      if (bits < 80) return 'info';
      return 'success';
    },
  },
  methods: {
    generate() {
      this.errorMessage = '';
      try {
        const value =
          this.mode === 'password'
            ? PasswordUtils.generatePassword(this.passwordOptions)
            : PasswordUtils.generatePassphrase(this.passphraseOptions);
        this.$emit('generated', value);
      } catch (err) {
        this.errorMessage = err.message || String(err);
      }
    },
  },
};
