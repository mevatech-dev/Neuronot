import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { SegmentScale } from '@/features/onboarding/Slider';
import { ApiError } from '@/services/api/client';
import { createEvent, EVENT_TYPES, type EventType } from '@/services/api/events';
import { getProfile } from '@/services/api/profile';
import { useTheme } from '@/theme';

const FOCUS_TO_EVENT: Partial<Record<string, EventType>> = {
  headache: 'headache',
  forgetfulness: 'forgetfulness',
  focus: 'distraction',
  energy: 'mental_fatigue',
  sleep: 'brain_fog',
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function EventQuickAdd({ visible, onClose }: Props) {
  const { t } = useTranslation(['events', 'errors']);
  const theme = useTheme();
  const qc = useQueryClient();

  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile, staleTime: 60_000 });

  const [type, setType] = useState<EventType | undefined>();
  const [intensity, setIntensity] = useState<number | undefined>();
  const [note, setNote] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // Show types ordered by the user's onboarding choice — their most relevant
  // event sits first so they don't hunt for it.
  const orderedTypes = useOrderedTypes(profile.data?.focus_problem ?? null);

  const mutation = useMutation({
    mutationFn: () =>
      createEvent({
        type: type!,
        intensity: intensity!,
        note: note.trim() ? note.trim() : undefined,
      }),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void qc.invalidateQueries({ queryKey: ['timeline'] });
      void qc.invalidateQueries({ queryKey: ['events'] });
      reset();
      onClose();
    },
    onError: (err) => {
      const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
      setErrorKey(key);
    },
  });

  const ready = type !== undefined && intensity !== undefined;

  const reset = () => {
    setType(undefined);
    setIntensity(undefined);
    setNote('');
    setErrorKey(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: theme.colors.surface.overlay }} />
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
            {t('add')}
          </Text>
          <Text
            style={{
              ...theme.typography.caption,
              color: theme.colors.text.muted,
              marginBottom: theme.space[6],
            }}
          >
            {t('add_subtitle')}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2], marginBottom: theme.space[5] }}>
            {orderedTypes.map((evt) => {
              const active = type === evt;
              return (
                <Pressable
                  key={evt}
                  onPress={() => setType(evt)}
                  style={{
                    paddingHorizontal: theme.space[4],
                    paddingVertical: theme.space[3],
                    borderRadius: theme.radius.full,
                    borderWidth: 1,
                    borderColor: active ? theme.colors.border.focus : theme.colors.border.subtle,
                    backgroundColor: active ? theme.colors.accent.muted : theme.colors.surface.raised,
                  }}
                >
                  <Text
                    style={{
                      ...theme.typography.caption,
                      color: active ? theme.colors.accent.onAccent : theme.colors.text.primary,
                    }}
                  >
                    {t(`types.${evt}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text
            style={{
              ...theme.typography.bodyMedium,
              color: theme.colors.text.primary,
              marginBottom: theme.space[2],
            }}
          >
            {t('intensity')}
          </Text>
          <SegmentScale value={intensity} onChange={setIntensity} min={1} max={5} />

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('note_placeholder')}
            placeholderTextColor={theme.colors.text.muted}
            multiline
            maxLength={500}
            style={{
              backgroundColor: theme.colors.surface.raised,
              color: theme.colors.text.primary,
              borderColor: theme.colors.border.subtle,
              borderWidth: 1,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.space[4],
              paddingVertical: theme.space[3],
              minHeight: 80,
              marginTop: theme.space[5],
              marginBottom: theme.space[5],
            }}
          />

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

function useOrderedTypes(focusProblem: string | null): readonly EventType[] {
  if (!focusProblem) return EVENT_TYPES;
  const preferred = FOCUS_TO_EVENT[focusProblem];
  if (!preferred) return EVENT_TYPES;
  return [preferred, ...EVENT_TYPES.filter((e) => e !== preferred)];
}
