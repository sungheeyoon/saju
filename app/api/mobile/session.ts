import { isAuthApiError, type SupabaseClient } from '@supabase/supabase-js';

import { NOTICE_UNREAD, gateFor } from '@/src/lib/consent';
import type { Database } from '@/src/lib/db';
import type { DoorRefusal } from '@/src/lib/reading/door';

import { supabaseAsBearer } from '../../auth/bearer-client';
import { currentSchedule } from '../../beta-schedule';

/** 못 읽어 문을 안 연 때의 한 줄 — 웹의 계정 실패 줄(`accountFailureOf`)과 같은 글자다 */
const ACCOUNT_UNREAD_NOTE = '계정을 확인하지 못했어요.';

/** 까닭을 답으로 — 상태 코드는 앱이 다시 로그인할지 · 다시 시도할지를 가르는 데만 쓴다 */
export const refusal = (status: number, body: DoorRefusal) => Response.json(body, { status });

/** 관문이 보는 주소 — 앱의 문은 대개 웹의 `/me/readings` 와 같은 자리에 선다 */
const GATED_AS = '/me/readings';

/** 토큰을 머리에서 — `Bearer` 한 개만 받는다 */
const tokenOf = (request: Request): string | undefined =>
  /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '')?.[1];

/**
 * **사진 문의 자격** — 토큰의 클라이언트뿐이다. 토큰을 믿는 것이 아니라 PostgREST 가 서명을 보고 `photo_at` 이 그 사람으로 판정한다.
 * 웹의 사진 주소가 관문을 안 지나는 것과 같은 까닭이다(ADR 0200): 장마다 Auth · 계정 · 일정을 묻지 않는다.
 */
export function photoClientOf(request: Request): SupabaseClient<Database> | null {
  const token = tokenOf(request);
  return token === undefined ? null : supabaseAsBearer(token);
}

/**
 * **앱 문의 자격 — `Authorization: Bearer <Supabase access token>`**(ADR 0211).
 *
 * `/api` 는 `proxy.ts` 를 지나지 않아 아무나 두드린다. 그래서 관문이 쿠키로 하던 일을 토큰으로 그대로 밟는다 — 판정을 새로 쓰지 않는다.
 *
 * 1. **Auth 서버에 묻는다**(`getUser`) — 관문과 같은 문이다. 서명만 보는 `getClaims` 는 끊긴 세션 · 지워진 계정을 못 알아챈다.
 * 2. **가입 · 안내 재확인 · 종료는 `gateFor`** — 웹이 지나는 그 함수에 그 값을 넣는다. 정지 · 풀이권 · 중복 누름은 여기서 안 묻는다.
 *    `start_reading_run` 이 그 사람의 JWT 로 묻는다.
 *
 * **못 읽으면 닫는다**(웹과 다른 한 자리). 웹의 관문은 계정을 못 읽으면 지나가게 두고 화면이 실패를 말한다. 이 문 뒤에는 그 화면이
 * 없고 바로 비용이 나가는 길이 있어 503 으로 답한다. 일정만 못 읽은 것은 웹과 같다 — 가입을 마친 사람은 지나가고 종료는 DB 가 다시 막는다.
 *
 * @param touches 사람이 낸 요청인가 — 화면을 열었거나 눌렀다(ADR 0118). 기다리며 3초마다 묻는 것은 활동이 아니다.
 * @param gatedAs 웹의 어느 주소와 같은 문인가 — 참여 끄기는 `/me/settings` 다. 끝난 뒤에도 철회는 열려 있다는 `gateFor` 의 예외를 그대로 탄다.
 */
export async function mobileSession(
  request: Request,
  { touches, gatedAs = GATED_AS }: { touches: boolean; gatedAs?: string },
): Promise<{ ok: true; client: SupabaseClient<Database>; userId: string } | { ok: false; response: Response }> {
  const refuse = (status: number, body: DoorRefusal) => ({ ok: false as const, response: refusal(status, body) });

  const token = tokenOf(request);
  if (token === undefined) return refuse(401, { refused: 'sign-in' });

  const client = supabaseAsBearer(token);

  const { data, error } = await client.auth.getUser(token);
  if (data.user === null) {
    /* 거절과 못 닿음을 가른다 — 못 닿은 것으로 앱의 세션을 걷으면 망이 한 번 끊긴 사람이 로그아웃된다 */
    const rejected = isAuthApiError(error) && error.status >= 400 && error.status < 500;
    return rejected || error === null
      ? refuse(401, { refused: 'sign-in' })
      : refuse(503, { refused: 'unavailable', message: ACCOUNT_UNREAD_NOTE });
  }

  const [{ data: account, error: accountError }, schedule] = await Promise.all([
    client.from('app_user').select('signed_up_at, notice_version, notice_schedule_id').maybeSingle(),
    currentSchedule(client),
    touches ? noteActivity(client) : Promise.resolve(),
  ]);
  if (accountError !== null || account === null) {
    return refuse(503, { refused: 'unavailable', message: ACCOUNT_UNREAD_NOTE });
  }

  const where = gateFor(
    gatedAs,
    {
      signedUp: account.signed_up_at !== null,
      noticeVersion: account.notice_version,
      noticeScheduleId: account.notice_schedule_id,
    },
    schedule.ok ? schedule.value : NOTICE_UNREAD,
    new Date(),
  );
  if (where !== null) return refuse(403, { refused: where === '/closed' ? 'closed' : 'signup' });

  return { ok: true, client, userId: data.user.id };
}

/** 활동을 적는다 — 1분에 한 번만 실제로 적히고(ADR 0092) 답은 안 쓴다. 부속 정보라 실패는 기록에만 남긴다 */
async function noteActivity(client: SupabaseClient<Database>): Promise<void> {
  const { error } = await client.rpc('touch_activity');
  if (error !== null) console.error('touch_activity', error.code);
}
