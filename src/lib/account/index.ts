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
export const ACCOUNT_STATUSES = ['active', 'suspended', 'deletion_requested'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const isActiveAccount = (status: string): boolean => status === 'active';

/**
 * 살아 있지 않은 계정에게 하는 말.
 *
 * **이유를 갈라서 말한다.** 운영자가 건 제재와 본인이 낸 요청은 같은 것을 막지만 같은
 * 일이 아니다 — 자기가 요청해서 그렇게 된 사람에게 「중지되었습니다」는 거짓이다.
 */
export const ACCOUNT_HALTED_TEXT: Record<
  Exclude<AccountStatus, 'active'>,
  { readonly title: string; readonly detail: string }
> = {
  suspended: {
    title: '중지된 계정입니다.',
    detail: '저장된 자료는 그대로 있고, 지금은 열어 볼 수 없습니다.',
  },
  deletion_requested: {
    title: '삭제를 요청한 계정입니다.',
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
 * 떠나기 전에 읽는 말.
 *
 * **무엇이 지워지지 않는지를 함께 적는다.** 「삭제」라고만 적으면 누른 사람은 모든 것이
 * 그 자리에서 사라진다고 읽는다. 실제로는 요청이 접수되는 것이고, 이미 공유된 결과처럼
 * 두 사람의 것인 자료는 한쪽이 지울 수 없다(PRD: 무조건 연쇄 삭제하지 않는다).
 */
export const DELETION_NOTE =
  '삭제를 요청하면 인연 찾기 참여가 즉시 꺼지고, 답을 기다리던 요청이 정리되며, 새 요청과 풀이 생성이 막힙니다. 저장된 자료는 그 자리에서 지워지지 않습니다 — 운영자가 처리하며, 이미 함께 보기로 한 궁합처럼 두 사람의 기록은 한쪽이 지울 수 없습니다.';

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

export const isReportReason = (value: string): value is ReportReason =>
  REPORT_REASONS.some((one) => one.value === value);

/**
 * 신고는 차단이 아니다 — **누르기 전에 그 차이를 읽힌다.**
 *
 * 나란히 놓인 두 버튼이 같은 무게로 읽히면, 운영자가 봐야 할 일이 조용한 차단으로
 * 끝나거나 그 반대가 된다.
 */
export const REPORT_NOTE =
  '신고는 운영자에게 기록을 남기는 것입니다. 상대에게는 알리지 않고, 이 사람이 인연 목록에서 사라지지도 않습니다 — 보이지 않게 하려면 차단을 함께 눌러 주세요.';

export const REPORT_DETAIL_MAX = 1000;
