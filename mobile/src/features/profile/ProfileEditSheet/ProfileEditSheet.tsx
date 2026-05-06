import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/feedback/Toast';
import { SegmentScale } from '@/features/onboarding/Slider';
import { FOCUS_PROBLEMS, type FocusProblem } from '@/features/onboarding/types';
import { ApiError } from '@/services/api/client';
import { patchProfile } from '@/services/api/profile';
import { scheduleCycleForCurrentUser } from '@/services/sync/engine';
import { useTheme } from '@/theme';

import { profileQuery } from '../queries';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const HOURS = [7, 9, 12, 15, 18, 21];

export function ProfileEditSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({ ...profileQuery, enabled: visible });

  const [focusProblem, setFocusProblem] = useState<FocusProblem | undefined>();
  const [intensity, setIntensity] = useState<number | undefined>();
  const [sleepHours, setSleepHours] = useState<number | undefined>();
  const [caffeine, setCaffeine] = useState<boolean>(false);
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(false);
  const [reminderHour, setReminderHour] = useState<number | undefined>();

  useEffect(() => {
    if (!profile) return;
    setFocusProblem(profile.focus_problem as FocusProblem | undefined);
    setIntensity(profile.intensity_level ?? undefined);
    setSleepHours(profile.avg_sleep_hours ?? undefined);
    setCaffeine(!!profile.caffeine_daily);
    setReminderEnabled(profile.reminder_enabled);
    setReminderHour(profile.reminder_hour ?? undefined);
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      patchProfile({
        focus_problem: focusProblem,
        intensity_level: intensity,
        avg_sleep_hours: sleepHours,
        caffeine_daily: caffeine,
        reminder_enabled: reminderEnabled,
        reminder_hour: reminderEnabled ? reminderHour : undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      scheduleCycleForCurrentUser();
      toast.show({ messageKey: 'profile_edit.saved', tone: 'success' });
      onClose();
    },
    onError: (err) => {
      const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
      toast.show({ messageKey: key, tone: 'danger' });
    },
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={{ flex: 1, backgroundColor: theme.colors.surface.overlay, justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: theme.colors.surface.primary,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            paddingTop: theme.space[5],
            paddingBottom: insets.bottom + theme.space[4],
            maxHeight: '92%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.space[6] }}>
            <Text style={{ ...theme.typography.title, color: theme.colors.text.primary, flex: 1 }}>
              {t('profile_edit.title')}
            </Text>
            <Pressable onPress={onClose}>
              <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.secondary }}>
                {t('actions.cancel')}
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[5] }}>
            {isLoading || !profile ? (
              <View style={{ gap: theme.space[3] }}>
                <Skeleton height={48} radius="md" />
                <Skeleton height={48} radius="md" />
                <Skeleton height={48} radius="md" />
              </View>
            ) : (
              <>
                <Field label={t('profile_edit.focus_problem')}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
                    {FOCUS_PROBLEMS.map((p) => {
                      const active = focusProblem === p;
                      return (
                        <Pressable
                          key={p}
                          onPress={() => setFocusProblem(p)}
                          style={{
                            paddingHorizontal: theme.space[4],
                            paddingVertical: theme.space[3],
                            borderRadius: theme.radius.full,
                            borderWidth: 1,
                            borderColor: active ? theme.colors.border.focus : theme.colors.border.subtle,
                            backgroundColor: active ? theme.colors.surface.raised : theme.colors.surface.elevated,
                          }}
                        >
                          <Text style={{ ...theme.typography.body, color: theme.colors.text.primary }}>
                            {t(`profile_edit.options.${p}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>

                <Field label={t('profile_edit.intensity')}>
                  <SegmentScale
                    value={intensity}
                    onChange={setIntensity}
                    min={1}
                    max={5}
                    lowLabel={t('profile_edit.intensity_low')}
                    highLabel={t('profile_edit.intensity_high')}
                  />
                </Field>

                <Field label={t('profile_edit.sleep')}>
                  <TextInput
                    keyboardType="decimal-pad"
                    value={sleepHours?.toString() ?? ''}
                    onChangeText={(txt) => {
                      const n = Number(txt.replace(',', '.'));
                      setSleepHours(Number.isFinite(n) ? n : undefined);
                    }}
                    style={{
                      ...theme.typography.body,
                      backgroundColor: theme.colors.surface.elevated,
                      color: theme.colors.text.primary,
                      borderColor: theme.colors.border.subtle,
                      borderWidth: 1,
                      borderRadius: theme.radius.md,
                      paddingHorizontal: theme.space[4],
                      paddingVertical: theme.space[3],
                    }}
                    placeholderTextColor={theme.colors.text.muted}
                  />
                </Field>

                <Field label={t('profile_edit.caffeine')}>
                  <Switch value={caffeine} onValueChange={setCaffeine} />
                </Field>

                <Field label={t('profile_edit.reminder_enabled')}>
                  <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
                </Field>

                {reminderEnabled && (
                  <Field label={t('profile_edit.reminder_hour')}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
                      {HOURS.map((h) => {
                        const active = reminderHour === h;
                        return (
                          <Pressable
                            key={h}
                            onPress={() => setReminderHour(h)}
                            style={{
                              paddingHorizontal: theme.space[3],
                              paddingVertical: theme.space[2],
                              borderRadius: theme.radius.md,
                              borderWidth: 1,
                              borderColor: active ? theme.colors.border.focus : theme.colors.border.subtle,
                              backgroundColor: active ? theme.colors.surface.raised : theme.colors.surface.elevated,
                            }}
                          >
                            <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}>
                              {`${h.toString().padStart(2, '0')}:00`}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Field>
                )}
              </>
            )}
          </ScrollView>

          <View style={{ paddingHorizontal: theme.space[6] }}>
            <Pressable
              onPress={() => save.mutate()}
              disabled={save.isPending}
              style={{
                backgroundColor: save.isPending ? theme.colors.accent.muted : theme.colors.accent.default,
                paddingVertical: theme.space[4],
                borderRadius: theme.radius.md,
                alignItems: 'center',
              }}
            >
              {save.isPending ? (
                <LoadingDots color={theme.colors.accent.onAccent} />
              ) : (
                <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
                  {t('actions.save')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space[2] }}>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>{label}</Text>
      {children}
    </View>
  );
}
