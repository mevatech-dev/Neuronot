import * as Application from 'expo-application';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

export function VersionRow() {
  const theme = useTheme();
  const { t } = useTranslation('about');

  return (
    <View
      style={{
        padding: theme.space[4],
        backgroundColor: theme.colors.surface.elevated,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
      }}
    >
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
        {t('version_label')}
      </Text>
      <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}>
        {Application.nativeApplicationVersion ?? '—'} ({Application.nativeBuildVersion ?? '—'})
      </Text>
    </View>
  );
}
