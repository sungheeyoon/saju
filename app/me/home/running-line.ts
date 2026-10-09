import { isSolo, selfSectionTitlesOf } from '@/src/lib/reading';
import { READING_OUTLINE_STATE, READING_REVIEW_LABEL } from '@/src/lib/reading/notes';

import { readingOutline } from '../reading/outline';
import { readingHrefOf, type ReadingTarget } from '../reading/target';
import { withFromMe } from './from-me';
import type { RunningReading } from './running';

/**
 * **만드는 중인 풀이 한 줄이 뭐라고 적히고 어디로 가는가**(ADR 0157) — 홈의 띠가 그리기만 하도록 여기서 짓는다.
 *
 * 진행은 **풀이 화면의 목차와 같은 값**으로 말한다(`readingOutline`, ADR 0127). 홈이 따로 단계를 지으면 두 화면이 같은 시도를
 * 다르게 말한다. 퍼센트는 없다 — 끝을 모르는 일에 비율을 세우면 그건 꾸며 낸 진행이다.
 */

/** 첫 머리가 서기 전 — 서버가 아직 아무 절도 적지 않았다. 확정(대장 15) */
export const READING_PREPARING = '준비 중…';

const called = (label: string | null): string => label ?? '이름 없음';

/** 무엇을 만드는가 — 보관함의 줄 이름(`readingTitle`)과 같은 갈래에 「풀이」 낱말을 붙인 꼴 */
export function runningName(running: Pick<RunningReading, 'target' | 'labelA' | 'labelB'>): string {
  switch (running.target.kind) {
    case 'self':
      return '내 사주풀이';
    case 'person':
      return running.labelA === null ? '사주풀이' : `${running.labelA} 사주풀이`;
    case 'private':
      return `${called(running.labelA)} × ${called(running.labelB)} 궁합풀이`;
    case 'match':
      return running.labelA === null ? '인연 궁합' : `${running.labelA} 님과의 인연 궁합`;
  }
}

/**
 * 지금 어디쯤인가 — 목차에서 움직이는 줄 하나.
 *
 * 한 사람 풀이는 프롬프트가 시킨 절 이름이, 궁합은 「n번째 이야기」가 선다(풀이 화면과 같다). 본문을 다 썼으면 마지막 검토다.
 * 아무 줄도 안 움직였으면 준비 중이다 — 시간으로 앞서 가지 않는다.
 */
export function runningStage(running: Pick<RunningReading, 'target' | 'progress'>): string {
  const titles = isSolo(running.target.kind) ? selfSectionTitlesOf() : null;
  const moving = readingOutline(titles, running.progress).find(
    (row) => row.state === 'writing' || row.state === 'reviewing',
  );
  if (moving === undefined) return READING_PREPARING;
  /* 「마지막 검토 검토 중…」이 되지 않게 — 줄 이름이 이미 「검토」다 */
  if (moving.state === 'reviewing') return `${READING_REVIEW_LABEL} 중…`;
  return `${moving.label} ${READING_OUTLINE_STATE.writing}`;
}

/** 누르면 그 풀이 화면으로 — 다 되면 결과가, 아직이면 같은 목차가 선다. 홈에서 열었으니 ← 는 홈이다 */
export const runningHref = (target: ReadingTarget): string => withFromMe(readingHrefOf(target));

/** 사주풀이를 지금 만드는 중인 저장한 사람들 — 홈의 타일 · `/me/people` 카드가 내 사주 카드와 같은 규칙을 따른다 */
export const makingPeopleOf = (running: readonly Pick<RunningReading, 'target'>[]): ReadonlySet<string> =>
  new Set(running.flatMap((one) => (one.target.kind === 'person' ? [one.target.personId] : [])));

/** 내 사주풀이를 지금 만드는 중인가 — 카드의 단추와 빈 표지가 이 값으로 갈린다 */
export const makingSelf = (running: readonly Pick<RunningReading, 'target'>[]): boolean =>
  running.some((one) => one.target.kind === 'self');
