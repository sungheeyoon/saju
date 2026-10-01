# 슬롭 코드 감사 — 후보를 나누고, 결함 둘과 동작 무변 정리 셋만 머지하고 두 번 배포한 라운드 — 2026-10-01

앞 기록은 `2026-10-01-docs-diet-audit.md`. **요구사항도 규칙도 아니다** — 그날의 사정이다.

## 범위

운영자 지시: 「아직 코드를 고치거나 지우지 마라 … 슬롭 코드 후보를 … 중복 · 미사용 · 임시 우회 · 과도한 추상화 · 의미 없는 생성
코드로 나누고 … 기존 결정과 충돌하는 항목은 결정 사항으로」. 조율자가 읽기 전용 `reviewer` 일곱을 띄웠다 — A 엔진 · B 도메인 lib ·
C 화면 · D 문 · 액션 · E scripts/e2e · F 기계 측정(knip · jscpd · tsc) · G DB. 정리 후보는 어림 합 약 2,000줄. 기계 측정: 15줄 이상
중복 0.56% · 제품 코드 탈출구 수 = 잠금 목록 · 미사용 의존성 0.

## 외부 리뷰가 바로잡은 것

운영자가 붙여 넣은 외부 리뷰를 조율자가 코드에서 다시 재서 갈랐다.

1. 「`discovery_deficit_complement_v1` 은 살아 있다」는 옛 본문을 인용해 틀렸다 — 부르는 함수 넷의 마지막 정의는 `20261105090000`
   (570 · 673 · 764 · 1342줄)이고 v1 을 안 부른다. 다만 DB 함수 묶음 삭제는 멈추고, 로컬 `pg_proc` 를 확인한 뒤 하나씩 한다.
2. 공용 액션 훅 · 「호출처 하나뿐인 래퍼」 일괄 삭제 · 신살 164 → 65 는 과했다 — 지우면 복잡도가 사라지는가로 판단한다. 신살은 약
   100줄이 목표.
3. 3파동에서 `fail_reading_job` · 머리글 신호 · `person` 생성기를 뺐고, 방 메뉴는 접근성 PR 로 나눈다.

조율자가 첫 표에서 마지막 정의 날짜 둘과 잠금 시험 이름을 틀렸다.

## 머지

- **#405**(`0423e9f`) — 결함 둘(ADR 0078): `pipeline.ts` 가 삼키던, 동의가 연 풀이를 못 찾은 실패를 기록에 남긴다. 사주풀이 글 화면
  (`[subject]`)의 DB 실패가 404 가 아니라 오류 화면이 된다 — 문 `savedPersonOf`, 옛 자리 5 → 4.
- **#403**(`a22b9b4`) — 삼합과 방합이 한 함수로 관계를 낸다. 골든 무변.
- **#404**(`566025d`) — 같은 시험 블록 삭제(19 → 13), `visibleShare` → `countRatioOf`. 동작 무변.
- **#406**(`80c59bf`) — `ReadingPanel` 의 card 갈래와 `layout` prop 을 걷음(+25 −102). 렌더 결과 그대로.

머지 전 모의 합치기(#405 → #403 → #404) 초록.

## 배포 — 둘(운영자 「배포」 답)

| SHA | 배포 | Ready(서울) |
| --- | --- | --- |
| `0423e9f` | `saju-35shwr9k3…` | 15:47:49 |
| `80c59bf` | `saju-4jfe2pg5i…` | 16:05:05 |

둘 다 그 SHA 의 detached 워크트리에서 `vercel deploy --prod`, alias `https://saju-snowy.vercel.app`. 올리기 전 `verify` · `main-red`
초록, 마이그레이션 없음. `vercel inspect` 는 CLI 배포의 커밋 SHA 를 안 보여 준다 — SHA 의 근거는 detached 워크트리다.

익명 smoke: `/` · `/auth` · `/compat` 200, `/me/people` · `/ops/reports` 307 → `/auth`. **운영자가 Production 에서 `/me/readings/<사람 id>`
와 사람 목록이 잘 나오는 것을 확인했다.**

## 결정 대기 — 열

1. `ui-*` 갤러리 도구 약 1,000줄 — 지울지, ui 역할의 도구로 둘지. `scripts/ui-seed.mjs:84` 의 `2026-10-31`
2. `ai` · `@ai-sdk/openai` 와 `callModel` — 시험 밖 호출 0(ADR 0020)
3. `matchInputOfEvidenceText` 가 파싱 실패 때 `legacy-v0` 로 내려가 억부 금지가 풀린다(`src/lib/saju/evidence/shared.ts:432-436`,
   실패 때 여닫음)
4. 운영자 설문 읽기에 접속기록이 없다(`app/ops/survey/read.ts`, ADR 0105 범위 밖)
5. 열쇠판 `set_discovery_participation` 이 베타 종료를 안 본다(`20261106090000:287`)
6. `followingCandidacy` 가 `following.facts` 와 같은 값으로 모델 자료에 두 번 실린다(프롬프트 · 실호출)
7. `src/lib/saju/analysis/needComplement.ts` 287줄 — 런타임 소비자 없음(ADR 0112 §8)
8. 시험만 부르는 두 번째 구현 — `src/lib/saju/constants/relations.ts` 의 `findTripleCombinations` · `findPunishments`
   (`docs/agents/delegation.md` 「죽은 코드는 셋으로」 해석)
9. 문구 — 운 표 「합쳐서」 구분 · 겹친 문구 상수 표기 · `KNOWN_UNCONTRACTED_TEXT`
10. 개발용 `MOCK_OUTPUT` 이 운영 클라이언트 묶음에 실리는가 — build 로 재야 확정

## 남은 파동 — 운영자가 동의한 차례

1. 시험 파서 29벌 · `cookieFor` 와 정확히 같은 가짜 요약 · 같은 명식 `settle` 검토(3파동, 이 노트와 나란히 도는 중)
2. 신살 표 약 100줄
3. 지지 관계 · 운 표는 각각 재감사
4. DB 함수는 로컬 `pg_proc` 확인 뒤 하나씩 — `photo_of` 먼저 · v1 → `one_way_v1` 은 같은 마이그레이션 · `reading_recovery_configured`
   는 runbook 의 Vault 질의와 대조 뒤 · `set_my_photo` 좁히기

방 메뉴 → `useDetailsMenu` 는 별도 접근성 PR.

## 아직 안 고친 문서 노후 — 목록만

- `docs/notes/text-layer-decisions.md:8` — 없는 `src/lib/text/`
- `docs/notes/prompt-map.md` — 걷은 `/inspect`
- `src/lib/discovery/element-axes.ts:9-12` — DB 가 v1 을 다시 센다고 적음
- `CONTEXT.md:238` — claim 은 코드에 없다
- `scripts/checks.mjs:2-5` — 일곱 벌 → 아홉
- `app/keyed-client.ts:11` — 여덟 → 아홉
- `scripts/check-reading.mjs:453` — 자세히 보기/접기

## 끝 상태

- Production: `80c59bf`(위 표, 운영자 확인).
- DB remote: 변화 없음.
