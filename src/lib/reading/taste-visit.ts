/**
 * **로그인 전 사주 문단 한 번의 방문** — 서버가 DB 의 갈래를 화면의 상태로 옮기는 순수한 절반(ADR 0143).
 *
 * 서버(`app/taste-run.ts`)는 예약(`reserve_taste`) · 읽기(`taste_session_view`) · 모델 결과를 받고, 화면(`app/taste.tsx`)은
 * 다섯 상태만 안다 — 글이 섰다 · 기다린다 · 실패 · 시간 초과 · 한도. **내부 갈래 이름과 한도 숫자는 화면으로 안 간다** —
 * `limited_ip` 와 `limited_global` 은 화면에서 같은 「한도」다. 어느 한도인지 알려 주면 그것이 곧 비켜 가는 법이 된다.
 *
 * 날짜 키와 IP 의 모양도 여기서 정한다 — 서버의 HMAC 모듈(`app/taste-visitor.ts`)이 부른다. 여기는 DB 도 Node 도 모른다.
 */

// ---------------------------------------------------------------------------
// 화면의 상태
// ---------------------------------------------------------------------------

/**
 * 화면이 받는 답 — **세션 id 는 글이 섰거나 기다릴 때만** 간다. 가입 왕복이 그 id 를 탭에 들고 가고(ADR 0128), 서버가
 * 쿠키의 HMAC 과 함께 맞춰 본다 — id 하나로는 아무것도 못 읽는다.
 *
 * - `ready` — 글이 섰다
 * - `waiting` — 같은 입력을 지금 누가 쓰고 있다. 화면이 조금 뒤 `readTaste` 로 다시 본다
 * - `failed` — 이번 시도가 실패했다. `retry` 면 「다시 시도하기」가 다음 시도를 연다. 아니면 가입 경로만 남는다
 *   (같은 입력이 세 번 실패했거나 · 서버가 이 자리를 닫았다)
 * - `timeout` — 시간 상한에 걸렸다. `retry` 의 뜻은 위와 같다
 * - `limited` — 한도(요청 · 브라우저 · IP · 전체 하루 중 하나)
 */
export type TasteAnswer =
  | { readonly state: 'ready'; readonly sessionId: string; readonly preview: string }
  | { readonly state: 'waiting'; readonly sessionId: string }
  | { readonly state: 'failed'; readonly retry: boolean }
  | { readonly state: 'timeout'; readonly retry: boolean }
  | { readonly state: 'limited' };

/** 서버가 이 자리를 닫았다 — 비밀이 없거나 · 입력을 못 읽거나 · 문이 터졌다. 다시 눌러도 같다 */
export const TASTE_CLOSED: TasteAnswer = { state: 'failed', retry: false };

/**
 * 잠긴 목차 첫 절의 모양 넷 — 화면(`app/taste.tsx`)이 답 하나로 고른다(운영자 결정 2026-10-10, ADR 0143 「2026-10-10 덧」).
 *
 * - `writing` — 답이 아직 없거나 같은 입력을 누가 쓰고 있다. 막대 넷 위에 「첫 문단 작성 중…」
 * - `ready` — 글이 섰다
 * - `retry` — 실패 · 시간 초과이고 다음 시도가 열려 있다. 자물쇠 + 흐린 막대 + 실패 줄 + 「다시 시도하기」
 * - `closed` — 한도 · 같은 입력이 세 번 실패 · 서버가 닫음. 자물쇠 + 흐린 막대 + 줄 하나, 단추 없음 — 눌러도 같다
 */
export type TasteFirstSection = 'writing' | 'ready' | 'retry' | 'closed';

export function tasteFirstSectionOf(answer: TasteAnswer | null): TasteFirstSection {
  if (answer === null || answer.state === 'waiting') return 'writing';
  if (answer.state === 'ready') return 'ready';
  if (answer.state === 'limited') return 'closed';
  return answer.retry ? 'retry' : 'closed';
}

/** `reserve_taste` 의 갈래 — DB 함수의 머리말과 같은 여덟 */
export const RESERVE_OUTCOMES = [
  'call_model',
  'reuse_succeeded',
  'wait_running',
  'retries_exhausted',
  'limited_request',
  'limited_browser',
  'limited_ip',
  'limited_global',
] as const;

export type ReserveOutcome = (typeof RESERVE_OUTCOMES)[number];

export const isReserveOutcome = (value: unknown): value is ReserveOutcome =>
  (RESERVE_OUTCOMES as readonly unknown[]).includes(value);

/**
 * 모델을 안 부르는 갈래의 답 — 세션을 읽어야 하는 둘(`reuse_succeeded` · `wait_running`)과 부르는 하나(`call_model`)는
 * `null` 이다. 부르는 쪽이 그 셋을 따로 간다.
 */
