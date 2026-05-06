import { useTranslation } from 'react-i18next';
import { SafeAreaView, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export default function InsightsScreen() {
  const { t } = useTranslation('common');
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
      <View style={{ flex: 1, padding: theme.space[6] }}>
        <Text style={{ ...theme.typography.title, color: theme.colors.text.primary }}>
          {t('tabs.insights')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
