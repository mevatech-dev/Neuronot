import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { NeuroMascot } from '@/components/brand/NeuroMascot';
import { LegalConsentNote } from '@/features/auth/LegalConsentNote';
import { SocialButton } from '@/features/auth/SocialButton';
import { useFadeIn } from '@/hooks/useFadeIn';
import {
  isAppleSignInAvailable,
  isAppleSignInLikelyAvailable,
  signInWithAppleNative,
} from '@/services/auth/apple';
import { useGoogleSignIn } from '@/services/auth/google';
import { ApiError } from '@/services/api/client';
import type { RegisterConsentInput } from '@/services/api/auth';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

const CONSENT_VERSION = '2026-05';

// Welcome screen for unauthenticated users. Order is per ADR 0003:
// Apple (iOS only) → Google → Sign-up email → Sign-in email link →
// Continue without account (anon, ghost link).
//
// Tapping any sign-in button counts as accepting ToS + Privacy; AI usage
// consent stays optional and is asked separately the first time the user
// requests an insight.
export default function WelcomeScreen() {
  const { t, i18n } = useTranslation(['common', 'errors']);
  const theme = useTheme();
  const fade = useFadeIn();

  const signInAnonymous = useAuthStore((s) => s.signInAnonymous);
  const signInWithApple = useAuthStore((s) => s.signInWithApple);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  const google = useGoogleSignIn();

  const [appleAvailable, setAppleAvailable] = useState<boolean>(isAppleSignInLikelyAvailable());
  const [pending, setPending] = useState<'apple' | 'google' | 'anon' | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isAppleSignInLikelyAvailable()) return;
    let cancelled = false;
    void isAppleSignInAvailable().then((ok) => {
      if (!cancelled) setAppleAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const baseConsents: RegisterConsentInput[] = [
    { type: 'terms_of_service', granted: true, version: CONSENT_VERSION },
    { type: 'privacy_policy', granted: true, version: CONSENT_VERSION },
  ];

  const handle = async (label: 'apple' | 'google' | 'anon', fn: () => Promise<boolean>) => {
    setPending(label);
    setErrorKey(null);
    try {
      const ok = await fn();
      // Cancel paths (Apple/Google sheet dismiss) return false. Stay on
      // welcome — we have no token to navigate with.
      if (!ok) return;
      // Route to root index — it gates onboarding vs. home based on the
      // user's profile state (onboarding_completed_at). Hard-coding
      // /(tabs)/home would skip first-run onboarding for new users.
      router.replace('/');
    } catch (err) {
      const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
      setErrorKey(key);
    } finally {
      setPending(null);
    }
  };

  const onApple = () =>
    handle('apple', async () => {
      const result = await signInWithAppleNative();
      if (!result) return false;
      await signInWithApple(result.identityToken, result.rawNonce, i18n.language, baseConsents);
      return true;
    });

  const onGoogle = () =>
    handle('google', async () => {
      const result = await google.signIn();
      if (!result) return false;
      await signInWithGoogle(result.idToken, i18n.language, baseConsents);
      return true;
    });

  const onAnon = () =>
    handle('anon', async () => {
      await signInAnonymous(i18n.language, baseConsents);
      return true;
    });

  const onEmail = () => router.push('/(auth)/register');
  const onLogin = () => router.push('/(auth)/login');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
      <Animated.View
        style={[{ flex: 1, padding: theme.space[6], justifyContent: 'space-between' }, fade]}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: theme.space[3] }}>
          <NeuroMascot mood="calm" size={120} />
          <Text style={{ ...theme.typography.title, color: theme.colors.text.primary, textAlign: 'center' }}>
            {t('common:app.name')}
          </Text>
          <Text
            style={{
              ...theme.typography.body,
              color: theme.colors.text.secondary,
              textAlign: 'center',
            }}
          >
            {t('common:auth.welcome_subtitle')}
          </Text>
        </View>

        <View style={{ gap: theme.space[3] }}>
          {appleAvailable && (
            <SocialButton
              variant="apple"
              // U+F8FF — Apple logo glyph. Renders correctly on iOS;
              // harmless box character on the rare Android path that
              // even surfaces this button.
              icon=""
              label={t('common:auth.continue_with_apple')}
              onPress={onApple}
              pending={pending === 'apple'}
              disabled={pending !== null}
            />
          )}

          {google.configured && (
            <SocialButton
              variant="google"
              icon="G"
              label={t('common:auth.continue_with_google')}
              onPress={onGoogle}
              pending={pending === 'google'}
              disabled={pending !== null || !google.ready}
            />
          )}

          <SocialButton
            variant="email"
            label={t('common:auth.sign_up_email')}
            onPress={onEmail}
            disabled={pending !== null}
          />

          <SocialButton
            variant="ghost"
            label={t('common:auth.continue_without_account')}
            onPress={onAnon}
            pending={pending === 'anon'}
            disabled={pending !== null}
          />

          {errorKey && (
            <Text
              style={{
                ...theme.typography.caption,
                color: theme.colors.danger.default,
                textAlign: 'center',
              }}
            >
              {t(errorKey, { ns: 'errors' })}
            </Text>
          )}

          <View style={{ marginTop: theme.space[2] }}>
            <LegalConsentNote />
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              marginTop: theme.space[3],
              gap: theme.space[1],
            }}
          >
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
              {t('common:auth.have_account')}
            </Text>
            <Text
              onPress={onLogin}
              style={{ ...theme.typography.caption, color: theme.colors.accent.default }}
            >
              {t('common:auth.sign_in_email')}
            </Text>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
