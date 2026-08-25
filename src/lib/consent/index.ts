import { ELEMENT_KO, type Element } from '../saju';

/**
 * 요청 · 동의 · Match 가 사람에게 하는 **말**.
 *
 * `src/lib/discovery` 와 같은 자리에 선다 — 정책이 문장을 들고, 화면은 글자를 앞에
 * 세우기만 한다(`DISCOVERY_DISCLOSURE` 와 같은 규율). 무엇이 열리고 무엇이 안 열리는지를
 * 화면마다 따로 적으면 한 곳만 고쳐지고, 그때 사용자가 읽은 약속과 실제 동작이 갈린다.
 *
 * ## 여기 **없는** 것
 *
 * 상태 전이 규칙이 없다. pending 이 무엇으로 갈 수 있는지, 무엇이 무효를 부르는지는
 * 전부 DB 안에 있다(`respond_to_match_request` · `invalidate_pending_requests`). 여기
 * 적어 두면 판정하는 자리가 둘이 되고, 둘은 언젠가 어긋난다 — 어긋났을 때 열려 있는
 * 쪽은 언제나 더 바깥이다.
 *
 * 궁합 사실도 지표도 없다. 이 단계가 만드는 것은 **접근 근거**이지 결과가 아니다.
 */

/** 요청이 놓일 수 있는 자리 — 이름은 DB 의 검사식과 같다 */
export const REQUEST_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'invalidated',
  'cancelled',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** 요청을 보는 자리 — 내가 청했는가, 내가 받았는가 */
export type RequestDirection = 'sent' | 'received';

/**
 * 상태를 사람 말로.
 *
 * **`invalidated` 와 `cancelled` 를 갈라서 말한다.** 둘 다 「성립하지 않았다」지만 이유가
 * 다르고, 사용자가 알아야 하는 것은 이유다(US 43). 한 낱말로 합치면 「왜 사라졌는지」에
 * 답할 수 없다.
 */
export const REQUEST_STATUS_TEXT: Record<
  RequestStatus,
  { label: string; sent: string; received: string }
> = {
  pending: {
    label: '기다리는 중',
    sent: '상대가 아직 답하지 않았습니다.',
    received: '답하지 않은 요청입니다.',
  },
  accepted: {
    label: '성립',
    sent: '상대가 수락해 Match 가 되었습니다.',
    received: '수락해 Match 가 되었습니다.',
  },
  rejected: {
    label: '거절',
    sent: '상대가 이번에는 함께 보지 않기로 했습니다.',
    received: '함께 보지 않기로 했습니다.',
  },
  invalidated: {
    label: '무효',
    sent: '어느 한쪽의 출생정보가 바뀌어 요청이 무효가 되었습니다. 동의한 대상과 계산 대상이 달라지기 때문입니다.',
    received:
      '어느 한쪽의 출생정보가 바뀌어 요청이 무효가 되었습니다. 동의한 대상과 계산 대상이 달라지기 때문입니다.',
  },
  cancelled: {
    label: '거둠',
    sent: '보낸 요청을 거뒀습니다.',
    received: '거둬진 요청입니다.',
  },
};

