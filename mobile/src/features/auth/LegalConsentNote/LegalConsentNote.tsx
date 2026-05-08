import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

// LegalConsentNote sits beneath the welcome buttons and reads "By
// continuing you agree to our Terms and Privacy Policy". Tapping a link
// opens the hosted page in the system browser. Tapping any sign-in button
// is the implicit consent grant — that's why it's worded "by continuing"
// rather than a checkbox.
export function LegalConsentNote() {
  const theme = useTheme();
  const { t } = useTranslation('common');

  const open = (url: string) => {
    void Linking.openURL(url);
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: theme.space[1],
      }}
    >
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
        {t('auth.legal_intro')}
      </Text>
      <Pressable onPress={() => open('https://neuronot.app/legal/terms')} hitSlop={6}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.accent.default }}>
          {t('auth.tos_link')}
        </Text>
      </Pressable>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
        {t('auth.legal_and')}
      </Text>
      <Pressable onPress={() => open('https://neuronot.app/legal/privacy')} hitSlop={6}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.accent.default }}>
          {t('auth.privacy_link')}
        </Text>
      </Pressable>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>.</Text>
    </View>
  );
}
