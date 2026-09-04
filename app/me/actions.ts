'use server';

import { revalidatePath } from 'next/cache';

import { relationOf } from '@/src/lib/people';

import { supabaseOnServer } from '../auth/server-client';
import { missingAnswer, type Query } from '../query';
import { sameChartInMyList, type SameChart } from './same-chart';
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
 * 저장한 사람 하나 — **id 를 함께 낸다.**
 *
 * 「됐다」만 돌려주면 부르는 쪽이 그 사람의 화면으로 갈 수 없다. 목록을 다시 그리는
 * 화면은 이 값을 안 봐도 되므로 `SaveResult` 를 넓히는 대신 갈래를 하나 둔다.
 *
 * **셋째 갈래가 「아직 저장 안 했고 물어봐야 한다」다.** `ok: false` 안에서 `kind` 로
 * 가른다 — 거절과 물음은 화면이 할 일이 다르다(하나는 문장을 세우고 하나는 칸을 연다).
 */
export type PersonSaved =
  | { ok: true; personId: string }
  | { ok: false; kind: 'failed'; message: string }
  | { ok: false; kind: 'same-chart'; same: SameChart };

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
 * 않는다. 저장 자리 한도는 DB 트리거가 들고(`enforce_person_limit`), 그 판정을 여기에도
 * 적으면 세는 규칙이 두 곳이 된다. 그러면 selfPerson 을 세느냐 마느냐가 언젠가 갈린다.
 *
 * 한도에 걸렸을 때 나오는 말은 DB 가 쓴 문장 그대로다 — 사람이 읽을 수 있게 써 뒀다.
 */
export async function addManagedPerson(
  query: Query,
  note: string,
  /**
   * 같은 명식이 있어도 **그대로 저장한다** — 사용자가 「아니다」라고 답했을 때만 참이다.
   *
   * 기본값이 「묻는다」인 것이 요점이다. 「확인했으면 참을 넘겨라」로 두면 호출부 셋 중
   * 하나는 그것을 잊고, 잊은 자리는 조용히 옛 동작으로 돈다 — **호출부가 잊지 않아야
   * 맞는 기본값은 틀린 기본값이다.**
   */
  evenIfSameChart = false,
): Promise<PersonSaved> {
  const missing = missingAnswer(query);
  if (missing !== null) return { ok: false, kind: 'failed', message: missing };

  const unsupported = unsupportedForSaving(query);
  if (unsupported !== null) return { ok: false, kind: 'failed', message: unsupported };

  if (!evenIfSameChart) {
    const same = await sameChartInMyList(query);
    if (same !== null) return { ok: false, kind: 'same-chart', same };
  }

  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc('create_managed_person', managedPersonArgs(query, note));

  if (error) return { ok: false, kind: 'failed', message: error.message };
  /**
   * 0행은 저장이 아니다 — 「했다」로 읽으면 없는 사람의 화면을 열러 간다. 목록만 다시
   * 그리는 화면은 이 값을 안 봐도 되지만, **못 받았다는 사실은 값으로 남는다.**
   */
  if (typeof data !== 'string') {
    return { ok: false, kind: 'failed', message: '저장한 사람을 찾지 못했습니다.' };
  }

  revalidatePath('/me/people');
  return { ok: true, personId: data };
}

/**
 * 직접 입력한 한 사람을 **저장하고 그 사람의 풀이로 넘긴다.**
 *
 * 사주 결과 화면(`/`)은 아무것도 저장하지 않아서 AI 풀이가 없다 — 시도도 잠금도
 * 풀이권도 대상에 거는데(ADR 0013) 걸 대상이 없다. 궁합 쪽과 **같은 길**이고, 다른
 * 것은 저장이 하나뿐이라 한 문으로 묶을 일이 없다는 것이다(ADR 0030).
 *
 * 메모는 안 받는다. 이 입구는 이름과 여덟 글자만 들고 왔고, **묻지 않은 것을 빈 값으로
 * 채워 저장하지 않는다** — 메모는 사람 탭에서 언제든 적을 수 있다.
 */