/** 앱 내 알림이 다루는 사건 — 이름은 DB 의 검사식과 같다 */
export const NOTIFICATION_KINDS = [
  'request_received',
  'request_accepted',
  'request_rejected',
  'request_invalidated',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * 알림 한 줄.
 *
 * **DB 는 문장을 저장하지 않는다.** 사건의 종류와 상대만 들고 있고 말은 여기서 난다 —
 * 저장해 두면 문구를 고칠 때 과거 알림이 옛 문장으로 남고, 별명이 바뀌면 알림이 옛
 * 이름을 부른다.
 *
 * 별명을 못 읽는 경우가 있다(상대가 프로필을 지운 뒤). 그때도 사건은 말할 수 있으므로
 * 사람을 부르지 않는 문장으로 낸다 — 「알 수 없는 사람」이라고 지어 부르지 않는다.
 */
export function notificationText(kind: NotificationKind, nickname: string | null): string {
  const who = nickname?.trim() ?? '';

  switch (kind) {
    case 'request_received':
      return who === ''
        ? '상세 궁합을 함께 보자는 요청이 왔습니다.'
        : `${who} 님이 상세 궁합을 함께 보자고 요청했습니다.`;
    case 'request_accepted':
      return who === ''
        ? '요청이 수락되어 Match 가 되었습니다.'
        : `${who} 님과 Match 가 되었습니다.`;
    case 'request_rejected':
      return who === ''
        ? '요청이 거절되었습니다.'
        : `${who} 님이 이번에는 함께 보지 않기로 했습니다.`;
    case 'request_invalidated':
      return who === ''
        ? '출생정보가 바뀌어 요청이 무효가 되었습니다.'
        : `${who} 님과의 요청이 출생정보 수정으로 무효가 되었습니다.`;
  }
}

/**
 * **Match 가 여는 범위** — 보내기 전에도, 수락하기 전에도, 결과 화면에서도 같은 목록을 읽는다.
 *
 * ADR 0008·0012 가 정한 그대로다. 「궁합을 함께 보자」는 동의에는 관계를 통해 서로의
 * 여덟 글자가 전부 드러날 가능성이 포함된다. 그래도 정확한 출생 시각·출생지와 상대 원국
 * 전체 판정까지 여는 동의는 아니다. 두 사람이 읽는 문장은 **같은 한 벌**이어야 한다 —
 * 보내는 쪽과 받는 쪽이 서로 다른 약속을 읽으면 동의가 무엇에 대한 것인지 갈린다.
 *
 * `elementSupport` 와 억부 후보는 오행 구성을 사실상 드러내므로 「일부 오행 구성」이라고
 * **정확히 적는다**(ADR 0008). 빼는 대신 적는 것은, 그게 궁합 그 자체라 뺄 수 없기
 * 때문이다.
 *
 * **결과 화면을 세우면서 한 줄이 늘었다**(ADR 0010). 관계 표는 무엇과 무엇이 걸렸는지를
 * 적으므로 상대의 글자가 그 자리에 선다. 관계 여러 줄의 합이 여덟 글자 전부가 될 수도
 * 있다는 것을 재어 본 뒤, 그것을 가리기보다 Match 의 명시적 동의 범위에 넣었다
 * (ADR 0012). 정확한 출생 원문과 원국 전체 판정은 계속 닫혀 있다.
 */
export const MATCH_DISCLOSURE = {
  shown: [
    '두 사람 사이에 걸리는 형충회합과 고정된 `match-v0` 지표.',
    '그 관계에 걸린 글자와 자리 — 관계를 모두 합치면 상대의 년주·월주·일주·시주 여덟 글자가 전부 보일 수 있습니다.',
    '그 관계를 설명하는 중립적인 해석 — 누가 보든 같은 글입니다.',
    '궁합을 이루는 일부 오행 구성.',
  ],
  hidden: [
    '정확한 생년월일시와 출생지.',
    '상대 원국 하나에 대한 전체 판정 — 십성·신살·신강신약·억부·조후·격국·종격, 원국 안의 형충회합과 운.',
    '상대의 전체 근거 자료와 private Reading, Person 관리권.',
  ],
} as const;

/** 보내기 전에 읽는 말 */
export const REQUEST_INTRO =
  '요청을 보내면 상대의 알림함에 뜹니다. 상대가 수락해야만 아래가 열리고, 수락하지 않으면 지금 보이는 것에서 더 나가지 않습니다.';

/** 수락 전에 읽는 말 — **후보 카드만 본 것은 궁합 동의가 아니다** */
export const CONSENT_INTRO =
  '수락하면 두 사람 사이에 Match 가 성립합니다. 아래가 서로에게 열리는 것이고, 그 밖의 것은 열리지 않습니다.';

/**
 * 요청이 잡아 둔 것 — **사람이 아니라 그때 그 입력에 대한 동의다.**
 *
 * 이 문장이 없으면 무효화가 사고처럼 읽힌다. 미리 적어 두면 실제로 무효가 됐을 때
 * 「그렇게 하기로 했던 것」이 된다.
 */
export const REVISION_BOUND_NOTE =
  '이 요청은 지금 두 사람의 출생정보 판본에 매여 있습니다. 어느 한쪽이 생년월일시·출생지·계산 옵션을 고치면 요청은 무효가 됩니다 — 동의한 대상과 실제 계산 대상이 달라지기 때문입니다. 이름과 메모를 고치는 것은 무효로 만들지 않습니다.';

/** 거절은 되돌리지 않는다 — 누르기 전에 읽힌다 */
export const REJECTION_IS_FINAL_NOTE =
  '거절하면 이 사람은 후보 목록에도 다시 서지 않고, 같은 요청을 다시 받지도 않습니다.';

/**
 * 차단은 「다시 보지 않기」와 다르다 — **되돌릴 수 없다.**
 *
 * 되돌릴 수 없다는 것을 누르기 전에 말한다. 「다시 보지 않기」는 한 번 더 묻지 않고
 * 되돌릴 수 있는 일이라 나란히 놓이면 같은 무게로 읽힌다.
 */
export const BLOCK_NOTE =
  '차단하면 서로의 후보 목록에서 사라지고 살아 있던 요청도 거둬집니다. 이미 성립한 Match 는 목록에서 내려가지만 기록은 지우지 않습니다. 차단은 되돌릴 수 없습니다.';

/** 결과 화면으로 들어가는 말 — 목록에서 읽는다 */
export const MATCH_RESULT_LINK = '함께 보기';

/**
 * 결과 화면 맨 위에 서는 말.
 *
 * **무엇을 보고 있는지부터 말한다.** 요청·수락 화면이 「열릴 것」이라고 적은 그 목록이
 * 여기서 실제로 열린 것이고, 그 밖의 것은 여전히 닫혀 있다 — 같은 한 벌을 여기서도
 * 읽는 이유다(`MATCH_DISCLOSURE`).
 */
export const MATCH_RESULT_INTRO =
  '두 분이 서로 동의해 열린 자리입니다. 여기 서는 것은 두 사람 사이에 걸리는 관계와 고정된 `match-v0` 지표, 그리고 그것을 설명하는 중립적인 문장입니다.';

/**
 * 결과가 **매인 판본**으로 났다는 말.
 *
 * 이 문장이 없으면 「내 사주를 고쳤는데 이 화면은 왜 그대로인가」에 답할 데가 없다.
 * 미리 적어 두면 그것이 고장이 아니라 **그렇게 하기로 했던 것**이 된다(ADR 0010).
 */
export const MATCH_RESULT_PINNED_NOTE =
  '이 결과는 두 분이 동의한 그때의 출생정보 판본으로 계산했습니다. 그 뒤에 어느 쪽이 입력을 고쳤더라도 이 결과는 움직이지 않습니다 — 동의한 대상이 그 판본이기 때문입니다. 새 입력으로 다시 보려면 새 요청이 필요합니다.';

/**
 * 아직 AI 가 없다 — **없는 것을 없다고 말한다.**
 *
 * 여기 선 문장은 저장소의 문장 조립기가 근거에서 곧장 만든 것이다. 그것을 말하지
 * 않으면 사용자는 이미 AI 가 쓴 글을 읽고 있다고 여기고, 나중에 진짜 AI 가 붙었을 때
 * 무엇이 달라졌는지 알 수 없다.
 */
export const MATCH_RESULT_NO_AI_NOTE =
  '이 화면의 문장은 계산 결과에서 곧바로 조립한 것이고 AI 가 쓴 글이 아직 아닙니다. 나중에 AI 해석이 붙어도 점수를 새로 만들지 않고 위의 `match-v0` 를 설명합니다.';

/**
 * 결과를 열 수 없을 때 — **빈 화면을 내지 않는다.**
 *
 * 서버가 계산 입력을 읽지 못하는 경우가 실재한다(ADR 0010: 열쇠가 없는 배포). Match 는
 * 성립해 있으므로 「없는 Match」라고 말하면 거짓이고, 아무 말도 안 하면 고장으로 보인다.
 */
export const MATCH_RESULT_CLOSED_NOTE =
  '지금은 이 결과를 열 수 없습니다. Match 와 두 분의 동의는 그대로 있고, 결과를 계산하는 쪽이 지금 그 판본을 읽지 못하는 것입니다.';

/**
 * 채우는 쪽이 누구인가 — 요청은 **두 방향을 다 보여준다.**
 *
 * 후보 카드는 한 방향뿐이다(상대가 내게 채우는 것). 요청은 서로 무엇을 채우는지가
 * 함께 읽혀야 동의가 무엇에 대한 것인지 알 수 있다.
 */
export type SupplyDirection = 'toMe' | 'toThem';

/**
 * 요청 한 줄이 드는 이유 — **후보 카드가 이미 말한 것과 같은 종류다.**
 *
 * 새로 열리는 것이 없다. 참여를 켤 때 「상대의 카드에도 같은 방식으로 내 오행이 몇 글자
 * 나타납니다」라고 이미 적었다(`DISCOVERY_DISCLOSURE`).
 *
 * **두 방향을 여기서 다 짓는다.** 화면이 한 문장을 받아 낱말을 바꿔 쓰면 그때부터 문구는
 * 화면이 쓰는 것이 되고, 고칠 자리가 둘이 된다.
 */
export function suppliedText(
  elements: readonly Element[],
  direction: SupplyDirection,
): string | null {
  if (elements.length === 0) return null;

  const named = elements.map((element) => `${ELEMENT_KO[element]}(${element})`).join(' · ');

  return direction === 'toMe'
    ? `나에게 부족한 ${named} 기운을 이 사람이 채웁니다.`
    : `이 사람에게 부족한 ${named} 기운을 내가 채웁니다.`;
}
