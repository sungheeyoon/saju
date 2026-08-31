'use server';

import { revalidatePath } from 'next/cache';

import { relationOf } from '@/src/lib/people';

import { supabaseOnServer } from '../auth/server-client';
import { missingAnswer, type Query } from '../query';
import { selfElementSummary } from './summary';
import {
  managedPersonArgs,
  noteOrNull,
  revisionArgs,
  selfPersonArgs,
  unsupportedForSaving,
} from '../revision';

export type SaveResult = { ok: true } | { ok: false; message: string };

/**
 * 자기 사주를 저장한다.
 *
 * **여기서 권한을 판정하지 않는다.** 서버 액션은 주소가 알려지면 누구나 부를 수 있는
 * 자리이지만, 판정은 RPC 안에 있다 — 로그인했는가, 계정이 살아 있는가, 이미 등록했는가.
 * 그 셋을 여기서 다시 물으면 답하는 자리가 둘이 되고, 둘은 언젠가 어긋난다. 그리고
 * 어긋났을 때 열려 있는 쪽은 언제나 더 바깥이다.
 *
 * 여기서 보는 것은 **모양**뿐이다. 사람이 읽을 수 있는 말로 돌려주려는 것이고,
 * 그마저도 DB 가 한 번 더 본다.
 */
export async function saveSelfPerson(query: Query): Promise<SaveResult> {
  const missing = missingAnswer(query);
  if (missing !== null) return { ok: false, message: missing };

  const unsupported = unsupportedForSaving(query);
  if (unsupported !== null) return { ok: false, message: unsupported };

  const supabase = await supabaseOnServer();
  const { error } = await supabase.rpc('create_self_person', selfPersonArgs(query));

  if (error) {
    /**
     * 「이미 등록했다」는 실패가 아니라 상태다.
     *
     * 두 번 눌렸거나 뒤로 갔다 다시 왔을 때 나온다. RPC 가 조용히 덮어쓰지 않고
     * 거절하도록 만들어 뒀으므로(첫 번째가 어디로 갔는지 모르게 되니까), 화면은
     * 그냥 새로 그려서 저장된 것을 보여주면 된다.
     */
    if (error.code === '23505') {
      revalidatePath('/me');
      return { ok: true };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath('/me');
  return { ok: true };
}

/**
 * 가족·친구 한 사람을 등록한다.
 *
 * 자기 사주 저장과 **모양이 같고 판정하는 자리도 같다** — 여기서 권한도 한도도 묻지
 * 않는다. 스무 명 한도는 DB 트리거가 들고(`enforce_person_limit`), 그 판정을 여기에도
 * 적으면 세는 규칙이 두 곳이 된다. 그러면 selfPerson 을 세느냐 마느냐가 언젠가 갈린다.
 *
 * 한도에 걸렸을 때 나오는 말은 DB 가 쓴 문장 그대로다 — 사람이 읽을 수 있게 써 뒀다.
 */
export async function addManagedPerson(
  query: Query,
  note: string,
  relation: string | null,
): Promise<SaveResult> {
  const missing = missingAnswer(query);
  if (missing !== null) return { ok: false, message: missing };

  const unsupported = unsupportedForSaving(query);
  if (unsupported !== null) return { ok: false, message: unsupported };

  const supabase = await supabaseOnServer();
  /**
   * **모르는 값은 모르는 채로 넘긴다.** 화면이 보낸 글자를 그대로 싣지 않는 것은
   * 이 자리가 서버 액션이라 주소만 알면 아무 값이나 올 수 있기 때문이다. 검사식이
   * DB 에도 있지만, 거기서 걸리면 사용자가 읽는 것은 제약 이름이다.
   */
  const { error } = await supabase.rpc(
    'create_managed_person',
    managedPersonArgs(query, note, relationOf(relation)),
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath('/me/people');
  return { ok: true };
}

/**
 * 메모만 고친다.
 *
 * RPC 가 없다. 엣지의 `note` 는 정책이 이미 열어 준 칸이고(`"내 라벨만 고친다"`),
 * 열려 있는 것을 다시 함수로 감싸면 판정하는 자리가 둘이 된다. 여덟 글자를 바꾸지
 * 않으므로 판본도 되지 않는다.
 */
export async function updateNote(personId: string, note: string): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  // 정책이 자기 행만 열어 주므로 `user_id` 를 적지 않는다.
  const { error } = await supabase
    .from('user_person_access')
    .update({ note: noteOrNull(note) })
    .eq('person_id', personId);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/me/people');
  return { ok: true };
}

/**
 * 무슨 사이인지 고쳐 적는다.
 *
 * `note` 와 같은 문이다 — 정책이 이미 열어 준 칸이라 RPC 로 감싸지 않는다. 잘못
 * 고른 것을 못 고치면 사람을 지웠다 다시 등록하게 되고, **그러면 그 사람의 판본
 * 이력이 고르기 실수 때문에 사라진다.**
 *
 * 궁합 결과는 여기서 안 건드린다. 이 값은 다음 생성 요청이 읽을 뿐이고, 지금 서 있는
 * 글은 그것을 만들 때의 자료로 난 것이다(ADR 0013).
 */
export async function updateRelation(
  personId: string,
  relation: string | null,
): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase
    .from('user_person_access')
    .update({ relation: relationOf(relation) })
    .eq('person_id', personId);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/me/people');
  return { ok: true };
}

/**
 * 목록에서 뺀다 — **지우는 것은 엣지이지 Person 이 아니다.**
 *
 * 「이 사람을 내가 관리한다」는 근거를 거두는 일이라, 그 근거가 사라지면 RLS 가 그
 * Person 을 더는 안 보여준다. selfPerson 은 빠지지 않는다 — 그 판정도 정책이 든다
 * (`"자기 자신은 목록에서 지울 수 없다"`). 여기서 다시 묻지 않는 이유는 늘 같다.
 */
export async function removeFromList(personId: string): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.from('user_person_access').delete().eq('person_id', personId);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/me/people');
  return { ok: true };
}

