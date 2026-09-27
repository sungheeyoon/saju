/**
 * 검사가 쓰는 종료일 — **오늘에서 센다.** 서울 날짜로 `monthsAhead` 달 뒤의 1일이다.
 *
 * 한동안 `2026-10-31` 을 적어 두었다. 운영의 종료일과 같은 값이라 맞아 보였지만, 그날이
 * 지나면 DB 가 베타를 끝난 것으로 읽어 가입부터 닫히고 — 흐름 검사도 로그인 e2e 도
 * 아무것도 안 고쳤는데 붉어진다. 검사가 재려는 것은 「열려 있는 동안」이지 운영이
 * 약속한 그날이 아니다.
 *
 * **날이 아니라 달로 센다.** 검사는 자정을 걸쳐 돌 수 있고, e2e 는 워커마다 따로 센다 —
 * 날로 세면 도는 도중에 값이 바뀌어 새 일정 줄이 서고 앞선 계정이 모두 안내로 돌아간다.
 * 달로 세면 그 자리가 한 해에 열두 번이다. 기본값(2)은 29~62일 뒤라(가장 짧은 것이 1월
 * 31일 → 3월 1일) DB 가 서울 날짜로 세든 UTC 로 세든 4주가 넘게 남는다.
 *
 * 흐름 검사(`scripts/notice.mjs` 의 `scheduleBeta`)와 로그인 e2e(`e2e/session.ts`)가 이
 * 함수 하나를 쓴다 — 값을 적는 자리는 여기 하나다. pgTAP 의 `tests.beta_ends_on()`
 * (`supabase/tests/00_helpers.sql`)이 같은 규칙이다.
 *
 * **따로 선 파일인 까닭** — Playwright 는 e2e 를 CommonJS 로 옮겨 싣는데, `notice.mjs` 는
 * `import.meta` 로 원본을 읽어서 거기서 넘어진다. 순수 함수만 여기 둔다.
 */
export function checkEndsOn(now = new Date(), monthsAhead = 2) {
  const [year, month] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  })
    .format(now)
    .split('-')
    .map(Number);
  return new Date(Date.UTC(year, month - 1 + monthsAhead, 1)).toISOString().slice(0, 10);
}
