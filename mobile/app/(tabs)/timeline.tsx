import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, SafeAreaView, Text, View } from 'react-native';

import { TimelineItem } from '@/features/timeline/TimelineItem';
import { bucketOf } from '@/features/timeline/utils';
import { getTimeline, type TimelineItem as ItemT } from '@/services/api/timeline';
import { useTheme } from '@/theme';

type Row = { kind: 'header'; key: string; label: string } | { kind: 'item'; key: string; item: ItemT };

export default function TimelineScreen() {
  const { t, i18n } = useTranslation('timeline');
  const theme = useTheme();

  const query = useInfiniteQuery({
    queryKey: ['timeline'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getTimeline(pageParam, 20),
    getNextPageParam: (last) => last.next_cursor,
  });

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastBucket: ReturnType<typeof bucketOf> | null = null;
    const items = query.data?.pages.flatMap((p) => p.items) ?? [];
    for (const item of items) {
      const bucket = bucketOf(new Date(item.at));
      if (bucket !== lastBucket) {
        out.push({ kind: 'header', key: `h-${bucket}-${item.id}`, label: t(`headers.${bucket}`) });
        lastBucket = bucket;
      }
      out.push({ kind: 'item', key: item.id, item });
    }
    return out;
  }, [query.data, t]);

  if (query.isLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.colors.surface.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={theme.colors.accent.default} />
      </SafeAreaView>
    );
  }

  if (rows.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <View style={{ flex: 1, padding: theme.space[6], justifyContent: 'center' }}>
          <Text style={{ ...theme.typography.title, color: theme.colors.text.primary }}>
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
      <View style={{ paddingHorizontal: theme.space[6], paddingTop: theme.space[4] }}>
        <Text style={{ ...theme.typography.title, color: theme.colors.text.primary }}>
          {t('title')}
        </Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={{ padding: theme.space[6] }}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <Text
              style={{
                ...theme.typography.caption,
                color: theme.colors.text.muted,
                marginTop: theme.space[4],
                marginBottom: theme.space[2],
                textTransform: 'uppercase',
              }}
            >
              {item.label}
            </Text>
          ) : (
            <TimelineItem item={item.item} locale={i18n.language} />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View style={{ padding: theme.space[4], alignItems: 'center' }}>
              <ActivityIndicator color={theme.colors.accent.default} />
              <Text
                style={{
                  ...theme.typography.micro,
                  color: theme.colors.text.muted,
                  marginTop: theme.space[2],
                }}
              >
                {t('loading_more')}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
