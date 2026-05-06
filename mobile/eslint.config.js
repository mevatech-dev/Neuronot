// @ts-check
const expoConfig = require('eslint-config-expo/flat');
const i18nextPlugin = require('eslint-plugin-i18next');

module.exports = [
  ...expoConfig,
  {
    plugins: {
      i18next: i18nextPlugin,
    },
    rules: {
      // PRD §13: hardcoded UI strings forbidden — use t('namespace.key').
      'i18next/no-literal-string': [
        'error',
        {
          markupOnly: true,
          ignoreAttribute: ['testID', 'accessibilityLabel'],
          ignoreCallee: ['t', 'i18next.t', 'translate'],
        },
      ],
    },
  },
  {
    ignores: ['node_modules', 'dist', '.expo', 'ios', 'android', 'src/locales/**'],
  },
];
