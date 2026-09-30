import 'server-only';

import { rpcArgs } from '@/src/lib/db';
import { personInputArgs, selfPersonArgs } from '@/src/lib/input/edit';
import type { Query } from '@/src/lib/input/query';

import { supabaseOnServer } from '../auth/server-client';
import { signedInUser } from '../auth/signed-in';
import { recordDbFailure } from '../db-error';
import { keyedClient } from '../keyed-client';
import { selfElementSummary, type SelfSummary } from './summary';

/**
 * **풀에 오르는 값을 쓰는 문 넷을 열쇠로 부르는 유일한 자리**(G-64 길 ①, ADR 0136).
 *
 * 매칭 풀에 오르는 오행 요약 · 필요한 기운 요약과 내 사람의 여덟 글자는 엔진(절기 · 자시 · 경도 · 억부)이 짓고,
 * DB 는 모양만 본다. 그 문 넷(`create_self_person` · `edit_person_input` · `set_discovery_participation` ·
 * `ensure_discovery_participation`)이 로그인한 사람에게 열려 있던 동안, PostgREST 로 직접 부르면 제 저장된 입력과
 * 다른 — 모양만 맞는 — 값을 풀에 올릴 수 있었다(2026-09-28 보안 감사). 이제 그 넷은 `service_role` 에만 열려 있고
 * (`20261106090000`), 부르는 자리는 이 파일 하나다.
 *
 * 이 자리가 지키는 셋:
 *
 * 1. **사람 id 는 세션에서 얻는다** — 인자로 받지 않는다. 쿠키의 JWT 서명을 이 서버가 확인한 `signedInUser` 의 id 다.
 *    PostgREST 가 `auth.uid()` 로 하던 확인과 같은 서명 확인이다.
 * 2. **값은 서버가 짓는다** — 여덟 글자는 저장할 입력(`Query`)에서 엔진으로(`selfPersonArgs` · `personInputArgs`),
 *    요약은 그 사람의 저장된 입력에서(`app/me/summary.ts`). 브라우저가 보낸 요약 · 여덟 글자를 받는 인자는 없다.
 * 3. **이 문 넷만 부른다** — 열쇠 클라이언트를 밖으로 내주지 않는다. 판정(정지 · 가입 전 · 남의 사람 · 껐는가)은
 *    여전히 DB 가 한다.
 *
 * 잠금: `scripts/layers.test.ts` 가 이 넷의 이름이 이 파일 밖의 `.rpc()` 에 없고, 이 파일이 다른 문을 안 부르며,
 * 열쇠(`app/keyed-client.ts`)를 부르는 파일이 목록 그대로인지 잰다. 이 파일이 저장된 입력에서 지은 값만 내보내는지는
 * `app/me/keyed-chart-writes.test.ts` 가 잰다. 첫 줄의 `server-only` 가 화면 층에서 부르면 빌드를 세운다.
 *
 * 이 파일은 서버 액션(`'use server'`)이 아니다 — 브라우저가 이 함수를 직접 부를 길이 없다. 부르는 것은 서버 액션과
 * 서버 화면이고, 그들이 넘기는 것은 저장할 입력 · 사람 id · 서버가 지은 요약뿐이다.
 */

/** 문의 실패 — 부르는 쪽이 `userFacingDbMessage` 로 옮긴다. 우리말이 아닌 문장은 사용자에게 안 간다 */
type WriteError = { readonly message: string; readonly code?: string };

export type KeyedWrite<T> = { data: T | null; error: WriteError | null };

/** 세션이 없다 — `28000` 은 「다시 로그인」 안내로 옮겨진다(`app/db-error.ts`) */
const NO_SESSION: WriteError = { message: 'keyed-chart-writes: no session', code: '28000' };

/** 열쇠가 없는 배포 — 문장을 안 싣고 일반 안내로 선다. 원문은 기록에 간다 */
const NO_KEY: WriteError = { message: 'keyed-chart-writes: no key', code: 'XX000' };

/**
 * 세션의 사람과 열쇠 한 쌍 — 둘 중 하나라도 없으면 부르지 않는다.
 */
type Writer =
  | { ok: true; userId: string; keyed: ReturnType<typeof keyedClient> }
  | { ok: false; error: WriteError };

