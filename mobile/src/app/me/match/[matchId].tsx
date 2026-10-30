import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CHAT_TAB_LABEL } from '@chat/index';
import { MATCH_RESULT_CLOSED_NOTE } from '@consent/index';
import { ELEMENT_KO, PILLAR_POSITION_KO, STEM_INFO, type ChartSnapshot, type Element } from '@saju';

import { readMatchResult, readMyNickname, type MatchOutcome, type Read } from '@/matching/doors';
import { Face, PartnerSheet, ReportBlock } from '@/matching/people';
import type { ReadingTarget } from '@/reading/api';
import { ReadFailure, ReadingPanel, useReadingView } from '@/reading/panel';
import { Icon } from '@/ui/icons';
import { Panel, PrimaryButton } from '@/ui/parts';
import { TopBar, goBack } from '@/ui/top-bar';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

const POSITIONS = ['hour', 'day', 'month', 'year'] as const;

/**
 * 인연 궁합 — 동의가 실제로 연 것. 머리 한 줄 · 표지 · 두 명식 · 풀이 본문 차례다(PRD §6.3). 풀이 칸은 네 갈래 한 벌이다(`ReadingPanel`) — 만드는 중 · 실패 · 의견이 거기 있다.
 * 없는 Match 와 못 보는 Match 는 같은 말로 거절한다(ADR 0007). 글이 있으면 만드는 단추가 없다(ADR 0038) — 글이 없을 때만 선다.
 */
