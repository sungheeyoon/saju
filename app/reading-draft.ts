/** 같은 탭에서 로그인을 다녀오는 동안 입력을 들고 있는 자리 — 출생 정보는 로그인이 돌아올 주소에 싣지 않는다 */
export const READING_DRAFT_KEY = 'saju:reading-draft';

/**
 * 첫 화면의 궁합 맛보기에서 넣은 **두 사람** — 로그인을 다녀와 `/compat` 의 두 칸을 채운다(ADR 0131).
 * 값은 궁합 화면이 주소 `#` 뒤에서 읽는 모양(`a.` · `b.` 접두사) 그대로다.
 */
export const PAIR_DRAFT_KEY = 'saju:pair-draft';

/** 돌아온 주소의 `#` 뒤 낱말 → 입력을 든 자리. 낱말은 `src/lib/consent/return-path.ts` 의 돌아올 곳과 같다 */
export const RESUME_DRAFTS: Readonly<Record<string, string>> = {
  'resume-reading': READING_DRAFT_KEY,
  'resume-pair': PAIR_DRAFT_KEY,
};
