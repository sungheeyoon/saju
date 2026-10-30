import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { rpcArgs, type Database } from '@/src/lib/db';
import { personInputArgs, selfPersonArgs } from '@/src/lib/input/edit';
import type { Query } from '@/src/lib/input/query';

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
 * 1. **사람 id 는 세션에서 얻는다** — 인자로 받지 않는다. 묻는 쪽(`ChartWriter`)이 확인한 세션이 답한다: 웹은 쿠키의 JWT 서명을
 *    이 서버가 확인한 `signedInUser` 의 id 이고(`chart-writes.ts`), 앱은 Auth 서버가 토큰으로 답한 id 다(`app/api/mobile/session.ts`, ADR 0211).
 *    PostgREST 가 `auth.uid()` 로 하던 확인과 같거나 더 센 확인이다.
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
 * 서버 화면과 토큰을 확인한 앱의 문(`app/api/mobile`, ADR 0211)이고, 그들이 넘기는 것은 저장할 입력 · 사람 id · 서버가 지은 요약뿐이다.
 */

/** 문의 실패 — 부르는 쪽이 `userFacingDbMessage` 로 옮긴다. 우리말이 아닌 문장은 사용자에게 안 간다 */
type WriteError = { readonly message: string; readonly code?: string };

type KeyedWrite<T> = { data: T | null; error: WriteError | null };

/** 세션이 없다 — `28000` 은 「다시 로그인」 안내로 옮겨진다(`app/db-error.ts`) */
const NO_SESSION: WriteError = { message: 'keyed-chart-writes: no session', code: '28000' };

/** 열쇠가 없는 배포 — 문장을 안 싣고 일반 안내로 선다. 원문은 기록에 간다 */
const NO_KEY: WriteError = { message: 'keyed-chart-writes: no key', code: 'XX000' };

/**
 * **누가 쓰는가** — 값이 아니라 세션을 묻는 길이다. 사람 id 를 값으로 받지 않으므로 부르는 쪽이 남의 id 를 실을 자리가 없다.
 * 이 파일이 로그인 확인을 import 하지 않는 것은 `signedInUser` 가 관문 안에서만 돌기 때문이다(`app/auth/signed-in.boundary.test.ts`) —
 * 관문 밖의 앱 문이 그 import 를 끌고 오지 않는다(ADR 0211).
 */
export type ChartWriter = {
  /** 그 사람의 JWT 로 도는 클라이언트 — 저장된 입력을 읽어 요약을 짓는다. 열쇠가 아니다 */
  readonly client: SupabaseClient<Database>;
  readonly sessionUserId: () => Promise<string | null>;
};

/**
 * 세션의 사람과 열쇠 한 쌍 — 둘 중 하나라도 없으면 부르지 않는다.
 */
type Writer =
  | { ok: true; userId: string; keyed: ReturnType<typeof keyedClient>; client: ChartWriter['client'] }
  | { ok: false; error: WriteError };

async function writer(asker: ChartWriter): Promise<Writer> {
  const userId = await asker.sessionUserId();
  if (userId === null) return { ok: false, error: NO_SESSION };

  try {
    return { ok: true, userId, keyed: keyedClient('풀에 오르는 값 쓰기'), client: asker.client };
  } catch (failure) {
    console.error('keyed-chart-writes: 열쇠 없음', failure);
    return { ok: false, error: NO_KEY };
  }
}

/**
 * 내 사람을 처음 등록한다 — 여덟 글자는 저장할 입력에서 여기서 센다.
 */