export default function MatchScreen() {
  const { matchId, from } = useLocalSearchParams<{ matchId: string; from?: string }>();
  const [outcome, setOutcome] = useState<Read<MatchOutcome> | null>(null);
  const [nickname, setNickname] = useState('');
  const [sheet, setSheet] = useState(false);

  const load = useCallback(async () => {
    const [next, mine] = await Promise.all([readMatchResult(matchId), readMyNickname()]);
    setNickname(mine);
    setOutcome(next);
  }, [matchId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load 는 읽기를 기다린 뒤에만 상태를 고친다. 규칙이 await 를 넘어 보지 못한다
    void load();
  }, [load]);

  const fallback = from === 'history' ? '/me/matching/history' : from === 'shelf' ? '/me/readings' : '/me/matching';
  const back = () => goBack(fallback);

  if (outcome === null) {
    return (
      <View style={styles.screen}>
        <TopBar fallback={fallback} />
      </View>
    );
  }

  if (!outcome.ok) {
    return (
      <View style={styles.screen}>
        <TopBar title="궁합 결과" fallback={fallback} />
        <View style={styles.content}>
          <Text style={styles.failure} accessibilityRole="alert">
            {outcome.reason}
          </Text>
          <Pressable accessibilityRole="button" onPress={load} style={styles.retry}>
            <Text style={styles.retryText}>다시 시도하기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (outcome.value.kind === 'none') {
    return (
      <View style={styles.screen}>
        <TopBar fallback={fallback} />
        <View style={styles.notFound}>
          <Text style={styles.title} accessibilityRole="header">
            찾을 수 없어요
          </Text>
          <View>
            <Text style={styles.line}>주소에 적힌 인연 궁합을 찾지 못했어요.</Text>
            <Text style={styles.line}>인연 탭에서 다시 열어 주세요.</Text>
          </View>
          <PrimaryButton label="인연 탭으로" onPress={() => router.replace('/me/matching')} />
        </View>
      </View>
    );
  }

  if (outcome.value.kind === 'closed') {
    return (
      <View style={styles.screen}>
        <TopBar title="궁합 결과" fallback={fallback} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.closed}>
            <Text style={styles.line}>{MATCH_RESULT_CLOSED_NOTE}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  const { result } = outcome.value;
  const tone = STEM_INFO[result.theirs.dayMaster].element;

  return (
    <View style={styles.screen}>
      <TopBar
        fallback={fallback}
        right={
          <>
            {from !== 'chat' && (
              <Pressable accessibilityRole="link" onPress={() => router.push(`/me/chat/${result.matchId}` as never)} style={styles.chat}>
                <Icon name="chat" size={18} />
                <Text style={styles.chatText}>{CHAT_TAB_LABEL}</Text>
              </Pressable>
            )}
            <ReportBlock userId={result.partnerUserId} nickname={result.partnerNickname} onBlocked={back} />
          </>
        }
      >
        <Pressable accessibilityRole="button" accessibilityLabel={`${result.partnerNickname} 님 자세히`} onPress={() => setSheet(true)}>
          <Face userId={result.partnerUserId} nickname={result.partnerNickname} hasPhoto={result.partnerPhotoCount > 0} focus={result.partnerPhotoFocus[0]} size={40} tone={tone} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1} accessibilityRole="header">
            {result.partnerNickname} 님
          </Text>
          <Text style={styles.meta}>궁합 결과</Text>
        </View>
      </TopBar>
      <ScrollView contentContainerStyle={styles.content}>
        <PartnerSheet
          open={sheet}
          onClose={() => setSheet(false)}
          partner={{
            userId: result.partnerUserId,
            nickname: result.partnerNickname,
            intro: result.partnerIntro,
            photoCount: result.partnerPhotoCount,
            photoFocus: result.partnerPhotoFocus,
            tone,
          }}
          menu={<ReportBlock userId={result.partnerUserId} nickname={result.partnerNickname} onBlocked={back} />}
        />

        <MatchReadingPanel
          matchId={result.matchId}
          nicknames={{ viewer: nickname, partner: result.partnerNickname }}
          tones={[STEM_INFO[result.mine.dayMaster].element, tone]}
          pair={
            <View style={styles.pair}>
              <Text style={styles.pairEyebrow}>각자의 사주</Text>
              <Text style={styles.pairTitle}>궁합의 출발점</Text>
              <Side name="나" chart={result.mine} who="첫 번째" />
              <Side name={result.partnerNickname} chart={result.theirs} who="두 번째" />
            </View>
          }
        />
      </ScrollView>
    </View>
  );
}

/** 풀이 칸 — 글은 문이 근거 절을 자르고 내준다(ADR 0008 · 0211). 동의가 만드는 글이라 `automatic` 이다(ADR 0038). 두 명식은 표지와 본문 사이에 선다 */
function MatchReadingPanel({
  matchId,
  nicknames,
  tones,
  pair,
}: {
  matchId: string;
  nicknames: { viewer: string; partner: string };
  tones: readonly Element[];
  pair: ReactNode;
}) {
  const target = useMemo<ReadingTarget>(() => ({ kind: 'match', matchId }), [matchId]);
  const { answer, reload } = useReadingView(target);

  if (answer === null) return <ActivityIndicator color={COLOR.secondary} />;
  if ('refused' in answer) return <ReadFailure refused={answer.refused} onRetry={reload} />;
  if (answer.view.view === 'blocked') {
    return (
      <Panel>
        <Text style={styles.name}>{answer.view.title}</Text>
        <Text style={styles.line}>{answer.view.detail}</Text>
      </Panel>
    );
  }
  if (answer.view.view !== 'reading') return null;
  return <ReadingPanel target={target} view={answer.view} automatic nicknames={nicknames} tones={tones} betweenSummaryAndBody={pair} />;
}

/** 한 사람의 면 — 동의로 열린 여덟 글자만. 입력 · 출생지 · 원국 판정은 이 값에 없다(ADR 0012) */
function Side({ name, chart, who }: { name: string; chart: ChartSnapshot; who: string }) {
  const dayMaster = STEM_INFO[chart.dayMaster];
  return (
    <View style={[styles.side, { backgroundColor: ELEMENT_TONE[dayMaster.element].soft }]}>
      <Text style={styles.meta}>{who} 사람</Text>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.meta}>
        {dayMaster.ko}
        {ELEMENT_KO[dayMaster.element]} 일간
      </Text>
      <View style={styles.pillars}>
        {POSITIONS.map((position) => {
          const pillar = chart[position];
          return (
            <View key={position} style={styles.pillar}>
              <Text style={styles.meta}>{PILLAR_POSITION_KO[position]}</Text>
              <Text style={styles.glyph}>{pillar === null ? '–' : pillar.stem}</Text>
              <Text style={styles.glyph}>{pillar === null ? '–' : pillar.branch}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, gap: 24, padding: 16 },
  flex: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.foreground },
  meta: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.muted },
  chat: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 12, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  chatText: { fontFamily: FONT.bold, fontSize: TYPE.sm, color: COLOR.foreground },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.danger },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { fontFamily: FONT.bold, fontSize: TYPE.sm, color: COLOR.foreground },
  notFound: { flex: 1, justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontFamily: FONT.bold, fontSize: TYPE.title, lineHeight: 34, color: COLOR.foreground },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 26, color: COLOR.secondary },
  closed: { padding: 20, borderRadius: RADIUS.panel, borderWidth: 1, borderStyle: 'dashed', borderColor: COLOR.borderStrong },
  pair: { gap: 12, padding: 16, borderRadius: RADIUS.panel, backgroundColor: COLOR.cream },
  pairEyebrow: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.creamInk },
  pairTitle: { fontFamily: FONT.bold, fontSize: TYPE.heading, color: COLOR.foreground, marginTop: -8 },
  side: { gap: 4, padding: 16, borderRadius: RADIUS.panel },
  pillars: { flexDirection: 'row', gap: 6, marginTop: 8 },
  pillar: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: RADIUS.control, backgroundColor: COLOR.surface },
  glyph: { fontSize: 24, lineHeight: 30, color: COLOR.foreground },
});
