# 코드 규칙 — 금지어

색인은 `docs/agents/code-rules.md` 다.

## 금지어

| 어디 | 무엇 | 대신 | 누가 잠그나 |
| --- | --- | --- | --- |
| 식별자 | `query` · `fetch` · `repository`(DB 읽는 함수), `isSelf`, `revision`, `birthDate` — 용어집 _Avoid_ | 문 이름은 내주는 것, `selfPerson`, 「입력」, 달력이 붙은 이름 | 안 잠갔다(`docs/agents/code-rules/locks.md` 「알려진 어긋남」) |
| 화면 문구 | 「판본」 · 「revision」, 「맛보기」, 내부어(`self` · `person` · 검사 코드), 해라체 버튼, 「~ 중이에요」 | `docs/context/copy.md` 규칙 · `docs/context/evidence.md` — 「맛보기」는 「로그인 전 결과」(로그인 전 사주 문단 · 로그인 전 궁합 결과) | `consent.test.ts` 가 「판본」을, `code-rules.test.ts` 가 `app/**/*.tsx` 의 「맛보기」를 주석까지 훑는다. 나머지는 사람 |
| 풀이 본문(모델이 낸 글) | 동의 밖 판정 이름 — 신강 · 신약 · 억부 · 용신 · 격국 · 조후 · 대운 · 세운 · 월운 … | 그 이름은 `reading/vocabulary.ts` 의 갈래에서 프롬프트가 읽어 「쓰지 마라」고 말한다 | `reading/check.ts` 가 저장 전에 막는다(ADR 0073) |
| 풀이 본문 | 「후보」 · 「시험값」 · 「자료상」 · 「~라고 본다면?」 — 제품이 덜 됐다고 스스로 말하는 말투 | 결론의 세기로(「~일 것 같아요」) | 프롬프트 지시(`pairReadingGuideBlock`). 검사는 안 한다 |
| 프롬프트 | **금지어 목록을 늘리지 않는다** — 목록이 길면 글이 점검표가 된다 | 지시가 결론의 모양을 시킨다. 고치면 실호출 한 번(`READING_LIVE=1`) | ADR 0073 |
| 주석 | TODO · FIXME · XXX · HACK | ADR · 간극 대장 · 이슈 | 린트 |
