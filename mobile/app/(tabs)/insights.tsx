import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, Text, View } from 'react-native';

import { ApiError } from '@/services/api/client';
import { generateInsight, getInsights, type InsightResponse } from '@/services/api/insights';
import { useTheme } from '@/theme';

export default function InsightsScreen() {
  const { t, i18n } = useTranslation(['insights', 'errors']);
  const theme = useTheme();
  const queryClient = useQueryClient();

  const insights = useQuery({
    queryKey: ['insights'],
    queryFn: () => getInsights(20),
  });

  const generate = useMutation({
    mutationFn: () => generateInsight(i18n.language),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['insights'] }),
  });

  const latest = insights.data?.items[0];
  const history = insights.data?.items.slice(latest ? 1 : 0) ?? [];
  const errorMessage = generate.error
    ? errorLabel(generate.error, t)
    : insights.error
      ? errorLabel(insights.error, t)
      : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id ?? `${item.generated_at}-${item.title}`}
        contentContainerStyle={{ padding: theme.space[6], gap: theme.space[4], flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ gap: theme.space[5] }}>
            <View>
              <Text style={{ ...theme.typography.title, color: theme.colors.text.primary }}>
                {t('title')}
              </Text>
              <Text
                style={{
                  ...theme.typography.body,
                  color: theme.colors.text.secondary,
                  marginTop: theme.space[2],
                }}
              >
                {t('subtitle')}
              </Text>
            </View>

            <Pressable
              onPress={() => generate.mutate()}
              disabled={generate.isPending}
              style={{
                backgroundColor: generate.isPending
                  ? theme.colors.accent.muted
                  : theme.colors.accent.default,
                borderRadius: theme.radius.md,
                paddingVertical: theme.space[4],
                alignItems: 'center',
              }}
            >
              {generate.isPending ? (
                <ActivityIndicator color={theme.colors.accent.onAccent} />
              ) : (
                <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
                  {t('generate')}
                </Text>
              )}
            </Pressable>

            {errorMessage && (
              <Text style={{ ...theme.typography.caption, color: theme.colors.danger.default }}>
                {errorMessage}
              </Text>
            )}

            {insights.isLoading ? (
              <View style={{ paddingVertical: theme.space[8], alignItems: 'center' }}>
                <ActivityIndicator color={theme.colors.accent.default} />
              </View>
            ) : latest ? (
              <View>
                <Text
                  style={{
                    ...theme.typography.caption,
                    color: theme.colors.text.muted,
                    marginBottom: theme.space[2],
                  }}
                >
                  {latest.crisis ? t('crisis_label') : t('latest')}
                </Text>
                <InsightCard item={latest} />
              </View>
            ) : (
              <View
                style={{
                  padding: theme.space[5],
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.border.subtle,
                  backgroundColor: theme.colors.surface.elevated,
                }}
              >
                <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>
                  {t('empty_title')}
                </Text>
                <Text
                  style={{
                    ...theme.typography.body,
                    color: theme.colors.text.secondary,
                    marginTop: theme.space[2],
                  }}
                >
                  {t('empty_body')}
                </Text>
              </View>
            )}

            {history.length > 0 && (
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
                {t('history')}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => <InsightCard item={item} />}
      />
    </SafeAreaView>
  );
}

function InsightCard({ item }: { item: InsightResponse }) {
  const theme = useTheme();
  const { t } = useTranslation(['crisis']);

  return (
    <View
      style={{
        padding: theme.space[5],
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: item.crisis ? theme.colors.warning.default : theme.colors.border.subtle,
        backgroundColor: theme.colors.surface.elevated,
      }}
    >
      {item.crisis && (
        <Text
          style={{
            ...theme.typography.caption,
            color: theme.colors.warning.default,
            marginBottom: theme.space[2],
          }}
        >
          {t('label', { ns: 'crisis' })}
        </Text>
      )}
      <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>
        {item.title}
      </Text>
      <Text
        style={{
          ...theme.typography.body,
          color: theme.colors.text.secondary,
          marginTop: theme.space[2],
        }}
      >
        {item.content}
      </Text>
      {item.crisis && (
        <Text
          style={{
            ...theme.typography.caption,
            color: theme.colors.text.muted,
            marginTop: theme.space[3],
          }}
        >
          {t('card_hint', { ns: 'crisis' })}
        </Text>
      )}
    </View>
  );
}

function errorLabel(error: unknown, t: ReturnType<typeof useTranslation>['t']) {
  if (error instanceof ApiError) {
    return t(error.messageKey.replace(/^errors\./, ''), { ns: 'errors' });
  }
  return t('fallback_error', { ns: 'insights' });
}
