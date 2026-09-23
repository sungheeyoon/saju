# 프롬프트 지도 — 어느 파일이 무엇을 드는가

> **세션 기록이다.** 세션 메모 「프롬프트 지도」(2026-09-03~15)를 2026-09-22 에 저장소로 옮겼다(ADR 0090). 요구사항도 규칙도
> 아니다 — 무엇을 만드는가는 `docs/prd.md`, 결정은 `docs/adr/`, 낱말은 `CONTEXT.md` 가 답하고,
> **코드와 어긋나면 코드가 맞다.** 날짜가 붙은 문단은 그날의 사정이고 커밋 해시는 그날의 자리다.
> 여기 적힌 경로가 실재하는지는 시험이 재지 않는다.
>
> **지금은:** 실제로 나가는 것은 `CONTROL` 하나이고 세대는 `planOf` 가 한 번 고른다(ADR 0075). 개인 풀이 `reading-prompt-v15`(2026-09-23 G-56), 두 궁합 `reading-prompt-v14`(2026-09-23 G-55) — 이름은 `promptVersionOf`. 조립은 `src/lib/reading/prompt.ts` · `parts.ts` · `vocabulary.ts`. 프롬프트 본문을 고치면 실호출 한 번(`docs/agents/test-map.md`).
>
> **낡은 경로:** `src/lib/saju/evidence/prompt.ts` 는 없다 — 그 바탕은 `src/lib/reading/prompt.ts` 와 `parts.ts` 로 옮겨 갔다(ADR 0047·0075).

## 2026-09-15 — 판본이 둘로 갈렸다 (이것이 가장 먼저다)

- 개인 풀이(self·person) `READING_POLICY.version = reading-prompt-v10`, 궁합(match·private) `pairVersion = reading-prompt-v11`.
  저장·동결에 쓰는 이름은 `promptVersionOf(kind)` 하나다
- 궁합은 `CONTROL.pairReading: 'guide-v4'` — `isMatchV3`/`isMatchV4` 문으로 공통 조각을 갈아 끼운다. 옛 판은 `LEGACY_PAIR_ASSEMBLY`
- 자세한 것은 `match-input-experiment-2026-09-15.md`

## 지금 판 (2026-09-14 사용자 확인) — 아래 v5~v7 기록보다 이것이 먼저다

- **`reading-prompt-v10`** = 궁합 점수가 **기준점(`previewScoreOf`) + 항목 조정 ±15 + 재량 ±10**
  (ADR 0060·0065). 재량은 09-13 에 이름을 안 올리고 들어왔고, 사용자가 **그것까지를 v10 으로
  친다**고 정했다. v11 로 올리지 않는다.
- **한 줄 요약(`metaphor` 칸)은 비유가 아니라 직접 요약**이다(v9, ADR 0056 개정). 칸 이름만
  호환 때문에 남았다. PRD §1.5·CONTEXT 가 「비유」라고 적고 있던 것을 이날 고쳤다.
- 옛 동기 생성 경로(`requestReading`·`generateReadingArtifact`·`ReadingGenerator`)는 걷었다.
  **`callModel` 만 남았고 실호출 시험(`call.live.test.ts`) 전용이다** — 그래서 `ai`·
  `@ai-sdk/openai` 의존성도 남는다. 실제 누름은 `submitBackgroundReading` 이다.

`~/Documents/projects/saju` 의 프롬프트를 고칠 때 **어느 파일을 여는가.** 사용자가
2026-09-03 에 세 kind 의 원문을 받아 고칠 대목을 찾는 중이다.

**실제로 나가는 것은 `CONTROL` 하나다** — `app/me/reading/generator.ts` 가
`readingPromptOf(evidence, CONTROL, about)` 로 부른다. kind 는 넷이고 `self` 와
`person` 은 **같은 몸통**이다(갈리는 것은 접근 판정뿐).

- **셋이 공유하는 바탕**: `src/lib/saju/evidence/prompt.ts` — 역할·자료 설명·사실 금지·
  근거의 층·`REGISTER`·`PERSONALITY`·강도.
- **사용자에게 나가는 말투와 절**: `src/lib/reading/prompt.ts` — `CUSTOMER_TONE`(셋 공통),
  `selfCustomerVoice(terminology)`(자기 풀이만), `relationshipCustomerVoice(terminology)`(궁합 둘),
  `termsSection` 이 고르는 `ANNOTATED_TERMS`/`PLAIN_TERMS`(십성·오행 줄은 상수에서 자동
  생성 — 손으로 적으면 용어집과 갈린다), `expertSelfSections(terminology)`·
  `compatPrivateSections`, `SCORE_SECTION`(궁합),
  `MATCH_SCOPE`(공유 궁합만, ADR 0012), `OUTPUT_CONTRACT`.
