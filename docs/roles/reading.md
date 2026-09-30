# 역할 — 풀이 (글 · 프롬프트 · 문장 층 · 엔진)

`src/lib/reading/` · `src/lib/saju/` · `app/me/reading/` 와 `docs/text/` 가 사는 자리다.

## 먼저 읽는 것

- `CONTEXT.md` 「2. 입력과 명식」 · 「4. 근거와 글」
- `docs/text/claim-policy.md` — 무엇까지 말할 자격이 있는가. 조각 · 조립 · 말뭉치는 같은 폴더의 나머지 셋
- `README.md` 「설계에서 핵심이었던 세 가지」 · 「학파에 따라 갈리는 지점」 — 엔진
- `docs/prd.md` 「4. 풀이」
- `docs/agents/code-rules.md` 「금지어」 — 풀이 본문과 프롬프트의 줄
- `docs/agents/test-map.md` 「잠긴 시험 넷 — `*.live.test.ts`」 · 「무엇을 고쳤으면 무엇을 돌리나」의 엔진 · 프롬프트 줄
- `docs/notes/verification-discipline.md` — 검증 수준보다 세게 말하지 않는다
- ADR 0047(모델은 `app/me/reading/model.ts` 한 곳에서만) · 0073(막힌 이름은 프롬프트가 말한다)

## 이 저장소의 방식

- 엔진은 판정이 아니라 근거를 낸다. 사실은 행이고 판정은 문장이다
- 엔진 파일 이름은 camelCase 다(옛 규약, 폴더 안에서 섞지 않는다)
- **프롬프트에 금지 목록을 쌓지 않는다** — 지시가 결론의 모양을 시키고 본보기 한 토막을 준다
- 프롬프트 본문이 한 글자라도 바뀌면 실호출 한 번이 필요하다 — **운영자가 돌린다.** 에이전트는 명령과 볼 값을 PR 에 적는다
- 클라이언트 화면은 풀이 입구(`src/lib/reading/index`)가 아니라 잎을 부른다 — `scripts/layers.test.ts` 가 잰다
- `src/lib/saju/version.ts` · `src/lib/saju/pillars/index.ts` 를 고치면 DB 검사식이 보므로 시험 전부를 돈다

## 하지 않는 것 · 묻는 것

- **프롬프트 실험은 보류다(2026-09-15)** — 모델의 버릇은 프롬프트가 아니라 받는 쪽을 넓혀 푼다(ADR 0139). 다시 열지는 운영자가 정한다
- 실호출 · 백필(`READING_LIVE` · `BACKFILL_*` · `TASTE_LIVE`)을 돌리지 않는다 — 토큰이 나가고 운영 표에 쓴다
- 동의 밖 판정 이름(신강 · 용신 · 대운 …)을 풀이 본문에 들이는 변경은 결정이다

## 끝날 때 고치는 것

- [ ] 말할 자격 · 강도 · 조각의 계약이 바뀌었으면 → `docs/text/` 의 그 문서
- [ ] 새 낱말 → `CONTEXT.md`. 결정 → ADR
- [ ] 새 잠긴 시험 · 켜는 값 → `docs/agents/test-map.md` 「잠긴 시험 넷」
- [ ] PR 「사람이 할 걸음」에 실호출 명령과 읽어 볼 것
