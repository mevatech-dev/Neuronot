import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useToast } from '@/components/feedback/Toast';
import { useUpdateDailyLog } from '@/features/daily-log/mutations';
import { SegmentScale } from '@/features/onboarding/Slider';
import { ApiError } from '@/services/api/client';
import { type DailyLogResponse } from '@/services/api/dailylog';
import { useTheme } from '@/theme';

type Props = {
  visible: boolean;
  log: DailyLogResponse | null;
  onClose: () => void;
};

export function DailyLogEditSheet({ visible, log, onClose }: Props) {
  const { t } = useTranslation(['daily-log', 'common', 'errors']);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [focus, setFocus] = useState<number | undefined>();
  const [energy, setEnergy] = useState<number | undefined>();
  const [forgetfulness, setForgetfulness] = useState<number | undefined>();
  const [stress, setStress] = useState<number | undefined>();
  const [sleepQuality, setSleepQuality] = useState<number | undefined>();

  useEffect(() => {
    if (!log) return;
    setFocus(log.focus);
    setEnergy(log.energy);
    setForgetfulness(log.forgetfulness);
    setStress(log.stress);
    setSleepQuality(log.sleep_quality);
  }, [log]);

  const mutation = useUpdateDailyLog({
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({ messageKey: 'daily-log:edit.saved', tone: 'success' });
      onClose();
    },
    onError: (err) => {
      const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
      toast.show({ messageKey: key, tone: 'danger' });
    },
  });

  if (!log) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: theme.colors.surface.overlay }} />
      <View
        style={{
          backgroundColor: theme.colors.surface.elevated,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          paddingHorizontal: theme.space[6],
          paddingTop: theme.space[5],
          paddingBottom: insets.bottom + theme.space[4],
          maxHeight: '88%',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.space[4] }}>
          <Text style={{ ...theme.typography.title, color: theme.colors.text.primary, flex: 1 }}>
            {t('edit.title')}
          </Text>
          <Pressable onPress={onClose}>
            <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.secondary }}>
              {t('actions.cancel', { ns: 'common' })}
            </Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {(
            [
              { key: 'focus', value: focus, set: setFocus, min: 1 },
              { key: 'energy', value: energy, set: setEnergy, min: 1 },
              { key: 'sleep_quality', value: sleepQuality, set: setSleepQuality, min: 1 },
              { key: 'forgetfulness', value: forgetfulness, set: setForgetfulness, min: 0 },
              { key: 'stress', value: stress, set: setStress, min: 0 },
            ] as const
          ).map((field) => (
            <View key={field.key} style={{ marginBottom: theme.space[5] }}>
              <Text
                style={{
                  ...theme.typography.bodyMedium,
                  color: theme.colors.text.primary,
                  marginBottom: theme.space[2],
                }}
              >
                {t(`fields.${field.key}`)}
              </Text>
              <SegmentScale
                value={field.value}
                onChange={field.set}
                min={field.min}
                max={5}
                lowLabel={t('scale.low')}
                highLabel={t('scale.high')}
              />
            </View>
          ))}

          <Pressable
            onPress={() =>
              mutation.mutate({
                id: log.id,
                patch: {
                  focus,
                  energy,
                  forgetfulness,
                  stress,
                  sleep_quality: sleepQuality,
                },
              })
            }
            disabled={mutation.isPending}
            style={{
              backgroundColor: mutation.isPending ? theme.colors.accent.muted : theme.colors.accent.default,
              padding: theme.space[4],
              borderRadius: theme.radius.md,
              alignItems: 'center',
              marginTop: theme.space[2],
            }}
          >
            {mutation.isPending ? (
              <LoadingDots color={theme.colors.accent.onAccent} />
            ) : (
              <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
                {t('actions.save', { ns: 'common' })}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
