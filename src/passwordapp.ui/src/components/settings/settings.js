import Authentication from '@/components/azuread/AzureAD.Authentication.js';
import PasswordUtils from '@/components/utils/utils.js';
import {
  loadSettings,
  saveSettings,
  resetSettings,
} from '@/components/settings/settings.store.js';

export default {
  name: 'Settings',
  data() {
    return {
      settings: loadSettings(Authentication.getUserProfile()),
      savedMessage: '',
      separatorChoices: [
        { value: '-', text: 'Dash ( - )' },
        { value: '.', text: 'Dot ( . )' },
        { value: '_', text: 'Underscore ( _ )' },
        { value: ' ', text: 'Space (   )' },
      ],
      sortChoices: [
        { value: 'accountName', text: 'Account' },
        { value: 'siteName', text: 'Site' },
        { value: 'lastModifiedDate', text: 'Last Modified' },
      ],
      directionChoices: [
        { value: false, text: 'Ascending' },
        { value: true, text: 'Descending' },
      ],
      perPageChoices: [5, 10, 20, 50, 100],
    };
  },
  computed: {
    generatorEntropy() {
      try {
        return this.settings.generator.mode === 'password'
          ? PasswordUtils.passwordEntropyBits(this.settings.generator.password)
          : PasswordUtils.passphraseEntropyBits(this.settings.generator.passphrase);
      } catch {
        return 0;
      }
    },
  },
  methods: {
    save() {
      const userId = Authentication.getUserProfile();
      const ok = saveSettings(userId, this.settings);
      this.savedMessage = ok
        ? 'Preferences saved.'
        : 'Could not save preferences (storage unavailable).';
    },
    resetToDefaults() {
      const userId = Authentication.getUserProfile();
      this.settings = resetSettings(userId);
      this.savedMessage = 'Preferences reset to defaults.';
    },
  },
};
