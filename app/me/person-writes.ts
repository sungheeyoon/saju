import { missingAnswer, type Query } from '@/src/lib/input/query';
import { unsupportedForSaving } from '@/src/lib/input/edit';

import { userFacingDbMessage } from '../db-error';
import type { SaveResult } from '../save-result';
import { createSelfPerson, editPersonInput, type ChartWriter } from './keyed-chart-writes';

/**
 * **내 사람을 저장 · 수정하는 몸통** — 웹의 액션(`actions.ts`)과 앱의 문(`app/api/mobile`, ADR 0211)이 같은 입력 판정과 같은 열쇠 문을 탄다.
 * 다른 것은 세션을 묻는 길(`ChartWriter`)과, 웹만 하는 화면 무르기다.
 */

/** 켜려는데 내 사주를 못 세웠다 — 매칭 참여의 답 */
export const PARTICIPATION_NO_SELF_NOTE = '내 사주를 불러오지 못했어요. 홈 탭에 내 사주 카드가 보이는지 확인하고 다시 시도해 주세요.';

const refusalOf = (query: Query): string | null => missingAnswer(query) ?? unsupportedForSaving(query);

export async function saveSelfPersonAs(writer: ChartWriter, query: Query): Promise<SaveResult> {
  const refused = refusalOf(query);
  if (refused !== null) return { ok: false, message: refused };

  /* 여덟 글자는 열쇠 모듈이 이 입력에서 세고, 사람은 세션에서 얻는다(G-64, ADR 0136) */
  const { error } = await createSelfPerson(writer, query);

  /**
   * 「이미 등록했다」(`23505`)는 실패가 아니라 상태다. 두 번 눌렸거나 뒤로 갔다 다시 왔을 때 나온다. RPC 가 조용히 덮어쓰지 않고
   * 거절하도록 만들어 뒀으므로(첫 번째가 어디로 갔는지 모르게 되니까), 화면은 저장된 것을 보여주면 된다.
   */
  if (error && error.code !== '23505') return { ok: false, message: userFacingDbMessage(error, 'create_self_person') };
  return { ok: true };
}

export async function editPersonInputAs(writer: ChartWriter, personId: string, query: Query): Promise<SaveResult> {
  const refused = refusalOf(query);
  if (refused !== null) return { ok: false, message: refused };

  // 정책이 자기 행만 열어 주므로 `user_id` 를 적지 않는다.
  const { error: labelError } = await writer.client
    .from('user_person_access')
    .update({ local_label: query.name.trim() })
    .eq('person_id', personId);
  if (labelError) return { ok: false, message: userFacingDbMessage(labelError, 'user_person_access.label') };

  /**
   * 입력을 덮어쓰고, 내 사람이면 **매칭 풀에 내놓은 오행 요약도 따라간다** — 둘 다 열쇠 모듈이 한다(G-64, ADR 0136).
   *
   * 낡은 요약은 후보 질의가 이미 걸러낸다. 그래도 따라가게 하는 것은 그 탈락이 **조용하기** 때문이다 — 사용자는
   * 참여 중이라고 알고 있는데 아무에게도 안 보이게 된다. 「내 사주인가」는 앱이 안 묻는다 — `ensure_discovery_participation`
   * 이 `uuid` 로 견준다(문자열 비교는 대소문자를 가려, 대문자 id 에서 요약 갱신이 조용히 빠졌었다).
   * 참여가 기본으로 켜진 뒤로 그 호출은 참여를 열기도 한다. 끈 사람은 그대로 쉰다(`opted_out_at`).
   */
  const { error } = await editPersonInput(writer, personId, query);
  if (error) return { ok: false, message: userFacingDbMessage(error, 'edit_person_input') };
  return { ok: true };
}
