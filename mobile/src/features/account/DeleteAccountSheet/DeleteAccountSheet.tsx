import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useToast } from '@/components/feedback/Toast';
import { useDeleteAccount } from '@/features/account/mutations';
import { ApiError } from '@/services/api/client';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

type Props = { visible: boolean; onClose: () => void };

export function DeleteAccountSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('account');
  const toast = useToast();
  const logout = useAuthStore((s) => s.logout);
  const [confirm, setConfirm] = useState('');

  const del = useDeleteAccount({
    onSuccess: async () => {
      await logout();
      router.replace('/(auth)/login');
    },
    onError: (err) => {
      const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
      toast.show({ messageKey: key, tone: 'danger' });
    },
  });

  const submitDisabled = del.isPending || !confirm;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.surface.overlay,
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.surface.primary,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.space[6],
          }}
        >
          <Text
            style={{
              ...theme.typography.title,
              color: theme.colors.danger.default,
              marginBottom: theme.space[3],
            }}
          >
            {t('delete.title')}
          </Text>
          <Text
            style={{
              ...theme.typography.body,
              color: theme.colors.text.secondary,
              marginBottom: theme.space[5],
            }}
          >
            {t('delete.body')}
          </Text>

          <Text
            style={{
              ...theme.typography.caption,
              color: theme.colors.text.muted,
              marginBottom: theme.space[1],
            }}
          >
            {t('delete.confirm_label')}
          </Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{
              ...theme.typography.body,
              backgroundColor: theme.colors.surface.elevated,
              color: theme.colors.text.primary,
              borderColor: theme.colors.border.subtle,
              borderWidth: 1,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.space[4],
              paddingVertical: theme.space[3],
              marginBottom: theme.space[5],
            }}
            placeholderTextColor={theme.colors.text.muted}
          />

          <Pressable
            onPress={() => del.mutate(confirm)}
            disabled={submitDisabled}
            style={{
              backgroundColor: del.isPending
                ? theme.colors.danger.muted
                : theme.colors.danger.default,
              paddingVertical: theme.space[4],
              borderRadius: theme.radius.md,
              alignItems: 'center',
              marginBottom: theme.space[3],
              opacity: submitDisabled && !del.isPending ? 0.5 : 1,
            }}
          >
            {del.isPending ? (
              <LoadingDots color={theme.colors.text.inverse} />
            ) : (
              <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.inverse }}>
                {t('delete.confirm_action')}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={onClose}
            style={{ alignItems: 'center', paddingVertical: theme.space[3] }}
          >
            <Text style={{ ...theme.typography.body, color: theme.colors.text.muted }}>
              {t('delete.cancel')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
