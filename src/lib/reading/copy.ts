/**
 * 로그인 전 결과 · 풀이 화면의 **문구 상수만** 모은 파일이다(ADR 0159).
 *
 * 여기에는 `export const 이름 = '글자';` 만 선다 — import · 함수 · 계산 · 키 · 경로 · 설정값은 두지 않는다. CI 계획기
 * (`scripts/ci-plan.mjs` 의 `COPY_FILES`)가 이 파일의 문자열 값만 바뀐 PR 을 「문구만 바뀐 파일」로 세므로, 화면에 서는
 * 글자가 아닌 값을 여기 두면 그 값이 바뀌어도 동작 검사가 안 선다. 모양과 「화면의 글자 자리만 부른다」는 `scripts/ci-plan.test.ts` 가 잰다.
 */

/**
 * 잠긴 목차 첫 절 — 로그인 전 사주 문단이 못 섰을 때(운영자 결정 2026-10-10 「b로 적용하자」, 문구 대장 34).
 *
 * - 실패 · 시간 초과로 다음 시도가 열려 있을 때의 줄과 그 단추 — 누르면 같은 입력으로 다시 묻는다
 * - 한도 · 같은 입력이 세 번 실패 · 서버가 닫음 — 단추 없이 이 줄만
 */
export const TASTE_FAILED_NOTE = '첫 문단을 쓰지 못했어요.';
export const TASTE_RETRY_LABEL = '다시 시도하기';
export const TASTE_CLOSED_NOTE = '지금은 첫 문단을 열 수 없어요.';

/** 기다리는 동안 첫 절 위의 한 줄 — 뒤에 「작성 중…」(`READING_OUTLINE_STATE.writing`)이 붙는다 */
export const TASTE_WRITING_SUBJECT = '첫 문단';
