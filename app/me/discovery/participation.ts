import type { DiscoveryProfile } from '@/src/lib/discovery';
import type { StoredChartResult } from '@/src/lib/input/stored';

import type { supabaseOnServer } from '../../auth/server-client';
import type { SkippableRead } from '../../db-error';
import { selfSummaryOf, type SelfSummary } from '../summary';

type ServerClient = Awaited<ReturnType<typeof supabaseOnServer>>;

/**
 * 참여가 열리는 문 — **화면이 아니라 문이다.**
 *
 * 이 일은 `board.tsx` 의 `DiscoveryBoard` 안에 있었다. 홈의 후보 목록을 그리면서 겸사겸사
 * 참여를 열던 자리다(ADR 0037: 「문은 하나다 — 홈이 목록을 여는 자리」).
 *
 * **그 목록이 2026-09-18 에 매칭으로 옮겨 갔다**(ADR 0070). 홈은 그 뒤로 `participationOnly`
 * 로만 그 컴포넌트를 불렀고, 그 가지는 후보 카드 앞에서 `null` 로 끝난다 — **아무것도
 * 안 그리는 컴포넌트**가 300줄짜리 목록 코드를 들고 서 있었다. 재어 보면 그 안의
 * `Candidates`·`Empty`·`Resting`·`HideButton`·`PreviewScorePanel` 에 닿는 길이 없다.
 *
 * 그래서 이름을 하는 일로 바꿨다. **문은 남는다** — 걷으면 아무도 참여가 안 열려 후보가
 * 한 명도 안 선다. 실제로 한 번 그랬다.
 *
 * ## 여기서 판정하지 않는다
 *
 * 켤 자격인지(사주가 있는가·이름이 있는가), 껐던 사람인지는 RPC 가 묻는다
 * (`ensure_discovery_participation` 의 `opted_out_at`). 앱이 하는 일은 **요약을 넣는
 * 것**뿐이다 — 절기·자시·경도 판정이 엔진에 있어서 DB 가 요약을 못 만든다.
 *
 * 쉬는 사람을 여기서 한 번 더 거르는 것은 판정이 아니라 **안 물어도 되는 것을 안 묻는
 * 일**이다. 그 줄을 지워도 RPC 가 같은 답을 낸다.
 *
 * 참여를 여는 문(`ensure_discovery_participation`)은 **셋**이다 — 홈(이 함수), 매칭
 * (`/me/matching`), 그리고 입력을 고친 뒤(`editPersonInput`). 매칭만 보고 홈에 안 들르는
 * 사람이 홈의 문을 한 번도 안 지나기 때문이고, 같은 RPC 라 여러 번 불려도 한 번만 연다.
 */
export async function openDiscoveryParticipation(
  supabase: ServerClient,
  profile: SkippableRead<DiscoveryProfile | null>,
  selfPersonId: string,
  stood: StoredChartResult | null,
): Promise<void> {
  /*
    **묻는 것이 「켰는가」에서 「껐는가」로 바뀌었다**(PRD 「추천은 여섯 자리 덱이다」). 참여가 기본으로 켜지면서
    안 켠 사람이라는 상태가 없어졌다. 남은 것은 직접 끈 사람이고, 그 하나만 안 연다.

    **읽지 않고 받는다**(2026-09-30). 홈이 참여 설정 · 내 입력 · 내 이름을 제 화면과 한 물결에 읽어 넘긴다 — 여기서 따로
    읽던 동안(참여 설정 → 계정 → 입력 · 이름 → 문) 이 줄이 나 탭의 가장 긴 차례였다.
  */
  if (profile.ok && profile.value?.optedOut) return;

  // 홈을 열며 곁들이는 일이다. 요약을 못 세웠으면 이번에는 안 열고 넘어간다 — 홈을 오류로 세우지 않는다
  let self: SelfSummary | null = null;
  try {
    self = stood === null ? null : selfSummaryOf(selfPersonId, stood);
  } catch {
    self = null;
  }
  if (self === null) return;

  /*
    홈을 오류로 세우지 않는 것은 그대로다 — 다만 조용히 버리지 않는다. 못 열면 매칭(`/me/matching`)이 같은 RPC 를
    다시 부르고 그쪽은 던진다. 여기서는 기록에만 남긴다.
  */
  const { error } = await supabase.rpc('ensure_discovery_participation', {
    p_person_id: self.personId,
    p_summary: self.summary,
    p_need: self.need,
  });
  if (error) console.error('ensure_discovery_participation (home)', error);
}
