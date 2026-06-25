import Authentication from '@/components/azuread/AzureAD.Authentication.js';
import PasswordUtils from '@/components/utils/utils.js';
import {
  loadSettings,
  saveSettings,
  resetSettings,
} from '@/components/settings/settings.store.js';
import {
  defaultBackupSettings,
  getBackupSettings,
  normalizeBackupSettings,
  putBackupSettings,
  runBackupNow,
} from '@/components/api/BackupSettings.Api.js';

export default {
  name: 'Settings',
  data() {
    return {
      settings: loadSettings(Authentication.getUserProfile()),
      backupSettings: defaultBackupSettings(),
      backupSettingsError: '',
      backupSettingsLoading: false,
      backupRunningNow: false,
      savedMessage: '',
      themeChoices: [
        { value: 'vault', text: 'Vault' },
        { value: 'classic', text: 'Classic' },
        { value: 'roman-bank', text: 'Roman/Classical Bank' },
      ],
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
      staleChoices: [
        { value: 0, text: 'Never' },
        { value: 6, text: '6 months' },
        { value: 12, text: '1 year' },
        { value: 24, text: '2 years' },
        { value: 36, text: '3 years' },
      ],
      clipboardClearChoices: [
        { value: 0, text: 'Never' },
        { value: 10, text: '10 seconds' },
        { value: 20, text: '20 seconds' },
        { value: 30, text: '30 seconds' },
        { value: 60, text: '60 seconds' },
      ],
      autoLockChoices: [
        { value: 0, text: 'Never' },
        { value: 1, text: '1 minute' },
        { value: 5, text: '5 minutes' },
        { value: 15, text: '15 minutes' },
        { value: 30, text: '30 minutes' },
      ],
      backupFrequencyChoices: [
        { value: 'daily', text: 'Daily' },
        { value: 'weekly', text: 'Weekly' },
        { value: 'monthly', text: 'Monthly' },
      ],
      dayOfWeekChoices: [
        { value: 0, text: 'Sunday' },
        { value: 1, text: 'Monday' },
        { value: 2, text: 'Tuesday' },
        { value: 3, text: 'Wednesday' },
        { value: 4, text: 'Thursday' },
        { value: 5, text: 'Friday' },
        { value: 6, text: 'Saturday' },
      ],
      dayOfMonthChoices: Array.from({ length: 31 }, (_, i) => i + 1),
      retentionChoices: [7, 14, 30, 60, 90, 180, 365],
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
  async mounted() {
    this.backupSettingsLoading = true;
    this.backupSettingsError = '';
    try {
      this.backupSettings = await getBackupSettings();
    } catch (err) {
      this.backupSettingsError = 'Unable to load backup schedule: ' + (err && err.message ? err.message : err);
    } finally {
      this.backupSettingsLoading = false;
    }
  },
  methods: {
    async save() {
      const userId = Authentication.getUserProfile();
      const ok = saveSettings(userId, this.settings);
      if (ok) {
        this.applyTheme();
      }
      try {
        this.backupSettings = await putBackupSettings(this.backupSettings);
        this.backupSettingsError = '';
        this.savedMessage = ok
          ? 'Preferences and backup schedule saved.'
          : 'Backup schedule saved. Could not save local preferences (storage unavailable).';
      } catch (err) {
        this.savedMessage = ok ? 'Preferences saved.' : 'Could not save preferences (storage unavailable).';
        this.backupSettingsError = 'Could not save backup schedule: ' + (err && err.message ? err.message : err);
      }
    },
    resetToDefaults() {
      const userId = Authentication.getUserProfile();
      this.settings = resetSettings(userId);
      this.applyTheme();
      this.savedMessage = 'Preferences reset to defaults.';
    },
    applyTheme() {
      window.dispatchEvent(new CustomEvent('vaultThemeChanged', {
        detail: { theme: this.settings.appearance.theme },
      }));
    },
    async runBackupNow() {
      this.backupRunningNow = true;
      this.backupSettingsError = '';
      this.savedMessage = '';
      try {
        this.backupSettings = await runBackupNow();
        this.savedMessage = 'Backup completed.';
      } catch (err) {
        if (err && err.response && err.response.data) {
          this.backupSettings = normalizeBackupSettings(err.response.data);
        }
        this.backupSettingsError = 'Could not run backup: ' + this.describeBackupError(err);
      } finally {
        this.backupRunningNow = false;
      }
    },
    describeBackupError(err) {
      const data = err && err.response && err.response.data;
      if (data) {
        return data.lastError || data.LastError || data.lastStatus || data.LastStatus || err.message;
      }
      return err && err.message ? err.message : err;
    },
  },
};
