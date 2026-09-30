import { accountStateOf, type AccountState } from '@/src/lib/account';
import type { Database } from '@/src/lib/db';

import type { supabaseOnServer } from '../auth/server-client';
import { recordDbFailure } from '../db-error';

type ServerClient = Awaited<ReturnType<typeof supabaseOnServer>>;

/** 표의 한 행 — 생성된 `Database` 가 말하는 그대로 */
type AppUserRow = Database['public']['Tables']['app_user']['Row'];

/** 화면이 청할 수 있는 칸 */
type AccountColumn = keyof AppUserRow;

/**
 * 청하는 칸의 목록 — **`status` 가 언제나 첫 칸이다.** 어디에 서 있는지(`accountStateOf`)를 그 칸으로 답한다.
 *
 * 전에는 칸을 글자(`'status, nickname'`)로 받고 돌려줄 모양(`T`)을 화면이 따로 적었다. 둘을 잇는 것이 없어서
 * 화면이 청하지 않은 칸을 `T` 에 적어도, 칸 이름을 틀리게 적어도 컴파일이 됐다(2026-09-28 밤샘 감사의 구조 줄 —
 * `readAccount<T>(string)`). 이제 목록이 곧 모양이다 — `Pick<AppUserRow, …>` 가 목록에서 나온다.
 */
type AccountColumns<K extends AccountColumn> = readonly ['status', ...K[]];

/**
 * 온보딩까지 묻는 화면이 읽는 두 칸 — 일곱 화면이 이 글자를 똑같이 적고 있었다.
 */
const ACCOUNT_COLUMNS: AccountColumns<'self_person_id'> = ['status', 'self_person_id'];

/** 청한 칸의 행 */
type AccountRow<K extends AccountColumn> = Pick<AppUserRow, 'status' | K>;

type AccountRead<K extends AccountColumn> = { readonly state: AccountState; readonly row: AccountRow<K> | null };

/**
 * 계정을 읽고 **어디에 서 있는지까지 답한다**(ADR 0048).
 *
 * ## 왜 화면이 직접 안 읽는가
 *
 * 아홉 화면이 저마다 읽고 저마다 갈랐고, **같은 답을 하지 않았다.** 계정을 못 읽었을 때
 * 셋은 정상 화면을 그렸고 하나는 「이용이 정지된 계정입니다」를 세웠다 — `app_user` 의 select
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
 *
 * ## 한 그림에서 두 번 불러도 한 번 읽는다
 *
 * 보관함은 레이아웃과 그 안의 풀이 화면이 같은 요청에서 둘 다 이 함수를 부른다. 그래도 `app_user` 는 한 번 간다 — 같은
 * 칸의 읽기는 같은 GET 주소이고, Next 가 한 그림 안의 같은 `fetch` GET 을 묶는다(문서 「Request Memoization」). 2026-09-30 에
 * 로컬 스택의 Kong 기록으로 쟀다: `/me/readings/self` 를 여는 e2e 한 건에서 `select=status,self_person_id` 가 React
 * `cache` 로 묶은 판과 안 묶은 판 모두 세 번이었다. 그래서 여기서 따로 묶지 않는다.
 */
export function readAccount(supabase: ServerClient): Promise<AccountRead<'self_person_id'>>;
export function readAccount<const K extends AccountColumn>(
  supabase: ServerClient,
  columns: AccountColumns<K>,
): Promise<AccountRead<K>>;
export async function readAccount(
  supabase: ServerClient,
  columns: AccountColumns<AccountColumn> = ACCOUNT_COLUMNS,
): Promise<AccountRead<AccountColumn>> {
  const { data, error } = await supabase.from('app_user').select(columns.join(', ')).maybeSingle();

  if (error !== null) {
    // 화면은 `unreachable` 상태만 받는다 — 원문은 기록에 간다
    recordDbFailure(error, 'app_user');
    return { state: accountStateOf({ ok: false, reason: 'unreachable' }), row: null };
  }
  if (data === null) {
    return { state: accountStateOf({ ok: false, reason: 'missing' }), row: null };
  }

  /* 칸을 글자로 넘겨 생성 타입이 모양을 못 짓는다 — 청한 칸의 모양은 위 겹쳐 쓴 서명이 목록에서 짓는다 */
  type T = AccountRow<AccountColumn>;
  const row = data as unknown as T;
  return {
    state: accountStateOf({
      ok: true,
      account: { status: row.status, selfPersonId: 'self_person_id' in row ? row.self_person_id : undefined },
    }),
    row,
  };
}
