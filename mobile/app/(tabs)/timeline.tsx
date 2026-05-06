import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, SafeAreaView, Text, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingDots } from '@/components/feedback/LoadingDots';
import { Skeleton } from '@/components/feedback/Skeleton';
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
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <View style={{ paddingHorizontal: theme.space[6], paddingTop: theme.space[4] }}>
          <Text style={{ ...theme.typography.title, color: theme.colors.text.primary }}>
            {t('title')}
          </Text>
        </View>
        <View style={{ padding: theme.space[6], gap: theme.space[3] }}>
          <Skeleton height={56} radius="lg" />
          <Skeleton height={56} radius="lg" />
          <Skeleton height={56} radius="lg" />
          <Skeleton height={56} radius="lg" />
        </View>
      </SafeAreaView>
    );
  }

  if (query.isError) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.colors.surface.primary,
          justifyContent: 'center',
        }}
      >
        <ErrorState messageKey="errors.generic.network" onRetry={() => query.refetch()} />
      </SafeAreaView>
    );
  }

  if (rows.length === 0) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.colors.surface.primary,
          justifyContent: 'center',
        }}
      >
        <EmptyState mood="thinking" titleKey="timeline:empty_title" bodyKey="timeline:empty_body" />
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
            <View style={{ padding: theme.space[4], alignItems: 'center', gap: theme.space[2] }}>
              <LoadingDots />
              <Text
                style={{
                  ...theme.typography.micro,
                  color: theme.colors.text.muted,
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
