import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { SegmentScale } from '@/features/onboarding/Slider';
import { ApiError } from '@/services/api/client';
import { createDailyLog, type DailyLogResponse } from '@/services/api/dailylog';
import { useTheme } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function QuickLogSheet({ visible, onClose }: Props) {
  const { t } = useTranslation(['daily-log', 'errors']);
  const theme = useTheme();
  const qc = useQueryClient();

  const [focus, setFocus] = useState<number | undefined>();
  const [energy, setEnergy] = useState<number | undefined>();
  const [forgetfulness, setForgetfulness] = useState<number | undefined>();
  const [stress, setStress] = useState<number | undefined>();
  const [sleepQuality, setSleepQuality] = useState<number | undefined>();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const ready =
    focus !== undefined &&
    energy !== undefined &&
    forgetfulness !== undefined &&
    stress !== undefined &&
    sleepQuality !== undefined;

  const mutation = useMutation({
    mutationFn: () =>
      createDailyLog({
        focus: focus!,
        energy: energy!,
        forgetfulness: forgetfulness!,
        stress: stress!,
        sleep_quality: sleepQuality!,
      }),
    onSuccess: (data: DailyLogResponse) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.setQueryData(['daily-log', 'today'], data);
      void qc.invalidateQueries({ queryKey: ['timeline'] });
      reset();
      onClose();
    },
    onError: (err) => {
      const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
      setErrorKey(key);
    },
  });

  const reset = () => {
    setFocus(undefined);
    setEnergy(undefined);
    setForgetfulness(undefined);
    setStress(undefined);
    setSleepQuality(undefined);
    setErrorKey(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: theme.colors.surface.overlay }}
      />
      <View
        style={{
          backgroundColor: theme.colors.surface.elevated,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          padding: theme.space[6],
          maxHeight: '85%',
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text
            style={{
              ...theme.typography.title,
              color: theme.colors.text.primary,
              marginBottom: theme.space[1],
            }}
          >
            {t('title')}
          </Text>
          <Text
            style={{
              ...theme.typography.caption,
              color: theme.colors.text.muted,
              marginBottom: theme.space[6],
            }}
          >
            {t('subtitle')}
          </Text>

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

          {errorKey && (
            <Text
              style={{
                ...theme.typography.caption,
                color: theme.colors.danger.default,
                marginBottom: theme.space[4],
              }}
            >
              {t(errorKey, { ns: 'errors' })}
            </Text>
          )}

          <Pressable
            onPress={() => {
              if (!ready) return;
              setErrorKey(null);
              mutation.mutate();
            }}
            disabled={!ready || mutation.isPending}
            style={{
              backgroundColor: ready ? theme.colors.accent.default : theme.colors.accent.muted,
              padding: theme.space[4],
              borderRadius: theme.radius.md,
              alignItems: 'center',
              marginTop: theme.space[2],
            }}
          >
            {mutation.isPending ? (
              <ActivityIndicator color={theme.colors.accent.onAccent} />
            ) : (
              <Text
                style={{
                  ...theme.typography.bodyMedium,
                  color: theme.colors.accent.onAccent,
                }}
              >
                {t('submit')}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
