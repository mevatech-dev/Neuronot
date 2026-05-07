import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BETA_LANGUAGES, SUPPORTED_LANGUAGES, setAppLanguage, type SupportedLanguage } from '@/i18n';
import { useTheme } from '@/theme';

const LABELS: Record<SupportedLanguage, string> = {
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

export function LanguagePicker() {
  const [open, setOpen] = useState(false);
  const { t, i18n } = useTranslation('settings');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const current = i18n.language as SupportedLanguage;

  const selectLanguage = async (lang: SupportedLanguage) => {
    await setAppLanguage(lang);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: theme.space[4],
          backgroundColor: theme.colors.surface.elevated,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border.subtle,
        }}
      >
        <Text style={{ ...theme.typography.body, color: theme.colors.text.primary, flex: 1 }}>
          {LABELS[current] ?? LABELS.en}
        </Text>
        <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.secondary }}>
          &gt;
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)} transparent>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: theme.colors.surface.overlay, justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: theme.colors.surface.primary,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              paddingTop: theme.space[5],
              paddingBottom: insets.bottom + theme.space[4],
              maxHeight: '82%',
            }}
          >
            <View style={{ paddingHorizontal: theme.space[6], marginBottom: theme.space[4] }}>
              <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>
                {t('language.title')}
              </Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: theme.space[6], gap: theme.space[2] }}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const active = current === lang;
                const beta = BETA_LANGUAGES.has(lang);

                return (
                  <Pressable
                    key={lang}
                    onPress={() => {
                      void selectLanguage(lang);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: theme.space[4],
                      backgroundColor: active ? theme.colors.surface.raised : theme.colors.surface.elevated,
                      borderRadius: theme.radius.md,
                      borderWidth: 1,
                      borderColor: active ? theme.colors.border.focus : theme.colors.border.subtle,
                    }}
                  >
                    <Text style={{ ...theme.typography.body, color: theme.colors.text.primary, flex: 1 }}>
                      {LABELS[lang]}
                    </Text>
                    {beta && (
                      <View
                        style={{
                          backgroundColor: theme.colors.warning.muted,
                          paddingHorizontal: theme.space[2],
                          paddingVertical: theme.space[1],
                          borderRadius: theme.radius.sm,
                        }}
                      >
                        <Text style={{ ...theme.typography.micro, color: theme.colors.text.inverse }}>
                          {t('language.beta')}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
