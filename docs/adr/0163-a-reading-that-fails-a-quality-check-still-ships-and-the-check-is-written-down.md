# 품질 검사에 걸린 풀이도 내보내고, 걸린 검사를 시도마다 적는다 — 막는 것은 셋뿐이다

> **운영자 결정 2026-10-10**(조율자가 갈래를 내놓고 받은 답, 원문) — 「문장 규칙 검사를 통과하지 못한다고 버려지는 게 아니라
> 프로세스를 일단 결과를 내고, 서비스를 개선해 나아가야 하는 게 맞지 않냐? 모든 풀이들이 그렇고, 운영자가 분석할 수 있는 칸으로
> 뭐 정리하던가 이래야지」 · 「이것뿐만 아니라 모든 풀이 사주, 궁합, 비공개든 뭐든 말하는 거야」.

ADR 0045 의 「경로가 새면 막는다」, ADR 0143 의 「검사를 지나야 성공으로 적는다」 · 「이어쓰기 답이 계약을 어기면 실패」, 그리고
`checkReading` 이 저장 문턱이던 것(ADR 0013 · 0031 이 그 자리를 「저장 입구」로 불렀다)을 이 결정이 좁힌다. 막는 것은 아래 셋이다.

## 잰 것 (2026-10-10 운영 smoke)

로그인 전 사주 문단이 화면에 안 섰다. 운영 DB 집계 — 모델은 한 번 불려 7.9초 · 출력 433토큰을 썼는데 `taste_artifact.failure_code =
'taste-check-failed'` 였다. 짧은 규칙 검사(`checkTasteRun`)가 글을 버렸고 **걸린 까닭은 어디에도 안 남았다.** 본 풀이 · 궁합도 같은
모양이었다 — 회수(`app/me/reading/collect.ts`)가 `checkReading` 에 하나라도 걸리면 저장하지 않고 실패로 닫았다. 돈은 나갔고, 사용자는
「실패」를 받았고, 운영자는 무엇이 문 것인지 셀 수 없었다.

## 정한 것

1. **막는 것은 셋이다 — 내보내면 사고인 것.** ① 출생 원문 누출 ② 동의 범위 밖 판정(인연 궁합) ③ 화면이 그릴 수 없는 꼴(내보낼 것이
   없다 — 본문이 비었거나 저장할 수 없다 · 점수가 드는 풀이에 읽을 수 있는 점수가 없다 · 맛보기는 DB 가 받지 못하는 꼴). 지금처럼
   실패로 닫는다 — 풀이권을 안 쓰고(ADR 0021), 맛보기는 다음 요청이 재시도한다(상한 셋, ADR 0143).
2. **나머지 검사는 내보내고 적는다.** `READING_KINDS` 넷(자기 · 저장한 사람 · 궁합 · 인연 궁합)과 맛보기 모두다. 저장하고 화면에
   그대로 세우며, 걸린 검사를 시도마다 적는다.
   - **샌 경로는 걷을 수 있는 자리만 걷는다**(`withoutLeakedPaths`) — 경로와 구분자만 든 괄호는 괄호째 걷고 `evidence-path-stripped`
     로 적는다. 문장 안에 낱말처럼 선 경로는 걷으면 문장이 깨지므로 그대로 두고 `evidence-path-leaked` 로 적는다. 괄호에 우리가 넘긴
     경로가 아닌 것이 섞이면 안 걷는다(사람이 지은 라틴 이름일 수 있다).
   - **이어쓰기 계약이 깨지면** 답이 있고 첫 절이 2 · 3 으로 비어 있을 때는 그 답을 그대로 1번에 끼우고, 아니면(답이 없다 · 모델이
     1번까지 썼다) **이어쓰기 없이 본 풀이를 세운다.** 어느 쪽이든 `continuation-out-of-contract` 와 「답을 끼움 / 답 없이 세움」을
     적는다. 이어 쓴 시도는 섰으므로 퍼널 끝(`reading_succeeded`)을 센다.
   - **빈 비유는 비유 없이 저장한다**(`metaphor` 를 `null` 로) — 화면은 비유 없는 풀이를 그대로 그린다. 자기 풀이에 붙은 점수는
     이미 저장하지 않았고 그대로다.
3. **운영자가 분석할 칸.** 시도마다 `{code, detail}` 배열을 적는다 — `reading_run.check_findings` · `taste_artifact.check_findings`
   (+ `checked_attempt`). `detail` 은 「너무 길다(1,820자)」 수준이고 **글 원문 · 이용자 자료를 넣지 않는다** — 길이 · 개수 · 우리가
   넘긴 식별자 · 우리 표의 낱말까지만. DB 가 키 둘 · 설명 200자 · 서른둘 이하만 받는다(`check_findings_valid`). 날짜별 수는
   `check_finding_daily_count`(서울 날짜 × 종류 × 코드 → 내보냄 · 막음), 한 줄로 보는 뷰는 `reading_check_daily` 다. 앱은 뷰를 안
   읽고 `service_role` 에도 닫는다(`taste_daily` 와 같은 결). 「걸린 것 없음」도 적는다 — 분모(`checked`)가 된다.

### 갈래 표

