import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
};

export function Step3Sleep({ value, onChange }: Props) {
  const { t } = useTranslation('onboarding');
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space[3] }}>
      <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>
        {t('step3.title')}
      </Text>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
        {t('step3.sleep_label')}
      </Text>
      <TextInput
        keyboardType="decimal-pad"
        value={value?.toString() ?? ''}
        onChangeText={(txt) => {
          const n = Number(txt.replace(',', '.'));
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        style={{
          ...theme.typography.body,
          backgroundColor: theme.colors.surface.elevated,
          color: theme.colors.text.primary,
          borderColor: theme.colors.border.subtle,
          borderWidth: 1,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.space[4],
          paddingVertical: theme.space[3],
        }}
        placeholderTextColor={theme.colors.text.muted}
      />
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
        {t('step3.sleep_hint')}
      </Text>
    </View>
  );
}
