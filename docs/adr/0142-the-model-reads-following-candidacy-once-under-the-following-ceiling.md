# 모델은 종격 후보 자격을 한 번만, 종격 판정의 상한으로 읽는다

> **운영자 결정 2026-10-01** — 「`followingCandidacy` 중복을 모델에 보내는 evidence 에서만 뺀다. 엔진과 화면의
> `analysis.followingCandidacy` 는 유지한다.」 프롬프트에 닿는 변경이라 운영자가 실호출로 확인한 뒤에 머지한다.

## 잰 것 (2026-10-01)

- 엔진은 같은 세 입력(원국 · 실효 분포 · 뿌리)으로 같은 순수 함수 `followingCandidacyOf` 를 두 번 부른다 —
  `analysis.followingCandidacy`(`src/lib/saju/analysis/index.ts`)와 `analysis.following.facts`
  (`followingAssessmentOf`, `src/lib/saju/analysis/followingPatterns.ts`). 1940~2010 년 1,420 명식(시간 미상 포함)에서
  엔진 값도, 소수를 네 자리로 자른 자료 값도 전부 같았다.
- 두 칸의 상한이 갈렸다. `analysis.followingCandidacy` 는 `fact`(시간 미상이면 있다 `derived` · 없다 `silent`)이고,
  `analysis.following` 은 종격 게이트에 묶여 `candidate`(시간 미상이면 `reference` · `silent`)다. 같은 사실을 모델은 센 쪽
  이름으로 읽을 수 있었다. `src/lib/saju/text/policy.ts` 의 통관 주석이 이 칸이 `fact` 에 앉은 것을 이미 짚었다.
- 이 칸은 자기 풀이 · 남의 풀이 · 비공개 궁합 자료에만 실린다. 인연 궁합 컷(`shareEvidence`)은 원래 고르지 않는다.

## 정한 것

- 모델에 넘기는 자료(`evidenceOf`)에서 `analysis.followingCandidacy` 를 뺀다. `EXCLUDED_PATHS` 에 이유와 함께 들어가므로
  자료의 `contract.excluded` 에 한 줄이 늘고, 명식마다 `claims` 한 줄과 `analysis` 의 객체 하나가 빠진다.
- 인연 궁합 컷(`shareEvidence`, 세 판 모두)은 계약의 `excluded` 에서 **그 한 줄을 받지 않는다.** 세 판 모두
  `withheld.analysis` 로 `analysis` 를 통째로 또는 종격까지 빼 두었으니 같은 빠짐을 두 번 말하는 줄이고, 이 칸은 인연 궁합
  자료에 실린 적이 없어 판본을 가를 것도 없다. 인연 궁합 프롬프트는 main 과 글자까지 같다 — 옛 컷(`legacy-v0`)의
  「운영 JSON 을 한 글자도 안 바꾼다」도 그대로 선다. `src/lib/saju/evidence/shared.test.ts` 가 잰다.
- 같은 사실은 `analysis.following.facts` 로 남고 상한은 `analysis.following` 의 것이다 — 시각을 알면 `fact` → `candidate`,
  시간 미상이면 `derived`/`silent` → `reference`/`silent`.
- 엔진의 `Analysis.followingCandidacy` 와 화면(`app/saju/analysis.tsx`)은 그대로다. 화면 쪽 상한 표(`CLAIM_CEILING`)도 그대로다.
- 지시 본문은 안 바뀐다. 바뀌는 것은 자료 JSON 뿐이다. 그래서 프롬프트 판본(`READING_POLICY.version`)과 계약 판본
  (`evidence-v0`)은 올리지 않는다 — 어느 결과가 이 칸 없이 났는지는 함께 저장되는 자료의 `contract.excluded` 가 말한다
  (칸만 늘고 판본을 안 올린 ADR 0114 와 같은 결).
- 뺀 값이 `following.facts` 에 같은 값으로 있는지는 `src/lib/saju/evidence/evidence.test.ts` 가 골든 명식으로 잰다 — 두 칸을
  내는 입력이 갈리는 날 붉다(실효 분포 대신 원 분포로 바꿔 붉어지는 것을 봤다).

## 치르는 값

- 입력 토큰(o200k 셈, 대표 명식, 프롬프트 전체): 자기 풀이 · 남의 풀이 24,513 → 24,424(−89), 비공개 궁합 40,073 → 39,861(−212),
  시간 미상 자기 풀이 20,204 → 20,129(−75). 인연 궁합은 10,793 → 10,793(0) — 처음 판은 `contract.excluded` 의 한 줄을
  함께 받아 +34 였고, 위의 컷으로 걷었다.
- 모델이 종격 조건을 「사실」로 단정하던 여지가 줄고 「후보」로 말하게 된다. 글이 실제로 그렇게 바뀌는지는 실호출로만 안다.

## 고르지 않은 것

- **엔진에서 칸을 걷는 것** — 화면이 이 칸을 읽는다. 운영자가 엔진과 화면은 유지하라고 했다.
- **화면 쪽 상한까지 `candidate` 로 내리는 것** — 범위 밖이다. 통관 주석의 「옮기는 일은 그 값을 재는 자리에서」가 그대로 남는다.
- **`excluded` 의 이유 문장을 줄이는 것** — 인연 궁합의 증가가 줄 뿐 0 이 되지 않고(이 문장보다 15 토큰 짧은 판도 +19),
  다른 줄들이 쓰는 「무엇은 — 어디가 든다」 모양에서 벗어난다. 인연 궁합 계약은 이미 kind 마다 한 벌이 아니다
  (`withheld` · `scope` · `matchInput` 이 붙는다) — 처음 판이 이 갈래를 「계약은 한 벌」이라며 고르지 않은 근거는 서지 않았다.
