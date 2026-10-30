import { NOTICE_ACK_LABEL, NOTICE_AGAIN_NOTE, asKoreanDay } from './notice';

/**
 * **가입 폼의 판정과 글자** — 웹(`app/signup`)과 앱(`mobile/src/app/signup.tsx`)이 함께 쓴다.
 * 그리는 일만 각자 한다. 한쪽에만 적으면 거절의 차례와 고지의 글자가 두 화면에서 갈린다(G-123).
 */

/** 가입 폼의 칸 — 거절의 말이 그 칸 곁에 선다 */
export type SignupField = 'code' | 'nickname';

/**
 * **가입 거절이 어느 칸의 것인가** — 말을 그 칸 곁에 세우려고 가른다(2026-10-11 화면 점검).
 *
 * 거절은 폼 맨 아래 한 줄로 섰다 — 「이미 사용 중인 닉네임이에요」가 닉네임 칸에서 한 화면 아래였다. DB 가 내는 거절
 * (`complete_signup`, `20261105090000`)은 칸을 말하지 않으므로 errcode 와 문장으로 가른다:
 *
 * - `23505` — 닉네임 중복 하나뿐이다
 * - `22023` — 닉네임 길이 · 빈 코드. 문장에 「닉네임」이 있으면 닉네임 칸이다
 * - `42501` — 코드(없는 코드 · 여러 번 틀림 · 정원)와 정지된 계정이 같은 코드다. 문장에 「코드」가 있으면 코드 칸이다
 *
 * 나머지(안내가 바뀜 · 테스트가 끝남 · 정지 · 알 수 없는 오류)는 칸이 없다 — 단추 곁에 선다. 틀린 코드가 `false` 로 오는
 * 갈래는 액션이 따로 `code` 를 준다.
 */
export function refusedField(code: string | undefined, message: string): SignupField | null {
  if (code === '23505') return 'nickname';
  if (code === '22023') return message.includes('닉네임') ? 'nickname' : 'code';
  if (code === '42501' && message.includes('코드')) return 'code';
  return null;
}

/** 틀린 코드의 문장 — 없는 코드 · 지난 코드 · 가입이 멈춘 때가 같은 말이다(DB 의 거절과 같은 글자) */
export const WRONG_CODE_NOTE = '사용할 수 없는 코드예요. 코드를 다시 확인해 주세요.';

/** 눌렀을 때 코드 칸이 비어 있으면 — 닉네임은 `missingNickname` 이 제 말을 든다 */
const CODE_MISSING = '테스트 코드를 입력해 주세요.';

/** 눌렀을 때 안내 확인을 안 했으면 — 무엇에 표시하는지는 그 칸의 글자를 그대로 부른다 */
const ACK_MISSING = `‘${NOTICE_ACK_LABEL}’에 표시해 주세요.`;

export const SIGNUP_CODE_MAX = 24;

/** 대문자 하나로만 산다 — DB 검사식과 같은 규칙이라 칸에서 미리 맞춘다 */
export const signupCodeOf = (typed: string): string => typed.toUpperCase().slice(0, SIGNUP_CODE_MAX);

export type SignupGap = { field: SignupField | 'ack'; message: string };

/** 눌렀을 때 **위에서부터 처음 걸린 칸 하나** — 칸을 고치면 말도 다음 칸으로 넘어간다 */
export function signupGap(form: {
  needsCode: boolean;
  code: string;
  /** `missingNickname` 의 답 — 이름을 안 묻는 사람은 `null` */
  nicknameGap: string | null;
  acknowledged: boolean;
}): SignupGap | null {
  if (form.needsCode && form.code.trim().length === 0) return { field: 'code', message: CODE_MISSING };
  if (form.nicknameGap !== null) return { field: 'nickname', message: form.nicknameGap };
  if (!form.acknowledged) return { field: 'ack', message: ACK_MISSING };
  return null;
}

/**
 * `complete_signup` 의 인자. **빈 칸은 `null` 로 보낸다** — 이미 이름이나 코드를 가진 사람은 그 칸을 안 보므로
 * 빈 문자열이 온다. DB 가 그것을 「짓겠다」로 읽으면 2자 미만이라고 거절한다.
 */
export const signupRequest = (answer: {
  code: string;
  nickname: string;
  version: string;
  scheduleId: number;
  improvement: boolean;
  contact: boolean;
}) => ({
  p_code: answer.code.trim() || null,
  p_nickname: answer.nickname.trim() || null,
  p_version: answer.version,
  p_schedule_id: answer.scheduleId,
  p_improvement: answer.improvement,
  p_contact: answer.contact,
});

/** 머리 — 처음 가입과, 처리방침이 바뀌어 다시 확인하는 사람 */
export const SIGNUP_HEAD = {
  first: {
    eyebrow: '가입하기',
    title: '테스트 코드와 닉네임을 입력해 주세요',
    note: '초대받은 분만 이용할 수 있는 비공개 베타예요. 가입에 필요한 정보만 간단히 확인해 주세요.',
  },
  again: {
    eyebrow: '한 번 더 확인해 주세요',
    title: '개인정보 처리방침이 바뀌었습니다',
    note: NOTICE_AGAIN_NOTE,
  },
} as const;

export const SIGNUP_LABEL = {
  code: '테스트 코드',
  codePlaceholder: '예: SAJU1001',
  nickname: '닉네임',
  nicknameNote: '앱에서는 이 닉네임으로 불려요. 프로필 사진과 소개는 가입한 뒤에 추가할 수 있어요.',
  check: '중복 확인',
  checking: '확인하는 중…',
  noticeHead: '가입 전에 확인해 주세요',
  privacy: '개인정보 처리방침',
  optional: '선택 항목',
  signingUp: '가입하는 중…',
  signUp: '가입하고 시작하기',
  confirm: '확인하고 계속하기',
  otherAccount: '다른 계정으로 로그인하기',
} as const;

/** 고지 세 줄의 앞뒤 — 가운데 줄은 날짜만 굵게 세우므로 조각으로 낸다 */
export const SIGNUP_NOTICE_USE = '구글 이메일과 닉네임, 직접 저장한 사주 정보는 서비스 제공에 사용합니다.';
export const SIGNUP_NOTICE_DISCOVERY = '내 사주를 저장하면 인연 찾기에 참여합니다. 참여는 설정에서 언제든 끌 수 있습니다.';
export const signupNoticeDates = (endsOn: string, purgeBy: string) => ({
  ends: asKoreanDay(endsOn),
  purge: asKoreanDay(purgeBy),
  parts: ['베타는 ', '에 종료되며, 저장된 정보는 늦어도 ', '까지 삭제합니다.'] as const,
});
