import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useToast } from '@/components/feedback/Toast';
import { ApiError } from '@/services/api/client';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

type Props = { visible: boolean; onClose: () => void };

export function UpgradeWithEmailSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('account');
  const toast = useToast();
  const upgradeWithEmail = useAuthStore((s) => s.upgradeWithEmail);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setEmail('');
    setPassword('');
    setConfirm('');
    setMismatch(false);
    setSubmitting(false);
  };

  const onSubmit = async () => {
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setSubmitting(true);
    try {
      await upgradeWithEmail(email, password);
      toast.show({ messageKey: 'account:save.saved', tone: 'success' });
      reset();
      onClose();
    } catch (err) {
      const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
      toast.show({ messageKey: key, tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
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

  const submitDisabled = submitting || !email || !password || !confirm;

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
              color: theme.colors.text.primary,
              marginBottom: theme.space[5],
            }}
          >
            {t('save.email_form_title')}
          </Text>

          <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
            {t('save.email_field')}
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            style={inputStyle}
            placeholderTextColor={theme.colors.text.muted}
          />

          <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
            {t('save.password_field')}
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={inputStyle}
            placeholderTextColor={theme.colors.text.muted}
          />

          <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
            {t('save.confirm_field')}
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
              {t('save.mismatch')}
            </Text>
          )}

          <Pressable
            onPress={onSubmit}
            disabled={submitDisabled}
            style={{
              backgroundColor: submitting ? theme.colors.accent.muted : theme.colors.accent.default,
              paddingVertical: theme.space[4],
              borderRadius: theme.radius.md,
              alignItems: 'center',
              marginBottom: theme.space[3],
              opacity: submitDisabled && !submitting ? 0.5 : 1,
            }}
          >
            {submitting ? (
              <LoadingDots color={theme.colors.accent.onAccent} />
            ) : (
              <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
                {t('save.submit')}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              reset();
              onClose();
            }}
            style={{ alignItems: 'center', paddingVertical: theme.space[3] }}
          >
            <Text style={{ ...theme.typography.body, color: theme.colors.text.muted }}>
              {t('save.cancel')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
