import { READING_REVIEW_LABEL, readingStoryLabel } from '@/src/lib/reading/notes';

import type { RunProgress } from './current';

/**
 * **기다리는 화면의 목차** — 줄마다 서버가 적은 진행 그대로(ADR 0127).
 *
 * 시간으로 단계를 짓지 않는다. 들어오는 값은 셋뿐이다 — 얼린 작업의 상태, 시작한 절의 수, 본문을 다 썼는가
 * (`my_last_reading_run`). 셋이 안 오면(옛 DB · 끝난 시도) 아무 줄도 앞서 가지 않는다.
 *
 * - **절 k 를 시작했으면** 앞의 k−1 절이 완료이고 k 번째가 작성 중이다 — 다음 머리가 서야 앞 절이 끝난 것이다.
 * - **본문을 다 썼으면** 절은 다 완료이고 마지막 검토가 검토 중이다. 작업의 `retrieving` 은 그 근거가 아니다 — 복구기가
 *   1분마다 도는 작업을 집어 그 표시를 달고, 아직 쓰는 중이면 `submitted` 로 놓는다(`release_reading_job`). 그 표시로
 *   끝을 읽으면 목차가 끝까지 갔다가 쓰던 절로 되돌아간다(ADR 0127 「2026-10-10 덧」).
 * - **검토가 끝나면** 시도가 닫히고 화면이 결과로 다시 읽힌다 — 그래서 이 목차에 「검토 완료」 줄은 안 선다.
 *
 * 자기 풀이 · 다른 사람 풀이는 프롬프트가 시킨 절 이름이 줄이 된다 — 서버가 `selfSectionTitlesOf` 로 지어 넘긴다
 * (프롬프트 모듈은 브라우저로 안 간다, `scripts/layers.test.ts`). 두 궁합은 소제목을 모델이 정하므로 `null` 이 오고,
 * 시작한 만큼만 「n번째 이야기」로 선다 — 몇 개가 될지 모르는 줄을 미리 세우지 않는다.
 * 모델이 시킨 것보다 소제목을 더 달면 마지막 줄에 머문다(앞서 가지 않는다).
 */
type OutlineState = 'done' | 'writing' | 'reviewing' | 'waiting';

export type OutlineRow = { readonly label: string; readonly state: OutlineState };

export function readingOutline(
  /** 프롬프트가 시킨 절 이름 — 이름을 미리 모르는 궁합이면 `null` */
  titles: readonly string[] | null,
  progress: RunProgress | null,
): readonly OutlineRow[] {
  const begun = Math.max(progress?.sectionsBegun ?? 0, 0);
  const bodyDone = progress?.bodyWritten === true;

  const labels =
    titles !== null
      ? titles
      : Array.from({ length: Math.max(begun, 1) }, (_, at) => readingStoryLabel(at + 1));

  /** 작성 중인 줄 — 시킨 것보다 많이 달면 마지막 줄에 머문다 */
  const current = Math.min(begun, labels.length) - 1;

  const sections = labels.map((label, at): OutlineRow => {
    if (bodyDone) return { label, state: 'done' };
    if (begun === 0) return { label, state: 'waiting' };
    if (at < current) return { label, state: 'done' };
    if (at === current) return { label, state: 'writing' };
    return { label, state: 'waiting' };
  });

  return [...sections, { label: READING_REVIEW_LABEL, state: bodyDone ? 'reviewing' : 'waiting' }];
}

/**
 * **물을 때마다 받은 진행을 지나온 값에 접는다** — 한 번 앞선 줄은 뒤로 가지 않는다(ADR 0127 「2026-10-10 덧」).
 *
 * 서버가 적는 두 값은 한 시도 안에서 올라가기만 하지만(`note_reading_progress`), 화면이 받는 답은 그렇지 않다. 시도가 닫히면
 * 얼린 작업이 지워져 진행이 `null` 로 오고(결과가 화면에 서기 전 사이), 가리킬 시도가 없다는 답도 `null` 이다. 그 답으로
 * 갈아 끼우면 다 된 목차가 「대기」로 비었다. 새 시도는 부르는 칸이 `null` 에서 다시 시작한다.
 */
export function progressSoFar(before: RunProgress | null, seen: RunProgress | null): RunProgress | null {
  if (seen === null) return before;
  if (before === null) return seen;
  return {
    jobStatus: seen.jobStatus,
    sectionsBegun: Math.max(before.sectionsBegun, seen.sectionsBegun),
    bodyWritten: before.bodyWritten || seen.bodyWritten,
  };
}
