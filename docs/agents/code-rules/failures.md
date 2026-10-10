# 코드 규칙 — 실패

색인은 `CODING_STANDARDS.md` 다.

## 실패를 말하는 법

**문(DB 를 읽는 `.ts`)은 셋으로 가른다**(ADR 0078, `docs/architecture.md`).

| 무엇 | 어떻게 | 어디서 |
| --- | --- | --- |
| 없으면 화면의 뜻이 무너지는 **본체** | `throw dbFailure(error, '문 이름')` — 오류 경계가 받는다 | `app/db-error.ts` |
| 없어도 본체가 서는 **부속 정보** | `SkippableRead` 로 값을 낸다(`read` / `unread`) — 화면이 그 자리만 비운다 | 같은 곳 |
| 문은 성공했고 자료가 없음 | `null` · `[]` · `0` | |

**서버 액션은 값으로 낸다** — `{ ok: false, message: userFacingDbMessage(error, '문 이름') }`.
폼이 그 문장을 세운다. **던지는 문을 부르면 그 부름 하나를 `try` 로 받아**
`{ ok: false, message: answerOfThrown(thrown, '자리') }` 로 낸다 — 액션이 던지면 운영의 Next 가 문장을
영어 안내로 바꾼다. `answerOfThrown` 은 `DbFailure`(`dbFailure` 가 지은 우리말)만 옮기고 나머지는 기록에
보낸 뒤 일반 문장을 세운다. `app/actions.boundary.test.ts` 가 받지 않은 부름을 센다.

**클라이언트가 액션을 부르는 자리는 `actionAnswer(부름)` 을 지난다**(`app/ui/action-answer.ts`, ADR 0164) — 값으로 답하는 액션도 부름 자체는
던질 수 있다(망 · 배포 직후 액션 id 불일치 · 받지 않은 예외). 받지 않으면 오류 경계로 올라가 입력이 사라진다. 래퍼는 던진 것을
`{ ok: false, message }` 로 접고 `redirect()` 의 이동 표지는 다시 던진다. 이미 제 문장으로 받는 `try … catch` · `.catch(…)` 는 그대로다.
`app/action-calls.boundary.test.ts` 가 `'use client'` 파일의 부름을 세고, 아직 안 받는 자리는 목록으로 줄어들기만 한다. **화면 안에서 한 칸을
못 읽은 줄**과 폼의 실패 줄은 `FailureLine`(`app/ui/failure-line.tsx` — 붉은 줄 · `role="alert"` · 읽기 실패면 「다시 시도하기」 · 세션이 끝난 문장이면
「다시 로그인」)이다. 부품 밖의 `role="alert"` 는 `app/failure-lines.boundary.test.ts` 의 목록뿐이다.

넷 다 한 가지를 지킨다: **`error.message` 를 사용자에게 그대로 내지 않는다.** 우리가 쓴 한국어
거절만 옮기고 나머지는 `console.error` 로 기록에 보낸다 — `app/db-error.boundary.test.ts` 가
모든 파일을 훑는다(#67). `if (error) return null` 은 「DB 실패」와 「없음」을 한 값으로 합치므로
새로 쓰지 않는다. 남은 하나는 지문으로 잠겨 있다. `error` 를 꺼내지도 않는 자리는 이제 없다 — 예산 0 이다.

**엔진과 도메인 lib** 은 DB 를 모르므로 다르다 — 사용자가 고칠 수 있는 것은 **값**으로
(`hour: null` · `unresolved` · `candidate`), 고칠 수 없는 것은 **예외**로(`InvalidSajuInputError`).
`docs/context/chart.md` 「입력」 항목이 그 경계다.

**`console`** — 앱(`src/` · `app/`)에 `console.log` 는 없다. `console.error` 는 답을 안 바꾸고 **기록에만**
남기는 자리뿐이고, 2026-09-28 에 잰 값으로 호출 스물셋 · 파일 열넷이다(`grep -rn 'console\.error' app src`, 시험 파일 제외).
갈래는 다섯이다 — ① 못 옮긴 DB 오류의 원문(`app/db-error.ts` 한 곳). ② 답에 안 싣는 거절 까닭: webhook 의
서명 거절(G-23 ⑧)과 결제 알림을 반영하지 않은 까닭(서명 · 금액 거절 · 닫힌 주문, G-23 ⑥). ③ 운영자 거절 기록을
못 적은 것과 ④ 접속기록 반출 실패(ADR 0105). ⑤ **뒤에서 받치는 쓰기를 못 한 것** — 복구기 · 만료가 닫을 일감을
못 닫음(응답 뒤 `after` 에서 풀이를 못 떠나보낸 것 포함), 오행 요약 · 발견 참여 갱신 실패, webhook 처리 표시, 동의 당시 명식이 없는 옛 Match, 활동을 못 적음(`app/auth/signed-in.ts`, ADR 0118). ⑤ 는 결과를 버리는
쓰기의 대신이다(`docs/agents/code-rules/escapes.md` 의 탈출구 표). 새 자리는 이 다섯 중 하나여야 한다. 찍어 보는 자리는 `scripts/` 와, 사람이 읽으려고
돌리는 `*.live.test.ts` 다.

**화면이 서버보다 먼저 서는 누름**(낙관적 갱신 — 덱의 지나치기, ADR 0115 「2026-10-08 덧」)은 실패하면 누르기 전 상태로 돌아가야 한다.
시험은 「누름 → 실패 되돌림」이 누르기 전 상태와 **같은가**를 목록의 경계에서 잰다 — 빈 목록과 꽉 찬 목록. 넣으면서 자르는 목록은
꽉 찼을 때 밀려난 줄이 있고, 실패한 한 줄만 빼면 그 줄이 사라진다(#539, `app/me/matching/deck-state.test.ts`).
**채팅의 보내기는 갈래가 다르다**(ADR 0155 「2026-10-11 덧」) — 되돌리지 않고 **실패한 말을 제자리에 남긴다**(카카오톡의 방식). 곁에
실패 단추가 서고 사람이 다시 보내거나 지운다. 다시 보내기는 같은 전송 id 로 가서 서버가 두 번 남기지 않는다. 액션의 예외 ·
시한(15초)도 그 말 하나의 실패로 받는다 — 트랜지션 안에서 던져 오류 경계로 올라가면 화면 전체가 바뀌고 쓴 글을 잃는다.
시험은 `app/me/chat/[matchId]/pending.test.ts`(제자리 · id 짝짓기 · 시한)와 `e2e/chat.spec.ts`(끊긴 전송)다.
