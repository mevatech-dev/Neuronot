import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useToast } from '@/components/feedback/Toast';
import { useChangePassword } from '@/features/account/mutations';
import { ApiError } from '@/services/api/client';
import { useTheme } from '@/theme';

export function ChangePasswordForm() {
  const theme = useTheme();
  const { t } = useTranslation('account');
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const change = useChangePassword({
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.show({ messageKey: 'account:password.changed', tone: 'success' });
    },
    onError: (err) => {
      const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
      toast.show({ messageKey: key, tone: 'danger' });
    },
  });

  const onSubmit = () => {
    if (next !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    change.mutate({ currentPassword: current, newPassword: next });
  };

  const inputStyle = {
    ...theme.typography.body,
    backgroundColor: theme.colors.surface.elevated,
    color: theme.colors.text.primary,
    borderColor: theme.colors.border.subtle,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    marginBottom: theme.space[3],
  } as const;

  const submitDisabled = change.isPending || !current || !next || !confirm;

  return (
    <View style={{ gap: theme.space[2] }}>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
        {t('password.current')}
      </Text>
      <TextInput
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        style={inputStyle}
        placeholderTextColor={theme.colors.text.muted}
      />

      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
        {t('password.new')}
      </Text>
      <TextInput
        value={next}
        onChangeText={setNext}
        secureTextEntry
        style={inputStyle}
        placeholderTextColor={theme.colors.text.muted}
      />

      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
        {t('password.confirm')}
      </Text>
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        style={inputStyle}
        placeholderTextColor={theme.colors.text.muted}
      />

      {mismatch && (
        <Text
          style={{
            ...theme.typography.caption,
            color: theme.colors.danger.default,
            marginBottom: theme.space[3],
          }}
        >
          {t('password.mismatch')}
        </Text>
      )}

      <Pressable
        onPress={onSubmit}
        disabled={submitDisabled}
        style={{
          backgroundColor: change.isPending
            ? theme.colors.accent.muted
            : theme.colors.accent.default,
          paddingVertical: theme.space[4],
          borderRadius: theme.radius.md,
          alignItems: 'center',
          opacity: submitDisabled && !change.isPending ? 0.5 : 1,
        }}
      >
        {change.isPending ? (
          <LoadingDots color={theme.colors.accent.onAccent} />
        ) : (
          <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
            {t('password.submit')}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
