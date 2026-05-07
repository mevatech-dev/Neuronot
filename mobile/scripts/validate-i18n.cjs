/* global __dirname */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const localesDir = path.join(root, 'src', 'locales');
const languages = ['en', 'tr', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'ru', 'ja', 'zh'];
const namespaces = [
  'common',
  'errors',
  'onboarding',
  'daily-log',
  'events',
  'timeline',
  'insights',
  'crisis',
  'settings',
  'account',
  'consents',
  'data',
  'about',
  'help',
];

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function flattenKeys(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}

let hasError = false;

for (const namespace of namespaces) {
  const sourcePath = path.join(localesDir, 'en', `${namespace}.json`);
  const sourceKeys = flattenKeys(readJSON(sourcePath)).sort();

  for (const language of languages) {
    const file = path.join(localesDir, language, `${namespace}.json`);
    if (!fs.existsSync(file)) {
      console.error(`[i18n] missing file: ${language}/${namespace}.json`);
      hasError = true;
      continue;
    }

    const targetKeys = flattenKeys(readJSON(file)).sort();
    const missing = sourceKeys.filter((key) => !targetKeys.includes(key));
    const extra = targetKeys.filter((key) => !sourceKeys.includes(key));

    if (missing.length > 0 || extra.length > 0) {
      hasError = true;
      if (missing.length > 0) {
        console.error(`[i18n] ${language}/${namespace}.json missing: ${missing.join(', ')}`);
      }
      if (extra.length > 0) {
        console.error(`[i18n] ${language}/${namespace}.json extra: ${extra.join(', ')}`);
      }
    }
  }
}

if (hasError) {
  process.exit(1);
}

console.log(`[i18n] ${languages.length} languages x ${namespaces.length} namespaces complete`);
