# 엔진은 모델에게 말을 걸지 않는다

`src/lib/saju/evidence/prompt.ts` 는 이름 그대로 엔진 안에 살았고, 배럴이 그것을 공개
표면으로 올렸다(`src/lib/saju/index.ts:34`, `export * from './evidence/prompt'`).

**재어 보니 엔진 안에서 그것을 부르는 곳이 하나도 없었다.** 배럴 34행이 유일한 안쪽
참조이고, 실제 소비자는 전부 `src/lib/reading/` 과 화면 둘이다. 역방향 의존도 없다 —
`src/lib/saju` 는 `src/lib/reading` 을 한 번도 부르지 않는다. 즉 이 파일은 엔진의
일부였던 적이 없고, **폴더가 그렇게 보이게 했을 뿐이다.**

## 값을 치른 자리 둘

**하나. 공개 계산기가 프롬프트를 짊어졌다.** `app/saju-calculator.tsx` 에서 도달하는
소스가 1099KB 인데 그중 48KB 가 이 프롬프트 모듈이다. 계산기는 한 글자도 안 쓴다. 더
나쁜 것은 `app/evidence-panel.tsx` 다 — `'use client'` 이면서 `PROMPTS` 를 직접 쓰고,
`/evidence` 는 `proxy.ts` 의 matcher 밖이라 **로그인 없이 열린다.** 걸어 두지 않았을
뿐 닫혀 있지는 않았다.

**둘. 프롬프트 본문이 두 벌이 됐다.** 이 파일에 `READING`·`NOW`·`COMPAT`·`STRICT`·
`AUDIT` 다섯 벌 216줄이 있었는데 **OpenAI 로는 한 번도 안 갔다.** 실제로 나가는 것은
`src/lib/reading/prompt.ts` 의 `READING_PROMPTS` 이고 `generator.ts` 가 부르는 것도
그쪽이다. 그런데 안 나가는 쪽이 배럴에 서 있고, 파일 이름이 `prompt.ts` 이고, 화면에
보였다 — **찾기 더 쉬운 것이 죽은 쪽이었다.** 「프롬프트를 고치면 실호출부터 확인한다」는
규율이 하루에 두 번 깨진 적이 있는데, 이 구조가 정확히 그 실수의 모양이다.

## 정한 것

**엔진은 사실만 든다.** `src/lib/saju/evidence/` 에 남는 것은 `evidenceOf` ·
`EVIDENCE_CONTRACT` · `INCLUDED_PATHS`/`EXCLUDED_PATHS` 다. 자료를 짓는 일과 자료의
상한을 적는 일까지가 엔진이다.

**모델에게 하는 말은 전부 `src/lib/reading/` 에 산다.** 살아 있는 조각이 그리로 옮겨
가되 **둘로 갈라 놓는다** — 손으로 쓴 산문(`parts.ts`: `PROMPT_PARTS` · `ABSORPTION_RULE`)과
근거를 읽어서 짓는 함수(`summary.ts`: `withSummary` · 요약 조립)는 하는 일이 다르고,
한 파일에 있을 때는 그 차이가 안 보였다.

안 나가는 본문 다섯 벌과 그것을 고르던 `PROMPTS`·`BODY`·`promptBodyOf`·
`promptWithEvidence`·`promptHeadOf`·`PromptKind` 는 지운다. `PROMPT_POLICY` 와
`CEILING_RULE` 도 함께 간다 — 둘 다 그 다섯 벌만 쓰던 것이라 몸통이 사라지면 잴 것이
없다.

**판본 실험 장치는 안 옮긴다.** 처음에는 `variants.ts` 도 한 자리로 모으려 했는데, 다섯
벌을 지우고 나니 **모을 것이 하나뿐이었다.** 그 파일은 이미 첫 줄이 「손으로 돌리는
실험판 — 실제 생성에는 쓰지 않는다」이고, 한 파일을 위해 폴더를 만드는 것은 그 줄이 이미
하는 말을 경로로 되풀이하는 것이다. 모으는 것은 **모을 것이 둘 이상일 때** 한다.

배럴 34행을 지운다. 같은 이유로 `src/lib/saju/analysis/index.ts:44` 의
`export * from './validation/eokbuExternalCases'` 도 내린다 — 39KB 검증 사례이고
런타임 사용처가 0이다. 시험에서만 쓰는 것을 지우지는 않지만, **공개 표면에 세우지도
않는다.**

## 「계약 옆에 있어야 한다」를 버리지 않는다

이 파일이 스스로 내세운 까닭이 있었다 — 사다리도 규칙 묶음 이름도 손으로 안 적고
`CLAIM_STRENGTH_ORDER` 와 `EVIDENCE_CONTRACT` 에서 지으므로, 계약에 칸이 하나 생기면
프롬프트가 저절로 따라오고 그 칸에 말투를 안 적었으면 **타입이 먼저 빨개진다.**

그 성질은 자리가 아니라 `import` 가 지킨다. `reading` → `saju` 방향은 이미 서 있고
반대는 없으므로, 옮겨도 계약이 칸을 늘리는 날 빨개지는 것은 그대로다. 잃는 것이 없다.

## 화면 하나가 사라진다

`/evidence` 를 없애고 내부 검증은 `/me/reading/inspect` 하나로 모은다. inspect 는 이미
서버 컴포넌트이고 로그인 뒤에 있고, `preview.ts` 가 **서버에서** 조립해 결과 문자열만
내려보낸다 — 진짜 프롬프트를 보여주면서 모듈은 브라우저에 안 싣는다. 옳은 모양이 이미
거기 있었다.

`/evidence` 가 들고 있던 **fragment 로 임의 명식의 근거를 보는 능력은 버린다.** 그
능력을 inspect 로 옮기면 서버 화면에 클라이언트 섹션을 붙여야 하고, 그러면 방금 지운
경계가 같은 자리에 다시 생긴다. 저장하지 않은 명식의 근거를 보려면 사람을 저장해야
하고 그것은 `person_limit` 을 먹는다 — 그 값은 치르기로 한다.

## 재어 본 값

공개 계산기에서 도달하는 소스가 **1099KB / 86파일 → 1013KB / 84파일**이 됐다. 줄어든
87KB 는 프롬프트 48KB 와 검증 사례 39KB 를 더한 것과 같다. **이것은 도달 그래프이지
번들이 아니다** — 번들러가 이미 흔들어 떨구고 있었는지는 재지 않았다. 다만 그래프에
없으면 떨굴지 말지를 물을 일도 없다.

시험은 40건을 지우고 16건을 더했다. 지운 것은 **안 나가는 프롬프트를 재던 것**이고,
더한 것은 같은 성질을 `READING_PROMPTS` 에 대고 잰다 — 재는 대상이 실물로 바뀌었다.

한 가지가 그 과정에서 드러났다. **`PROMPT_PARTS.voice` 는 기준판에 안 닿았다** —
`CONTROL.selfPresentation` 이 `expert-v4` 라 자기 풀이는 `selfCustomerVoice` 를, 궁합은
`relationshipCustomerVoice` 를 쓰고, 그 조각은 `legacy-v1` 판본으로만 섰다.

여기서는 지우지 않고 시험이 그 사실을 값으로 들게 했다. **그 뒤 `legacy-v1` 을 지우면서
함께 갔다**(ADR 0049) — 닿는 길이 그 판 하나였으므로 판이 사라지자 조각도 사라졌다.
