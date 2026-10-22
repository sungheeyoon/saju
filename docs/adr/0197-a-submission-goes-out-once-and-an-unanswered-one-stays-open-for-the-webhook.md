# 풀이 제출은 한 번만 나가고, 답을 못 받은 제출은 닫지 않고 webhook 을 기다린다

> **운영자 결정 2026-10-22**(조율자 세션에서 전함) — 권고안 그대로: 제출의 SDK 재시도 **0** · 응답 머리 상한 **30초** · 답을 못 받은
> 제출은 **닫지 않고 webhook · 기한을 기다린다**(커밋 3 유지). 2026-10-22 읽기 감사에서 나온 결정이다(`docs/agents/delegation/decisions.md`
> 「결정 점검표」의 「비용 · 요금 · 외부 서비스 — 토큰이 나가는 호출의 수」와 「실패했을 때 열리는가 닫히는가」).

## 잰 것

`app/me/reading/model.ts` 의 `new OpenAI()` 는 SDK 기본값(재시도 2 · 시간 상한 10분, `node_modules/openai/client.js` 7.8.0)으로
`responses.create({ background: true, stream: true })` 를 낸다. 이 클라이언트는 멱등 머리를 싣지 않는다(`idempotencyHeader` 가
없다). 망을 끊어 넣은 단위 시험(`app/me/reading/submit-unanswered.test.ts`, 이 PR 의 첫 커밋)이 지금의 동작을 보인다:

| 갈래 | 지금(SDK 기본값) |
| --- | --- |
| provider 가 받아 응답을 세운 뒤 망이 끊김 | SDK 가 두 번 더 보낸다 — **provider 쪽 응답 셋**(토큰 세 벌). 시도는 `model-submit-failed` · 쓴 토큰 `null` 로 닫힌다. 셋의 webhook 은 되찾기(`adopt_reading_job` — `submitting` 인 시도만 받는다)가 거절해 모두 건너뛴다. 복구기는 집을 것이 없다 — **결과 셋이 다 버려지고 지출 기록에도 안 남는다**(ADR 0039) |
| provider 가 받고 응답 머리를 안 보냄 | SDK 가 10분을 기다린다 — 누름의 `after` 가 사는 300초 안에 포기하지 않는다. 함수가 끊기면 시도는 `submitting` 으로 남고 webhook 이 이름표로 되찾아 저장한다 |

## 정한 것

1. **제출은 한 번만 보낸다** — `responses.create` 에만 `maxRetries: 0`. 다시 보낼지는 시도를 여는 쪽(사람의 누름 · 복구기)이 정한다.
   회수(`retrieve`)는 같은 것을 다시 읽을 뿐이라 기본값 그대로다.
2. **응답 머리는 30초까지만 기다린다** — `responses.create` 에만 `timeout: 30_000`. SDK 의 상한은 머리가 오면 풀린다 — 본문
   스트림을 읽는 동안에는 안 걸린다(`fetchWithTimeout`).
3. **답을 못 받은 제출은 닫지 않는다** — 망 끊김 · 머리 시간 초과(`OpenAI.APIConnectionError`)는 `model-submit-unanswered` 로
   부르고 파이프라인이 시도를 `submitting` 으로 둔다. provider 가 받았으면 그 webhook 이 이름표로 되찾아 저장하고, 안 닿았으면
   복구기가 기한(`reading_job_deadline()`, 8분)에 `model-timeout` 으로 닫는다. **머리(200)를 받은 뒤 이름표(`response.created`)
   전에 본문이 끊기거나 조용히 끝난 것도 답 없음이다** — SDK 는 그 끊김을 `APIConnectionError` 로 감싸지 않고 던진다
   (`node_modules/openai/core/streaming.js` 113–120줄). 상태 코드로 거절당한 것(`APIError` 의 나머지) · 스트림의 `error`
   사건은 provider 가 답한 거절이라 지금처럼 `model-submit-failed` 로 바로 닫는다.

## 치르는 값

- provider 에 안 닿은 제출은 사람이 실패를 30초가 아니라 **8분 뒤에** 본다(복구기의 기한 — 복구기가 1분마다 돌므로 8~9분).
  그동안 「만드는 중」이 서는데 기다림 문구는 「길면 4분까지 걸려요」다(`readingWaitNote(GENERATION.settings.timeout)` —
  `src/lib/reading/notes.ts` · `app/me/reading/generation.ts` 의 240초). 이 갈래에서는 문구가 어긋난다.
- 재시도 0 은 연결 오류만이 아니라 **429 · 408 · 409 · 5xx 의 재시도도 끈다**(`node_modules/openai/client.js` `shouldRetry`).
  그중 429 · 408 은 provider 가 받지 않은 것이 분명해 다시 보내도 응답이 둘 서지 않는 갈래다 — 지금은 바로 실패로 닫는다.
- 3 을 빼고 1 · 2 만 두면, provider 가 받았는데 30초 안에 머리가 안 온 제출은 지금과 달리 **버려진다**(시험의 둘째 커밋이 그 갈래를 든다).
- 멱등 머리(`Idempotency-Key`)로 재시도를 살리는 길은 Responses API 가 그 머리를 받는지 확인 전이라 고르지 않았다.

## 앞선 결정과의 관계

- ADR 0020 — 제출 · 회수 · 복구기의 뼈대는 그대로다. 「이름표를 결과에 붙여 보내는 것이 우리 쪽 기록보다 먼저다」가 3 의 근거다.
- ADR 0039 — 3 이 버려지던 응답을 저장으로 돌리므로, 그 토큰이 지출 기록에 남는다.
