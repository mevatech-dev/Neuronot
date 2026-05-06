import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { NeuroMascot } from '@/components/brand/NeuroMascot';
import { DailyLogCard } from '@/features/daily-log/DailyLogCard';
import { DailyLogEditSheet } from '@/features/daily-log/DailyLogEditSheet';
import { QuickLogSheet } from '@/features/daily-log/QuickLogSheet';
import { EventQuickAdd } from '@/features/events/EventQuickAdd';
import { WeeklySummaryCard } from '@/features/summary/WeeklySummaryCard';
import { useFadeIn } from '@/hooks/useFadeIn';
import { useHapticPress } from '@/hooks/useHapticPress';
import { type DailyLogResponse } from '@/services/api/dailylog';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

export default function HomeScreen() {
  const { t } = useTranslation(['common', 'events']);
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const fade = useFadeIn();
  const fab = useHapticPress();

  const [logSheetVisible, setLogSheetVisible] = useState(false);
  const [eventSheetVisible, setEventSheetVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<DailyLogResponse | null>(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
      <Animated.ScrollView
        style={fade}
        contentContainerStyle={{ padding: theme.space[6], gap: theme.space[6] }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[4] }}>
          <NeuroMascot mood="happy" size={72} framed />
          <View style={{ flex: 1 }}>
            <Text style={{ ...theme.typography.title, color: theme.colors.text.primary }}>
              {t('app.name')}
            </Text>
            <Text
              style={{
                ...theme.typography.caption,
                color: theme.colors.text.muted,
                marginTop: theme.space[1],
              }}
            >
              {user?.email ?? ''}
            </Text>
          </View>
        </View>

        <DailyLogCard
          onTapEmpty={() => setLogSheetVisible(true)}
          onTapEdit={(log) => setEditingLog(log)}
        />

        <WeeklySummaryCard />
      </Animated.ScrollView>

      <Animated.View
        style={[
          {
            position: 'absolute',
            right: theme.space[6],
            bottom: theme.space[6],
          },
          fab.style,
        ]}
      >
        <Pressable
          onPress={() => setEventSheetVisible(true)}
          onPressIn={fab.onPressIn}
          onPressOut={fab.onPressOut}
          style={{
            backgroundColor: theme.colors.accent.default,
            paddingHorizontal: theme.space[5],
            paddingVertical: theme.space[4],
            borderRadius: theme.radius.full,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
            {t('add', { ns: 'events' })}
          </Text>
        </Pressable>
      </Animated.View>

      <QuickLogSheet visible={logSheetVisible} onClose={() => setLogSheetVisible(false)} />
      <EventQuickAdd visible={eventSheetVisible} onClose={() => setEventSheetVisible(false)} />
      <DailyLogEditSheet
        visible={editingLog !== null}
        log={editingLog}
        onClose={() => setEditingLog(null)}
      />
    </SafeAreaView>
  );
}
