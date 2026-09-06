/**
 * 계정이 어디에 서 있는가, 그리고 그 자리에서 **사람에게 하는 말.**
 *
 * `src/lib/consent` 와 같은 규율이다 — 정책이 문장을 들고 화면은 글자를 앞에 세우기만
 * 한다. 다섯 화면이 저마다 「중지된 계정입니다」를 적고 있었고, 그래서 상태가 하나
 * 늘어나는 순간 다섯 곳 중 하나는 반드시 안 고쳐진다. 값을 하나 두고 화면이 그것을
 * 읽으면 안 고쳐질 자리가 없다.
 *
 * ## 여기 **없는** 것
 *
 * 무엇이 막히는가가 없다. 그것은 전부 DB 가 든다 — `is_active_account()` 하나를 모든
 * 문이 묻고 있고, 여기 다시 적으면 판정하는 자리가 둘이 된다.
 */

/** 이름은 DB 의 검사식과 같다(`app_user_status_check`) */
const ACCOUNT_STATUSES = ['active', 'suspended', 'deletion_requested'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

const isActiveAccount = (status: string): boolean => status === 'active';

/**
 * 살아 있지 않은 계정에게 하는 말.
 *
 * **이유를 갈라서 말한다.** 운영자가 건 제재와 본인이 낸 요청은 같은 것을 막지만 같은
 * 일이 아니다 — 자기가 요청해서 그렇게 된 사람에게 「중지되었습니다」는 거짓이다.
 */
const ACCOUNT_HALTED_TEXT: Record<
  Exclude<AccountStatus, 'active'>,
  { readonly title: string; readonly detail: string }
> = {
  suspended: {
    title: '중지된 계정입니다',
    detail: '저장된 자료는 그대로 있고, 지금은 열어 볼 수 없습니다.',
  },
  deletion_requested: {
    title: '삭제를 요청한 계정입니다',
    detail:
      '요청을 받았습니다. 인연 찾기 노출과 새 요청·풀이 생성은 이미 멈췄고, 저장된 자료는 운영자가 처리할 때까지 그대로 있습니다. 되돌리려면 운영자에게 알려 주세요.',
  },
} as const;

/** 화면이 상태 하나로 문장을 얻는 자리 — `active` 면 할 말이 없다 */
export function haltedText(status: string): { title: string; detail: string } | null {
  if (isActiveAccount(status)) return null;
  return ACCOUNT_HALTED_TEXT[status as Exclude<AccountStatus, 'active'>] ?? ACCOUNT_HALTED_TEXT.suspended;
}

/**
 * 계정을 **못 읽었을 때** 하는 말 — 까닭에 따라 지시가 다르다.
 *
 * 「중지」와 섞지 않는다(ADR 0048). `app_user` 의 select 정책은 `id = auth.uid()` 하나이고
 * `status` 를 안 본다 — 정지된 계정도 자기 행을 읽는다. 그러니 **못 읽었다는 것은 정지의
 * 증거가 아니다.** 한 화면이 이 둘을 섞어서, 아무 일도 없는 사람에게 「중지된 계정입니다」를
 * 세우고 있었다.
 *
 * 그리고 못 읽는 까닭 둘에 **같은 지시를 주면 안 된다.** DB 가 잠긴 사람에게
 * 「다시 로그인해 주세요」는 들어올 곳이 없는 데로 보내는 말이고, 그 길로 두 번 헛걸음한다.
 */
const ACCOUNT_UNREADABLE_TEXT: Record<
  'missing' | 'unreachable',
  { readonly title: string; readonly detail: string }
> = {
  missing: {
    title: '계정을 찾지 못했습니다',
    detail: '다시 로그인해 주세요.',
  },
  unreachable: {
    title: '계정을 지금 확인할 수 없습니다',
    detail: '잠시 뒤에 다시 열어 주세요. 다시 로그인해도 달라지지 않습니다.',
  },
} as const;

/**
 * 화면이 계정에서 읽는 칸 — **DB 의 이름이 아니라 우리 이름으로 받는다.**
 *
 * `gateFor` 와 같은 규율이다. 표의 열 이름이 순수 함수까지 들어오면, 열 이름을 고치는
 * 날 판정까지 따라 고쳐야 한다.
 */
export type ScreenAccount = {
  readonly status: string;
  /**
   * 자기 사주를 등록했는가.
   *
   * **이 칸을 안 읽는 화면은 `undefined` 를 준다.** 설정·풀이 목록·프로필은 온보딩을
   * 묻지 않으므로 이 값을 select 하지 않고, 그래서 그 화면들에서는 `onboarding` 이
   * 나오지 않는다. 안 물은 것에 답이 나오는 쪽이 더 나쁘다.
   */
  readonly selfPersonId?: string | null;
};

/**
 * 계정을 읽어 본 결과 — **못 읽었으면 왜 못 읽었는지까지.**
 *
 * `maybeSingle()` 이 세 가지로 온다: 행이 있거나 · 0행이거나(`data: null`, 오류 없음) ·
 * 터졌거나(`error`). 열넷 중 열셋이 `error` 를 안 봐서 뒤의 둘이 한 덩어리였다.
 */
export type AccountRead =
  | { readonly ok: true; readonly account: ScreenAccount }
  | { readonly ok: false; readonly reason: 'missing' | 'unreachable' };

/** 계정이 지금 어디에 서 있는가 — 다섯 중 하나다(ADR 0048) */
export type AccountState =
  /**
   * 다 갖췄다. **자기 사주를 함께 들고 간다** — 이 값이 `null` 이면 `onboarding` 이므로,
   * 그 칸을 읽은 화면에서 여기 오는 값은 반드시 있다. 안 읽은 화면에는 `null` 이 서고,
   * 그 화면은 어차피 이 값을 안 쓴다.
   */
  | { readonly kind: 'active'; readonly selfPersonId: string | null }
  | { readonly kind: 'onboarding' }
  | { readonly kind: 'halted'; readonly status: string }
  | { readonly kind: 'missing' }
  | { readonly kind: 'unreachable' };

/**
 * **판정은 여기 하나뿐이다** — 그리는 것은 화면마다 다르다(ADR 0048).
 *
 * `/me` 아래 화면이 모두 같은 것을 먼저 물었고, 아홉 벌이 같은 답을 하지 않았다. 순수
 * 함수라 시험이 다섯 자리를 전부 밟는다 — 브라우저 없이.
 */
export function accountStateOf(read: AccountRead): AccountState {
  if (!read.ok) return { kind: read.reason };

  const { status, selfPersonId } = read.account;
  if (!isActiveAccount(status)) return { kind: 'halted', status };
  if (selfPersonId === null) return { kind: 'onboarding' };
  return { kind: 'active', selfPersonId: selfPersonId ?? null };
}

/**
 * 화면을 못 그리는 자리인가 — **안내문 하나로 대신하는 셋.**
 *
 * `onboarding` 은 여기 안 든다. 막힌 것이 아니라 아직 안 한 것이고, 화면마다 다르게
 * 맞아 준다. 아홉 화면이 이 술어 하나를 쓰면, 상태가 하나 늘어나는 날 안 고쳐질 자리가
 * 없다 — 그것이 `haltedText` 를 한 자리에 둔 것과 같은 까닭이다.
 */
export const isBlocked = (
  state: AccountState,
): state is Extract<AccountState, { kind: 'halted' | 'missing' | 'unreachable' }> =>
  state.kind === 'halted' || state.kind === 'missing' || state.kind === 'unreachable';

/**
 * 자기 사주가 무엇인가 — **없으면 `null`.**
 *
 * 온보딩과 막힌 자리를 같은 `null` 로 낸다. 이 값을 쓰는 화면들은 「내 것을 목록에서
 * 뺀다」·「내 카드를 편다」처럼 **있으면 쓰고 없으면 안 쓰는** 일만 하므로, 왜 없는지를
 * 다시 가를 까닭이 없다. 왜 없는지가 중요한 자리는 `state.kind` 를 그대로 본다.
 */
export const selfPersonIdOf = (state: AccountState): string | null =>
  state.kind === 'active' ? state.selfPersonId : null;

/**
 * 화면이 상태 하나로 문장을 얻는 자리 — **`active` 와 `onboarding` 은 할 말이 없다.**
 *
 * 온보딩은 막힌 것이 아니라 아직 안 한 것이라, 회색 안내문이 아니라 자기 카드를 편다
 * (`Onboarding`).
 */
export function accountNoticeOf(
  state: AccountState,
): { readonly title: string; readonly detail: string } | null {
  if (state.kind === 'halted') return haltedText(state.status);
  if (state.kind === 'missing' || state.kind === 'unreachable') {
    return ACCOUNT_UNREADABLE_TEXT[state.kind];
  }
  return null;
}

/**
 * 떠나기 전에 읽는 말.
 *
 * **화면이 약속한 것과 실제로 벌어지는 일이 반대였다.**
 *
 * 이 문구는 「두 사람의 기록은 한쪽이 지울 수 없습니다」라고 적고 있었다. 그때는 참이었다 —
 * 삭제 절차가 없었고 공유 결과를 어떻게 할지 정하지 않았기 때문이다. ADR 0023 이 그것을
 * 정하면서 반대가 됐다: `match` 는 양쪽 `app_user` 에 cascade 라 한쪽이 나가면 Match 와
 * 그 공유 결과가 **양쪽 화면에서 사라진다.** 고를 수 있는 다른 답이 없다 — 공유 결과는
 * 서버가 두 판본을 읽어 자르는 것이라(ADR 0010) 한쪽이 사라지면 그 화면은 설 수 없다.
 *
 * 누르기 **전에** 읽는 말이 실제와 반대이면, 그건 안내가 아니라 잘못된 약속이다.
 *
 * 「그 자리에서 지워지지 않는다」도 고친다. 처리방침이 「요청하시면 그 시점에 파기」라고
 * 적으므로, 여기서 「운영자가 나중에」라고 말하면 두 문서가 서로 다른 것을 약속한다.
 * 처리 기한을 말한다.
 */
export const DELETION_NOTE =
  '삭제를 요청하면 인연 찾기 참여가 즉시 꺼지고, 답을 기다리던 요청이 정리되며, 새 요청과 풀이 생성이 막힙니다. 저장된 자료는 운영자가 확인한 뒤 영업일 기준 3일 이내에 지웁니다. 함께 보기로 한 궁합이 있다면 그 관계와 결과는 상대 화면에서도 함께 사라집니다.';

/** 되돌리는 길이 화면에 없다는 것을 누르기 전에 말한다 */
export const DELETION_IRREVERSIBLE_NOTE =
  '이 화면에서 되돌리는 버튼은 없습니다. 잘못 눌렀다면 운영자에게 알려 주세요.';

/**
 * 신고 사유 — **이름은 DB 의 검사식과 같고, 뜻은 여기가 든다.**
 *
 * 고른 것만 받는다. 자유 서술만 받으면 운영자가 매번 읽어서 분류해야 하고, 분류가
 * 사람마다 달라져 「무엇이 몇 건인가」를 셀 수 없다.
 */
export const REPORT_REASONS = [
  { value: 'harassment', label: '괴롭힘이나 위협' },
  { value: 'impersonation', label: '사칭이나 거짓 정보' },
  { value: 'inappropriate', label: '부적절한 내용' },
  { value: 'other', label: '그 밖의 이유' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];


/**
 * 신고는 차단이 아니다 — **누르기 전에 그 차이를 읽힌다.**
 *
 * 나란히 놓인 두 버튼이 같은 무게로 읽히면, 운영자가 봐야 할 일이 조용한 차단으로
 * 끝나거나 그 반대가 된다.
 */
export const REPORT_NOTE =
  '신고는 운영자에게 기록을 남기는 것입니다. 상대에게는 알리지 않고, 이 사람이 인연 목록에서 사라지지도 않습니다 — 보이지 않게 하려면 차단을 함께 눌러 주세요.';

export const REPORT_DETAIL_MAX = 1000;
