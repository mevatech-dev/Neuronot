import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { NeuroMascot } from '@/components/brand/NeuroMascot';
import { useHapticPress } from '@/hooks/useHapticPress';
import { useOnboardingStore } from '@/store/onboarding';
import { useTheme } from '@/theme';

export default function GetStarted() {
  const { t } = useTranslation('onboarding');
  const theme = useTheme();
  const press = useHapticPress();
  const markIntroSeen = useOnboardingStore((s) => s.markIntroSeen);

  const onPress = () => {
    markIntroSeen();
    router.replace('/(intro)/onboarding');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
      <View style={{ flex: 1, paddingHorizontal: theme.space[6], justifyContent: 'center', alignItems: 'center', gap: theme.space[5] }}>
        <NeuroMascot mood="happy" size={160} />
        <Text style={{ ...theme.typography.display, color: theme.colors.text.primary, textAlign: 'center' }}>
          {t('getStarted.brand')}
        </Text>
        <Text style={{ ...theme.typography.body, color: theme.colors.text.muted, textAlign: 'center' }}>
          {t('getStarted.tagline')}
        </Text>
      </View>

      <View style={{ paddingHorizontal: theme.space[6], paddingBottom: theme.space[6] }}>
        <Animated.View style={press.style}>
          <Pressable
            onPress={onPress}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            style={{
              paddingVertical: theme.space[4],
              borderRadius: theme.radius.md,
              alignItems: 'center',
              backgroundColor: theme.colors.accent.default,
            }}
          >
            <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
              {t('getStarted.cta')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
