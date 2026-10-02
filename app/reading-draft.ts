/** 같은 탭에서 로그인을 다녀오는 동안 입력을 들고 있는 자리 — 출생 정보는 로그인이 돌아올 주소에 싣지 않는다 */
export const READING_DRAFT_KEY = 'saju:reading-draft';

/**
 * 같은 탭에서 가입을 다녀오는 동안 **로그인 전 사주 문단의 세션 id** 를 들고 있는 자리(ADR 0143) — 불투명한 id 하나뿐이다.
 * 문단 원문 · 물음 · 근거는 브라우저가 들고 가지 않는다. 「이 사주가 내 사주 맞나요?」가 저장한 뒤 이 id 로 세션을 붙이고
 * (`claimTaste`) 지운다. id 하나로는 아무것도 못 읽는다 — 서버가 쿠키의 HMAC 과 다시 잰 지문을 함께 맞춘다.
 */
export const TASTE_SESSION_KEY = 'saju:taste-session';

/**
 * 첫 화면의 로그인 전 궁합 결과에서 넣은 **두 사람** — 로그인을 다녀와 `/compat` 의 두 칸을 채운다(ADR 0131).
 * 값은 궁합 화면이 주소 `#` 뒤에서 읽는 모양(`a.` · `b.` 접두사) 그대로다.
 */
export const PAIR_DRAFT_KEY = 'saju:pair-draft';

/** 돌아온 주소의 `#` 뒤 낱말 → 입력을 든 자리. 낱말은 `src/lib/consent/return-path.ts` 의 돌아올 곳과 같다 */
export const RESUME_DRAFTS: Readonly<Record<string, string>> = {
  'resume-reading': READING_DRAFT_KEY,
  'resume-pair': PAIR_DRAFT_KEY,
};
