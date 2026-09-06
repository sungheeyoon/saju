import { accountStateOf, type AccountState } from '@/src/lib/account';

import type { supabaseOnServer } from '../auth/server-client';

type ServerClient = Awaited<ReturnType<typeof supabaseOnServer>>;

/**
 * 온보딩까지 묻는 화면이 읽는 두 칸 — 일곱 화면이 이 글자를 똑같이 적고 있었다.
 */
export const ACCOUNT_COLUMNS = 'status, self_person_id';

/** 표에서 오는 모양 — 여기서만 DB 의 이름을 쓴다 */
type AccountRow = {
  readonly status: string;
  readonly self_person_id?: string | null;
};

/**
 * 계정을 읽고 **어디에 서 있는지까지 답한다**(ADR 0048).
 *
 * ## 왜 화면이 직접 안 읽는가
 *
 * 아홉 화면이 저마다 읽고 저마다 갈랐고, **같은 답을 하지 않았다.** 계정을 못 읽었을 때
 * 셋은 정상 화면을 그렸고 하나는 「중지된 계정입니다」를 세웠다 — `app_user` 의 select
 * 정책은 `status` 를 안 보므로 그 말은 참일 수가 없다.
 *
 * 판정을 옮기는 것이 아니다. 판정은 `accountStateOf` 가 순수 함수로 하고 여기서는
 * **읽어서 넘길 뿐이다.** `gateFor` 와 `proxy.ts` 가 나뉜 것과 같은 까닭이다 — 규칙을
 * 브라우저 없이 전부 밟을 수 있어야 한다.
 *
 * ## 열을 화면이 고른다
 *
 * 설정은 동의 칸을, 프로필은 이름과 소개를 함께 읽는다. 그 화면들은 `self_person_id` 를
 * 안 읽으므로 `onboarding` 이 나오지 않는다 — 안 물었으니 안 나오는 것이 맞다.
 * 돌려주는 `row` 는 넘긴 열 그대로라, 화면이 자기가 청한 칸을 그대로 쓴다.
 *
 * ## `error` 를 보는 자리
 *
 * 열넷 중 열셋이 안 봤다. `maybeSingle()` 은 0행일 때도 터졌을 때도 `data: null` 로
 * 오므로, 둘을 가르는 유일한 값이 `error` 다. 한 자리로 모으는 지금이 그것을 처음
 * 보는 자리이고, 한 번만 적으면 된다.
 */
export async function readAccount<T extends AccountRow = AccountRow>(
  supabase: ServerClient,
  columns: string = ACCOUNT_COLUMNS,
): Promise<{ readonly state: AccountState; readonly row: T | null }> {
  const { data, error } = await supabase.from('app_user').select(columns).maybeSingle();

  if (error !== null) {
    return { state: accountStateOf({ ok: false, reason: 'unreachable' }), row: null };
  }
  if (data === null) {
    return { state: accountStateOf({ ok: false, reason: 'missing' }), row: null };
  }

  const row = data as unknown as T;
  return {
    state: accountStateOf({
      ok: true,
      account: { status: row.status, selfPersonId: row.self_person_id },
    }),
    row,
  };
}
