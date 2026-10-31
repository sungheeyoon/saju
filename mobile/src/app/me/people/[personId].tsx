import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { isBlocked } from '@account/index';
import { UNREADABLE_INPUT_NOTE } from '@input/stored';
import { STEM_INFO } from '@saju';

import { Tabs } from '@/chart/parts';
import { readPersonDetail, type MyReading, type PersonDetail, type Read } from '@/people/data';
import { AccountNotice, DayMasterChip, FailureLine, NotFound, ScreenFrame, go, styles as shared } from '@/people/parts';
import { SajuSections } from '@/people/saju-sections';
import { StemSymbol } from '@/ui/stem-symbol';
import { Panel, PrimaryButton } from '@/ui/parts';
import { COLOR, CONTROL, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { settled } from '@/ui/settled';
import { UNREACHABLE } from '@/auth/signup';
import { TopBar } from '@/ui/top-bar';

const NO_READING_YET = '아직 받은 사주풀이가 없어요.';
const NO_COMPAT_YET = '아직 본 궁합이 없어요.';

/** 사람 하나 — 머리는 큰 이름 · 일간 딱지 · 단추 둘, 사주풀이 탭이 기본이다(`app/me/people/[personId]/page.tsx`) */
export default function PersonScreen() {
  const params = useLocalSearchParams<{ personId: string; from?: string; tab?: string }>();
  const [read, setRead] = useState<Read<PersonDetail> | null>(null);

  const load = useCallback(() => {
    void settled(readPersonDetail(params.personId), 'readPersonDetail', () => ({ kind: 'failed', message: UNREACHABLE }) as const).then((next) => {
      if (next.kind === 'signed-out') router.replace('/');
      else setRead(next);
    });
  }, [params.personId]);
  useFocusEffect(load);

  const before = <TopBar fallback={params.from === 'me' ? '/me' : '/me/people'} />;

  if (read === null || read.kind === 'signed-out') {
    return (
      <ScreenFrame bar={before}>
        <ActivityIndicator color={COLOR.secondary} style={styles.loading} />
      </ScreenFrame>
    );
  }
  if (read.kind === 'failed') {
    return (
      <ScreenFrame bar={before}>
        <FailureLine onRetry={load}>{read.message}</FailureLine>
      </ScreenFrame>
    );
  }

  const { state, person, selfPersonId, nickname, readings } = read.value;
  if (isBlocked(state)) {
    return (
      <ScreenFrame bar={before}>
        <AccountNotice state={state} onRetry={load} />
      </ScreenFrame>
    );
  }
  if (person === null) {
    return (
      <ScreenFrame bar={before}>
        <NotFound>
          <PrimaryButton label="사람 목록으로" onPress={() => router.replace('/me/people')} />
        </NotFound>
      </ScreenFrame>
    );
  }

  /* 내 명식이면 풀이 칸은 내 것이다 — 견주는 값은 주소의 글자가 아니라 DB 가 낸 id 다 */
  const mine = selfPersonId === person.personId;
  const fromHome = mine || params.from === 'me';
  const bar = <TopBar title={person.label} fallback={fromHome ? '/me' : '/me/people'} />;

  if (!person.chart.ok) {
    return (
      <ScreenFrame bar={bar}>
        <Panel style={styles.unreadable}>
          <Text style={shared.noticeBody}>{person.chart.message}</Text>
          <Text style={shared.meta}>{UNREADABLE_INPUT_NOTE}</Text>
        </Panel>
      </ScreenFrame>
    );
  }

  const { saju } = person.chart;
  const stem = saju.pillars.dayMaster;
  const own = readings.find((one) => (mine ? one.kind === 'self' : one.kind === 'person' && one.personA === person.personId)) ?? null;
  const readingHref = mine ? '/me/readings/self' : `/me/readings/${person.personId}`;
  /* 이 사람이 들어간 궁합풀이 전부 — 최근 순. 이 사람 이름이 앞이고 내 자리는 닉네임이다 */
  const called = nickname?.trim() || '나';
  const pairs = mine
    ? []
    : readings
        .filter((one) => one.kind === 'private' && (one.personA === person.personId || one.personB === person.personId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const namesOf = (one: MyReading) =>
    [
      person.label,
      one.personA === person.personId ? (one.personB === selfPersonId ? called : (one.labelB ?? '')) : one.personA === selfPersonId ? called : (one.labelA ?? ''),
    ].join(' · ');

  return (
    <ScreenFrame bar={bar}>
      <View style={[styles.header, { backgroundColor: ELEMENT_TONE[STEM_INFO[stem].element].soft }]}>
        <View style={styles.watermark}>
          <StemSymbol stem={stem} size={160} opacity={0.15} />
        </View>
        <View style={styles.chip}>
          <DayMasterChip stem={stem} />
        </View>
        <View style={styles.headButtons}>
          <Pressable accessibilityRole="link" onPress={() => go(readingHref)} style={[styles.headButton, own === null ? styles.primary : styles.plain]}>
            <Text style={[styles.headButtonText, own === null && styles.primaryText]} numberOfLines={1}>{own === null ? '사주풀이 받기' : '사주풀이 보기'}</Text>
          </Pressable>
          {/* 이 사람만 앉힌다 — 다른 칸은 비워 두고 사용자가 고른다(운영자 2026-10-26) */}
          <Pressable accessibilityRole="link" onPress={() => go(`/me/compat?pickA=${person.personId}`)} style={[styles.headButton, styles.plain]}>
            <Text style={styles.headButtonText} numberOfLines={1}>궁합 보러 가기</Text>
          </Pressable>
        </View>
      </View>

      <Tabs
        label={`${mine ? '내 사주' : person.label}의 사주풀이와 만세력`}
        initial={params.tab === 'chart' ? 'chart' : 'reading'}
        tabs={[
          {
            key: 'reading',
            label: '사주풀이',
            panel: (
              <View style={styles.gathered}>
                <View style={styles.part}>
                  <Text style={shared.section}>사주풀이</Text>
                  {own === null ? (
                    <Text style={shared.body}>{NO_READING_YET}</Text>
                  ) : (
                    <Row title={`${person.label}의 사주풀이`} sub={own.metaphor} onPress={() => go(readingHref)} />
                  )}
                </View>
                {!mine && (
                  <View style={styles.part}>
                    <Text style={shared.section}>
                      궁합
                      {pairs.length > 0 && <Text style={shared.meta}>{`  ${pairs.length}개`}</Text>}
                    </Text>
                    {pairs.length === 0 && <Text style={shared.body}>{NO_COMPAT_YET}</Text>}
                    {pairs.map((one) => (
                      <Row
                        key={`${one.personA}:${one.personB}`}
                        title={namesOf(one)}
                        sub={one.metaphor}
                        value={one.score === null ? null : `${one.score}점`}
                        onPress={() => go(`/me/compat?a=${one.personA}&b=${one.personB}`)}
                      />
                    ))}
                  </View>
                )}
              </View>
            ),
          },
          { key: 'chart', label: '만세력', panel: <View style={styles.gathered}><SajuSections saju={saju} /></View> },
        ]}
      />
    </ScreenFrame>
  );
}

function Row({ title, sub, value, onPress }: { title: string; sub: string | null; value?: string | null; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        {sub !== null && <Text style={shared.meta} numberOfLines={1}>{sub}</Text>}
      </View>
      {value != null && <Text style={styles.rowValue}>{value}</Text>}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 48 },
  unreadable: { gap: 8 },
  header: { padding: 20, borderRadius: RADIUS.panel, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -32, bottom: -40 },
  chip: { position: 'absolute', top: 16, right: 16 },
  headButtons: { flexDirection: 'row', gap: 8, marginTop: 32 },
  headButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: RADIUS.pill },
  plain: { backgroundColor: COLOR.surface },
  primary: { backgroundColor: COLOR.accent },
  headButtonText: { fontSize: TYPE.sm, fontFamily: FONT.bold, color: COLOR.foreground },
  primaryText: { color: COLOR.onAccent },
  gathered: { gap: 14, marginTop: 14 },
  part: { gap: 8 },
  row: { minHeight: CONTROL + 12, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.control, backgroundColor: COLOR.surface },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: TYPE.body, lineHeight: 22, fontFamily: FONT.bold, color: COLOR.foreground },
  rowValue: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  chevron: { fontSize: TYPE.lead, color: COLOR.muted },
});
