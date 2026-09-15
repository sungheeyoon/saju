# 인연 궁합 입력 A/B 비교 — 실행법과 평가 기준

ADR 0067 의 두 판(A 제한형 · B 확장형)을 **같은 조건**으로 부르고 견준다.
**AI 설명 품질의 비교이지 실제 관계가 잘 되는지의 검증이 아니다.**

## 같게 두는 것 / 다른 것

| 같다 | 다르다 (둘 다 `manifest.json` 에 적힌다) |
|---|---|
| 표본 명식 넷 · 기준 시각 `2026-08-26T04:00Z` | 자료 범위 — `addedEvidence` |
| 모델·생성 설정(`GENERATION`) · 판본 이름 | 지시 — `promptChanges` (점수표 한 줄 · 범위 절) |
| 분량 3000~4800 · 말투 · 출력 계약 | |
| 기준점(`previewScoreOf`) · 조정 ±15 · 재량 ±10 | |

**필드만 더한 효과로 읽지 않는다.** B 는 자료와 함께 점수표와 범위 절이 바뀌었다.

## 표본 — 관계 구조가 서로 다르다

`src/lib/reading/match-input-eval.ts` 의 `MATCH_INPUT_FIXTURES`. 성질은 `npm test` 가 늘 잰다.

| id | 보려는 것 |
|---|---|
| `internal-rival` | 사이 합을 원국 안 글자가 함께 문다 (B 만 그 연결을 받는다) · 신강/신약이 갈린다 |
| `combined-formation` | 두 사람 글자가 세 글자 구조를 온전히 이룬다 — 한 사실로 읽는가 |
| `day-branch-clash` | 두 일지가 충한다 — 자리를 맞게 짚는가 · 억부 후보를 가진 쪽이 한쪽뿐 |
| `hour-unknown-one-side` | 한쪽 시각을 모르고 반쪽 관계가 있다 — 단정하지 않는가 |

## 실행

```bash
# 1) 부르지 않고 프롬프트만 — 계획 호출 수와 입력 크기 확인
READING_MATCH_INPUT_LIVE=1 READING_MATCH_DRY=1 npx vitest run src/lib/reading/call.live.test.ts

# 2) 소규모 — 표본 하나 × 두 판 × 1회 = 2콜
READING_MATCH_INPUT_LIVE=1 READING_MATCH_REPEAT=1 READING_MATCH_FIXTURES=internal-rival \
  npx vitest run src/lib/reading/call.live.test.ts

# 3) 본 실행 — 넷 × 둘 × 3회 = 24콜
READING_MATCH_INPUT_LIVE=1 READING_MATCH_REPEAT=3 READING_MATCH_MAX_CALLS=24 \
  npx vitest run src/lib/reading/call.live.test.ts
```

# 4) 같은 실행에 판마다 더 — 프롬프트 해시·생성 설정이 다르면 부르기 전에 멈춘다
READING_MATCH_INPUT_LIVE=1 READING_MATCH_REPEAT=2 READING_MATCH_RUN_DIR=.reading-live/match-input-… \
  npx vitest run src/lib/reading/call.live.test.ts

# 5) 저장된 명식 한 쌍 — Git 밖 파일(.reading-live/private/…)에서 판본을 읽어 기존 계산 경로로 세운다
READING_MATCH_INPUT_LIVE=1 READING_MATCH_PAIR_FILE=.reading-live/private/my-pair.json READING_MATCH_REPEAT=1 \
  npx vitest run src/lib/reading/call.live.test.ts
```

쌍 파일은 `{ id, relation, a: { personId, revisionId, revision }, b: … }` 이다. 모델에는 이름 대신 A·B 가 가고,
기록에는 판본 id 만 적는다(출생 원문은 안 적는다).

```text
`OPENAI_API_KEY` 가 `.env.development.local` 이나 환경에 있어야 한다. 계획 호출 수가
`READING_MATCH_MAX_CALLS`(기본 24)를 넘으면 **부르기 전에** 멈춘다.

