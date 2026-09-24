import type { ReportReason } from '.';

/**
 * 경고를 받은 사람에게 **무엇을 말하는가** — 갈래 · 경고한 날 · 이의 제기의 길 · 안내번호, 그것뿐이다 (ADR 0108, G-57).
 *
 * 2026-09-24 에 운영자가 문구를 표로 승인했다. 판단 근거 · 신고한 사람 · 신고 시각 · 고른 메시지 · **경고 횟수**는 싣지
 * 않는다 — 문(`my_warning_notice`)이 애초에 안 내주고, 여기도 받을 자리가 없다. 화면은 이 값을 그리기만 한다(ADR 0080).
 */

/**
 * 고객 문의 이메일 — **아직 없다.** 사업자 명의의 주소는 사업자등록 뒤에 선다(G-25 ㉡). 그때까지 자리 표시로 두고,
 * 공개 출시로 옮기는 날 `scripts/code-rules.test.ts` 가 이메일 모양이 아니면 붉힌다. 운영 DB 에 경고는 0건이다(2026-09-24).
 * ［출시 전 운영자·변호사 확인］
 */
export const SUPPORT_EMAIL = '［고객 문의 이메일］';

/** 갈래마다 한 줄의 가운데 — 표 승인 그대로다. `other` 는 넓은 말로 한다(ADR 0108 의 2) */
const CATEGORY_PHRASE: Readonly<Record<ReportReason, string>> = {
  harassment: '괴롭힘이나 위협에 해당하는',
  impersonation: '사칭이나 거짓 정보에 해당하는',
  inappropriate: '부적절한 내용에 해당하는',
  other: '운영정책에 어긋나는',
};

export const WARNING_NOTICE_TITLE = '운영정책 위반으로 경고를 받았습니다';
export const WARNING_ACKNOWLEDGE_LABEL = '확인했습니다';

/** 문이 내준 경고 하나 — 이 셋 말고는 없다 */
export type WarningNotice = {
  /** `W-` 와 네 글자 */
  readonly ref: string;
  /** 경고의 갈래 — 신고 사유와 같은 넷. 모르는 값은 `other` 로 말한다 */
  readonly category: string;
  /** 경고한 날 — 한국 날짜 `YYYY-MM-DD` */
  readonly warnedOn: string;
};

/**
 * 경고한 날 — 앱의 다른 날짜와 같은 표기(「2026년 9월 24일」, `readingDate` · 채팅의 날짜). 문이 이미 한국 날짜로 잘라
 * 내주므로 여기서는 시간대를 옮기지 않는다 — 자정 언저리에 하루가 밀리지 않게 UTC 의 그날로 읽는다.
 */
export const warningDateLabel = (day: string): string =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('ko-KR', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const phraseOf = (category: string): string =>
  CATEGORY_PHRASE[category as ReportReason] ?? CATEGORY_PHRASE.other;

/** 안내의 줄 넷 — 차례도 표 승인 그대로다 */
export function warningNoticeLines(notice: WarningNotice, supportEmail: string = SUPPORT_EMAIL): readonly string[] {
  return [
    `${warningDateLabel(notice.warnedOn)}에 ${phraseOf(notice.category)} 이용이 확인되어 경고를 드립니다.`,
    '같은 일이 반복되면 이용이 제한될 수 있습니다.',
    `이 경고에 이의가 있으면 ${supportEmail}로 알려 주세요. 3영업일 안에 답을 드립니다.`,
    `문의하실 때 안내번호 ${notice.ref}를 함께 적어 주세요.`,
  ];
}

/**
 * 안내번호 — `W-` 와 네 글자. 글자는 헷갈리는 0 · 1 · I · L · O · U 를 뺀 서른이다(DB 의 검사식 `warning_ref_shape` 과 같다).
 */
const WARNING_REF = /^W-[2-9A-HJKMNP-TV-Z]{4}$/;

/**
 * 운영자가 친 안내번호를 표의 모양으로 — 빈칸 · 소문자 · 하이픈 없이 친 것(`w7k3f`) · 앞 글자 없이 친 것(`7K3F`)도 받는다.
 * 모양이 아니면 `null`.
 */
export function warningRefOf(typed: string): string | null {
  const bare = typed.replace(/\s/g, '').toUpperCase();
  /* 「W-」를 쳤으면 그 뒤가 번호다. 안 쳤으면 다섯 글자일 때만 앞의 W 를 뗀다 — 네 글자 번호도 W 로 시작할 수 있다 */
  const code = bare.startsWith('W-') ? bare.slice(2) : bare.length === 5 && bare.startsWith('W') ? bare.slice(1) : bare;
  const ref = `W-${code}`;
  return WARNING_REF.test(ref) ? ref : null;
}
