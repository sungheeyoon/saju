import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

import { read, unread, type SkippableRead } from './db-error';

/** 내 사주를 등록했는가와, 등록하면 설 이름 */
export type SelfPersonState = {
  readonly saved: boolean;
  /**
   * 내 사주의 이름은 **닉네임이다** — 등록할 때 DB 가 닉네임으로 적고, 닉네임을 고치면 함께 옮는다.
   * 그래서 「이 사주가 내 사주 맞나요?」의 카드도 적은 이름이 아니라 이 이름으로 선다. 가입 전이면 `null`.
   */
  readonly nickname: string | null;
};

/**
 * **내 사주를 등록했는가를 읽는 문** — 사주 이어 보기(`app/save-for-reading.tsx`)가 부른다(ADR 0128).
 *
 * `/` 에서 생일을 넣고 로그인 · 가입을 다녀온 사람은 대개 **자기** 사주를 넣었다 — 현관이 그렇게 묻는다. 그런데
 * 이어 보기의 저장은 언제나 「저장한 사람」이라, 처음 온 사람이 같은 생일을 온보딩에서 한 번 더 넣었고 첫 풀이권이
 * 「다른 사람 풀이」에 쓰였다. 내 사주가 아직 없으면 화면이 「이 사주가 내 사주 맞나요?」를 먼저 묻는다.
 *
 * 클라이언트를 **받기만** 한다 — `/` 는 공개 화면이라 브라우저가 부른다(`beta-schedule.ts` 와 같은 결).
 *
 * @returns 못 읽었으면 `{ ok: false }` — 화면은 묻지 않고 지금 흐름(저장한 사람)을 연다. 이미 내 사주가 있는 사람에게
 *   「내 사주 맞나요?」를 세우는 것보다, 없는 사람에게 한 번 덜 묻는 편이 되돌리기 쉽다(저장한 사람은 지울 수 있다).
 *   계정 줄이 없으면(가입 전) 등록하지 않은 것이다.
 */
export async function selfPersonState(supabase: SupabaseClient<Database>): Promise<SkippableRead<SelfPersonState>> {
  const { data, error } = await supabase.from('app_user').select('self_person_id, nickname').maybeSingle();
  if (error !== null) return unread(error, 'app_user.self_person_id');
  return read({ saved: data !== null && data.self_person_id !== null, nickname: data?.nickname ?? null });
}