export function answerOfReserve(outcome: ReserveOutcome): TasteAnswer | null {
  switch (outcome) {
    case 'limited_request':
    case 'limited_browser':
    case 'limited_ip':
    case 'limited_global':
      return { state: 'limited' };
    case 'retries_exhausted':
      return { state: 'failed', retry: false };
    case 'call_model':
    case 'reuse_succeeded':
    case 'wait_running':
      return null;
  }
}

/** `taste_session_view` 한 줄 — 못 읽었으면(0행) 부르는 쪽이 `null` 을 넘긴다 */
export type TasteSessionView = {
  readonly state: string;
  readonly retryable: boolean;
  readonly preview: string | null;
};

/**
 * 세션을 읽은 답.
 *
 * `claimed`(이미 회원에게 귀속된 세션)는 로그인 전 화면에 글을 다시 안 낸다 — 다시 읽으면 새 세션이 선다. 그래서 다시 시도를
 * 연다. 0행(없는 세션 · 24시간이 지남 · 결과가 지워짐)도 같다 — 다시 부르면 예약이 새 세션을 세운다.
 */
export function answerOfView(view: TasteSessionView | null, sessionId: string, failedWith: 'failed' | 'timeout' = 'failed'): TasteAnswer {
  if (view === null) return { state: 'failed', retry: true };
  switch (view.state) {
    case 'succeeded':
      return view.preview === null || view.preview.trim() === ''
        ? { state: 'failed', retry: true }
        : { state: 'ready', sessionId, preview: view.preview };
    case 'running':
      return { state: 'waiting', sessionId };
    case 'failed':
      return { state: failedWith, retry: view.retryable };
    default:
      return { state: 'failed', retry: true };
  }
}

/** `callModel` 의 실패 코드 가운데 시간 초과 — 화면이 「실패」와 갈라 말한다 */
export const MODEL_TIMEOUT = 'model-timeout';

/** 기다리는 화면이 다시 묻는 간격과 상한 — 모델 시간 상한(20초)에 왕복을 얹은 만큼만 기다린다 */
export const TASTE_WAIT = { everyMs: 2_000, forMs: 30_000 } as const;

/**
 * 앱이 세는 퍼널 단계 가운데 **브라우저와 함께 보는 둘** — 세션 하나에 단계마다 한 번만 센다(`count_taste_step_once`,
 * `20261119090000`). 세션 id 와 서버가 지은 브라우저 HMAC 이 함께 맞아야 센다. 「더보기」(`more_clicked`)는 걷었다 — 퍼널은
 * 다섯 단계다(G-85, `20261128090000`).
 *
 * - `signup_started` — 가입으로 가는 누름(잠긴 목차 끝의 「로그인하고 전체 풀이 받기」 하나)
 * - `signup_completed` — 가입을 마치고 그 세션을 들고 돌아왔다 — 귀속 결과가 `claimed` · `discarded` · `expired` ·
 *   `not_ready` 어느 것이든(`TASTE_RETURNED_CLAIMS`). 귀속 성공만이 아니다(조율자 결정 2026-10-03)
 */
export const TASTE_SESSION_STEPS = ['signup_started', 'signup_completed'] as const;

export type TasteSessionStep = (typeof TASTE_SESSION_STEPS)[number];

export const isTasteSessionStep = (value: unknown): value is TasteSessionStep =>
  (TASTE_SESSION_STEPS as readonly unknown[]).includes(value);

/**
 * 「가입을 마치고 그 세션을 들고 돌아왔다」로 세는 귀속 결과 — `not_found`(없는 세션 · 다른 브라우저) · `taken`(남의 회원이
 * 이미 붙였다)은 이 브라우저가 들고 온 세션이 아니라 안 센다.
 */
export const TASTE_RETURNED_CLAIMS = ['claimed', 'discarded', 'expired', 'not_ready'] as const;

/**
 * 가입한 뒤 들고 온 세션을 붙인 결과 — **세 갈래다**(ADR 0143 「덧」). 화면은 이 셋만 받는다 — DB 의 갈래 · 오류 원문은 안 간다.
 *
 * - `claimed` — 붙었고 이을 풀이가 남았다. 다음 누름이 이 세션을 잇는다(귀속 표가 섰다)
 * - `terminal` — **답이 났다 — 이을 것이 없다.** 다시 불러도 같다: 지문이 다르다(`discarded`) · 지났다(`expired`) · 남의
 *   것이다(`taken`) · 없는 세션이거나 다른 브라우저다(`not_found`) · 아직 글이 없다(`not_ready`) · id 꼴이 틀렸다 · 비밀이 없다 ·
 *   이 브라우저의 쿠키가 없다 · 이어진 풀이가 이미 섰다. 화면은 보통 흐름으로 간다
 * - `retryable` — **답이 안 났다.** DB · 네트워크 · 로그인 세션을 그 순간 못 읽었다. 화면은 세션 id 를 지우지 않고 다시
 *   시도하게 한다 — 조용히 보통 흐름으로 가면 「맛보기에서 끊긴 물음은 가입 뒤 그 답부터 이어진다」가 순간 장애에 깨진다
 */
