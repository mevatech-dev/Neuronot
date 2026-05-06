import { Link, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/services/api/client';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

export default function RegisterScreen() {
  const { t, i18n } = useTranslation(['common', 'errors']);
  const theme = useTheme();
  const register = useAuthStore((s) => s.register);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const onSubmit = async () => {
    setSubmitting(true);
    setErrorKey(null);
    try {
      await register(email, password, i18n.language);
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
      <View style={{ flex: 1, padding: theme.space[6], justifyContent: 'center' }}>
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

        <Pressable
          onPress={onSubmit}
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
            <ActivityIndicator color={theme.colors.accent.onAccent} />
          ) : (
            <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
              {t('auth.register')}
            </Text>
          )}
        </Pressable>

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
      </View>
    </SafeAreaView>
  );
}
