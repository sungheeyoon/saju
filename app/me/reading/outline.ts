import { READING_REVIEW_LABEL, readingStoryLabel } from '@/src/lib/reading/notes';

import type { RunProgress } from './current';

/**
 * **기다리는 화면의 목차** — 줄마다 서버가 적은 진행 그대로(ADR 0127).
 *
 * 시간으로 단계를 짓지 않는다. 들어오는 값은 셋뿐이다 — 얼린 작업의 상태, 시작한 절의 수, 본문을 다 썼는가
 * (`my_last_reading_run`). 셋이 안 오면(옛 DB · 끝난 시도) 아무 줄도 앞서 가지 않는다.
 *
 * - **절 k 를 시작했으면** 앞의 k−1 절이 완료이고 k 번째가 작성 중이다 — 다음 머리가 서야 앞 절이 끝난 것이다.
 * - **본문을 다 썼거나 결과를 가져가는 중이면**(`retrieving`) 절은 다 완료이고 마지막 검토가 검토 중이다.
 * - **검토가 끝나면** 시도가 닫히고 화면이 결과로 다시 읽힌다 — 그래서 이 목차에 「검토 완료」 줄은 안 선다.
 *
 * 자기 풀이 · 다른 사람 풀이는 프롬프트가 시킨 절 이름이 줄이 된다 — 서버가 `selfSectionTitlesOf` 로 지어 넘긴다
 * (프롬프트 모듈은 브라우저로 안 간다, `scripts/layers.test.ts`). 두 궁합은 소제목을 모델이 정하므로 `null` 이 오고,
 * 시작한 만큼만 「n번째 이야기」로 선다 — 몇 개가 될지 모르는 줄을 미리 세우지 않는다.
 * 모델이 시킨 것보다 소제목을 더 달면 마지막 줄에 머문다(앞서 가지 않는다).
 */
export type OutlineState = 'done' | 'writing' | 'reviewing' | 'waiting';

export type OutlineRow = { readonly label: string; readonly state: OutlineState };

export function readingOutline(
  /** 프롬프트가 시킨 절 이름 — 이름을 미리 모르는 궁합이면 `null` */
  titles: readonly string[] | null,
  progress: RunProgress | null,
): readonly OutlineRow[] {
  const begun = Math.max(progress?.sectionsBegun ?? 0, 0);
  const bodyDone = progress !== null && (progress.bodyWritten || progress.jobStatus === 'retrieving');

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
