import { rpcArgs } from '@/src/lib/db';

import type { supabaseOnServer } from '../auth/server-client';

/**
 * 운영자 화면의 문이 받은 거절을 접속기록에 적는다 (G-23 ⑩ · ADR 0105).
 *
 * 운영자 문은 거절하며 `42501` 을 던지고, 던진 트랜잭션에 적은 줄은 되감긴다. 그래서 거절을 받은 뒤 제
 * 트랜잭션에서 따로 적는다(`note_operator_denial`). 두 번째 요소를 안 지나 운영자 문을 부르지 않은 거절도 같은 줄로
 * 적는다(ADR 0123). 적지 못해도 화면은 404 그대로다 — 거절을 적는 일이 거절의 답을 바꾸지 않는다. 못 적은 것은
 * 기록으로만 남긴다.
 *
 * 동작 이름은 화면의 머리 문이다 — 한 화면이 문 여럿을 불러도 거절은 한 줄이다(신고 상세는 `reports.detail`, 설문은
 * `survey.overview`). DB 가 받는 이름은 `note_operator_denial` 의 목록 하나가 든다.
 */
export type DeniedAction = 'reports.list' | 'reports.detail' | 'survey.overview';

export async function noteDenial(
  supabase: Awaited<ReturnType<typeof supabaseOnServer>>,
  action: DeniedAction,
  reportId: string | null = null,
): Promise<void> {
  const { error } = await supabase.rpc(
    'note_operator_denial',
    rpcArgs<'note_operator_denial'>({ p_action: action, p_report_id: reportId ?? undefined }),
  );
  if (error) console.error('note_operator_denial', error);
}
