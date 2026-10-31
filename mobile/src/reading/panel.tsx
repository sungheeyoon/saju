import type { PairNicknames } from '@reading/display';
import { readingNoneNote } from '@reading/notes';
import { readingOutline } from '@reading/outline';
import type { Element } from '@saju';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, CardFrame, Tile } from '@/ui/surfaces';
import { PrimaryButton, SecondaryButton, TextButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { settled } from '@/ui/settled';
import { UNREACHABLE } from '@/auth/signup';

import { readReadingView, type DoorRefusal, type ReadingTarget, type ReadingView } from './api';
import { ConfirmMake, CreditsShortage } from './dialogs';
import { ReadingFeedback } from './feedback';
import { Result } from './result';
import { ShareReadingButton } from './share-button';
import { useReadingPanel, type ShownView } from './use-reading-panel';
import { LoadingState } from './waiting';

/** 문이 자격으로 거절한 때의 길 — 웹의 관문이 보내는 곳과 같다. 다시 시도할 수 있는 거절만 칸에 남는다 */
export function followRefusal(refused: DoorRefusal): void {
  if (refused.refused === 'sign-in') router.replace('/');
  else if (refused.refused === 'signup' || refused.refused === 'closed') router.replace('/signup');
}

/** 못 읽은 칸 — 웹의 `FailureLine` 처럼 까닭 한 줄과 다시 시도 */
export function ReadFailure({ refused, onRetry }: { refused: DoorRefusal; onRetry: () => void }) {
  if (refused.refused === 'not-found') {
    return (
      <Card>
        <Text style={styles.line}>페이지를 찾을 수 없어요</Text>
      </Card>
    );
  }
  if (refused.refused !== 'unavailable') return null;
  return (
    <Tile tone={COLOR.dangerWash} accessibilityRole="alert" style={styles.alert}>
      <Text style={styles.alertText}>{refused.message}</Text>
      <TextButton label="다시 시도하기" onPress={onRetry} />
    </Tile>
  );
}

/** 대상의 풀이 칸을 읽는다 — 화면 머리가 값을 쓰려면 이것으로 먼저 읽고 `ReadingPanel` 에 넘긴다 */
export function useReadingView(target: ReadingTarget) {
  const [answer, setAnswer] = useState<{ view: ReadingView } | { refused: DoorRefusal } | null>(null);
  const query = JSON.stringify(target);

  /* 가장 최근의 읽기 표 — 늦은 응답이 새 대상의 칸에 서면 궁합은 다른 두 사람의 풀이가 보인다. 「다시 시도하기」의 읽기도 같은 표로 잰다 */
  const latest = useRef(0);

  const load = useCallback(() => {
    latest.current += 1;
    const mine = latest.current;
    setAnswer(null);
    void settled(readReadingView(JSON.parse(query) as ReadingTarget), 'readReadingView', () => ({ ok: false, refused: { refused: 'unavailable', message: UNREACHABLE } }) as const).then((read) => {
      if (mine !== latest.current) return;
      if (read.ok) setAnswer({ view: read.value });
      else {
        followRefusal(read.refused);
        setAnswer({ refused: read.refused });
      }
    });
  }, [query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load 는 효과 안에서 동기로 칸을 비운다 - 대상이 바뀌면 옛 풀이가 한 번도 안 그려지게 하는 일이다
    load();
    return () => {
      latest.current += 1;
    };
  }, [load]);
  return { answer, reload: load };
}

/**
 * **결과 칸 — 네 갈래가 같은 것을 쓴다.** 내 사주 · 저장한 사람은 여기 `[subject]` 화면이, 궁합은 궁합 화면이 부른다:
 *
 * ```tsx
 * const { answer, reload } = useReadingView(target);
 * <ReadingPanel target={target} view={shownView} tones={[a, b]} nicknames={...} ask={...} />
 * ```
 *
 * 읽기만 한다 — 이 칸이 그려지는 것으로 모델이 불리지 않는다. 부르는 길은 확인 창의 받기 하나다.
 */
export function ReadingPanel({
  target,
  view,
  tones,
  nicknames,
  automatic = false,
  ask,
  betweenSummaryAndBody,
  onReadingChanged,
}: {
  target: ReadingTarget;
  view: ShownView;
  /** 표지의 색 — 글이 있으면 그 글을 만들 때의 일간이 이긴다(`section.tsx`) */
  tones?: readonly (Element | null)[];
  nicknames?: PairNicknames;
  /** 이 글을 동의가 만드는가(ADR 0038) — 인연 궁합. 글이 있으면 누를 것이 없다 */
  automatic?: boolean;
  /** 다음 풀이를 위해 먼저 정할 것 — 궁합의 「무슨 사이인가」 */
  ask?: ReactNode;
  betweenSummaryAndBody?: ReactNode;
  /** 새 글이 섰다 — 글이 정하는 값(궁합 지표의 눈금)을 위쪽이 다시 읽는다. 웹은 응답이 화면을 무른다 */
  onReadingChanged?: () => void;
}) {
  const panel = useReadingPanel({ target, initial: view, automatic, onRefused: followRefusal });
  const { phase, failure, reading, chrome, noun, creditsNote, progress } = panel;

  const shownId = useRef(reading?.id ?? null);
  useEffect(() => {
    const id = reading?.id ?? null;
    if (id === shownId.current) return;
    shownId.current = id;
    onReadingChanged?.();
  }, [reading?.id, onReadingChanged]);

  const stale = reading !== null && target.kind !== 'match' && !reading.fromCurrentChart;
  const makeAtTop = chrome.makeInHeader && stale;
  const makeAtEnd = chrome.makeInHeader && !stale;
  const makeButton = (emphasis: 'primary' | 'secondary') =>
    emphasis === 'primary' ? (
      <PrimaryButton label={chrome.makeLabel} onPress={panel.press} disabled={chrome.makeDisabled} />
    ) : (
      <SecondaryButton label={chrome.makeLabel} onPress={panel.press} disabled={chrome.makeDisabled} />
    );
  const note = creditsNote !== null && <Text style={styles.small}>{creditsNote}</Text>;

  return (
    <View style={styles.panel}>
      {makeAtTop && (
        <View style={styles.group}>
          {makeButton('primary')}
          {ask}
          {note}
        </View>
      )}

      {!chrome.hideMake && !chrome.makeInHeader && (
        <CardFrame style={styles.group}>
          {ask}
          {reading === null && (
            <View>
              <Text style={styles.lead}>사주를 바탕으로 {noun}를 받아 보세요</Text>
              <Text style={styles.small}>{readingNoneNote(noun)}</Text>
            </View>
          )}
          {makeButton('primary')}
          {note}
        </CardFrame>
      )}

      {failure !== null && (
        <Tile tone={phase === 'error' ? COLOR.dangerWash : COLOR.warningWash} accessibilityRole={phase === 'error' ? 'alert' : undefined} style={phase === 'error' ? styles.alert : styles.notice}>
          <Text style={phase === 'error' ? styles.alertText : styles.noticeText}>{failure}</Text>
          {phase === 'error' && <TextButton label="다시 시도하기" onPress={panel.generate} />}
        </Tile>
      )}

      {phase === 'loading' ? (
        <>
          {betweenSummaryAndBody}
          <LoadingState rows={readingOutline(panel.view.outline, progress)} waitNote={panel.view.waitNote} />
        </>
      ) : reading === null ? (
        betweenSummaryAndBody
      ) : (
        <Result
          reading={reading}
          target={target}
          createdLabel={panel.view.createdLabel}
          minutes={panel.view.minutes}
          tones={tones}
          nicknames={nicknames}
          betweenSummaryAndBody={betweenSummaryAndBody}
          coverAction={chrome.canShare ? <ShareReadingButton target={target} look="icon" /> : undefined}
        />
      )}

      {/* 다 읽은 뒤에 하는 일은 글 끝에 선다 — 보내기와 다시 받기가 반반, 그 아래 접힌 의견(`app/me/reading/panel.tsx`) */}
      {reading !== null && phase !== 'loading' && (chrome.canShare || makeAtEnd || chrome.asksFeedback) && (
        <View style={styles.group}>
          {(chrome.canShare || makeAtEnd) && (
            <View style={styles.group}>
              <View style={styles.halves}>
                {chrome.canShare && (
                  <View style={styles.half}>
                    <ShareReadingButton target={target} />
                  </View>
                )}
                {makeAtEnd && <View style={styles.half}>{makeButton(chrome.canShare ? 'secondary' : 'primary')}</View>}
              </View>
              {makeAtEnd && ask}
              {makeAtEnd && note}
            </View>
          )}
          {chrome.asksFeedback && reading.sourceRunId !== null && <ReadingFeedback target={target} runId={reading.sourceRunId} given={reading.myFeedback} />}
        </View>
      )}

      {panel.asking && (
        <ConfirmMake noun={noun} hasReading={reading !== null} onConfirm={panel.confirmGenerate} onClose={panel.closeAsking} />
      )}
      {panel.shortage !== null && (
        <CreditsShortage available={panel.shortage.available} onClose={panel.closeShortage} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 24 },
  group: { gap: 12, padding: 20 },
  halves: { flexDirection: 'row', gap: 8 },
  half: { flex: 1, minWidth: 0 },
  lead: { fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.foreground },
  small: { marginTop: 2, fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  alert: { paddingHorizontal: 16, paddingVertical: 14 },
  alertText: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.danger },
  notice: { paddingHorizontal: 16, paddingVertical: 14 },
  noticeText: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
});
