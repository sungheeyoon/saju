import { supabaseOnServer } from '../../auth/server-client';
import { selfElementSummary } from '../summary';

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
 * 문이 **둘**이다 — 홈과 매칭(`/me/matching`). 매칭만 보고 홈에 안 들르는 사람이 그 문을
 * 한 번도 안 지나기 때문이고, 같은 RPC 라 두 번 불려도 한 번만 연다.
 */
export async function openDiscoveryParticipation(): Promise<void> {
  const supabase = await supabaseOnServer();

  /*
    **묻는 것이 「켰는가」에서 「껐는가」로 바뀌었다**(PRD §4.1). 참여가 기본으로 켜지면서
    안 켠 사람이라는 상태가 없어졌다. 남은 것은 직접 끈 사람이고, 그 하나만 안 연다.
  */
  const { data: profile } = await supabase
    .from('discovery_profile')
    .select('opted_out_at')
    .maybeSingle();
  if (profile?.opted_out_at != null) return;

  const self = await selfElementSummary();
  if (self === null) return;

  await supabase.rpc('ensure_discovery_participation', {
    p_person_id: self.personId,
    p_summary: self.summary,
  });
}
