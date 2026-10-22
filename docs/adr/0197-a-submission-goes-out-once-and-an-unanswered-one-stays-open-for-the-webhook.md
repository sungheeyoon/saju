# 풀이 제출은 한 번만 나가고, 답을 못 받은 제출은 닫지 않고 webhook 을 기다린다

> **결정 전** — 2026-10-22 읽기 감사에서 나온 결정 PR 이다. 운영자가 답하기 전에는 머지하지 않는다(`docs/agents/delegation/decisions.md`
> 「결정 점검표」의 「비용 · 요금 · 외부 서비스 — 토큰이 나가는 호출의 수」와 「실패했을 때 열리는가 닫히는가」).

## 잰 것

`app/me/reading/model.ts` 의 `new OpenAI()` 는 SDK 기본값(재시도 2 · 시간 상한 10분, `node_modules/openai/client.js` 7.8.0)으로
`responses.create({ background: true, stream: true })` 를 낸다. 이 클라이언트는 멱등 머리를 싣지 않는다(`idempotencyHeader` 가
없다). 망을 끊어 넣은 단위 시험(`app/me/reading/submit-unanswered.test.ts`, 이 PR 의 첫 커밋)이 지금의 동작을 보인다:

| 갈래 | 지금(SDK 기본값) |
| --- | --- |
| provider 가 받아 응답을 세운 뒤 망이 끊김 | SDK 가 두 번 더 보낸다 — **provider 쪽 응답 셋**(토큰 세 벌). 시도는 `model-submit-failed` · 쓴 토큰 `null` 로 닫힌다. 셋의 webhook 은 되찾기(`adopt_reading_job` — `submitting` 인 시도만 받는다)가 거절해 모두 건너뛴다. 복구기는 집을 것이 없다 — **결과 셋이 다 버려지고 지출 기록에도 안 남는다**(ADR 0039) |
| provider 가 받고 응답 머리를 안 보냄 | SDK 가 10분을 기다린다 — 누름의 `after` 가 사는 300초 안에 포기하지 않는다. 함수가 끊기면 시도는 `submitting` 으로 남고 webhook 이 이름표로 되찾아 저장한다 |

## 정한 것(안)

1. **제출은 한 번만 보낸다** — `responses.create` 에만 `maxRetries: 0`. 다시 보낼지는 시도를 여는 쪽(사람의 누름 · 복구기)이 정한다.
   회수(`retrieve`)는 같은 것을 다시 읽을 뿐이라 기본값 그대로다.
2. **응답 머리는 30초까지만 기다린다** — `responses.create` 에만 `timeout: 30_000`. SDK 의 상한은 머리가 오면 풀린다 — 본문
   스트림을 읽는 동안에는 안 걸린다(`fetchWithTimeout`).
3. **답을 못 받은 제출은 닫지 않는다** — 망 끊김 · 머리 시간 초과(`OpenAI.APIConnectionError`)는 `model-submit-unanswered` 로
   부르고 파이프라인이 시도를 `submitting` 으로 둔다. provider 가 받았으면 그 webhook 이 이름표로 되찾아 저장하고, 안 닿았으면
   복구기가 기한(`reading_job_deadline()`, 8분)에 `model-timeout` 으로 닫는다. 상태 코드로 거절당한 것(`APIError` 의 나머지) ·
   스트림의 `error` 사건은 지금처럼 `model-submit-failed` 로 바로 닫는다.

## 치르는 값

- provider 에 안 닿은 제출은 사람이 실패를 30초가 아니라 **8분 뒤에** 본다(복구기의 기한).
- 3 을 빼고 1 · 2 만 두면, provider 가 받았는데 30초 안에 머리가 안 온 제출은 지금과 달리 **버려진다**(시험의 둘째 커밋이 그 갈래를 든다).
- 멱등 머리(`Idempotency-Key`)로 재시도를 살리는 길은 Responses API 가 그 머리를 받는지 확인 전이라 고르지 않았다.

## 앞선 결정과의 관계

- ADR 0020 — 제출 · 회수 · 복구기의 뼈대는 그대로다. 「이름표를 결과에 붙여 보내는 것이 우리 쪽 기록보다 먼저다」가 3 의 근거다.
- ADR 0039 — 3 이 버려지던 응답을 저장으로 돌리므로, 그 토큰이 지출 기록에 남는다.
