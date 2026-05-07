import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import 'intl-pluralrules';

import { resources } from './resources';

export const SUPPORTED_LANGUAGES = [
  'en', 'tr', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'ru', 'ja', 'zh',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const BETA_LANGUAGES = new Set<SupportedLanguage>(['ar']);
export const RTL_LANGUAGES = new Set<SupportedLanguage>(['ar']);

function deviceLanguage(): SupportedLanguage {
  const locales = Localization.getLocales();
  const tag = locales[0]?.languageCode ?? 'en';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(tag)
    ? (tag as SupportedLanguage)
    : 'en';
}

const initialLanguage = deviceLanguage();
I18nManager.allowRTL(true);
I18nManager.forceRTL(RTL_LANGUAGES.has(initialLanguage));

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  ns: [
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
  ],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  compatibilityJSON: 'v4',
});

export function setAppLanguage(language: SupportedLanguage) {
  I18nManager.forceRTL(RTL_LANGUAGES.has(language));
  return i18n.changeLanguage(language);
}

export default i18n;
