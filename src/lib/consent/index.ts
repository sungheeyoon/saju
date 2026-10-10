export * from './gate';
export * from './return-path';
export * from './notice';
export * from './schedule';
export * from './disclosure';
export * from './counts';

import { ELEMENT_KO } from '../saju';
import { knownElementsOf } from '../discovery';
import type { ReadingKind } from '../reading';

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
  /**
   * 7일 답이 없어 만료됐다 (ADR 0038).
   *
   * `cancelled`(스스로 거둠)·`invalidated`(입력이 바뀜)와 갈라 둔다. 셋 다 「성립하지
   * 않았다」지만 사용자가 알아야 하는 것은 이유다 — 만료는 **아무도 아무것도 안 한 것**이고,
   * 그때 예약해 둔 풀이권이 돌아온다.
   */
  'expired',
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
    sent: '상대의 답을 기다리고 있어요.',
    received: '아직 답하지 않은 요청이에요.',
  },
  accepted: {
    label: '성립',
    sent: '상대가 수락해 인연 궁합이 열렸어요.',
    received: '수락해서 인연 궁합이 열렸어요.',
  },
  rejected: {
    label: '거절',
    sent: '상대가 요청을 거절했어요.',
    received: '요청을 거절했어요.',
  },
  invalidated: {
    label: '무효',
    sent: '한쪽의 출생 정보가 바뀌어 요청이 무효가 됐어요. 요청할 때와 계산할 사주가 달라졌기 때문이에요.',
    received: '한쪽의 출생 정보가 바뀌어 요청이 무효가 됐어요. 요청할 때와 계산할 사주가 달라졌기 때문이에요.',
  },
  cancelled: {
    label: '거둠',
    sent: '보낸 요청을 거뒀어요.',
    received: '상대가 거둔 요청이에요.',
  },
  expired: {
    label: '만료',
    sent: '7일 동안 답이 없어 요청이 만료됐어요. 잡고 있던 풀이권은 돌아왔어요.',
    received: '답하지 않은 채 7일이 지나 요청이 만료됐어요.',
  },
};