/**
 * 고친 출생정보를 새 판본으로 쌓는다.
 *
 * 두 가지가 함께 일어나지만 **같은 종류가 아니다.**
 *
 * - 부를 이름은 엣지를 고친다. 여덟 글자를 바꾸지 않으므로 판본이 되지 않는다.
 * - 나머지는 판본을 쌓는다. 하나라도 다르면 새것이고, 다 같으면 아무것도 안 쌓인다.
 *
 * 아무것도 안 쌓였는지는 DB 가 정한다(`add_person_revision` 이 지문으로 판정한다).
 * 여기서 미리 걸러 보내지 않는 이유는, 화면이 든 「지금 값」이 그 사이에 다른 기기에서
 * 바뀌었을 수 있기 때문이다 — 판정은 값을 들고 있는 쪽이 한다.
 */
export async function revisePerson(personId: string, query: Query): Promise<SaveResult> {
  const missing = missingAnswer(query);
  if (missing !== null) return { ok: false, message: missing };

  const unsupported = unsupportedForSaving(query);
  if (unsupported !== null) return { ok: false, message: unsupported };

  const supabase = await supabaseOnServer();

  // 정책이 자기 행만 열어 주므로 `user_id` 를 적지 않는다.
  const { error: labelError } = await supabase
    .from('user_person_access')
    .update({ local_label: query.name.trim() })
    .eq('person_id', personId);
  if (labelError) return { ok: false, message: labelError.message };

  const { error } = await supabase.rpc('add_person_revision', revisionArgs(personId, query));
  if (error) return { ok: false, message: error.message };

  /**
   * 판본이 바뀌었으면 **매칭 풀에 내놓은 오행 요약도 따라간다.**
   *
   * 낡은 요약은 후보 질의가 이미 걸러낸다. 그래도 여기서 따라가게 하는 것은 그 탈락이
   * **조용하기** 때문이다 — 사용자는 참여 중이라고 알고 있는데 아무에게도 안 보이게 된다.
   * 내 사주가 아니면 RPC 가 스스로 아무 일도 하지 않는다.
   */
  const self = await selfElementSummary();
  if (self !== null && self.personId === personId) {
    const { error: summaryError } = await supabase.rpc('refresh_discovery_summary', {
      p_person_id: personId,
      p_summary: self.summary,
    });
    // 저장은 끝났다. 요약을 못 따라가게 한 것은 다음 후보 화면이 고친다.
    if (summaryError) console.error('오행 요약을 갱신하지 못했습니다', summaryError.message);
  }

  revalidatePath('/me');
  revalidatePath('/me/people');
  revalidatePath('/me/discovery');
  return { ok: true };
}
