# 공유 궁합 자료의 판을 못 읽으면 가장 엄한 판으로 검사한다

> **운영자 결정 2026-10-01** — 「matchInput 파싱 실패를 fail-closed 로. 정상 `legacy-v0` 자료의 호환성은 유지한다.」
> 슬롭 감사의 결정 대기 3번이다(`docs/notes/2026-10-01-slop-audit.md`).

## 잰 것 (2026-10-01)

- 공유 궁합(`match`)의 글 검사는 동의 범위 밖 판정 이름(`OUT_OF_SCOPE_TERMS`)을 본문에서 막는다. 옛 컷(`legacy-v0`)만 `억부` 를
  푼다 — 그 판은 `compatibility.eokbuMatch` 를 싣고 절이 그것을 읽게 하기 때문이다(ADR 0067).
- 판은 검사가 받은 자료 문자열에서 읽는다(`matchInputOfEvidenceText`). 그 함수는 **깨진 JSON · 모르는 `matchInput` · 계약이 없는
  자료를 모두 `legacy-v0` 로 돌려줬다** — 판을 못 읽은 자리에서 금지 하나가 풀렸다(fail-open).
- 고치기 전 코드에서 깨진 JSON · 모르는 판 · 계약 없는 자료 · 공유 범위를 안 말하는 계약 넷에 `억부` 를 쓴 본문을 넣으면 넷 다
  검사를 지났다(`src/lib/reading/reading.test.ts`, 시험 넷 붉음).
- 옛 컷은 `shareEvidence` 가 지은 그대로 **`contract.scope === 'match-consent'` 이고 `matchInput` 키가 없다**(`LegacySharedEvidence`,
  2026-08-26 부터 `scope` 를 싣는다). A · B 는 `matchInput` 을 늘 싣는다.

## 정한 것

- **옛 컷은 「공유 계약인데 `matchInput` 이 없다」로만 알아본다.** 그 밖에 판을 못 읽으면 `matchInputOfEvidenceText` 는 `null` 을
  돌려주고, 검사는 `null` 을 가장 엄한 판(전체 금지어)으로 다룬다.
- `matchInput` 이 있는데 견주는 판(`limited-v1` · `extended-v1`)이 아니면 — 문자열 `'legacy-v0'` 를 적어 둔 경우도 — 모르는 판이다.
  그런 자료를 짓는 코드는 없다.
- 프롬프트 본문은 안 바뀐다 — 검사 쪽만이다.

## 치르는 값

- 계약이 망가진 옛 컷 자료에서 `억부` 를 쓴 글은 이제 `out-of-scope-judgment` 로 떨어진다. 토큰은 이미 나간 뒤다. 자료가 망가졌다는
  뜻이라 내보내지 않는 쪽을 골랐다.

## 고르지 않은 것

- **자료에 `compatibility.eokbuMatch` 가 실제로 있을 때만 푸는 것** — 더 곧은 조건이지만 판을 읽는 자리가 둘이 된다. 이 결정의
  범위는 실패 갈래를 닫는 것까지다.
