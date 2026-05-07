import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';

import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

export function LogoutButton() {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const logout = useAuthStore((s) => s.logout);

  const handlePress = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        padding: theme.space[4],
        backgroundColor: pressed ? theme.colors.danger.muted : theme.colors.danger.default,
        borderRadius: theme.radius.md,
        alignItems: 'center',
      })}
    >
      <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.inverse }}>
        {t('auth.logout')}
      </Text>
    </Pressable>
  );
}