| 검사 코드 | 어디 | 갈래 |
| --- | --- | --- |
| `birth-input-leaked` | 풀이 넷 | **막음** ① |
| `out-of-scope-judgment` | 인연 궁합 | **막음** ② |
| `body-unstorable` — 사용자 본문이 비었다 · 6만 자를 넘는다(`reading.output` 의 검사식) | 풀이 넷 | **막음** ③ |
| `score-unreadable` — 점수가 없다 · 0~100 정수가 아니다 | 궁합 · 인연 궁합 | **막음** ③ |
| `length-out-of-contract` — 400~12000자 밖 | 풀이 넷 | 내보내고 적음 |
| `metaphor-out-of-contract` — 비었다(비유 없이 저장) · 120자를 넘는다 | 풀이 넷 | 내보내고 적음 |
| `score-out-of-contract` — 기준점에서 ±25 를 넘게 움직였다 · 자기 풀이에 점수가 붙었다(그 점수는 저장 안 함) | 풀이 넷 | 내보내고 적음 |
| `non-korean-self-body` | 자기 · 저장한 사람 | 내보내고 적음 |
| `invented-characters` | 풀이 넷 | 내보내고 적음 |
| `evidence-path-leaked` · `evidence-path-stripped` | 풀이 넷 | 내보내고 적음(걷을 수 있으면 걷음) |
| `continuation-out-of-contract` | 이어 쓴 자기 풀이 | 내보내고 적음(위 2) |
| `preview-empty` · `field-empty` · `field-too-long` · `claims-unstorable` — `finish_taste` 의 성공 검사 · `taste_artifact` 검사식이 못 받는 꼴 | 맛보기 | **막음** ③ |
| `unknown-topic` · `claims-not-in-evidence` · `length-out-of-contract` · `paragraphs-out-of-contract` · `unfinished-sentence` · `no-closing-question` · `foreshadowing` · `not-polite` · `ai-word` · `markup` · `hanja` · `plain-term` | 맛보기 | 내보내고 적음 |

막는 코드의 원본은 `READING_BLOCKING_CODES`(`src/lib/reading/check.ts`) · `TASTE_BLOCKING_CODES`(`src/lib/reading/taste-run.ts`) 한
곳씩이다. 막은 시도의 `failure_code` 는 풀이는 첫 막음 코드, 맛보기는 그대로 `taste-check-failed` 다 — 걸린 코드 전부는 기록 칸이 든다.

## 바뀌는 약속

- **사용자는 품질 검사에 걸린 글도 받는다.** 짧거나 긴 글, 한자 · 분류명이 섞인 글, 내부 경로가 낱말처럼 남은 글, 점수가 계약보다
  멀리 간 궁합이 화면에 선다. 화면은 따로 표시하지 않는다(문구가 드는 일은 이 결정 밖이다).
- **풀이권** — 내보낸 시도는 성공이라 풀이권을 쓴다. 앞서는 같은 글이 실패로 닫혀 풀이권을 안 썼고 다시 누를 수 있었다. 막은
  시도는 그대로 안 쓴다.
- **환불** — ADR 0148 의 표 그대로다. 내보낸 글은 「생성 실패」가 아니다. 「계약과 다른 제공」으로 문의가 오면 그 시도의
  `check_findings` 가 무엇이 걸렸는지 답한다 — 품질 코드가 걸린 글을 그 자체로 「계약과 다른 제공」으로 볼지는 운영자가 아직 안 정했다
  (`docs/product/gaps.md` 의 G 줄).
- **비용** — 품질 검사로 버리고 다시 부르던 호출이 사라진다. 맛보기는 재시도가 줄고, 풀이는 사용자가 다시 누르던 몫이 준다.

## 고른 대가

- 검사가 잡던 사고 아닌 실수(경로 · 한자 · 길이)가 이제 사용자에게 간다. 그것을 세는 자리를 둔 것이 이 결정의 나머지 반이다 —
  `reading_check_daily` 로 코드마다의 몫을 보고 프롬프트를 고친다.
- 기록은 부속이다(ADR 0078) — 문(`note_reading_checks` · `note_taste_checks`)이 터지면 저장 · 실패는 그대로이고 원문만 기록에 남는다.
  한 시도에 한 번만 적는다(webhook · 복구기가 같은 회수를 지나도 두 번 안 센다).
- 날짜별 수는 개인을 가리키는 칸이 없어 지우지 않는다. 시도의 기록은 그 시도의 보존을 따른다 — 풀이 시도는 탈퇴까지, 맛보기는 24시간.
- `reading_run.failure_detail` 은 그대로 둔다 — 실패의 까닭 한 줄(모델 오류 · 시간 초과 · 저장 거절)이고, 검사 목록과는 다른 칸이다.
  좁힐 것이 없다.

## 재는 자리

단위 — `src/lib/reading/reading.test.ts` 「검사의 두 갈래」 · 「샌 경로를 걷을 수 있는 자리만 걷는다」, `src/lib/reading/taste-run.test.ts`
(코드마다 갈래), `app/me/reading/collect.test.ts`(막는 셋 · 내보내고 적기 · 경로 걷기 · 이어쓰기 · 기록 실패), `app/taste-run.test.ts`
(품질만 걸린 맛보기는 성공 · DB 꼴은 막음 · 기록). pgTAP — `supabase/tests/88_check_findings.test.sql`. 마이그레이션 `20261130090000`.