- **길이는 문자열에 안 박혀 있다**: `CONTROL.selfLength`(5000~9000) ·
  `compatLength`(private 3500~5500 · match 3000~4800). `selfPresentation: 'expert-v4'`,
  `terminology: 'plain'`.
- **절 번호도 문자열에 없다**: 절은 `{title, body}` 이고 차례는 `numbered` 가 붙인다.
  자기 풀이는 **열 절**이고 1번이 「먼저 볼 핵심 세 가지」다(ADR 0029).

**`variants.ts` 는 실제 생성에 안 쓰인다.** 그런데 `/me/reading/inspect` 의 「실험용
변형」 목록에 서 있어서, **버린 판(`legacy-v1` 옛 여덟 절)이 아직 살아 있는 것처럼
보인다** — 사용자가 실제로 그렇게 읽었다. 프롬프트가 「지금 것이 맞나」로 의심되면
여기부터 짚는다.

원문을 통째로 보려면 `READING_PROMPTS[kind]` 를 찍는다(자료 JSON 과 이름·사이는 안
붙는다). 자료까지 붙은 진짜 문자열은 `/me/reading/inspect?kind=…` 가 낸다.

2026-09-06 에 **`expert-v4` 가 CONTROL 자리로 올라갔다**(PR #31, main 배포까지). 성격·강점·
조심할 점 세 절이 억부·조후·격국·신강신약을 읽는다 — 그 전에는 자료에 다 실려 있는데
**프롬프트가 어느 경로도 안 불렀다.**

함께 움직인 것 둘.

- `READING_POLICY.version` 이 `reading-prompt-v4` → **`v5`**. 「바뀌면 이름이 바뀐다」가
  이 값의 규칙이다. 프로덕션에 v4 로 만든 글이 남아 있으므로 그 이름이 유일한 구분선이다.
- 실험판 자리는 비우지 않고 **뒤집었다** — `yongsin-v1` 이 사라지고 `no-yongsin-v1`
  (`expert-v3`)이 섰다. 되돌릴지 판단하려면 견줄 짝이 있어야 한다.

**아직 안 끝난 것 둘.**

- **품질 판단은 사용자가 프로덕션에서 직접 부르고 정한다.** 그래서 승격 ADR 을 일부러
  안 썼다. 정해지면 그때 쓴다.
- 세 절이 한 칸(`selfPresentation`) 안에서 **함께** 움직였다(`confounded`). 좋아도 셋 중
  무엇 덕인지 이 라운드는 답하지 않고, 되돌릴 때도 셋을 한 덩어리로 되돌려야 한다.

실호출로 확인한 것: 경로 이름(`analysis.*`)이 본문에 안 샜다 — 라틴 문자 0 · 한자 0.
그리고 **같은 날 그것을 잡는 검사가 섰다**(PR #32, `evidence-path-leaked`).
(옛 메모 saju-prompt-change-needs-a-live-call — 저장소 문서로 흡수됨)

## 같은 날 `plain` 도 기준판이 됐다 (PR #33, `reading-prompt-v6`)

사용자 판단이다 — **「모르는 용어를 들을 거면 사주풀이를 왜 듣냐」.** 분류명을 본문에
안 부르고 그 이름이 가리키는 장면을 사람 말로 쓴다. 오행(목·화·토·금·수)은 **그대로 둔다.**
낱말 치환 판이 아니다 — 한 이름을 정해진 한 마디로 옮겨 두면 그 말이 새 전문용어가 된다.

짝은 `annotated-terms-v1`(앞 기준판). 그 판의 계약을 재던 시험 여덟 줄도 안 지우고 짝을
겨누게 돌렸다.

**승격하면서 메운 구멍 둘 — 다음에 이 축을 만질 때 같은 자리를 본다.**

- `plain` 9절에 **`now.overlaps` 지시가 통째로 없었다**(annotated 1 · plain 0). 두 벌을
  따로 쓰면 한쪽에만 들어간 값이 생긴다. 지금은 시험이 두 판 모두에 그 줄을 요구한다.
- `termsRule` 이 번호(`2. `)를 들고 있어 **번호 목록인 자기 풀이에만** 붙었다. 불릿을 쓰는
  궁합에는 못 붙고 그 자리에 「전문 용어를 늘어놓지 않는다」는 약한 한 줄이 서 있었는데,
  이름을 안 부르는 판에서 **「늘어놓지 마라」는 부르는 것을 허락하는 말**이다. 번호를 떼서
  자기 풀이·비공개 궁합·공유 궁합 셋이 같은 규칙을 지나게 했다.

## 자료를 보내면서 안 읽히는 것 — `private` 이 제일 크다

2026-09-06 에 직접 셌다. 원국 하나마다 `analysis.*` 판정이 **18개** 실린다.

| kind | 자료에 실림 | 프롬프트가 이름으로 부름 | JSON |
|---|---|---|---|
| `self` | 18 | 8 (승격 뒤) | 35,079자 |
| `private` | 18 ×2명 | **1** (`analysis.elements` 뿐) | 72,625자 |
| `match` | 0 | 0 | 9,222자 |

**`match` 는 구멍이 아니라 설계다** — 공유 궁합은 근거를 한 번 더 자르므로(ADR 0012)
`analysis` 가 아예 안 실린다. **`private` 이 구멍이다**: 자를 이유가 없어 두 원국 판정
36개를 통째로 보내면서 절이 오행 하나만 가리킨다. self 에서 메운 것과 **같은 구멍**이고,
매번 72,625자 값을 치르면서 대부분을 안 가리킨다.

인계 메모에 「12개 중 11개」로 적혀 있던 것은 **틀린 수다.** 18개 중 17개다.

## 2026-09-07 — 궁합이 절을 걷었다 (`reading-prompt-v7`, ADR 0051)

**비공개 궁합에는 이제 우리가 정한 절이 없다.** 절 열하나와 「성격을 읽는 순서」를 걷고
**다룰 것의 목록 여덟**만 준다(`PAIR_NEEDS`/`NEEDS_BLOCK`). 나누는 것·차례·어느 판정을
읽을지·무엇이 답답한 점인지는 **모델이 정한다.** 자기 풀이와 공유 궁합은 안 건드렸다 —
자기 풀이는 열 절 그대로다.

**계약이 절을 요구하지 않았다.** `checkReading` 이 막는 일곱 어디에도 절 이야기가 없고
궁합은 절 수 계약도 없다. 열한 절은 필요해서 있던 것이 아니라 우리가 고른 것이었다.

**다룰 것은 안 놓는다** — 자기 풀이에서 네 절로 줄였다가 「생활 코칭만 남은」 전례가
있다. 커버리지와 구성은 다른 것이고, 지금 프롬프트가 그 둘을 한 덩어리로 묶고 있었다.

**절이 지고 있던 것 중 구조가 아닌 셋은 목록으로 옮겼다** — 관계마다 갈리는 물음
(ADR 0018 의 그 자리, 안 옮기면 어머니 궁합에 「처음 끌리는 지점」이 돌아온다) · 비대칭
(`aSeesB` ≠ `bSeesA`) · 기준 시각.

되돌릴 짝은 `pair-sections-v1`(`PAIR_VARIANTS`). **한 줄이면 돌아간다** —
`CONTROL.pairShape` 를 `'sections-v1'` 로.

### 그 전에 두 라운드를 버렸다 — 그 까닭이 값이다

`analysis.precedence` 를 10절에 읽히는 판(P1)을 실호출로 재봤는데 **안 닿았다.**
precedence 가 서열을 매기는 다섯(억부·조후·종격·격국·통관)은 전부 **「무엇을 쓸 것인가」
(용신)에 대한 답**인데, 10절은 「반복하는 모양·서운할 때의 반응」을 묻는다. 표본 둘 다
갈리는데도 없앨 모순이 없었다 — **절은 맞게 골랐고 내용을 잘못 골랐다.**

그래서 `solo` 게이트는 **적힌 이유는 틀렸어도 결론은 맞았다.** 궁합 프롬프트에는
precedence 가 답하는 물음을 하는 절이 아예 없다.

## 같은 날 점수 옆에 비유 한 문장이 섰다 (ADR 0052)

실호출 산출물의 궁합 점수를 전부 셌다 — **열한 번이 62~68 이고, 같은 짝 재호출의
흔들림(±3)이 다른 짝과의 차이만큼 크다.** 잡음이 신호만큼 커서 두 관계를 구별 못 한다.

눈금을 고치는 대신 **숫자에서 의미를 내렸다.** `metaphor` 한 문장이 뜻을 진다. 자기
풀이에는 점수가 없어도 비유는 있다. 스키마 `required` · `reading.metaphor` 열 ·
`my_reading`/`my_readings` · 결과 화면 · 목록 카드까지 지나간다.

경계 둘은 우리가 쥔다 — **오행을 빗댄 척 되살리는 꼴**(「물과 불처럼」·「A가 B를 만난
격」, 한국어라 경로 검사에 안 걸려서 따로 문다)과 사람·관계를 규정하는 말.
