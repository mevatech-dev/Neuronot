import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SafeAreaView, ScrollView, Text } from 'react-native';

import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { DeleteAccountSheet } from '@/features/account/DeleteAccountSheet';
import { LinkedProvidersList } from '@/features/account/LinkedProvidersList';
import { SaveAccountCard } from '@/features/account/SaveAccountCard';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

export default function AccountScreen() {
  const theme = useTheme();
  const { t } = useTranslation('account');
  const isAnonymous = useAuthStore((s) => s.user?.isAnonymous ?? false);
  const [del, setDel] = useState(false);

  // Anonymous accounts show the upgrade card instead of password change /
  // delete — there's no password to change and "delete forever" is just a
  // logout for an anon user. Once the user upgrades the store flips
  // isAnonymous to false and the regular flow re-renders.
  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[6] }}>
          {isAnonymous ? (
            <SaveAccountCard />
          ) : (
            <>
              <ChangePasswordForm />
              <LinkedProvidersList />
              <Pressable
                onPress={() => setDel(true)}
                style={{
                  padding: theme.space[4],
                  borderWidth: 1,
                  borderColor: theme.colors.danger.default,
                  borderRadius: theme.radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.danger.default }}>
                  {t('delete.open')}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
        <DeleteAccountSheet visible={del} onClose={() => setDel(false)} />
      </SafeAreaView>
    </>
  );
}
