import { useTranslation } from 'react-i18next';
import { Switch, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  value: boolean | undefined;
  onChange: (next: boolean) => void;
};

export function Step4Caffeine({ value, onChange }: Props) {
  const { t } = useTranslation('onboarding');
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space[3] }}>
      <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>
        {t('step4.title')}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: theme.space[4],
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surface.elevated,
          borderWidth: 1,
          borderColor: theme.colors.border.subtle,
        }}
      >
        <Text style={{ ...theme.typography.body, color: theme.colors.text.primary, flex: 1 }}>
          {t('step4.caffeine_label')}
        </Text>
        <Switch value={!!value} onValueChange={onChange} />
      </View>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
        {t('step4.hint')}
      </Text>
    </View>
  );
}
