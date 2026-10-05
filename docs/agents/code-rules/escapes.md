# 코드 규칙 — 탈출구

색인은 `docs/agents/code-rules.md` 다.

## 탈출구 — 지문으로 잠겨 있고 줄어들기만 한다

타입이 못 잇는 자리를 사람이 잇는 것들이다. 없애자는 것이 아니라 **늘리지 않는다** —
2026-09-22 에 있던 자리를 `scripts/code-rules.test.ts` 가 `파일 :: 코드` 지문으로 들고, 새 자리는
그 목록에 못 든다. 하나를 고치면 목록에서 지운다(ADR 0085 §3 의 화면 DB 호출과 같은 결).
같은 지문이 둘이면 목록에도 둘을 적는다 — 셋째가 둘째의 이름으로 지나가지 않게.

| 탈출구 | 잰 값 | 대신 |
| --- | --- | --- |
| `x as unknown as T` (`as never as` · `as any as` 도 같은 예산) | 7 | 생성 타입 `Database` 와 `rpcArgs`. `jsonb` 를 내주는 문만 어댑터 안에서 한 번 |
| `x!` | 12 | 좁히기(`if (x === null) return …`), 아니면 없음을 값으로 |
| `if (error) return null` (`if (x.error)` · `if (error \|\| …)` · `if (error !== null)` · `{ return false; }` · `{ ok: false }` 처럼 값이 글자뿐인 객체도 같다) | 1 | `docs/agents/code-rules/failures.md` 「실패를 말하는 법」. 문장을 안 싣는 자리는 `recordDbFailure` 로 원문을 기록에 보낸다 |
| `const { data } = await ….from(…)` — `error` 를 꺼내지도 않는다(`Promise.all` 의 한 칸 포함) | 0 | `{ data, error }` 로 꺼내고 `docs/agents/code-rules/failures.md` 「실패를 말하는 법」 |
| `await x.rpc(…)` 를 문장으로 — 결과를 통째로 버린다(`void` 포함, `.then` · `.catch` 로 받으면 안 센다) | 0 | `const { error } = await …` 로 꺼내고, 뒤에 복구기가 받치는 쓰기라도 `console.error` 로 기록에 남긴다 |
| `eslint-disable` | 화면 DB 호출 4(층 시험이 든다) + 3 | `// eslint-disable-next-line 규칙 -- 까닭` 한 줄. 파일째 끄지 않는다. 까닭 없는 것은 없다(2026-09-26 에 설문의 `exhaustive-deps` 표시를 걷었다) |
| `any` · `@ts-ignore` | 0 · 0 | 린트가 막는다 |
| `@ts-expect-error` | 0 | 시험이 예산 0 으로 든다 |
| 안 걸리는 예외 표시 | 0 | `reportUnusedDisableDirectives` 가 오류로 세운다 |
