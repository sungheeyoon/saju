import type { CurrentReading } from '@reading/current-reading';
import { seatNicknamesOf, withNicknames, type PairNicknames } from '@reading/display';
import { READING_STALE_LABEL, READING_STALE_NOTE } from '@reading/notes';
import { ELEMENTS, type Element } from '@saju';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { ElementSymbol } from '@/ui/element-symbol';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { Markdown } from './markdown';
import type { ReadingTarget } from './api';

const softOf = (element: Element | null | undefined) => (element ? ELEMENT_TONE[element].soft : COLOR.noneSoft);

/** 표지의 면 — 한 사람은 제 색 한 면, 두 사람은 두 색이 비스듬히 만난다(`app/me/reading/essay.ts` 의 `coverFace`) */
export function CoverFace({ tones }: { tones: readonly (Element | null)[] | undefined }) {
  if (tones === undefined) return <View style={[StyleSheet.absoluteFill, { backgroundColor: COLOR.cream }]} />;
  if (tones.length < 2) return <View style={[StyleSheet.absoluteFill, { backgroundColor: softOf(tones[0]) }]} />;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: softOf(tones[0]) }]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Polygon points="62,0 100,0 100,100 42,100" fill={softOf(tones[1])} />
      </Svg>
    </View>
  );
}

/** 다 된 글 — 표지(비유 · 점수) · 수정 전 경고 · 본문. 글자와 차례는 웹의 `reading-result.tsx` 와 같다 */
export function Result({
  reading,
  target,
  createdLabel,
  minutes,
  tones,
  nicknames,
  betweenSummaryAndBody,
  coverAction,
}: {
  reading: CurrentReading;
  target: ReadingTarget;
  createdLabel: string | null;
  minutes: number | null;
  tones: readonly (Element | null)[] | undefined;
  /** 두 사람 글의 자리 호칭을 바꿔 넣을 닉네임 — 궁합 화면만 넘긴다 */
  nicknames?: PairNicknames;
  /** 점수 · 한 문장 결론 다음, 본문 전에 세울 내용 — 궁합 화면이 넘긴다 */
  betweenSummaryAndBody?: ReactNode;
  /** 표지 첫 줄 끝의 아이콘 — 공유. 세울지는 `panelChrome().canShare` 한 벌이 정한다 */
  coverAction?: ReactNode;
}) {
  const seats = nicknames === undefined ? null : seatNicknamesOf(nicknames, reading.viewerIsFirst);
  const named = (text: string) => (seats === null ? text : withNicknames(text, seats));
  const metaphor = reading.metaphor === null ? null : named(reading.metaphor);

  const meta = (
    <Text style={styles.meta}>
      {createdLabel} 생성{' · '}읽는 데 약 {minutes}분
    </Text>
  );

  return (
    <View style={styles.result}>
      {reading.score !== null || metaphor !== null ? (
        <View style={styles.cover}>
          <CoverFace tones={tones} />
          {metaphor !== null ? (
            <>
              {coverAction !== undefined && <View style={styles.coverAction}>{coverAction}</View>}
              <Text aria-hidden style={styles.quote}>
                “
              </Text>
              <Text style={styles.metaphor}>{metaphor}</Text>
            </>
          ) : (
            <Text style={styles.coverTitle}>풀이 결과</Text>
          )}
          <View style={styles.caption}>
            <View style={styles.grow}>{meta}</View>
            {reading.score !== null && (
              <View style={styles.score}>
                <Text style={styles.scoreLabel}>궁합풀이 점수</Text>
                <Text style={styles.scoreValue}>
                  {reading.score} <Text style={styles.scoreLabel}>/ 100</Text>
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        meta
      )}

      {target.kind !== 'match' && !reading.fromCurrentChart && (
        <View style={styles.stale}>
          <Text style={styles.staleText}>
            <Text style={styles.staleLabel}>{READING_STALE_LABEL} </Text>
            {READING_STALE_NOTE}
          </Text>
        </View>
      )}

      {betweenSummaryAndBody}

      {target.kind === 'match' && (
        <View>
          <Text style={styles.coverTitle}>두 사람의 풀이</Text>
          <Text style={styles.bodyHead}>궁합풀이 결과</Text>
        </View>
      )}

      <Markdown source={named(reading.output)} />

      <View aria-hidden style={styles.end}>
        {ELEMENTS.map((element) => (
          <ElementSymbol key={element} element={element} size={20} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  result: { gap: 24 },
  grow: { flex: 1, minWidth: 0 },
  cover: { overflow: 'hidden', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24, borderRadius: RADIUS.panel },
  coverAction: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
  quote: { height: 40, fontFamily: FONT.bold, fontSize: 64, lineHeight: 72, color: COLOR.foreground, opacity: 0.7 },
  metaphor: { marginTop: 8, fontFamily: FONT.bold, fontSize: TYPE.title, lineHeight: 36, color: COLOR.foreground },
  coverTitle: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  caption: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginTop: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
  meta: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  score: { alignItems: 'flex-end' },
  scoreLabel: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  scoreValue: { fontFamily: FONT.bold, fontSize: TYPE.figure, color: COLOR.foreground },
  stale: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: RADIUS.panel, backgroundColor: COLOR.warningWash },
  staleText: { fontFamily: FONT.medium, fontSize: TYPE.sm, lineHeight: 24, color: COLOR.foreground },
  staleLabel: { fontFamily: FONT.bold, color: ELEMENT_TONE.土.ink },
  bodyHead: { marginTop: 4, fontFamily: FONT.bold, fontSize: TYPE.heading, color: COLOR.foreground },
  end: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 24, opacity: 0.8 },
});