export const TASTE_CLAIM_RESULTS = ['claimed', 'terminal', 'retryable'] as const;

export type TasteClaimResult = (typeof TASTE_CLAIM_RESULTS)[number];

/**
 * 맛보기를 시도에 잇지 못해(답이 안 났다 · 귀속 표를 다시 못 맞췄다 · 연 시도를 다른 세션이 쥐었다 · `wrong_run`) 보내지 않고 닫은
 * 시도의 실패 코드(ADR 0143 「덧」). 누름이 닫고(`app/me/reading/pipeline.ts`), 내 사주풀이 화면이 이 코드를 보고 「전체 풀이만
 * 보기」를 세운다(`app/me/reading/reading-state.ts`). `reading_run.failure_code` 는 DB 검사식이 없다 — 꼴은 맛보기 표와 같은
 * `^[a-z0-9-]{1,64}$` 로 맞춘다.
 */
export const TASTE_LINK_FAILED = 'taste-link-failed';

/** 회수가 세는 단계 — 이어 쓴 풀이가 섰다. 브라우저가 없는 길(webhook · 크론)이라 옛 `count_taste_step` 이 센다 */
export type TasteStep = 'reading_succeeded';

// ---------------------------------------------------------------------------
// 날짜 키와 IP 의 모양
// ---------------------------------------------------------------------------

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 서울 날짜(`YYYY-MM-DD`) — IP HMAC 의 날짜별 키가 이 값으로 바뀐다. DB 의 IP 하루 한도(`taste_day_start()`)가 서울 자정에
 * 새로 세므로 키도 같은 자정에 바뀌어야 한다 — 어긋나면 자정 앞뒤 아홉 시간 동안 같은 IP 가 두 이름으로 센다. 한국은 일광
 * 절약 시간이 없어 아홉 시간을 더하면 된다.
 */
export const seoulDateOf = (at: Date): string => new Date(at.getTime() + SEOUL_OFFSET_MS).toISOString().slice(0, 10);

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** IPv6 를 여덟 칸으로 편다 — 모양이 아니면 `null` */
function ipv6Groups(text: string): string[] | null {
  if (!/^[0-9a-f:]+$/.test(text) || text.split('::').length > 2) return null;
  const [head, tail] = text.includes('::') ? text.split('::') : [text, null];
  const front = head === '' ? [] : head.split(':');
  const back = tail === null || tail === '' ? [] : tail.split(':');
  if ([...front, ...back].some((group) => group === '' || group.length > 4)) return null;
  const missing = 8 - front.length - back.length;
  if (tail === null ? missing !== 0 : missing < 1) return null;
  return [...front, ...Array<string>(missing).fill('0'), ...back].map((group) => group.padStart(4, '0'));
}

/**
 * HMAC 할 IP 의 이름 — 헤더 값의 **첫 칸**을 읽고 모양을 본다. 모양이 아니면 `null`(서버가 이 자리를 닫는다).
 *
 * IPv6 는 **앞 56비트(/56)** 로 접는다 — 주소 하나마다 세면 같은 사람이 주소를 바꿔 가며 IP 빗장을 비켜 간다. /64 로
 * 접던 때(#441)는 흔한 VPS 할당이 /56 이라 /64 256개를 돌려 가며 IP 하루 한도(20)를 256배로 늘릴 수 있었다(읽기 전용 검토,
 * 2026-10-03). /48 로 더 넓히면 한 통신사 이용자 여럿이 한 이름으로 묶일 위험이 커서 /56 에서 멈췄다(조율자 결정 2026-10-03).
 *
 * 이것으로 다 막지 않는다 — **하루 돈은 서비스 전체 상한**(`taste_daily_model_calls()`)이 막고, 주소를 많이 쥔 쪽이 그 상한을
 * 먼저 채워 다른 사람의 문단을 닫는 **가용성 공격은 남는다.** 그 몫은 Vercel WAF 의 속도 제한이고 운영자가 켠다.
 * IPv4 를 품은 IPv6(`::ffff:1.2.3.4`)는 그 IPv4 다.
 */
export function ipSubjectOf(forwardedFor: string | null): string | null {
  const first = forwardedFor?.split(',')[0]?.trim().toLowerCase() ?? '';
  if (first === '') return null;
  if (IPV4.test(first)) return first;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(first);
  if (mapped !== null) return IPV4.test(mapped[1]) ? mapped[1] : null;
  const groups = ipv6Groups(first.replace(/^\[|\]$/g, ''));
  return groups === null ? null : `${groups.slice(0, 3).join(':')}:${groups[3].slice(0, 2)}00::/56`;
}
