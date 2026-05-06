import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import 'intl-pluralrules';

import enCommon from '@/locales/en/common.json';
import enDailyLog from '@/locales/en/daily-log.json';
import enErrors from '@/locales/en/errors.json';
import enEvents from '@/locales/en/events.json';
import enOnboarding from '@/locales/en/onboarding.json';
import enTimeline from '@/locales/en/timeline.json';
import trCommon from '@/locales/tr/common.json';
import trDailyLog from '@/locales/tr/daily-log.json';
import trErrors from '@/locales/tr/errors.json';
import trEvents from '@/locales/tr/events.json';
import trOnboarding from '@/locales/tr/onboarding.json';
import trTimeline from '@/locales/tr/timeline.json';

export const SUPPORTED_LANGUAGES = [
  'en', 'tr', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'ru', 'ja', 'zh',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const BETA_LANGUAGES = new Set<SupportedLanguage>(['ar']);
export const RTL_LANGUAGES = new Set<SupportedLanguage>(['ar']);

const resources = {
  en: {
    common: enCommon,
    errors: enErrors,
    onboarding: enOnboarding,
    'daily-log': enDailyLog,
    events: enEvents,
    timeline: enTimeline,
  },
  tr: {
    common: trCommon,
    errors: trErrors,
    onboarding: trOnboarding,
    'daily-log': trDailyLog,
    events: trEvents,
    timeline: trTimeline,
  },
  // Other locales loaded as their JSON files are populated (Hafta 4).
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
  ns: ['common', 'errors', 'onboarding', 'daily-log', 'events', 'timeline'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  compatibilityJSON: 'v4',
});

export default i18n;
