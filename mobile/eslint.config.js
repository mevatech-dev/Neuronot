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
      // Reanimated's SharedValue.value mutation pattern is idiomatic. The
      // newer react-hooks/immutability rule treats it as a hook argument
      // mutation, which produces false positives for every animation hook.
      'react-hooks/immutability': 'off',
      // Form sheets seed local state from a remote query inside useEffect;
      // we accept this "load remote → seed form" idiom.
      'react-hooks/set-state-in-effect': 'off',
      // Style preference, not a correctness rule.
      '@typescript-eslint/array-type': 'off',
    },
  },
  {
    ignores: ['node_modules', 'dist', '.expo', 'ios', 'android', 'src/locales/**'],
  },
];
