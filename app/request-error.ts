import 'server-only';

import { keyedClient } from '@/app/keyed-client';
import { rpcArgs } from '@/src/lib/db';

/**
 * **서버가 던진 오류를 운영자에게 알린다** — `instrumentation.ts` 의 `onRequestError` 가 부른다(`20261108090000`).
 *
 * 서버 컴포넌트 · 라우트 · 액션 · 관문이 던지면 Vercel 로그에만 남고 아무도 몰랐다(밤샘 감사 SRE, 2026-09-28). 알림 길은
 * 이미 있다 — DB 의 `notify_ops` 가 종류마다 하루 한 줄을 적고 운영자의 주소로 보낸다. 그 문을 여는 것이
 * `report_request_error` 이고, 열쇠(`service_role`)에만 열렸다 — 로그인한 사람이 부를 수 있으면 알림함을 채울 수 있다.
 *
 * **보내는 것은 셋뿐이다** — 라우트 파일의 무늬(`context.routePath`), 자리(`context.routeType`), digest. 오류 문장 ·
 * 실제 주소 · 요청 머리는 안 보낸다 — 문장에는 입력값이, 주소에는 사람 id 가 섞일 수 있다. digest 로 Vercel 로그의 그
 * 줄을 찾는다.
 *
 * **Production 에서만 보낸다.** Preview · 로컬 · 흐름 · e2e 의 오류가 운영자의 알림함에 서면 알림이 소음이 된다.
 *
 * **실패는 삼킨다** — 알림이 오류 처리를 붙들거나 새 오류를 던지지 않는다. 삼킨 것은 로그에 한 줄 남긴다(ADR 0078).
 *
 * **오류 응답을 붙들지 않는다.** Next 는 오류 응답을 내기 전에 `onRequestError` 를 기다린다
 * (`node_modules/next/dist/build/templates/app-page-runtime.js` · `middleware.js`). 그래서 둘을 둔다 —
 * 부름은 {@link REPORT_TIMEOUT_MS} 에 끊고, 한 인스턴스 안에서 (자리 · 라우트 · 서울 날짜)가 같은 것은 **한 번만** 보낸다.
 * DB 도 같은 날 같은 종류를 한 줄로 막지만, 거기까지 가는 왕복 자체가 DB 가 느린 날 오류 난 요청마다 늘어나 부하를
 * 키운다. 보내기 **전에** 적는다 — 실패한 부름을 같은 날 다시 하지 않는다(장애 때 두드리지 않는다).
 */

/** 알림 부름을 끊는 시간 — 오류 응답이 이보다 오래 기다리지 않는다 */
export const REPORT_TIMEOUT_MS = 1500;

/** 이 인스턴스가 오늘 이미 보낸 (자리 · 라우트 · 날짜) — 날이 바뀌면 옛 날짜의 것을 비운다 */
const sent = new Set<string>();
let sentDay = '';

function seoulDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now);
}

/** 시험이 인스턴스를 새로 띄운 것처럼 쓴다 */
export function forgetSentReports(): void {
  sent.clear();
  sentDay = '';
}

const ROUTE_TYPES = new Set(['render', 'route', 'action', 'proxy']);

/** DB 가 받는 digest 의 모양 — 벗어나면 안 보낸다(`null`). Next 의 digest 는 숫자 문자열이다 */
const DIGEST = /^[A-Za-z0-9_-]{1,64}$/;

/** 던져진 값에서 digest 를 꺼낸다 — 없거나 모양이 다르면 `null` */
export function digestOf(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return null;
  const digest = String((error as { digest: unknown }).digest);
  return DIGEST.test(digest) ? digest : null;
}

/**
 * @param routePath 라우트의 무늬 — `/me/[id]` 같은 것(로컬에서 라우트 오류는 `/api/boom-check` 로 왔다). 실제 주소가 아니다
 * @param routeType `render` · `route` · `action` · `proxy`. 그 밖이면 안 보낸다
 * @param digest 오류의 digest
 * @param vercelEnv 시험이 넣는 자리 — 기본은 `process.env.VERCEL_ENV`
 * @param now 시험이 넣는 자리 — 중복을 가르는 날짜
 */
export async function reportRequestError(
  routePath: string,
  routeType: string,
  digest: string | null,
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
  now: Date = new Date(),
): Promise<void> {
  if (vercelEnv !== 'production' || !ROUTE_TYPES.has(routeType)) return;

  const day = seoulDay(now);
  if (day !== sentDay) {
    sent.clear();
    sentDay = day;
  }
  const key = `${routeType}:${routePath}`;
  if (sent.has(key)) return;
  sent.add(key);

  try {
    const { error } = await keyedClient('서버 오류 알림')
      .rpc(
        'report_request_error',
        rpcArgs<'report_request_error'>({ p_route: routePath, p_kind: routeType, p_digest: digest }),
      )
      .abortSignal(AbortSignal.timeout(REPORT_TIMEOUT_MS));
    if (error) console.error('request-error: report_request_error', error.code);
  } catch (thrown) {
    console.error('request-error: report_request_error', thrown instanceof Error ? thrown.name : typeof thrown);
  }
}
