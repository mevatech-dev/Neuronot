import * as Localization from 'expo-localization';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { NeuroMascot, type NeuroMood } from '@/components/brand/NeuroMascot';
import { ProgressBar } from '@/features/onboarding/ProgressBar';
import { Ready } from '@/features/onboarding/Ready';
import { Step1FocusProblem } from '@/features/onboarding/Step1FocusProblem';
import { Step2Intensity } from '@/features/onboarding/Step2Intensity';
import { Step3Sleep } from '@/features/onboarding/Step3Sleep';
import { Step4Caffeine } from '@/features/onboarding/Step4Caffeine';
import { Step5Reminder } from '@/features/onboarding/Step5Reminder';
import { Welcome } from '@/features/onboarding/Welcome';
import type { OnboardingState } from '@/features/onboarding/types';
import { useHapticPress } from '@/hooks/useHapticPress';
import { useSlideTransition } from '@/hooks/useSlideTransition';
import { useOnboardingStore } from '@/store/onboarding';
import { useTheme } from '@/theme';

type Phase = 'welcome' | 1 | 2 | 3 | 4 | 5 | 'ready';

const QUESTION_STEPS = 5;

const STEP_MOOD: Record<Exclude<Phase, 'welcome' | 'ready'>, NeuroMood> = {
  1: 'thinking',
  2: 'sad',
  3: 'sleepy',
  4: 'happy',
  5: 'encouraging',
};

export default function IntroOnboardingScreen() {
  const { t } = useTranslation('onboarding');
  const theme = useTheme();
  const press = useHapticPress();
  const markCompletedLocally = useOnboardingStore((s) => s.markCompletedLocally);
  const persistedAnswers = useOnboardingStore((s) => s.answers);
  const setAnswersStore = useOnboardingStore((s) => s.setAnswers);

  const [phase, setPhase] = useState<Phase>('welcome');
  const [state, setState] = useState<OnboardingState>(persistedAnswers);
  const transition = useSlideTransition(typeof phase === 'number' ? phase : phase === 'welcome' ? -1 : QUESTION_STEPS + 1);

  // Mascot breathing — gentle, runs across all steps
  const breath = useSharedValue(0);
  const float = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    float.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breath, float]);
  const mascotAnim = useAnimatedStyle(() => ({
    transform: [
      { translateY: -4 + float.value * 8 },
      { scale: 1 + breath.value * 0.035 },
    ],
  }));

  const update = (patch: Partial<OnboardingState>) => {
    // Compute next from the latest state then push to both React state
    // and the zustand store outside the React state-updater function —
    // calling setAnswersStore inside the updater triggered a "cannot
    // update component while rendering" warning because the store
    // selector subscribes this component back into its own render.
    const next = { ...state, ...patch };
    setState(next);
    setAnswersStore(next);
  };

  const finish = () => {
    // Capture device timezone now so the post-login PATCH carries it.
    const timezone = Localization.getCalendars()[0]?.timeZone ?? 'UTC';
    markCompletedLocally({ ...state, timezone });
    router.replace('/(auth)/welcome');
  };

  if (phase === 'welcome') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <Welcome onStart={() => setPhase(1)} />
      </SafeAreaView>
    );
  }

  if (phase === 'ready') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <Ready onFinish={finish} submitting={false} />
      </SafeAreaView>
    );
  }

  const canAdvance =
    (phase === 1 && (state.concerns?.length ?? 0) > 0) ||
    (phase === 2 && !!state.intensityLevel) ||
    (phase === 3 && state.avgSleepHours !== undefined && state.avgSleepHours > 0) ||
    phase === 4 ||
    phase === 5;

  const goNext = () => {
    if (!canAdvance) return;
    if (phase === QUESTION_STEPS) {
      setPhase('ready');
    } else {
      setPhase((phase + 1) as Phase);
    }
  };

  const goBack = () => {
    if (phase === 1) {
      setPhase('welcome');
      return;
    }
    setPhase(((phase as number) - 1) as Phase);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.space[6],
          paddingTop: theme.space[6],
          paddingBottom: theme.space[4],
          gap: theme.space[5],
        }}
      >
        <Text style={{ ...theme.typography.micro, color: theme.colors.text.muted }}>
          {t('progress', { current: phase, total: QUESTION_STEPS })}
        </Text>
        <ProgressBar current={phase} total={QUESTION_STEPS} />

        <View style={{ alignItems: 'center', paddingVertical: theme.space[3] }}>
          <Animated.View style={mascotAnim}>
            <NeuroMascot mood={STEP_MOOD[phase]} size={200} />
          </Animated.View>
        </View>

        <Animated.View style={transition}>
          {phase === 1 && (
            <Step1FocusProblem
              value={state.concerns}
              onChange={(concerns) => update({ concerns })}
            />
          )}
          {phase === 2 && (
            <Step2Intensity
              value={state.intensityLevel}
              onChange={(intensityLevel) => update({ intensityLevel })}
            />
          )}
          {phase === 3 && (
            <Step3Sleep
              value={state.avgSleepHours}
              onChange={(avgSleepHours) => update({ avgSleepHours })}
            />
          )}
          {phase === 4 && (
            <Step4Caffeine
              value={state.caffeineDaily}
              onChange={(caffeineDaily) => update({ caffeineDaily })}
            />
          )}
          {phase === 5 && (
            <Step5Reminder
              enabled={state.reminderEnabled}
              hour={state.reminderHour}
              onEnabledChange={(reminderEnabled) =>
                update({
                  reminderEnabled,
                  reminderHour: reminderEnabled ? (state.reminderHour ?? 9) : state.reminderHour,
                })
              }
              onHourChange={(reminderHour) => update({ reminderHour })}
            />
          )}
        </Animated.View>
      </ScrollView>

      {/* Sticky bottom action bar */}
      <View
        style={{
          flexDirection: 'row',
          gap: theme.space[3],
          paddingHorizontal: theme.space[5],
          paddingTop: theme.space[3],
          paddingBottom: theme.space[3],
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.subtle,
          backgroundColor: theme.colors.surface.primary,
        }}
      >
        <Pressable
          onPress={goBack}
          style={{
            flex: 1,
            paddingVertical: theme.space[4],
            borderRadius: theme.radius.full,
            alignItems: 'center',
            backgroundColor: theme.colors.accent.muted,
            borderWidth: 2,
            borderColor: theme.colors.accent.default,
          }}
        >
          <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
            {t('back')}
          </Text>
        </Pressable>
        <Animated.View style={[{ flex: 1 }, press.style]}>
          <Pressable
            onPress={goNext}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            disabled={!canAdvance}
            style={{
              paddingVertical: theme.space[4],
              borderRadius: theme.radius.full,
              alignItems: 'center',
              backgroundColor: canAdvance ? theme.colors.accent.default : theme.colors.accent.muted,
              opacity: canAdvance ? 1 : 0.6,
            }}
          >
            <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
              {t('next')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
