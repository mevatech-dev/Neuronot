import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import { hotlines } from '../types';

export function CrisisHotlineList() {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const list = hotlines[i18n.language] ?? hotlines.en ?? [];

  return (
    <View>
      {list.map((h) => (
        <Pressable
          key={h.tel}
          onPress={() => {
            void Linking.openURL(`tel:${h.tel}`);
          }}
          style={{
            padding: theme.space[4],
            backgroundColor: theme.colors.surface.elevated,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border.subtle,
            marginBottom: theme.space[2],
          }}
        >
          <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}>
            {h.label}
          </Text>
          <Text
            style={{
              ...theme.typography.caption,
              color: theme.colors.accent.default,
              marginTop: theme.space[1],
            }}
          >
            {h.tel}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