export async function savePersonForReading(
  query: Query,
  evenIfSameChart = false,
): Promise<PersonSaved> {
  return addManagedPerson(query, '', evenIfSameChart);
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
 * 이 **쌍**이 무슨 사이인지 적는다 — 사람이 아니라 두 사람에 붙는다.
 *
 * 사람 탭에서 묻지 않는다. 그 화면은 그 사람의 사주를 보는 자리이고, 관계가 글을
 * 바꾸는 것은 **궁합을 볼 때**다. 그리고 「나와 그 사람」만 알면 어머니와 친구의
 * 궁합에서는 답이 없다 — 쌍에 붙여야 어느 조합이든 답할 수 있다.
 *
 * 차례는 DB 가 정한다(`least`·`greatest`). 화면이 지으면 그 규칙이 두 자리에 있게 되고,
 * 둘이 갈리는 날 같은 쌍이 두 줄로 남는다.
 *
 * 궁합 결과는 여기서 안 건드린다. 이 값은 다음 생성 요청이 읽을 뿐이고, 지금 서 있는
 * 글은 그것을 만들 때의 자료로 난 것이다(ADR 0013).
 */
export async function setPairRelation(
  personA: string,
  personB: string,
  relation: string | null,
): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('set_pair_relation', {
    p_person_a: personA,
    p_person_b: personB,
    // 모르는 값은 모르는 채로 넘긴다 — 서버 액션은 주소만 알면 아무 값이나 온다.
    p_relation: relationOf(relation),
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath('/me/compat');
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
 * 고친 출생 정보를 새 판본으로 쌓는다.
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
   * 내 사주가 아니면 RPC 가 스스로 아무 일도 하지 않는다 — 그래서 앱은 안 묻는다.
   */
  const self = await selfElementSummary();
  /*
    **「내 사주인가」를 여기서 묻지 않는다.**

    `self.personId === personId` 로 걸렀었다. `refresh_discovery_summary` 가 이미 같은
    질문에 답하는데(`self_person is distinct from p_person_id`) 앱이 한 번 더 판정한
    것이고, 둘 중 **나쁜 쪽이 먼저 답하고** 있었다 — 저쪽은 `uuid` 비교라 대소문자를
    안 가리고 이쪽은 문자열 비교라 가린다. 대문자로 적힌 id 가 오면 이 줄이 거짓이 되어
    요약 갱신이 조용히 빠지고, 사용자는 참여 중이라고 아는 채 아무에게도 안 보이게 된다.

    요약을 만들 재료가 있는지만 보고 넘긴다. 판정은 한 자리에서 한다.
  */
  if (self !== null) {
    const { error: summaryError } = await supabase.rpc('refresh_discovery_summary', {
      p_person_id: personId,
      p_summary: self.summary,
    });
    // 저장은 끝났다. 요약을 못 따라가게 한 것은 홈이 목록을 열 때 고친다.
    if (summaryError) console.error('오행 요약을 갱신하지 못했습니다', summaryError.message);
  }

  revalidatePath('/me');
  revalidatePath('/me/people');
  return { ok: true };
}

/**
 * 선택 동의 하나를 바꾼다.
 *
 * **어느 값인지를 인자로 받되 문을 나눠 부른다.** 하나의 RPC 로 합치면 한쪽만 바꾸려는
 * 화면이 다른 쪽 값을 다시 적어 넣어야 하고, 그때 그 값을 어디서 읽어 왔는지가 또 한
 * 자리가 된다 — 두 화면이 서로 다른 답을 적는 자리는 그렇게 생긴다.
 *
 * 철회하면 개선 활용 쪽은 남긴 답까지 지운다. 그 규칙은 DB 에 있다(ADR 0022).
 */
export async function setOptionalConsent(
  key: 'improvement' | 'contact',
  consent: boolean,
): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc(
    key === 'improvement' ? 'set_improvement_consent' : 'set_contact_consent',
    { p_consent: consent },
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath('/me/settings');
  revalidatePath('/me');
  return { ok: true };
}
