import { READING_KINDS } from '@/src/lib/reading';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';
import type { RunProgress } from '../reading/current';
import type { ReadingTarget } from '../reading/target';

/**
 * **만드는 중인 풀이가 홈으로 내려가는 문**(ADR 0157).
 *
 * 내가 연 시도 가운데 아직 도는 것 — 대상 · 부를 이름 · 서버가 적은 진행(ADR 0127)뿐이다. 글도 실패 이유도 없다. 무엇이 「도는
 * 것」인가(만료 시각 · 좁힘)는 DB 가 정한다(`my_running_readings`). 여기서 다시 거르면 판정하는 자리가 둘이 된다.
 */
export type RunningReading = {
  readonly target: ReadingTarget;
  /** `self` 는 `null`. 인연 궁합은 상대의 공개 별명, 나머지는 내가 부르는 이름이다 */
  readonly labelA: string | null;
  /** 두 사람 궁합의 뒷사람만 */
  readonly labelB: string | null;
  readonly createdAt: string;
  readonly progress: RunProgress;
};

/**
 * 지금 만드는 중인 내 풀이 — 최근 것이 앞이다.
 *
 * **부속 정보다**(ADR 0078). 못 읽으면 홈은 그 줄을 안 세우고 나머지는 그대로 선다 — 단추는 「받기」로 돌아간다. 이 문이 없는
 * 옛 DB 에서도 같다(`PGRST202` 도 못 읽음이다) — 앱이 DB 보다 먼저 나가도 홈이 서야 한다.
 */
export async function runningReadings(): Promise<SkippableRead<readonly RunningReading[]>> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_running_readings');
  if (error) return unread(error, 'my_running_readings');

  return read(
    (data ?? []).flatMap((row) => {
      const target = targetOf(row.kind, row.person_a, row.person_b, row.match_id);
      if (target === null) return [];
      return [
        {
          target,
          labelA: row.label_a ?? null,
          labelB: row.label_b ?? null,
          createdAt: row.created_at,
          progress: {
            jobStatus: row.job_status ?? null,
            sectionsBegun: row.sections_begun ?? 0,
            bodyWritten: row.body_written ?? false,
          },
        },
      ];
    }),
  );
}

/** DB 의 평평한 네 칸을 대상으로 — 모르는 kind 나 빈 칸은 그리지 않는다(가는 길이 없는 줄을 세우지 않는다) */
function targetOf(
  kind: string,
  personA: string | null,
  personB: string | null,
  matchId: string | null,
): ReadingTarget | null {
  switch (READING_KINDS.find((known) => known === kind)) {
    case 'self':
      return { kind: 'self' };
    case 'person':
      return personA === null ? null : { kind: 'person', personId: personA };
    case 'private':
      return personA === null || personB === null ? null : { kind: 'private', personA, personB };
    case 'match':
      return matchId === null ? null : { kind: 'match', matchId };
    case undefined:
      return null;
  }
}
