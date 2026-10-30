import { READING_OUTLINE_STATE, READING_REVIEW_LABEL } from './notes';
import { readingOutline } from './outline';
import { isSolo, type ReadingKind } from './policy';
import type { RunProgress } from './run';

/**
 * 한 사람 풀이의 절 이름 — 홈의 「어디쯤」 줄이 프롬프트 원문 없이 읽는 **이름만의 사본**이다. 프롬프트 모듈은 브라우저 · 앱으로 안 간다
 * (`scripts/layers.test.ts`). 절을 고치면 `running-stage.test.ts` 가 `selfSectionTitlesOf()` 와 견주어 붉어진다.
 */
export const SELF_SECTION_TITLES: readonly string[] = [
  '먼저 볼 핵심 세 가지',
  '이 사주의 핵심',
  '성격과 속마음',
  '강점과 타고난 복',
  '일과 돈',
  '연애와 인간관계',
  '귀인과 기회',
  '조심할 점과 몸',
  '앞으로의 흐름',
];

/** 첫 머리가 서기 전 — 서버가 아직 아무 절도 적지 않았다. 확정(대장 15) */
export const READING_PREPARING = '준비 중…';

/**
 * 지금 어디쯤인가 — 목차에서 움직이는 줄 하나(ADR 0157).
 *
 * 한 사람 풀이는 프롬프트가 시킨 절 이름이, 궁합은 「n번째 이야기」가 선다(풀이 화면과 같다). 본문을 다 썼으면 마지막 검토다.
 * 아무 줄도 안 움직였으면 준비 중이다 — 시간으로 앞서 가지 않는다.
 */
export function runningStageOf(kind: ReadingKind, progress: RunProgress | null): string {
  const moving = readingOutline(isSolo(kind) ? SELF_SECTION_TITLES : null, progress).find(
    (row) => row.state === 'writing' || row.state === 'reviewing',
  );
  if (moving === undefined) return READING_PREPARING;
  /* 「마지막 검토 검토 중…」이 되지 않게 — 줄 이름이 이미 「검토」다 */
  if (moving.state === 'reviewing') return `${READING_REVIEW_LABEL} 중…`;
  return `${moving.label} ${READING_OUTLINE_STATE.writing}`;
}
