import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/feedback/Toast';
import { linksQuery, useLinkApple, useLinkGoogle, useUnlinkProvider } from '@/features/account/links';
import { ApiError } from '@/services/api/client';
import {
  isAppleSignInLikelyAvailable,
  signInWithAppleNative,
} from '@/services/auth/apple';
import { useGoogleSignIn } from '@/services/auth/google';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

type Provider = 'apple' | 'google';

// LinkedProvidersList renders one row per supported social provider with
// connect/disconnect buttons. Apple row hides on Android. Google row hides
// when no client id is configured. The list invalidates its own query
// after every link/unlink, so the UI reflects server state without a
// manual refresh.
export function LinkedProvidersList() {
  const theme = useTheme();
  const { t } = useTranslation('account');
  const toast = useToast();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const links = useQuery(linksQuery(userId));

  const onError = (err: unknown) => {
    const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
    toast.show({ messageKey: key, tone: 'danger' });
  };
  const onLinked = () => toast.show({ messageKey: 'account:link.linked', tone: 'success' });
  const onUnlinked = () => toast.show({ messageKey: 'account:link.unlinked', tone: 'info' });

  const linkAppleMut = useLinkApple({ onSuccess: onLinked, onError });
  const linkGoogleMut = useLinkGoogle({ onSuccess: onLinked, onError });
  const unlinkMut = useUnlinkProvider({ onSuccess: onUnlinked, onError });

  const google = useGoogleSignIn();

  const [pending, setPending] = useState<Provider | null>(null);

  const handleApple = async () => {
    setPending('apple');
    try {
      const result = await signInWithAppleNative();
      if (!result) return;
      await linkAppleMut.mutateAsync({
        identityToken: result.identityToken,
        rawNonce: result.rawNonce,
      });
    } catch (err) {
      onError(err);
    } finally {
      setPending(null);
    }
  };

  const handleGoogle = async () => {
    setPending('google');
    try {
      const result = await google.signIn();
      if (!result) return;
      await linkGoogleMut.mutateAsync(result.idToken);
    } catch (err) {
      onError(err);
    } finally {
      setPending(null);
    }
  };

  const handleUnlink = (provider: Provider) => {
    setPending(provider);
    unlinkMut.mutate(provider, {
      onSettled: () => setPending(null),
    });
  };

  if (links.isLoading) {
    return (
      <View style={{ gap: theme.space[3] }}>
        <Skeleton height={68} />
        <Skeleton height={68} />
      </View>
    );
  }
  if (!links.data) return null;

  const appleAvailable = isAppleSignInLikelyAvailable();
  const googleAvailable = google.configured;

  return (
    <View style={{ gap: theme.space[3] }}>
      <Text
        style={{
          ...theme.typography.caption,
          color: theme.colors.text.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {t('link.section_title')}
      </Text>

      {appleAvailable && (
        <ProviderRow
          label={t('link.apple_label')}
          connected={links.data.has_apple}
          pending={pending === 'apple'}
          connectLabel={t('link.connect')}
          disconnectLabel={t('link.disconnect')}
          connectedLabel={t('link.connected')}
          notConnectedLabel={t('link.not_connected')}
          onConnect={handleApple}
          onDisconnect={() => handleUnlink('apple')}
        />
      )}

      {googleAvailable && (
        <ProviderRow
          label={t('link.google_label')}
          connected={links.data.has_google}
          pending={pending === 'google'}
          connectLabel={t('link.connect')}
          disconnectLabel={t('link.disconnect')}
          connectedLabel={t('link.connected')}
          notConnectedLabel={t('link.not_connected')}
          onConnect={handleGoogle}
          onDisconnect={() => handleUnlink('google')}
        />
      )}
    </View>
  );
}

type ProviderRowProps = {
  label: string;
  connected: boolean;
  pending: boolean;
  connectLabel: string;
  disconnectLabel: string;
  connectedLabel: string;
  notConnectedLabel: string;
  onConnect: () => void;
  onDisconnect: () => void;
};

function ProviderRow({
  label,
  connected,
  pending,
  connectLabel,
  disconnectLabel,
  connectedLabel,
  notConnectedLabel,
  onConnect,
  onDisconnect,
}: ProviderRowProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        padding: theme.space[4],
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface.elevated,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}>
          {label}
        </Text>
        <Text
          style={{
            ...theme.typography.caption,
            color: connected ? theme.colors.success.default : theme.colors.text.muted,
            marginTop: theme.space[1],
          }}
        >
          {connected ? connectedLabel : notConnectedLabel}
        </Text>
      </View>

      <Pressable
        onPress={connected ? onDisconnect : onConnect}
        disabled={pending}
        style={({ pressed }) => ({
          paddingHorizontal: theme.space[4],
          paddingVertical: theme.space[2],
          borderRadius: theme.radius.md,
          backgroundColor: pressed ? theme.colors.surface.raised : 'transparent',
          borderWidth: 1,
          borderColor: connected ? theme.colors.danger.default : theme.colors.accent.default,
          opacity: pending ? 0.5 : 1,
        })}
      >
        {pending ? (
          <LoadingDots
            color={connected ? theme.colors.danger.default : theme.colors.accent.default}
          />
        ) : (
          <Text
            style={{
              ...theme.typography.body,
              color: connected ? theme.colors.danger.default : theme.colors.accent.default,
            }}
          >
            {connected ? disconnectLabel : connectLabel}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
