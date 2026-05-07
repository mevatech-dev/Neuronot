import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useTheme } from '@/theme';

import { useGrantConsent } from '../mutations';
import type { ConsentRecord } from '../types';

type Props = {
  staleConsents: ConsentRecord[];
  onResolved: () => void;
};

export function ReConsentSheet({ staleConsents, onResolved }: Props) {
  const { t } = useTranslation('consents');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const top = staleConsents[0];

  const grant = useGrantConsent({
    onSuccess: () => {
      // Parent gate re-reads stale consents and advances when this item resolves.
    },
  });

  if (!top) {
    return null;
  }

  const dismissable = top.type === 'ai_usage';

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={dismissable ? onResolved : undefined}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.surface.overlay,
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.surface.primary,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            paddingTop: theme.space[5],
            paddingBottom: insets.bottom + theme.space[4],
            maxHeight: '88%',
          }}
        >
          <View style={{ paddingHorizontal: theme.space[6], gap: theme.space[2] }}>
            <Text style={{ ...theme.typography.title, color: theme.colors.text.primary }}>
              {t(`reconsent.${top.type}.title`)}
            </Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: theme.space[6],
              paddingTop: theme.space[4],
              paddingBottom: theme.space[6],
            }}
          >
            <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>
              {t(`reconsent.${top.type}.body`)}
            </Text>
          </ScrollView>

          <View style={{ paddingHorizontal: theme.space[6], gap: theme.space[3] }}>
            <Pressable
              onPress={() => grant.mutate(top.type)}
              disabled={grant.isPending}
              style={{
                backgroundColor: grant.isPending
                  ? theme.colors.accent.muted
                  : theme.colors.accent.default,
                paddingVertical: theme.space[4],
                borderRadius: theme.radius.md,
                alignItems: 'center',
              }}
            >
              {grant.isPending ? (
                <LoadingDots color={theme.colors.accent.onAccent} />
              ) : (
                <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
                  {t('reconsent.accept')}
                </Text>
              )}
            </Pressable>

            {dismissable && (
              <Pressable
                onPress={onResolved}
                disabled={grant.isPending}
                style={{
                  paddingVertical: theme.space[3],
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.secondary }}>
                  {t('reconsent.dismiss')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
