# 역할 — 풀이 (글 · 프롬프트 · 문장 층 · 엔진)

`src/lib/reading/` · `src/lib/saju/` · `app/me/reading/` 와 `docs/text/` 가 사는 자리다.

## 먼저 읽는 것

- `docs/context/chart.md` 「2. 입력과 명식」 · `docs/context/evidence.md` 「4. 근거와 글」
- `docs/text/claim-policy.md` — 무엇까지 말할 자격이 있는가. 조각 · 조립 · 말뭉치는 같은 폴더의 나머지 셋
- `README.md` 「설계에서 핵심이었던 세 가지」 · 「학파에 따라 갈리는 지점」 — 엔진
- `docs/product/prd/reading.md` 「4. 풀이」
- `docs/agents/code-rules.md` 「금지어」 — 풀이 본문과 프롬프트의 줄
- `docs/agents/test-map.md` 「잠긴 시험 넷 — `*.live.test.ts`」 · 「무엇을 고쳤으면 무엇을 돌리나」의 엔진 · 프롬프트 줄
- `docs/notes/verification-discipline.md` — 검증 수준보다 세게 말하지 않는다
- ADR 0047(모델은 `app/me/reading/model.ts` 한 곳에서만) · 0073(막힌 이름은 프롬프트가 말한다)

## 이 저장소의 방식

규칙은 아래 원본에만 있다 — 여기는 어디를 열지만 말한다(ADR 0145).

- [설계에서 핵심이었던 세 가지](../../README.md#설계에서-핵심이었던-세-가지) — 엔진은 판정이 아니라 근거를 낸다
- [금지어](../agents/code-rules.md#금지어) · [이름](../agents/code-rules.md#이름) — 풀이 본문 · 프롬프트의 낱말, 엔진 파일 이름
- [일하는 법](../agents/delegation/working.md) — 프롬프트에 규칙을 쌓지 않는다 · 올리기 전에 한 번 부른다
- [무엇을 고쳤으면 무엇을 돌리나](../agents/test-map.md#무엇을-고쳤으면-무엇을-돌리나) — 프롬프트 본문 · 엔진 판본 파일을 고쳤을 때
- [무엇이 잠겨 있나](../architecture.md#무엇이-잠겨-있나--그리고-무엇이-아닌가) — 화면은 풀이 입구가 아니라 잎을 부른다
- [무인 라운드](../agents/delegation/unattended.md) — 실호출은 운영자가 돌린다

## 하지 않는 것 · 묻는 것

- 프롬프트 실험은 보류다(2026-09-15) — 모델의 버릇은 받는 쪽을 넓혀 푼다. 다시 열지는 운영자가 정한다(ADR 0139 · [overlaps A/B](../notes/async-generation-and-overlaps-ab.md))
- 실호출 · 백필(`READING_LIVE` · `BACKFILL_*` · `TASTE_LIVE`)을 돌리지 않는다 — 토큰이 나가고 운영 표에 쓴다([권한 등급](../agents/delegation/permissions.md))
- 동의 밖 판정 이름(신강 · 용신 · 대운 …)을 풀이 본문에 들이는 변경은 결정이다([금지어](../agents/code-rules.md#금지어) · ADR 0073)

## 끝날 때 고치는 것

- [ ] [끝났다는 것](../agents/delegation/done.md) — PR 칸 여섯. 「사람이 할 걸음」에 실호출 명령과 읽어 볼 것
- [ ] 말할 자격 · 강도 · 조각의 계약이 바뀌었으면 → `docs/text/` 의 그 문서
- [ ] 새 잠긴 시험 · 켜는 값 → [잠긴 시험 넷](../agents/test-map.md#잠긴-시험-넷--livetestts)
