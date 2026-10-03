/** 같은 탭에서 로그인을 다녀오는 동안 입력을 들고 있는 자리 — 출생 정보는 로그인이 돌아올 주소에 싣지 않는다 */
export const READING_DRAFT_KEY = 'saju:reading-draft';

/**
 * 같은 탭에서 가입을 다녀오는 동안 **로그인 전 사주 문단의 세션 id** 를 들고 있는 자리(ADR 0143) — 불투명한 id 하나뿐이다.
 * 문단 원문 · 물음 · 근거는 브라우저가 들고 가지 않는다. 「이 사주가 내 사주 맞나요?」가 저장한 뒤 이 id 로 세션을 붙이고
 * (`claimTaste`) **답이 났을 때만** 지운다 — 답이 안 났으면(`retryable`) 남겨 두고 다시 시도한다(`app/carried-taste.ts`).
 * id 하나로는 아무것도 못 읽는다 — 서버가 쿠키의 HMAC 과 다시 잰 지문을 함께 맞춘다.
 */
export const TASTE_SESSION_KEY = 'saju:taste-session';

/**
 * 「방금 붙였다」는 한 번짜리 표 — 귀속이 `claimed` 로 답한 그 탭에서만 서고, 내 사주풀이 화면이 처음 그려질 때 **읽고 곧바로
 * 지운다**. 그 화면은 이 표가 있을 때만 풀이권 확인창을 스스로 연다(ADR 0143 「덧」). 귀속 표 쿠키(`saju_taste_claim`)는
 * 첫 누름까지 남아 있어 「도착했다」를 말하지 못한다 — 쿠키로 판단하면 새로고침 · 뒤로가기마다 창이 다시 열린다.
 */
export const TASTE_ARRIVAL_KEY = 'saju:taste-arrival';

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
