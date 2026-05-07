import { Link, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { NeuroMascot } from '@/components/brand/NeuroMascot';
import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useFadeIn } from '@/hooks/useFadeIn';
import { useHapticPress } from '@/hooks/useHapticPress';
import { ApiError } from '@/services/api/client';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

const CHECK_MARK = '\u2713';

export default function RegisterScreen() {
  const { t, i18n } = useTranslation(['common', 'errors', 'consents']);
  const theme = useTheme();
  const register = useAuthStore((s) => s.register);
  const fade = useFadeIn();
  const press = useHapticPress();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedAi, setAcceptedAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!acceptedAi) {
      setErrorKey('auth.ai_consent_required');
      return;
    }
    setSubmitting(true);
    setErrorKey(null);
    try {
      await register(email, password, i18n.language, [
        { type: 'ai_usage', granted: acceptedAi, version: 'v1' },
        { type: 'terms_of_service', granted: acceptedTos, version: '2026-05' },
        { type: 'privacy_policy', granted: acceptedPrivacy, version: '2026-05' },
      ]);
      router.replace('/(tabs)/home');
    } catch (err) {
      const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
      setErrorKey(key);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
      <Animated.View style={[{ flex: 1, padding: theme.space[6], justifyContent: 'center' }, fade]}>
        <View style={{ alignItems: 'center', marginBottom: theme.space[5] }}>
          <NeuroMascot mood="happy" size={112} />
        </View>
        <Text style={{ ...theme.typography.title, color: theme.colors.text.primary, marginBottom: theme.space[8] }}>
          {t('auth.register')}
        </Text>

        <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted, marginBottom: theme.space[1] }}>
          {t('auth.email')}
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          style={{
            ...theme.typography.body,
            backgroundColor: theme.colors.surface.elevated,
            color: theme.colors.text.primary,
            borderColor: theme.colors.border.subtle,
            borderWidth: 1,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.space[4],
            paddingVertical: theme.space[3],
            marginBottom: theme.space[4],
          }}
          placeholderTextColor={theme.colors.text.muted}
        />

        <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted, marginBottom: theme.space[1] }}>
          {t('auth.password')}
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          style={{
            ...theme.typography.body,
            backgroundColor: theme.colors.surface.elevated,
            color: theme.colors.text.primary,
            borderColor: theme.colors.border.subtle,
            borderWidth: 1,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.space[4],
            paddingVertical: theme.space[3],
            marginBottom: theme.space[6],
          }}
          placeholderTextColor={theme.colors.text.muted}
        />

        {errorKey && (
          <Text style={{ ...theme.typography.caption, color: theme.colors.danger.default, marginBottom: theme.space[4] }}>
            {t(errorKey, { ns: 'errors' })}
          </Text>
        )}

        <View style={{ gap: theme.space[3], marginBottom: theme.space[5] }}>
          <ConsentCheckbox checked={acceptedTos} onChange={setAcceptedTos} label={t('consents.tos_accept')} />
          <ConsentCheckbox
            checked={acceptedPrivacy}
            onChange={setAcceptedPrivacy}
            label={t('consents.privacy_accept')}
          />
          <ConsentCheckbox checked={acceptedAi} onChange={setAcceptedAi} label={t('consents.ai_accept')} />
        </View>

        <Animated.View style={press.style}>
          <Pressable
            onPress={onSubmit}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            disabled={submitting}
            style={{
              backgroundColor: submitting ? theme.colors.accent.muted : theme.colors.accent.default,
              paddingVertical: theme.space[4],
              borderRadius: theme.radius.md,
              alignItems: 'center',
              marginBottom: theme.space[4],
            }}
          >
            {submitting ? (
              <LoadingDots color={theme.colors.accent.onAccent} />
            ) : (
              <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
                {t('auth.register')}
              </Text>
            )}
          </Pressable>
        </Animated.View>

        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
            {t('auth.have_account')}{' '}
          </Text>
          <Link href="/(auth)/login">
            <Text style={{ ...theme.typography.caption, color: theme.colors.accent.default }}>
              {t('auth.login')}
            </Text>
          </Link>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

function ConsentCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: theme.radius.sm,
          borderWidth: 2,
          borderColor: checked ? theme.colors.accent.default : theme.colors.border.subtle,
          backgroundColor: checked ? theme.colors.accent.default : theme.colors.surface.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && (
          <Text style={{ color: theme.colors.accent.onAccent, fontSize: 14, lineHeight: 14 }}>{CHECK_MARK}</Text>
        )}
      </View>
      <Text style={{ ...theme.typography.body, color: theme.colors.text.primary, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}
