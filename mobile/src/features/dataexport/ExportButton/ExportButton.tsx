import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useToast } from '@/components/feedback/Toast';
import { useExportData } from '@/features/dataexport/mutations';
import { ApiError } from '@/services/api/client';
import { useTheme } from '@/theme';

export function ExportButton() {
  const theme = useTheme();
  const { t } = useTranslation('data');
  const toast = useToast();

  const ex = useExportData({
    onSuccess: () => toast.show({ messageKey: 'data:export.saved', tone: 'success' }),
    onError: (err) => {
      const key = err instanceof ApiError ? err.messageKey : 'errors.export.failed';
      toast.show({ messageKey: key, tone: 'danger' });
    },
  });

  return (
    <Pressable
      onPress={() => ex.mutate()}
      disabled={ex.isPending}
      style={{
        backgroundColor: ex.isPending ? theme.colors.accent.muted : theme.colors.accent.default,
        paddingVertical: theme.space[4],
        borderRadius: theme.radius.md,
        alignItems: 'center',
      }}
    >
      {ex.isPending ? (
        <LoadingDots color={theme.colors.accent.onAccent} />
      ) : (
        <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
          {t('export.action')}
        </Text>
      )}
    </Pressable>
  );
}