async function writer(): Promise<Writer> {
  const user = await signedInUser(await supabaseOnServer());
  if (user === null) return { ok: false, error: NO_SESSION };

  try {
    return { ok: true, userId: user.id, keyed: keyedClient('풀에 오르는 값 쓰기') };
  } catch (failure) {
    console.error('keyed-chart-writes: 열쇠 없음', failure);
    return { ok: false, error: NO_KEY };
  }
}

/**
 * 내 사람을 처음 등록한다 — 여덟 글자는 저장할 입력에서 여기서 센다.
 */
export async function createSelfPerson(query: Query): Promise<KeyedWrite<string>> {
  const who = await writer();
  if (!who.ok) return { data: null, error: who.error };

  const { data, error } = await who.keyed.rpc(
    'create_self_person',
    rpcArgs<'create_self_person'>({ p_user_id: who.userId, ...selfPersonArgs(query) }),
  );
  return { data: data ?? null, error };
}

/**
 * 저장된 입력을 고친다 — 여덟 글자는 고칠 입력에서 여기서 센다. 내 사람이면 **풀의 요약도 따라간다.**
 *
 * 요약을 못 따라가게 한 것은 저장의 실패가 아니다 — 홈이나 매칭을 열 때 참여를 여는 문이 고친다. 그래서 기록에만 남긴다.
 * 「내 사주인가」는 여기서 안 묻는다 — `ensure_discovery_participation` 이 `uuid` 로 견준다.
 */
export async function editPersonInput(personId: string, query: Query): Promise<KeyedWrite<number>> {
  const who = await writer();
  if (!who.ok) return { data: null, error: who.error };

  const { data, error } = await who.keyed.rpc(
    'edit_person_input',
    rpcArgs<'edit_person_input'>({ p_user_id: who.userId, ...personInputArgs(personId, query) }),
  );
  if (error) return { data: null, error };

  const self = await selfElementSummary().catch(() => null);
  if (self !== null) {
    const followed = await who.keyed.rpc('ensure_discovery_participation', {
      p_user_id: who.userId,
      p_person_id: personId,
      p_summary: self.summary,
      p_need: self.need,
    });
    if (followed.error) recordDbFailure(followed.error, 'ensure_discovery_participation (입력을 고친 뒤)');
  }

  return { data: data ?? null, error: null };
}

/**
 * 매칭 참여를 켜고 끈다. 켤 때는 **내 저장된 입력에서** 요약 둘을 여기서 짓는다.
 *
 * @returns `no-self` — 켜려는데 내 사주를 못 세웠다(없거나 못 읽었다). 부르는 쪽이 그 사실을 말한다.
 */
export async function setParticipation(on: boolean): Promise<KeyedWrite<boolean> | { data: null; error: null; noSelf: true }> {
  const who = await writer();
  if (!who.ok) return { data: null, error: who.error };

  if (!on) {
    const { data, error } = await who.keyed.rpc('set_discovery_participation', {
      p_user_id: who.userId,
      p_on: false,
      p_summary: null,
      p_need: null,
    });
    return { data: data ?? null, error };
  }

  // 요약의 문은 DB 실패를 던진다. 못 읽은 것도 「내 사주를 못 세웠다」와 같은 답이다
  const self = await selfElementSummary().catch(() => null);
  if (self === null) return { data: null, error: null, noSelf: true };

  const { data, error } = await who.keyed.rpc('set_discovery_participation', {
    p_user_id: who.userId,
    p_on: true,
    p_summary: self.summary,
    p_need: self.need,
  });
  return { data: data ?? null, error };
}

/**
 * 참여를 연다 — 홈과 매칭이 열릴 때. 요약은 그 화면이 **같은 요청에서 저장된 입력으로 이미 지은 것**이다
 * (`selfElementSummary` · `selfSummaryOf`). 다시 읽으면 탭마다 물결이 하나 는다(2026-09-30 에 줄인 것).
 *
 * 껐던 사람 · 이름 없는 사람 · 내 사람이 아닌 id 는 DB 가 `false` 로 답한다.
 */
export async function openParticipation(self: SelfSummary): Promise<KeyedWrite<boolean>> {
  const who = await writer();
  if (!who.ok) return { data: null, error: who.error };

  const { data, error } = await who.keyed.rpc('ensure_discovery_participation', {
    p_user_id: who.userId,
    p_person_id: self.personId,
    p_summary: self.summary,
    p_need: self.need,
  });
  return { data: data ?? null, error };
}
