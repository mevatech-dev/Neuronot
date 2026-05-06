// @ts-check
/* global __dirname */
const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const i18nextPlugin = require('eslint-plugin-i18next');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  ...compat.extends('expo'),
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
