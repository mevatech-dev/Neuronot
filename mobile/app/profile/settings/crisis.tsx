import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { NeuroMascot } from '@/components/brand/NeuroMascot';
import { CrisisHotlineList } from '@/features/crisis/CrisisHotlineList';
import { useTheme } from '@/theme';

export default function CrisisScreen() {
  const theme = useTheme();
  const { t } = useTranslation('crisis');

  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[5] }}>
          <View style={{ alignItems: 'center' }}>
            <NeuroMascot mood="calm" size={88} />
          </View>
          <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>
            {t('body')}
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
            {t('card_hint')}
          </Text>
          <CrisisHotlineList />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
