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

export default function LoginScreen() {
  const { t } = useTranslation(['common', 'errors']);
  const theme = useTheme();
  const login = useAuthStore((s) => s.login);
  const fade = useFadeIn();
  const press = useHapticPress();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const onSubmit = async () => {
    setSubmitting(true);
    setErrorKey(null);
    try {
      await login(email, password);
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
          <NeuroMascot mood="calm" size={112} />
        </View>
        <Text style={{ ...theme.typography.title, color: theme.colors.text.primary, marginBottom: theme.space[2] }}>
          {t('app.name')}
        </Text>
        <Text
          style={{ ...theme.typography.body, color: theme.colors.text.secondary, marginBottom: theme.space[8] }}
        >
          {t('app.tagline')}
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
          autoComplete="password"
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
                {t('auth.login')}
              </Text>
            )}
          </Pressable>
        </Animated.View>

        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
            {t('auth.no_account')}{' '}
          </Text>
          <Link href="/(auth)/register">
            <Text style={{ ...theme.typography.caption, color: theme.colors.accent.default }}>
              {t('auth.register')}
            </Text>
          </Link>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