export async function createSelfPerson(asker: ChartWriter, query: Query): Promise<KeyedWrite<string>> {
  const who = await writer(asker);
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
export async function editPersonInput(asker: ChartWriter, personId: string, query: Query): Promise<KeyedWrite<number>> {
  const who = await writer(asker);
  if (!who.ok) return { data: null, error: who.error };

  const { data, error } = await who.keyed.rpc(
    'edit_person_input',
    rpcArgs<'edit_person_input'>({ p_user_id: who.userId, ...personInputArgs(personId, query) }),
  );
  if (error) return { data: null, error };

  const self = await selfElementSummary(undefined, who.client).catch(() => null);
  if (self !== null) {
    const followed = await joinPool(who, personId, self);
    if (followed.error) recordDbFailure(followed.error, 'ensure_discovery_participation (입력을 고친 뒤)');
  }

  return { data: data ?? null, error: null };
}

/**
 * **판이 엇갈려 두 번 다 못 쓴 것** — 다시 지은 요약도 그 사이 또 바뀐 입력을 만났다. 문장을 안 싣고 일반 안내로 선다
 * (`app/db-error.ts` 가 모르는 코드). 원문은 기록에 간다.
 */
const STILL_STALE: WriteError = { message: 'keyed-chart-writes: the input moved while writing the summary', code: '40001' };

/** 참여의 두 문이 받는 요약 한 벌과 그 요약을 지은 입력의 판 둘 */
const summaryArgs = (self: SelfSummary) => ({
  p_summary: self.summary,
  p_need: self.need,
  p_input_version: self.versions.inputVersion,
  p_chart_engine_version: self.versions.chartEngineVersion,
});

/**
 * **요약을 지은 뒤 입력이 바뀌었으면 한 번 다시 짓는다**(ADR 0136, 운영자 검토 2026-09-30).
 *
 * 저장된 입력 A 로 요약을 지은 뒤 문을 부르기 전에 다른 요청이 입력을 B 로 고치면, DB 는 그 사람 행을 잠그고 판을 견주어
 * 쓰지 않고 `stale` 을 낸다. 그러면 여기서 저장된 입력을 **다시 읽어** 요약을 새로 짓고 한 번 더 부른다. 두 번째도 엇갈리면
 * 멈추고 실패로 낸다 — 끝없이 돌지 않는다.
 */
async function writeFollowingInput(
  client: ChartWriter['client'],
  first: SelfSummary,
  write: (self: SelfSummary) => PromiseLike<{ data: string | null; error: WriteError | null }>,
): Promise<{ data: string | null; error: WriteError | null }> {
  let self = first;
  for (let tries = 0; tries < 2; tries += 1) {
    const answer = await write(self);
    if (answer.error || answer.data !== 'stale') return answer;

    const again = await selfElementSummary(self.personId, client).catch(() => null);
    if (again === null) break;
    self = again;
  }
  return { data: null, error: STILL_STALE };
}

/** 참여를 여는 문 — `joined` 면 참, 내 사람이 아니거나 껐거나 이름이 없으면 거짓 */
async function joinPool(
  who: Extract<Writer, { ok: true }>,
  targetPersonId: string,
  self: SelfSummary,
): Promise<KeyedWrite<boolean>> {
  const { data, error } = await writeFollowingInput(who.client, self, (current) =>
    who.keyed.rpc('ensure_discovery_participation', {
      p_user_id: who.userId,
      p_person_id: targetPersonId,
      ...summaryArgs(current),
    }),
  );
  if (error) return { data: null, error };
  return { data: data === 'joined', error: null };
}

/**
 * 매칭 참여를 켜고 끈다. 켤 때는 **내 저장된 입력에서** 요약 둘을 여기서 짓고, 그 입력의 판을 함께 싣는다.
 *
 * @returns `noSelf` — 켜려는데 내 사주를 못 세웠다(없거나 못 읽었다). 부르는 쪽이 그 사실을 말한다.
 */
export async function setParticipation(
  asker: ChartWriter,
  on: boolean,
): Promise<KeyedWrite<boolean> | { data: null; error: null; noSelf: true }> {
  const who = await writer(asker);
  if (!who.ok) return { data: null, error: who.error };

  if (!on) {
    const { data, error } = await who.keyed.rpc(
      'set_discovery_participation',
      rpcArgs<'set_discovery_participation'>({
        p_user_id: who.userId,
        p_on: false,
        p_summary: null,
        p_need: null,
        p_input_version: null,
        p_chart_engine_version: null,
      }),
    );
    if (error) return { data: null, error };
    return { data: data === 'on', error: null };
  }

  // 요약의 문은 DB 실패를 던진다. 못 읽은 것도 「내 사주를 못 세웠다」와 같은 답이다
  const self = await selfElementSummary(undefined, who.client).catch(() => null);
  if (self === null) return { data: null, error: null, noSelf: true };

  const { data, error } = await writeFollowingInput(who.client, self, (current) =>
    who.keyed.rpc('set_discovery_participation', { p_user_id: who.userId, p_on: true, ...summaryArgs(current) }),
  );
  if (error) return { data: null, error };
  return { data: data === 'on', error: null };
}

/**
 * 참여를 연다 — 홈과 매칭이 열릴 때. 요약은 그 화면이 **같은 요청에서 저장된 입력으로 이미 지은 것**이다
 * (`selfElementSummary` · `selfSummaryOf`) — 다시 읽으면 탭마다 물결이 하나 는다(2026-09-30 에 줄인 것). 그 사이 입력이
 * 바뀌었으면 DB 가 `stale` 로 알리고, 그때만 다시 읽어 짓는다.
 *
 * 껐던 사람 · 이름 없는 사람 · 내 사람이 아닌 id 는 거짓이다.
 */
export async function openParticipation(asker: ChartWriter, self: SelfSummary): Promise<KeyedWrite<boolean>> {
  const who = await writer(asker);
  if (!who.ok) return { data: null, error: who.error };
  return joinPool(who, self.personId, self);
}
