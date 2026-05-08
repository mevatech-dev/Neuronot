import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text } from 'react-native';

import { useTheme } from '@/theme';

export function SupportMailtoButton() {
  const theme = useTheme();
  const { t } = useTranslation('help');

  return (
    <Pressable
      onPress={() => {
        void Linking.openURL('mailto:support@neuronot.app');
      }}
      style={{
        padding: theme.space[4],
        backgroundColor: theme.colors.accent.default,
        borderRadius: theme.radius.md,
        alignItems: 'center',
      }}
    >
      <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
        {t('contact')}
      </Text>
    </Pressable>
  );
}
