# 밤 청소 라운드 — 2026-09-26 밤 ~ 09-27 새벽

> 요구사항이 아니다. 운영자가 자는 동안 조율자와 워크트리 에이전트 다섯이 한 기록이다. 에이전트는 A 오늘의 UI · 공용 UI 모음,
> B 나머지 `app/`, C `src/lib`, D 저장소 위생 · 잠금 · 의존성 · DB 표면, E 시험이 옳은가를 맡았다. 할 일은 셋이었다 —
> 쓰레기 코드 걷기, 코드 규칙 · 아키텍처 점검, 시험 점검. 시작점은 `86d6b6c` 이고 끝은 `f082639` 다.
> **운영 배포 · `db push` · 마이그레이션 · 실호출은 하지 않았다** — Production 은 여전히 `08325ac` 다.
> 죽은 코드는 `delegation.md` 「죽은 코드는 셋으로 가른다」를 따랐다. 문서가 앞으로 쓴다고 적은 것은 남겼다.

## 머지한 것 (PR 열여덟, main verify 초록)

| PR | 영역 | 한 줄 |
|---|---|---|
| #259 | D | create-next-app 기본 그림 다섯(`public/*.svg`)과 아무도 안 짓는 빌드 자리 둘(`.next-buildcheck` · `.next-matching-test`)을 설정에서 걷음 |
| #261 · #262 | D | 입구 문서 경로 시험을 `AGENTS.md` · runbook 까지 넓힘, 문서의 `npm run` 이 실재하는지 잼, `ci-plan.mjs` 의 파일 목록이 실재하는지 잼(옮긴 파일이 조용히 시험을 건너뛰게 하던 자리) |
| #260 · #263 | C | 안 부르는 엔진 상수 · 함수 다섯(`stemIndex` · `branchIndex` · `YIN_YANG_KO` · `BUREAU_KIND_KO` · `PAIR_SCENARIOS`) 걷음, `reading/index.ts` 다시 내보내기 11 뗌, 받침 셈 복제를 `endsWithBatchim` 하나로 모음. 점수 · 프롬프트 스냅샷 변화 0 |
| #267 · #271 · #272 | A | 숨 쉬는 지도가 복사해 들던 천간 그림 조각 35 → `STEM_PARTS` 한 벌, 두 궤도 지도의 같은 모양 열셋 → `app/ui/orbit.tsx`, 얼굴 고르기 다섯 자리 → `FaceSymbol`. 전후 그린 결과가 바이트까지 같다 |
| #264 · #268 · #270 · #273 · #276 | B | 안 부르는 `TabHero`, 늘 안 넘기는 속성 일곱, 파일 밖에서 안 읽는 export 열하나, `EditInput` 의 죽은 `link` 갈래를 걷음. 주석의 PRD 절 번호 약 33곳을 절 이름으로 바꿈(넷은 이미 틀린 번호였다). 까닭 없는 `exhaustive-deps` 끔 0 |
| **#266** | B | **버그** — 서버(UTC)가 그리던 풀이 · 소식 · 책장의 날짜 · 시각이 아홉 시간 일렀다. 새벽 0~9시에 만든 글이 전날 날짜로 섰고, 풀이 칸 「… 생성」은 하이드레이션 글자가 어긋났다. `Asia/Seoul` 로 고치고 `TZ=UTC` 시험을 더함 |
| #265 · #269 · #274 · #275 | E | 단언 없이 초록이던 자리를 막음(흐름 러너 `0/0` 은 실패로 셈, pgTAP `no_plan` → 고정 plan), 모든 e2e `goto` · `reload` 가 하이드레이션까지 기다림, 덱 넘김의 1.4초 잠 → 다음 장 기다림, 관계 지도 카드 e2e 를 새로 넣음, 워커가 서며 남의 진행 중 풀이 시도를 어제로 밀던 경합, 「저장한 사람이 백이어도」 흔들림(하이드레이션 전 입력) |

바꾼 한글 문구: **없음.**

## 남긴 것 (안 쓰이는 것 같지만)

- 시험에서만 쓰는 export — lib 66 개(엔진 `*_POLICY` · 표 상수 · formula-comparison 등), app 의 `exportOnce` · `callModel` · `isNavigationActive` 등.
- `READING_REDACTION_NOTE`(다시 세울 때 부를 이름), `reading/bundle.ts`(G-21 판매), `needComplementOf`(ADR 0112), `legacy-v0` 계열(ADR 0067).
- `scripts/ui-*` 손 도구 다섯, `generate-*` 생성기 둘(ADR 0002), `backfill-need-summary.ts`(runbook), `public/matching/prompts.txt`(사진 생성 출처 기록).
- 두 지도의 자리 계산(`anglesOf` · `seatAngles`) — 방식은 같지만 문턱 · 끝 처리가 달라 합치면 매칭 지도의 자리가 움직인다.

## 운영자가 정할 것

1. **DB 에서 아무도 안 부르는 함수** — 다음 마이그레이션에서 걷을 후보다(D, 조율자 확인).
   - `reading_recovery_configured()` — 부르는 곳은 pgTAP 과 생성 타입뿐이다. 가장 확실한 후보다.
   - `cancel_reading_order` — ADR 0106 의 세 문 중 하나다. 결제 실패 경로가 쓸 예정인지 정해야 한다.
   - `clear_my_photo` · `set_my_photo` — 앱은 새 사진 문으로 갔다. e2e · 흐름 검사를 옮긴 뒤에 걷을 수 있다.
2. 관계 지도의 무한 애니메이션이 화면 밖에서도 돈다. 카드 전체가 `aria-live` 라 사람을 누를 때마다 카드 전체를 읽는다(A). 둘 다 동작은 맞고, 다듬을지는 취향이다.

## 안 고친 것

- `scripts/layers.test.ts` 「허용 목록에 순환이 없다」는 단언이 0개이고 throw 로만 실패한다. 목록이 비어도 초록이다(E).
- `src/lib` 의 `x!` 여섯은 지문으로 잠긴 채 둔다. 엔진 쪽을 좁히면 동작이 흔들릴 수 있다.
- e2e `signed-in.spec.ts` 사람 더하기(:988) — A 의 전체 실행에서 한 번 붉었다. E 가 서른 번 돌렸지만 재현하지 못했다. dev 서버가 도는 중에 `app/ui` 를 고쳐 화면이 다시 불린 것으로 짐작한다(확인 안 됨).
- `notice-gate` e2e 를 다른 로그인 시험과 워커 둘 이상으로 손으로 돌리면 전역 베타 일정이 옆 시험을 튕긴다. 스크립트는 `--workers=1` 이고 CI 는 차선이 따로라 괜찮다.
