import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import 'intl-pluralrules';

import enCommon from '@/locales/en/common.json';
import enErrors from '@/locales/en/errors.json';
import trCommon from '@/locales/tr/common.json';
import trErrors from '@/locales/tr/errors.json';

export const SUPPORTED_LANGUAGES = [
  'en', 'tr', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'ru', 'ja', 'zh',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const BETA_LANGUAGES = new Set<SupportedLanguage>(['ar']);
export const RTL_LANGUAGES = new Set<SupportedLanguage>(['ar']);

const resources = {
  en: { common: enCommon, errors: enErrors },
  tr: { common: trCommon, errors: trErrors },
  // Other locales loaded lazily as their JSON files are populated (Hafta 4).
};

function deviceLanguage(): SupportedLanguage {
  const locales = Localization.getLocales();
  const tag = locales[0]?.languageCode ?? 'en';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(tag)
    ? (tag as SupportedLanguage)
    : 'en';
}

void i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: 'en',
  ns: ['common', 'errors'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  compatibilityJSON: 'v4',
});

export default i18n;
