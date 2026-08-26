import {
  READING_FAILED_NOTE,
  READING_NONE_NOTE,
  READING_ON_REQUEST_NOTE,
  READING_PINNED_NOTE,
  READING_REDACTION_NOTE,
  READING_SCORE_NOTE,
  READING_STALE_NOTE,
  readingOrderNote,
} from '@/src/lib/reading';

import { CARD } from '../../card';
import { currentReading, lastReadingRun } from './current';
import { Markdown } from './markdown';
import { GenerateButton } from './panel';
import type { ReadingTarget } from './pipeline';

/**
 * 현재 결과가 서는 칸 — **자기 풀이와 공유 궁합이 같은 것을 쓴다.**
 *
 * 화면마다 따로 그리면 언젠가 한 곳에만 「새로 만들면 지금 것이 사라진다」가 빠진다.
 * 비공개 궁합만 아직 사용자 화면에 붙이지 않았고, 붙일 때도 이 컴포넌트를 그대로
 * 쓴다 — 파이프라인은 이미 세 kind 를 다 받는다.
 *
 * **읽기만 한다.** 이 칸이 그려지는 것으로 AI 가 불리지 않는다 — 부르는 길은 버튼
 * 하나뿐이다(`GenerateButton`).
 */
export async function ReadingSection({ target }: { target: ReadingTarget }) {
  const [reading, run] = await Promise.all([currentReading(target), lastReadingRun(target)]);

  return (
    <section className={`${CARD} flex flex-col gap-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">AI 해석</h2>
        {reading !== null && (
          <span className="text-xs text-muted">{when(reading.createdAt)} 생성</span>
        )}
      </div>

      {reading === null ? (
        <p className="text-sm text-secondary">{READING_NONE_NOTE}</p>
      ) : (
        <>
          {reading.score !== null && <Score score={reading.score} />}

          <div className="flex flex-col gap-1 text-xs text-muted">
            {target.kind === 'match' && <p>{readingOrderNote(reading.viewerIsFirst)}</p>}
            <p>{READING_ON_REQUEST_NOTE}</p>
            {/* 매인 판본인지 지금 판본인지는 kind 가 아니라 값이 말한다 */}
            {target.kind === 'match' ? (
              <p>{READING_PINNED_NOTE}</p>
            ) : (
              !reading.fromCurrentRevision && <p className="text-danger">{READING_STALE_NOTE}</p>
            )}
          </div>

          <Markdown source={reading.output} />
        </>
      )}

      {/* 지난 시도가 끝나지 못했으면 그 사실을 말한다 — 알림함에는 서지 않는다 */}
      {run?.status === 'failed' && <p className="text-xs text-danger">{READING_FAILED_NOTE}</p>}

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <GenerateButton target={target} hasCurrent={reading !== null} />
        <p className="text-xs text-muted">{READING_REDACTION_NOTE}</p>
      </div>
    </section>
  );
}

/**
 * 점수 — **말이 숫자보다 먼저 선다.**
 *
 * 82 와 79 는 절대적인 궁합 차이로 읽힌다(ADR 0003). 후보 목록에서는 그래서 숫자를
 * 아예 안 내보냈다. 여기서는 내보내되(PRD: 사용자에게 보이는 점수는 현재 결과의 일부다)
 * **무엇인지 적은 문장을 옆에 붙인다.**
 */
function Score({ score }: { score: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-3xl font-semibold tabular-nums">{score}</span>
      <p className="max-w-md text-xs text-muted">{READING_SCORE_NOTE}</p>
    </div>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}
