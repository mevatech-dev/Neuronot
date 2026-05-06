import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { NeuroMascot, type NeuroMood } from '@/components/brand/NeuroMascot';
import { SegmentScale } from '@/features/onboarding/Slider';
import { FOCUS_PROBLEMS, type FocusProblem, type OnboardingState } from '@/features/onboarding/types';
import { patchProfile } from '@/services/api/profile';
import { useTheme } from '@/theme';

const TOTAL_STEPS = 3;

const STEP_MASCOT: Record<number, NeuroMood> = {
  1: 'thinking',
  2: 'encouraging',
  3: 'calm',
};

export default function OnboardingScreen() {
  const { t } = useTranslation('onboarding');
  const theme = useTheme();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardingState>({});
  const [submitting, setSubmitting] = useState(false);

  const update = (patch: Partial<OnboardingState>) => setState((prev) => ({ ...prev, ...patch }));

  const finish = async () => {
    setSubmitting(true);
    try {
      await patchProfile({
        focus_problem: state.focusProblem,
        intensity_level: state.intensityLevel,
        avg_sleep_hours: state.avgSleepHours,
        caffeine_daily: state.caffeineDaily,
        complete_onboarding: true,
      });
      router.replace('/(tabs)/home');
    } catch {
      // Onboarding is best-effort — user can always edit profile later.
      router.replace('/(tabs)/home');
    } finally {
      setSubmitting(false);
    }
  };

  const canAdvance =
    (step === 1 && !!state.focusProblem) ||
    (step === 2 && !!state.intensityLevel) ||
    step === 3;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
      <ScrollView contentContainerStyle={{ padding: theme.space[6], flexGrow: 1 }}>
        <Text style={{ ...theme.typography.micro, color: theme.colors.text.muted, marginBottom: theme.space[2] }}>
          {t('progress', { current: step, total: TOTAL_STEPS })}
        </Text>
        <Text style={{ ...theme.typography.title, color: theme.colors.text.primary, marginBottom: theme.space[1] }}>
          {t('title')}
        </Text>
        <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary, marginBottom: theme.space[6] }}>
          {t('subtitle')}
        </Text>

        <View style={{ alignItems: 'center', marginBottom: theme.space[6] }}>
          <NeuroMascot mood={STEP_MASCOT[step]} size={128} />
        </View>

        {step === 1 && (
          <View>
            <Text
              style={{
                ...theme.typography.heading,
                color: theme.colors.text.primary,
                marginBottom: theme.space[4],
              }}
            >
              {t('step1.title')}
            </Text>
            {FOCUS_PROBLEMS.map((problem: FocusProblem) => {
              const active = state.focusProblem === problem;
              return (
                <Pressable
                  key={problem}
                  onPress={() => update({ focusProblem: problem })}
                  style={{
                    padding: theme.space[4],
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: active ? theme.colors.border.focus : theme.colors.border.subtle,
                    backgroundColor: active ? theme.colors.surface.raised : theme.colors.surface.elevated,
                    marginBottom: theme.space[2],
                  }}
                >
                  <Text style={{ ...theme.typography.body, color: theme.colors.text.primary }}>
                    {t(`step1.options.${problem}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text
              style={{
                ...theme.typography.heading,
                color: theme.colors.text.primary,
                marginBottom: theme.space[4],
              }}
            >
              {t('step2.title')}
            </Text>
            <SegmentScale
              value={state.intensityLevel}
              onChange={(v) => update({ intensityLevel: v })}
              min={1}
              max={5}
              lowLabel={t('step2.scale_low')}
              highLabel={t('step2.scale_high')}
            />
          </View>
        )}

        {step === 3 && (
          <View>
            <Text
              style={{
                ...theme.typography.heading,
                color: theme.colors.text.primary,
                marginBottom: theme.space[4],
              }}
            >
              {t('step3.title')}
            </Text>

            <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted, marginBottom: theme.space[1] }}>
              {t('step3.sleep_label')}
            </Text>
            <TextInput
              keyboardType="decimal-pad"
              value={state.avgSleepHours?.toString() ?? ''}
              onChangeText={(txt) => {
                const n = Number(txt.replace(',', '.'));
                update({ avgSleepHours: Number.isFinite(n) ? n : undefined });
              }}
              style={{
                backgroundColor: theme.colors.surface.elevated,
                color: theme.colors.text.primary,
                borderColor: theme.colors.border.subtle,
                borderWidth: 1,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.space[4],
                paddingVertical: theme.space[3],
                marginBottom: theme.space[6],
              }}
              placeholderTextColor={theme.colors.text.muted}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ ...theme.typography.body, color: theme.colors.text.primary }}>
                {t('step3.caffeine_label')}
              </Text>
              <Switch
                value={!!state.caffeineDaily}
                onValueChange={(v) => update({ caffeineDaily: v })}
              />
            </View>
          </View>
        )}

        <View style={{ flex: 1 }} />

        <View style={{ flexDirection: 'row', gap: theme.space[2], marginTop: theme.space[8] }}>
          {step > 1 && (
            <Pressable
              onPress={() => setStep(step - 1)}
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
          )}
          <Pressable
            onPress={() => {
              if (!canAdvance) return;
              if (step < TOTAL_STEPS) setStep(step + 1);
              else void finish();
            }}
            disabled={!canAdvance || submitting}
            style={{
              flex: 1,
              paddingVertical: theme.space[4],
              borderRadius: theme.radius.md,
              alignItems: 'center',
              backgroundColor: canAdvance ? theme.colors.accent.default : theme.colors.accent.muted,
            }}
          >
            {submitting ? (
              <ActivityIndicator color={theme.colors.accent.onAccent} />
            ) : (
              <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
                {step < TOTAL_STEPS ? t('next') : t('finish')}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
