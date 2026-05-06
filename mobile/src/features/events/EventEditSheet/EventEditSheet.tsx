import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useToast } from '@/components/feedback/Toast';
import { useDeleteEvent, useUpdateEvent } from '@/features/events/mutations';
import { SegmentScale } from '@/features/onboarding/Slider';
import { ApiError } from '@/services/api/client';
import { EVENT_TYPES, type EventType } from '@/services/api/events';
import { useTheme } from '@/theme';

type EditableEvent = {
  id: string;
  type: EventType;
  intensity: number;
  note?: string | null;
};

type Props = {
  visible: boolean;
  event: EditableEvent | null;
  onClose: () => void;
};

export function EventEditSheet({ visible, event, onClose }: Props) {
  const { t } = useTranslation(['events', 'common', 'errors']);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [type, setType] = useState<EventType | undefined>();
  const [intensity, setIntensity] = useState<number | undefined>();
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!event) return;
    setType(event.type);
    setIntensity(event.intensity);
    setNote(event.note ?? '');
  }, [event]);

  const update = useUpdateEvent({
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({ messageKey: 'events:edit.saved', tone: 'success' });
      onClose();
    },
    onError: (err) => {
      const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
      toast.show({ messageKey: key, tone: 'danger' });
    },
  });

  const remove = useDeleteEvent({
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      toast.show({ messageKey: 'events:edit.deleted', tone: 'info' });
      onClose();
    },
    onError: (err) => {
      const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
      toast.show({ messageKey: key, tone: 'danger' });
    },
  });

  if (!event) return null;

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
          <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary, marginBottom: theme.space[2] }}>
            {t('edit.type')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2], marginBottom: theme.space[5] }}>
            {EVENT_TYPES.map((evt) => {
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

          <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary, marginBottom: theme.space[2] }}>
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
              ...theme.typography.body,
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

          <Pressable
            onPress={() =>
              update.mutate({
                id: event.id,
                patch: {
                  type,
                  intensity,
                  // Backend's PATCH applies COALESCE — sending `null` would
                  // keep the old note. Empty string clears it visibly.
                  note: note.trim() ? note.trim() : '',
                },
              })
            }
            disabled={update.isPending || remove.isPending}
            style={{
              backgroundColor: update.isPending ? theme.colors.accent.muted : theme.colors.accent.default,
              padding: theme.space[4],
              borderRadius: theme.radius.md,
              alignItems: 'center',
              marginBottom: theme.space[3],
            }}
          >
            {update.isPending ? (
              <LoadingDots color={theme.colors.accent.onAccent} />
            ) : (
              <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
                {t('actions.save', { ns: 'common' })}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => remove.mutate(event.id)}
            disabled={update.isPending || remove.isPending}
            style={{
              padding: theme.space[4],
              borderRadius: theme.radius.md,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: theme.colors.danger.default,
            }}
          >
            <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.danger.default }}>
              {t('actions.delete', { ns: 'common' })}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
