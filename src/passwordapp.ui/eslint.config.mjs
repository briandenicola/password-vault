// ESLint 9 flat config. Intentionally lean and high-signal: bug-catching rules
// (JS recommended + Vue 3 essential), not style/formatting churn. See BACKLOG.
import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // Build-time constant injected by Vue CLI / webpack DefinePlugin.
        __WB_MANIFEST: 'readonly',
      },
    },
    rules: {
      // Components are globally registered in main.js (PrimeVue, FontAwesome),
      // and we use deliberate single-word page names (Home, Update, Trash...).
      'vue/multi-word-component-names': 'off',
      // PrimeVue v4 registers components under their canonical names (Button,
      // Dialog, Select, Textarea), which collide with reserved HTML elements by
      // design; the app uses <Button> etc. in templates throughout.
      'vue/no-reserved-component-names': 'off',
      // Service-worker registration logs lifecycle events on purpose.
      'no-console': 'off',
      // Surface unused code as a warning, but allow conventionally-ignored args.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
];