/** 앱 내 알림이 다루는 사건 — 이름은 DB 의 검사식과 같다 */
export const NOTIFICATION_KINDS = [
  'request_received',
  'request_accepted',
  'request_rejected',
  'request_invalidated',
  /**
   * 7일 답이 없어 만료됐다 — **요청한 쪽에만 선다** (ADR 0038).
   *
   * 받은 쪽은 답을 안 한 것이라 알릴 일이 없고, 알리면 「답하지 않았다」를 두드리는
   * 도구가 된다. 요청자는 **잡고 있던 풀이권이 돌아왔다**는 것을 알아야 한다 — 조용히
   * 사라지면 쓰지도 않은 것을 잃은 줄 안다.
   */
  'request_expired',
  /**
   * 풀이가 다 됐다 — **연 사람에게 선다. 인연 궁합은 두 사람 다에게 선다**(ADR 0157).
   *
   * 몇 분짜리 일 앞에서 다른 화면으로 가도 되게 만들었으므로(ADR 0016) 「누른 사람은 결과를 그 자리에서 본다」는 참이 아니다.
   * 인연 궁합의 상대는 자기가 보던 글이 바뀐 것을 알아야 한다. 결과 화면이 그 글을 보이면 그 풀이의 완성 소식은 읽음이 된다
   * (`mark_reading_ready_read`).
   */
  'reading_ready',
  /**
   * 만들다 실패했다 — **누른 사람에게 선다.**
   *
   * 만드는 일이 누름에서 떨어져 나온 뒤로(ADR 0016) 탭을 닫으면 실패를 말할 화면이
   * 없다. 그 대상의 화면으로 다시 걸어 들어와야만 보이는데, 비공개 궁합은 두 사람을
   * 다시 골라야 닿는 자리다. **조용한 실패를 남기지 않는다.**
   */
  'reading_failed',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * 알림 한 줄이 말하는 **사건.**
 *
 * 별명 하나만 받던 자리다. 실패가 들어오면서 그것으로 부족해졌다 — **실패는 사람이
 * 아니라 대상으로 알아본다.** 자기 풀이도 비공개 궁합도 상대가 없으므로, 별명만으로는
 * 「무엇을 다시 눌러야 하는지」가 문장에 안 실린다.
 */
type NotificationEvent = {
  readonly kind: NotificationKind;
  /** 상대의 별명. 상대가 없는 사건이거나 프로필을 못 읽으면 `null` */
  readonly nickname: string | null;
  /** 풀이 소식(`reading_ready` · `reading_failed`)이 무엇을 만들었나. 다른 사건 · 인연 궁합의 완성 소식에는 없다 */
  readonly readingKind: ReadingKind | null;
  /**
   * 그 풀이의 두 사람을 **내가 부르는 이름** — 완성 소식이 누구의 것인지 말한다(ADR 0157). 내 사주 · 못 읽음이면 `null`.
   * 실패 소식은 아직 이 이름을 안 쓴다(대장의 확정 문구 그대로다).
   */
  readonly readingLabels?: readonly [string | null, string | null];
  /**
   * 이 줄을 누르면 다시 시도할 자리로 가는가(`app/me/requests/inbox.ts` 의 `destinationFor` 가 주소를 냈나).
   * 「이 알림을 눌러」는 눌리는 줄에만 참이다. 없으면 안 눌리는 줄로 본다
   */
  readonly tappable?: boolean;
};

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
export function notificationText({
  kind,
  nickname,
  readingKind,
  readingLabels = [null, null],
  tappable = false,
}: NotificationEvent): string {
  const who = nickname?.trim() ?? '';

  switch (kind) {
    case 'request_received':
      return who === ''
        ? '상세 궁합을 함께 보자는 요청이 왔어요'
        : `${who} 님이 상세 궁합을 함께 보자고 요청했어요`;
    case 'request_accepted':
      return who === ''
        ? '요청이 수락돼 인연 궁합이 열렸어요'
        : `${who} 님과 인연 궁합이 열렸어요`;
    case 'request_rejected':
      return who === ''
        ? '상대가 요청을 거절했어요'
        : `${who} 님이 요청을 거절했어요`;
    case 'request_invalidated':
      return who === ''
        ? '출생 정보가 바뀌어 요청이 무효가 됐어요'
        : `${who} 님과의 요청이 출생 정보가 바뀌어 무효가 됐어요`;
    case 'request_expired':
      return who === ''
        ? '답이 없어 요청이 만료됐어요. 잡고 있던 풀이권은 돌아왔어요.'
        : `${who} 님에게 보낸 요청이 만료됐어요. 잡고 있던 풀이권은 돌아왔어요.`;
    case 'reading_ready': {
      /* 인연 궁합 — 완성 소식은 시도 대신 Match 를 가리켜 `readingKind` 가 없다. 두 사람 다 같은 문장으로 상대를 부른다 */
      if (readingKind === null || readingKind === 'match') {
        return who === '' ? '인연 궁합이 완성됐어요' : `${who} 님과의 인연 궁합이 완성됐어요`;
      }
      return `${readyReadingName(readingKind, readingLabels)}가 완성됐어요`;
    }
    /**
     * **무엇을 만들다 실패했고, 어디서 다시 누르는가**를 말한다(운영자 2026-09-29, ADR 0135).
     *
     * 「지금 보이는 글은 그대로」는 걷었다 — 처음 만들다 실패하면 보이는 글이 없어 거짓이다. 이미 글이 있던
     * 다시 받기의 실패인지는 알림 행이 모른다(`my_notifications` 는 시도의 종류와 대상만 내고, 그때 글이 있었는지는
     * 안 남긴다). 그래서 갈래 없이 한 꼴이다. 줄이 다시 시도할 자리로 가는 주소를 가지면(`destinationFor`)
     * 「이 알림을 눌러」, 없으면 가는 길을 말로 준다.
     */
    case 'reading_failed': {
      if (readingKind === 'match') {
        const retry = tappable
          ? '이 알림을 눌러 다시 시도해 주세요.'
          : '인연 기록에서 해당 궁합을 열어 다시 시도해 주세요.';
        return who === ''
          ? `인연 궁합을 만들지 못했어요. ${retry}`
          : `${who} 님과의 인연 궁합을 만들지 못했어요. ${retry}`;
      }
      const retry = tappable ? '이 알림을 눌러 다시 시도해 주세요.' : '만들던 풀이 화면에서 다시 시도해 주세요.';
      return `${FAILED_READING_NAME[readingKind ?? 'unknown']}를 만들지 못했어요. ${retry}`;
    }
  }
}

/**
 * 완성 소식이 부르는 이름 — 모두 「풀이」(모음)로 끝나 조사는 「가」다.
 *
 * 이름을 못 읽으면(엣지를 지웠다) 사람을 부르지 않고 실패 소식과 같은 이름까지만 말한다 — 「이름 없음」으로 지어 부르지 않는다.
 * 확정 문구다(대장 15, ADR 0157).
 */
function readyReadingName(
  readingKind: Exclude<ReadingKind, 'match'>,
  [labelA, labelB]: readonly [string | null, string | null],
): string {
  const a = labelA?.trim() ?? '';
  const b = labelB?.trim() ?? '';
  if (readingKind === 'person' && a !== '') return `${a} ${FAILED_READING_NAME.person}`;
  if (readingKind === 'private' && a !== '' && b !== '') return `${a} × ${b} ${FAILED_READING_NAME.private}`;
  return FAILED_READING_NAME[readingKind];
}

/**
 * 실패 소식이 부르는 이름 — 이름이 모두 모음(「이」)으로 끝나 조사는 「를」이다.
 *
 * `private` 은 직접 고른 두 사람의 궁합풀이고, **모르는 값**은 시도 기록을 못 읽은 것이다 — 자기 풀이나
 * 공유 궁합이라고 **지어 말하지 않고** 「풀이」까지만 말한다.
 */
const FAILED_READING_NAME = {
  self: '내 사주풀이',
  person: '사주풀이',
  private: '궁합풀이',
  unknown: '풀이',
} as const;


/**
 * **이 화면이 무엇을 하는 곳인가** — 세 걸음으로 적는다.
 *
 * 문장 하나로 「상세 궁합은 서로 동의한 뒤에 열립니다」라고만 적어 두면 맞는 말이지만
 * 아무것도 알려 주지 않는다. 읽는 사람이 모르는 것은 「동의가 필요하다」가 아니라
 * **내가 지금 무엇을 해야 하고, 그다음에 무슨 일이 일어나며, 끝에 무엇을 보게 되는가**다.
 * 그 셋을 안 적으면 사용자는 「동의」라는 낱말만 보고 약관을 읽는 기분이 된다.
 *
 * 걸음마다 **그 걸음에서 열리지 않는 것**을 함께 적는다. 이 제품이 파는 것이 곧
 * 「아직 안 열렸다」이기 때문이다 — 요청을 보내는 것만으로는 아무것도 열리지 않는다는
 * 사실이 첫 걸음에 없으면, 보내는 일 자체가 무서운 일이 된다.
 *
 * 「판본」은 여기 서지 않는다 — 개념을 처음 만나는 자리에서 우리 내부 낱말로 설명할 수는
 * 없다. 출생 정보를 바꾸면 요청이 취소된다는 사실은 바꾸기 직전의 확인 창이 든다
 * (`INPUT_EDIT_CHANGE_CONFIRM`).
 */
export const CONSENT_FLOW_STEPS = [
  {
    title: '요청을 보냅니다',
    body: '인연 목록에서 마음이 가는 사람에게 「상세 궁합을 함께 보자」고 청합니다. 보내는 것만으로 상대에게 열리는 것은 없고, 상대의 인연 탭에 요청이 하나 뜹니다.',
  },
  {
    title: '상대가 답합니다',
    body: '상대는 서로의 사주팔자 여덟 글자가 공개된다는 안내를 읽은 뒤 수락하거나 거절합니다. 수락하지 않으면 사주팔자는 공개되지 않습니다.',
  },
  {
    title: '둘이 같은 결과를 봅니다',
    body: '수락하면 두 사람의 사주팔자와 자세한 궁합풀이가 양쪽 계정에 함께 열립니다. 정확한 생년월일시와 출생지는 열리지 않습니다.',
  },
] as const;

/**
 * 흐름 아래에 붙는 한 줄 — **답을 기다리는 동안 무엇이 요청을 깨뜨리는가.**
 *
 * `INPUT_EDIT_CHANGE_CONFIRM` 과 같은 사실이지만 **먼저 읽히는 자리**라 낱말이 다르다.
 * 저쪽은 출생 정보를 바꾸려는 사람에게 지금 걸린 요청이 어떻게 되는지 말하고, 여기는
 * 아직 요청을 보내지도 않은 사람에게 규칙 하나를 알려 준다.
 */
export const CONSENT_FLOW_CAVEAT =
  '요청은 보낼 때 저장된 두 사람의 출생 정보로 계산해요. 답을 기다리는 동안 한쪽이 생년월일시 · 출생지 · 계산 옵션을 바꾸면 그 요청은 무효가 돼요. 바뀐 정보로 다시 요청해 주세요.';

/** 받은 요청 카드에서 수락 전에 읽는 한 문장 질문. */
export const MATCH_CONSENT_QUESTION =
  '수락하면 당신의 사주팔자 여덟 글자가 상대에게 공개됩니다. 상대와 자세한 궁합을 함께 보는 데 동의하시겠어요?';

/**
 * 내 출생 정보를 바꾸기 **직전**에 서는 확인 창.
 *
 * 요청은 보낼 때 저장된 두 사람의 출생 정보에 대한 동의라, 어느 한쪽이 여덟 글자를
 * 바꾸면 답을 기다리던 요청이 취소된다. 그 사실을 바꾼 **뒤에** 소식으로만 알면 사고처럼
 * 읽힌다 — 경고는 되돌릴 수 없는 누름 직전에 선다(ADR 0028).
 *
 * 이미 만든 풀이와 성립한 인연 궁합이 그대로라는 것도 함께 말한다. 안 적으면 「바꾸면
 * 다 사라진다」로 읽혀 고칠 것을 못 고친다(`MATCH_RESULT_PINNED_NOTE`).
 */
export const INPUT_EDIT_CHANGE_CONFIRM = {
  title: '출생 정보를 바꿀까요?',
  body: [
    '사주와 궁합이 새 입력으로 다시 계산됩니다.',
    '답을 기다리는 인연 요청은 모두 무효가 되고, 예약된 풀이권은 돌아옵니다. 바뀐 정보로 다시 요청해 주세요.',
    '이미 만든 풀이와 성립한 인연 궁합은 그때의 입력 그대로 남습니다.',
  ],
  confirm: '바꾸고 저장하기',
  cancel: '취소',
} as const;

/** 거절은 되돌리지 않는다 — 누르기 전에 읽힌다 */
export const REJECTION_IS_FINAL_NOTE =
  '거절하면 이 사람은 인연 목록에 다시 나타나지 않고, 같은 요청을 다시 받지도 않습니다.';

/**
 * 차단은 **되돌릴 수 없다** — 누르기 전에 그렇게 말한다.
 *
 * 푸는 문이 없으므로, 무엇이 함께 거둬지는지(요청·함께 보던 궁합)까지 문장이 들어야
 * 누르는 사람이 그 무게를 안다.
 */
export const BLOCK_NOTE =
  '차단하면 서로의 인연 목록에서 사라지고 진행 중인 요청도 거둬집니다. 함께 보던 궁합은 목록에서 내려가지만 기록은 지우지 않습니다. 차단은 되돌릴 수 없습니다.';

/**
 * 결과가 **매인 판본**으로 났다는 말.
 *
 * 이 문장이 없으면 「내 사주를 고쳤는데 이 화면은 왜 그대로인가」에 답할 데가 없다.
 * 미리 적어 두면 그것이 고장이 아니라 **그렇게 하기로 했던 것**이 된다(ADR 0010).
 */
export const MATCH_RESULT_PINNED_NOTE =
  '이 결과는 두 분이 동의한 그때의 출생 정보로 계산했어요. 그 뒤에 누가 출생 정보를 고쳐도 이 결과는 바뀌지 않아요. 바뀐 정보로 보려면 새로 요청해 주세요.';

/**
 * 이 화면의 문장이 어디서 왔는가 — **두 층이 함께 선다.**
 *
 * 관계 표와 그 아래 문장은 저장소의 문장 조립기가 근거에서 곧장 만든 것이고, 사주풀이는
 * 따로 만들어 저장된 현재 결과다. 둘을 구별해 말하지 않으면 사용자는 화면 전체가 한
 * 곳에서 나온 줄로 읽는다.
 *
 * **여기가 「누가 썼는가」를 말하는 유일한 자리다.** 제품이 부르는 이름은 「사주풀이」이고
 * 제목에 도구 이름을 박지 않는다. 한 사람짜리 화면에서는 만드는 버튼 옆의 한 줄도
 * 내렸다(`notes.ts`) — 거기는 표와 모델의 글이 나란히 서지 않는다. 여기는 다르다.
 * 두 층이 한 화면에 함께 서므로 어느 쪽이 계산에서 곧장 나온 것이고 어느 쪽이 모델이
 * 쓴 것인지 적어야 한다 — 그것이 이 문장이 존재하는 이유 자체다.
 *
 * **점수는 사주풀이와 같은 생성 건에서 나온다.** 예전에는 이 자리에 「모델이 붙어도 점수를
 * 새로 만들지 않고 `match-v0` 를 설명한다」고 적혀 있었다. 그 결정은 폐기됐다 — 점수는
 * 계산된 기준점에서 모델이 움직여 내고(ADR 0060·0065), 사용자에게 보이는 점수와 글은
 * **같은 현재 결과 한 벌**이다.
 */
export const MATCH_RESULT_ENGINE_NOTE =
  '표와 그 아래 문장은 계산 결과로 바로 만든 것이에요. 그 아래 궁합풀이와 점수는 언어 모델이 따로 써서 저장해 둔 글이고, 두 분이 같은 글을 봐요.';

/**
 * 결과를 열 수 없을 때 — **빈 화면을 내지 않는다.**
 *
 * 서버가 계산 입력을 읽지 못하는 경우가 실재한다(ADR 0010: 열쇠가 없는 배포). Match 는
 * 성립해 있으므로 「없는 Match」라고 말하면 거짓이고, 아무 말도 안 하면 고장으로 보인다.
 */
export const MATCH_RESULT_CLOSED_NOTE =
  '지금은 이 결과를 열 수 없습니다. 함께 보기로 한 두 분의 동의는 그대로 있고, 결과를 계산하는 쪽이 지금 그때의 출생 정보를 읽지 못하는 것입니다.';

/**
 * 채우는 쪽이 누구인가 — 요청은 **두 방향을 다 보여준다.**
 *
 * 후보 카드는 한 방향뿐이다(상대가 내게 채우는 것). 요청은 서로 무엇을 채우는지가
 * 함께 읽혀야 동의가 무엇에 대한 것인지 알 수 있다.
 */
type SupplyDirection = 'toMe' | 'toThem';

/**
 * 요청 한 줄이 드는 이유 — **후보 카드가 이미 말한 것과 같은 종류다.**
 *
 * 새로 열리는 것이 없다. 참여를 켤 때 「상대의 카드에도 같은 방식으로 내 오행이 몇 글자
 * 나타납니다」라고 이미 적었다(`DISCOVERY_DISCLOSURE`).
 *
 * **두 방향을 여기서 다 짓는다.** 화면이 한 문장을 받아 낱말을 바꿔 쓰면 그때부터 문구는
 * 화면이 쓰는 것이 되고, 고칠 자리가 둘이 된다.
 *
 * **DB 가 준 날값을 받는다** — 모르는 글자를 버리는 규칙(`knownElementsOf`)을 부르는 쪽이
 * 다시 적지 않게(`balanceLabelOf` 와 같은 결). 2026-09-23 까지 요청함·인연 결과의 다섯
 * 자리가 `suppliedText(knownElementsOf(…))` 를 저마다 적었다(G-46).
 */
export function suppliedText(
  raw: readonly string[] | null,
  direction: SupplyDirection,
): string | null {
  const elements = knownElementsOf(raw);
  if (elements.length === 0) return null;

  const named = elements.map((element) => `${ELEMENT_KO[element]}(${element})`).join(' · ');

  return direction === 'toMe'
    ? `나에게 부족한 ${named} 기운을 이 사람이 채워 줘요.`
    : `이 사람에게 부족한 ${named} 기운을 내가 채워 줘요.`;
}
