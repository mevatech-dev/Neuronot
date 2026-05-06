import * as Localization from 'expo-localization';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

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
import { patchProfile } from '@/services/api/profile';
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

export default function OnboardingScreen() {
  const { t } = useTranslation('onboarding');
  const theme = useTheme();
  const press = useHapticPress();

  const [phase, setPhase] = useState<Phase>('welcome');
  const [state, setState] = useState<OnboardingState>({});
  const [submitting, setSubmitting] = useState(false);
  const transition = useSlideTransition(typeof phase === 'number' ? phase : phase === 'welcome' ? -1 : QUESTION_STEPS + 1);

  const update = (patch: Partial<OnboardingState>) => setState((prev) => ({ ...prev, ...patch }));

  const finish = async () => {
    setSubmitting(true);
    try {
      // Capture device timezone so reminders fire in the user's local time
      // without an extra prompt. IANA name like 'Europe/Istanbul'; backend
      // validates via time.LoadLocation.
      const timezone = Localization.getCalendars()[0]?.timeZone ?? 'UTC';
      await patchProfile({
        focus_problem: state.focusProblem,
        intensity_level: state.intensityLevel,
        avg_sleep_hours: state.avgSleepHours,
        caffeine_daily: state.caffeineDaily,
        reminder_enabled: state.reminderEnabled,
        reminder_hour: state.reminderHour,
        timezone,
        complete_onboarding: true,
      });
      router.replace('/(tabs)/home');
    } catch {
      router.replace('/(tabs)/home');
    } finally {
      setSubmitting(false);
    }
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
        <Ready onFinish={finish} submitting={submitting} />
      </SafeAreaView>
    );
  }

  const canAdvance =
    (phase === 1 && !!state.focusProblem) ||
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
      <ScrollView contentContainerStyle={{ padding: theme.space[6], flexGrow: 1, gap: theme.space[5] }}>
        <Text style={{ ...theme.typography.micro, color: theme.colors.text.muted }}>
          {t('progress', { current: phase, total: QUESTION_STEPS })}
        </Text>
        <ProgressBar current={phase} total={QUESTION_STEPS} />

        <View style={{ alignItems: 'center', paddingVertical: theme.space[2] }}>
          <NeuroMascot mood={STEP_MOOD[phase]} size={120} />
        </View>

        <Animated.View style={transition}>
          {phase === 1 && (
            <Step1FocusProblem
              value={state.focusProblem}
              onChange={(focusProblem) => update({ focusProblem })}
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

        <View style={{ flex: 1 }} />

        <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
          <Pressable
            onPress={goBack}
            style={{
              flex: 1,
              paddingVertical: theme.space[4],
              borderRadius: theme.radius.md,
              alignItems: 'center',
              backgroundColor: theme.colors.surface.elevated,
              borderWidth: 1,
              borderColor: theme.colors.border.subtle,
            }}
          >
            <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}>
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
                borderRadius: theme.radius.md,
                alignItems: 'center',
                backgroundColor: canAdvance ? theme.colors.accent.default : theme.colors.accent.muted,
              }}
            >
              <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
                {t('next')}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