산출물 `.reading-live/match-input-<시각>/`: `manifest.json`(프롬프트 해시·씨앗 포함) · `runs.jsonl`(호출마다 즉시,
실패 원문 포함) · `verdicts.json` · `aggregate.json` · `blind.md` · `key.json`.

**다시 부르지 않는다.** 실패도 한 번의 결과로 적는다. 부르기 전에 사이 문장·판·억부 근거·기준점이 최종
프롬프트에 맞게 실렸는지 재고, 어긋나면 한 콜도 안 부른다.

## `verdicts.json` 의 세 갈래

| 갈래 | 무엇 | 시험 |
|---|---|---|
| `calls` | 모델까지 닿아 구조화 출력이 왔는가 · 실패 원문 | **하나라도 실패면 빨간불** — 기록 수가 맞아도 |
| `contract` | 저장 검사가 막는 것 · 계약 어긋남 | 떨구지 않지만 `status` 가 `complete` 로 안 선다 |
| `humanReview` | 근거 오류 후보 · 자리 문장 · 이탈 지표 · 분량 밖 | 사람이 원본 계산 자료와 대 본다 |

`status` 는 `calls-failed` · `complete-with-contract-violations` · `complete` 중 하나다.

## 평가 기준 — 두 갈래를 섞지 않는다

### ① 규칙 위반·지표 (기계가 센다 — `aggregate.json`)

| 항목 | 무엇을 세나 | 판정 |
|---|---|---|
| 규칙 위반 | `checkReading` 이 막는 것 — 동의 범위 밖 낱말(`억부`·`신강`…)·출생 원문·점수 상한 등 | 막는 것 |
| 근거 오류 후보 | 근거 칸의 `relations <이름>` 이 자료에 없음 · 근거 칸의 경로가 자료에 없는 키를 지남 | 사람이 확인 |
| 자리 혼동 | 본문에서 자리 이름이 든 문장을 모은다(`seatSentences`) | **사람이 자료와 대 보고 판정** |
| 구체성 | 근거 칸이 이름을 댄 서로 다른 관계 수 ÷ 자료의 관계 수 · 본문 길이 | 지표 |
| 개인 풀이 이탈 | 이탈 낱말 수(건강·재산·평생·신강…) · 한 사람만 부르는 문단 비율 | 지표 |
| 점수 변동 | 표본 × 판마다 점수 범위·표준편차 · 기준점과의 차 | 지표 — 같은 짝 재호출 흔들림과 견준다 |

### ② 선호 (사람이 고른다 — `blind.md`)

판 이름·점수·검사용 근거 절을 가렸다. 표본마다 「어느 글이 두 사람 사이를 더 이 두 사람답게
설명하는가」를 고르고, `key.json` 은 다 고른 뒤에 연다. 선호 결과는 ①의 수치와 따로 적는다.

## 읽는 법

- **호칭은 운영과 다르다.** 러너는 익명으로 부르려고 이름을 안 넘겨 프롬프트 폴백 「첫 번째 분」(`charts.a`)·
  「두 번째 분」(`charts.b`)이 본문에 선다. 운영 인연 궁합은 두 계정의 공개 닉네임을 넘기고 자리 호칭을 금지한다
  (ADR 0058). 판 비교에는 영향이 같지만, 결과를 운영에 반영할 때 호칭 경로를 되돌리지 않는다.

- 표본 넷 × 3회는 **작다.** 한 표본에서 갈린 것을 판의 성질로 적지 않는다.
- 어느 쪽이 이겨도 **운영 반영은 정책 결정이다**(ADR 0067). 2026-09-15 에 제한형 A 와 읽는 법 4판을 운영으로 올렸고, 비교 실험은 거기서 닫았다.
- 한 쌍의 결과를 전체 사용자로 일반화하지 않는다.
- 9/1 자리 색인 실험은 이 비교의 근거가 아니다.
