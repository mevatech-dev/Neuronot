import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useToast } from '@/components/feedback/Toast';
import { UpgradeWithEmailSheet } from '@/features/account/UpgradeWithEmailSheet';
import { ApiError } from '@/services/api/client';
import {
  isAppleSignInLikelyAvailable,
  signInWithAppleNative,
} from '@/services/auth/apple';
import { useGoogleSignIn } from '@/services/auth/google';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

// SaveAccountCard renders only when the current user is anonymous. It
// exposes the three upgrade paths: email/password sheet, Apple, Google.
// On success the auth store is updated with fresh non-anon tokens; the
// card disappears because is_anonymous flipped to false.
export function SaveAccountCard() {
  const theme = useTheme();
  const { t } = useTranslation('account');
  const toast = useToast();
  const upgradeWithApple = useAuthStore((s) => s.upgradeWithApple);
  const upgradeWithGoogle = useAuthStore((s) => s.upgradeWithGoogle);

  const google = useGoogleSignIn();

  const [emailSheet, setEmailSheet] = useState(false);
  const [pending, setPending] = useState<'apple' | 'google' | null>(null);

  const handle = async (label: 'apple' | 'google', fn: () => Promise<void>) => {
    setPending(label);
    try {
      await fn();
      toast.show({ messageKey: 'account:save.saved', tone: 'success' });
    } catch (err) {
      const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
      toast.show({ messageKey: key, tone: 'danger' });
    } finally {
      setPending(null);
    }
  };

  const onApple = () =>
    handle('apple', async () => {
      const result = await signInWithAppleNative();
      if (!result) return;
      await upgradeWithApple(result.identityToken, result.rawNonce);
    });

  const onGoogle = () =>
    handle('google', async () => {
      const result = await google.signIn();
      if (!result) return;
      await upgradeWithGoogle(result.idToken);
    });

  const cardStyle = {
    padding: theme.space[5],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface.elevated,
    borderWidth: 1,
    borderColor: theme.colors.accent.default,
    gap: theme.space[3],
  } as const;

  const buttonBase = {
    paddingVertical: theme.space[4],
    borderRadius: theme.radius.md,
    alignItems: 'center' as const,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: theme.space[2],
  };

  const showApple = isAppleSignInLikelyAvailable();
  const showGoogle = google.configured;

  return (
    <View style={cardStyle}>
      <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>
        {t('save.title')}
      </Text>
      <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>
        {t('save.body')}
      </Text>

      <View style={{ gap: theme.space[3], marginTop: theme.space[2] }}>
        <Pressable
          onPress={() => setEmailSheet(true)}
          disabled={pending !== null}
          style={{
            ...buttonBase,
            backgroundColor: theme.colors.accent.default,
            opacity: pending !== null ? 0.5 : 1,
          }}
        >
          <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
            {t('save.email_action')}
          </Text>
        </Pressable>

        {showApple && (
          <Pressable
            onPress={onApple}
            disabled={pending !== null}
            style={{
              ...buttonBase,
              backgroundColor: '#000000',
              borderWidth: 1,
              borderColor: '#000000',
              opacity: pending === 'apple' ? 1 : pending !== null ? 0.5 : 1,
            }}
          >
            {pending === 'apple' ? (
              <LoadingDots color="#FFFFFF" />
            ) : (
              <Text style={{ ...theme.typography.bodyMedium, color: '#FFFFFF' }}>
                {t('save.apple_action')}
              </Text>
            )}
          </Pressable>
        )}

        {showGoogle && (
          <Pressable
            onPress={onGoogle}
            disabled={pending !== null || !google.ready}
            style={{
              ...buttonBase,
              backgroundColor: theme.colors.surface.elevated,
              borderWidth: 1,
              borderColor: theme.colors.border.subtle,
              opacity: pending !== null || !google.ready ? 0.5 : 1,
            }}
          >
            {pending === 'google' ? (
              <LoadingDots color={theme.colors.text.primary} />
            ) : (
              <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}>
                {t('save.google_action')}
              </Text>
            )}
          </Pressable>
        )}
      </View>

      <UpgradeWithEmailSheet visible={emailSheet} onClose={() => setEmailSheet(false)} />
    </View>
  );
}
