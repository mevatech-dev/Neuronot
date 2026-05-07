import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme, useThemeMode } from '@/theme';

const MODES = ['system', 'light', 'dark'] as const;

export function ThemePicker() {
  const { t } = useTranslation('settings');
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();

  return (
    <View style={{ gap: theme.space[3] }}>
      <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>
        {t('theme.title')}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          gap: theme.space[2],
          padding: theme.space[1],
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surface.elevated,
          borderWidth: 1,
          borderColor: theme.colors.border.subtle,
        }}
      >
        {MODES.map((m) => {
          const active = mode === m;
          return (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingVertical: theme.space[3],
                paddingHorizontal: theme.space[2],
                borderRadius: theme.radius.md,
                backgroundColor: active || pressed ? theme.colors.surface.raised : theme.colors.surface.elevated,
                borderWidth: 1,
                borderColor: active ? theme.colors.border.focus : theme.colors.border.subtle,
              })}
            >
              <Text
                style={{
                  ...theme.typography.bodyMedium,
                  color: active ? theme.colors.accent.default : theme.colors.text.secondary,
                  textAlign: 'center',
                }}
              >
                {t(`theme.${m}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
