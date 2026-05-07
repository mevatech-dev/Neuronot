import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SafeAreaView, ScrollView, Text } from 'react-native';

import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { DeleteAccountSheet } from '@/features/account/DeleteAccountSheet';
import { useTheme } from '@/theme';

export default function AccountScreen() {
  const theme = useTheme();
  const { t } = useTranslation('account');
  const [del, setDel] = useState(false);

  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[6] }}>
          <ChangePasswordForm />

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
        </ScrollView>
        <DeleteAccountSheet visible={del} onClose={() => setDel(false)} />
      </SafeAreaView>
    </>
  );
}
