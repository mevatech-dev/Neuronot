import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { SUPPORTED_LANGUAGES, BETA_LANGUAGES, setAppLanguage, type SupportedLanguage } from '@/i18n';
import { useAuthStore } from '@/store/auth';
import { useTheme, useThemeMode } from '@/theme';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  tr: 'Türkçe',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  pt: 'Português',
  it: 'Italiano',
  ar: 'العربية',
  ru: 'Русский',
  ja: '日本語',
  zh: '简体中文',
};

export default function SettingsScreen() {
  const { t, i18n } = useTranslation('common');
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();
  const logout = useAuthStore((s) => s.logout);

  const handleLanguageChange = (lang: SupportedLanguage) => {
    void setAppLanguage(lang);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
      <ScrollView contentContainerStyle={{ padding: theme.space[6] }}>
        <Text style={{ ...theme.typography.title, color: theme.colors.text.primary, marginBottom: theme.space[6] }}>
          {t('tabs.settings')}
        </Text>

        <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary, marginBottom: theme.space[3] }}>
          {t('settings.theme.title')}
        </Text>
        {(['system', 'light', 'dark'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={{
              padding: theme.space[4],
              backgroundColor: mode === m ? theme.colors.surface.raised : theme.colors.surface.elevated,
              borderRadius: theme.radius.md,
              marginBottom: theme.space[2],
              borderWidth: 1,
              borderColor: mode === m ? theme.colors.border.focus : theme.colors.border.subtle,
            }}
          >
            <Text style={{ ...theme.typography.body, color: theme.colors.text.primary }}>
              {t(`settings.theme.${m}`)}
            </Text>
          </Pressable>
        ))}

        <Text
          style={{
            ...theme.typography.heading,
            color: theme.colors.text.primary,
            marginTop: theme.space[8],
            marginBottom: theme.space[3],
          }}
        >
          {t('settings.language.title')}
        </Text>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isActive = i18n.language === lang;
          const isBeta = BETA_LANGUAGES.has(lang);
          return (
            <Pressable
              key={lang}
              onPress={() => handleLanguageChange(lang)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: theme.space[4],
                backgroundColor: isActive ? theme.colors.surface.raised : theme.colors.surface.elevated,
                borderRadius: theme.radius.md,
                marginBottom: theme.space[2],
                borderWidth: 1,
                borderColor: isActive ? theme.colors.border.focus : theme.colors.border.subtle,
              }}
            >
              <Text style={{ ...theme.typography.body, color: theme.colors.text.primary, flex: 1 }}>
                {LANGUAGE_LABELS[lang]}
              </Text>
              {isBeta && (
                <View
                  style={{
                    backgroundColor: theme.colors.warning.muted,
                    paddingHorizontal: theme.space[2],
                    paddingVertical: theme.space[1],
                    borderRadius: theme.radius.sm,
                  }}
                >
                  <Text style={{ ...theme.typography.micro, color: theme.colors.text.inverse }}>
                    {t('settings.language.beta')}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}

        <Pressable
          onPress={handleLogout}
          style={{
            marginTop: theme.space[10],
            padding: theme.space[4],
            backgroundColor: theme.colors.danger.default,
            borderRadius: theme.radius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.inverse }}>
            {t('auth.logout')}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
