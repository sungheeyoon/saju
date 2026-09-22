# v2 를 지은 차례 — 단계 로그

> **세션 기록이다.** 세션 메모 「v2 단계 로그」(2026-08-22~25)를 2026-09-22 에 저장소로 옮겼다(ADR 0090). 요구사항도 규칙도
> 아니다 — 무엇을 만드는가는 `docs/prd.md`, 결정은 `docs/adr/`, 낱말은 `CONTEXT.md` 가 답하고,
> **코드와 어긋나면 코드가 맞다.** 날짜가 붙은 문단은 그날의 사정이고 커밋 해시는 그날의 자리다.
> 여기 적힌 경로가 실재하는지는 시험이 재지 않는다.
>
> **지금은:** **단계 번호는 옛 PRD(`docs/product/prd-archive.md`)의 것이고 진행 기준이 아니다.** 지금 모양은 `docs/prd.md` 가 답한다.
>
> **낡은 경로:** `app/evidence-panel.tsx` · `app/me/match/inputs.ts` · `app/query.ts` · `app/revision.ts` · `supabase/tests/12_revision_retention.test.sql` 은 없다(판본 저장소는 ADR 0071 로 걷혔고 주소 코덱은 `app/hash-query.ts`). `src/lib/matching/elementAxes.ts` 는 `src/lib/discovery/element-axes.ts` 로 갔다(ADR 0085).

v2 를 **어떤 순서로 지었는가**의 기록이다.

> **여기 적힌 단계 번호(1~11단계)는 옛 PRD 의 것이고 진행의 기준이 아니다.**
> 그 문서는 `docs/product/prd-archive.md` 로 내려갔다. 지금 무엇을 만들지는
> `docs/prd.md` 와 이슈가 정한다((옛 메모 saju-prd-axis — 저장소 문서로 흡수됨) · (옛 메모 saju-prd-open-decisions — 저장소 문서로 흡수됨)).

배포·시험 층·마이그레이션 같은 **지금도 참인 사실**은 (옛 메모 saju-prd-open-decisions — 저장소 문서로 흡수됨) 와
이 파일의 「붙어 있는 실물」·「시험이 네 층이다」 절을 본다.

## 목표가 다시 잡혔다 — AI 에 넘길 객관 지표 (2026-08-22)

본인이 말한 진짜 목표: **L1 만세력 → L2 조합·궁합 → 모든 지표를 강도까지 나열한
구조화 자료(JSON) → 그것을 AI 에 넘겨 해석 문장을 받는다.** 프롬프트 형식은 아직
안 정했고 그건 본인 몫. 이 저장소의 몫은 **AI 에 넘기기 전까지의 객관 지표와
그 검증**이다. 그러므로 진척도는 말뭉치 칸 수가 아니라 **payload 의 완전성**으로
재는 게 맞다 — 다만 말뭉치가 남긴 자산은 문장이 아니라 `text/policy.ts` 의 계약이고,
payload 는 그 계약의 **두 번째 소비자**여야 한다(계약 밖에 새로 만들면 화면과 AI 가
갈라진다).

의견 하나를 검토했는데 "강도를 측정값·판정 신뢰도·해석적 중요도 셋으로 분리하라"는
제안은 **이미 되어 있었다**: 측정값은 `Relation.full`·`distance`, 신뢰도는
`ClaimStrength` + `CLAIM_CEILING`, 해석 가중치는 `MATCH_POLICY_V0` 를 엔진 밖
`src/lib/matching/` 에 격리한 것. 새 설계가 아니라 **있는 계약을 payload 로
내보내는 일**이다. 그 의견의 JSON 예시는 항목마다 `status: 'fact'` 를 박았는데
그것은 「강도는 손으로 적지 않는다」를 어긴다 — payload 는 `claimPath` 만 들고
강도는 표에서 유도해야 한다.

**T1~T4 완료 (2026-08-22, 커밋 `51fb94a`)** — payload 이전에 엔진에서 잡아야 할 것들:
1. `resolveRelation` — 경계에서 `direction`·`cycle` 의 인덱스를 글자로 푼다.
2. A·B 스왑 대칭성 테스트 — 뒤집혀야 하는 여덟과 **안 뒤집히는 것 하나**(날것 인덱스).
3. `Compatibility.hourKnown` — 「없다」와 「못 셌다」를 값으로 가른다.
   `CompatPerson.hourKnown` 이 사라졌다(호출부가 손으로 넘기던 자리).
4. `COMPAT_CLAIM_PATHS` — 궁합 결과도 근거를 가리키게 양방향으로 잠근다.

**T5 완료 (2026-08-22, 커밋 `b656588`)** — `src/lib/saju/evidence/`.
`evidenceOf({ a, b? })` 가 `Evidence` 를 낸다. 궁합은 **안 받고 안에서 낸다**
(호출부가 넘기면 그것이 이 두 명식의 궁합인지 아무도 안 본다).
- `EVIDENCE_CONTRACT` 를 값과 함께 싣는다 — 강도 사다리·규칙 묶음 이름·
  `INCOMPLETE_INPUT_RULE` 까지. 받는 쪽이 우리 문서를 안 읽는다는 것이 전제.
- `claims: Record<ClaimPath, {presence, absence}>` — 강도는 `CLAIM_CEILING` 에서
  유도되고 항목은 자기 이름으로 선다. **두 방향을 다 낸다**(있다/없다 상한이 다르다).
- `EXCLUDED_PATHS` = `{ saeun, wolun }`. 이유까지 값으로. 양방향 테스트가 잠근다.
- `Jsonified<T>` — `Date` 를 타입 수준에서 ISO 문자열로. 절기 `date`·조후 중기까지.
- 관계는 대운·세운·월운 칸의 것까지 전부 `resolveRelation`. 깊이 훑는 테스트가 잠근다.
- 골든은 **모양만**(`evidence.snapshot.txt` 150줄) + **크기**를 찍는다.

**운을 표째 싣던 것을 고쳤다 (커밋 `5a548a1`) — 본인이 짚었다.**
첫 판은 대운 8칸·세운 10해·월운 12달을 통째로 싣고 **지금이 어느 칸인지는 안
실었다**(`now` 를 뺐다). 뺀 이유(「만든 시각과 읽는 시각이 다르면 틀린다」)는 맞지만
**그래서 표를 대신 싣는다**가 틀렸다 — 어느 칸이 지금인지 받는 쪽이 짚게 되고,
그것은 우리가 안 하기로 한 판정을 떠넘기는 것이다. 답은 빼는 것이 아니라
**'지금'을 자료가 들고 나가는 것**(`Evidence.viewedAt`, `evidenceOf` 가 시각을 필수로 받음).
`saeun`·`wolun` 은 이유와 함께 빠지고, `daeun` 은 표만 빠진다(대운수·방향·근거는 사실).
궁합 화면에도 `viewedAt` 을 잡았다(원국 화면과 같은 규율).

**크기**: 한 사람 **28KB**, 두 사람 **91KB**(UTF-8). 고치기 전 72/214KB 였다.

**화면에 붙였다 (2026-08-22, 커밋 `9ce963a`)** — `app/evidence-panel.tsx`.
원국·궁합 화면 아래 접힌 칸. **열기 전에는 만들지 않는다**(e2e 가 그것까지 본다).
전체를 펼치지 않고 **계약 + 상한 표**만 화면에 놓고 전체는 JSON 파일로 내린다 —
계산 값은 이미 화면 곳곳에 표로 있고, 새로 보아야 하는 것은 값이 아닌 계약이다.
`CARD` 를 `app/card.ts` 로 뺐다(evidence-panel ↔ saju-calculator 순환 임포트).

**크기를 다시 쟀다 — `String.length` 로 세고 있었다.** UTF-16 칸 수라 한자·한글이
하나로 세어지는데 UTF-8 로는 세 배다. 198KB 로 적혀 있던 것이 실은 **214KB**,
한 사람은 **72KB**. 화면과 골든이 이제 같은 방법(TextEncoder)으로 센다.
**운 셋을 뺀 조각**(계약+claims+pillars+analysis+relations+궁합)은 minify 해서 56KB.

**다음 후보**:
1. 프롬프트 층(본인 몫이라고 함) — 자를 축과 문장 틀. 자료는 준비됐다.
2. 앞으로의 운을 볼 길이 지금은 없다 — `fortune: 'current-only'` 로 못박았다.
   필요해지면 `evidenceOf` 에 옵션 하나지만, 그러면 `EXCLUDED_PATHS` 가 정적이
   아니게 되고 양방향 잠금이 흐려진다.
3. 고지에 남은 판정들, 격국 외부 대조 데이터셋, 생성기.

**로드맵**: v1 = L2 + 1:1 궁합(링크 공유) 까지가 포트폴리오 완성본.
v2(유저 풀 매칭)는 DB·인증·유저 확보가 필요하고 새로운 엔지니어링이 아니라서
안 가도 된다는 것이 본인 판단.

**v1 걸림돌이던 URL 공유는 2026-08-16 해결.** 제출된 입력은 `app/query.ts` 의 코덱을
거쳐 주소창이 들고, 컴포넌트는 `useSearchParams` 로 읽는다. 자세한 것은
`engine-decisions.md` 의 "주소창이 제출된 입력을 들고 있다" 항목.

L1 에서 내린 설계 판단들과 학파 분기 처리는 `engine-decisions.md` 참조.

---

## v2 로 갔다 (2026-08-24) — 「안 가도 된다」가 뒤집혔다

위에 「v2(유저 풀 매칭)는 안 가도 된다는 것이 본인 판단」이라고 적혀 있는데 **그 판단이
바뀌었다.** 2026-08-24 에 PRD(지금은 `docs/product/prd-archive.md`, GitHub 이슈 #1)와 ADR 0006~0008 이
서고, 그날 Supabase 를 실제로 붙여 3·4단계를 구현했다. 제품의 정체성은 이제 궁합
계산기가 아니라 **동의 기반 사주 매칭 서비스**이고, 계정·Person·동의는 부가 배관이
아니라 핵심 도메인이다.

> **아래의 단계 번호는 더 이상 진행의 기준이 아니다** (2026-09-03 개정).
> 그 11단계는 옛 PRD 의 것이고, 그 문서는 `docs/product/prd-archive.md` 로 내려가
> **US 번호의 출처로만** 남았다. 지금 무엇을 만들지는 `docs/prd.md` 와 GitHub 이슈가
> 정한다((옛 메모 saju-prd-axis — 저장소 문서로 흡수됨) · (옛 메모 saju-prd-open-decisions — 저장소 문서로 흡수됨)).
>
> 아래는 **그때 무엇을 어떤 순서로 만들었나**의 기록으로 읽는다 — 코드가 왜 이 모양인지
> 되짚을 때 쓸모가 있다.

- 1단계(익명 fragment 이전) — 끝. 커밋 `f24848e`
- 2단계(음력 변환표) — **아직 손도 안 댔다.** ADR 0002 만 있고 `src/` 에 음력 코드가
  없다. `calendar` 컬럼은 `lunar`·`lunar_leap` 을 받게 만들어 뒀지만 쓰기 경로가
  `0A000` 으로 거절한다
- 3단계(스키마·RLS·가입 관문) — 끝. 커밋 `40c0709`
- 4단계(selfPerson·Person 관리·수정) — **끝.** 로그인·온보딩·판본 수정
  (`0fb5372`, `d6b6e3c`, `877499f`) 에 이어 가족·친구 Person 과 수동 궁합까지
  (`b8e9471`, `b9f2df4`) 됐다. 아래 「4단계 끝났다」 참조
- 5단계(discovery) — **끝.** 커밋 `4921711`. 아래 「5단계 끝났다」 참조
- 6단계 이후(MatchRequest·알림·동의, Reading, AI) — 아직

## 붙어 있는 실물 (2026-08-24)

- **Supabase**: Vercel Marketplace 통합. 프로젝트 ref `skxtqxajfmxiusqrgbuf`,
  리소스 이름 `supabase-chestnut-branch`, Free plan. **프로비저닝만으로는 프로젝트에
  안 붙는다** — Vercel 대시보드 → 프로젝트 → Storage → Connect Store 를 눌러야
  환경변수가 내려온다. CLI 에 connect 하위 명령이 없다(`disconnect` 만 있다)
- **Vercel**: `sungheeyoons-projects/saju` (`prj_DfSzva1bCwl4JXT5gm4mRotiyBiv`).
  이 세션에서 새로 만들었다. **아직 한 번도 배포 안 했다** — 프로덕션 도메인 없음
- **대시보드에서만 되는 것 셋**(코드에 없으니 잊기 쉽다): Auth Hooks 의
  Before User Created → `public.gate_signup_by_invite`(Postgres Function, HTTP 아님),
  Google provider 의 client id/secret, URL Configuration 의 Site URL·Redirect URLs.
  지금 Site URL 은 `http://localhost:3000` 이라 **배포하면 반드시 바꿔야 한다**
- **구글 콘솔의 승인된 리디렉션 URI** 두 개:
  `https://skxtqxajfmxiusqrgbuf.supabase.co/auth/v1/callback` 와
  `http://127.0.0.1:54321/auth/v1/callback`(로컬 스택용). 앱 주소는 여기 안 들어간다
- **초대 명단**: `public.invite` 에 `운영자 계정` 하나. 운영자가 SQL 로 넣는다
  (`service_role` 에도 이 표 권한을 안 줬다)
- **로컬 개발**: `.env.development.local` 은 **원격**을 가리킨다. 로컬 Supabase 스택은
  시험 전용이다(`npm run db:start`). Google OAuth 는 로컬에 설정 안 돼 있다

## 시험이 네 층이다 (2026-08-24)

```
npm test          1110  vitest — 순수 함수
npm run test:e2e    47  playwright — 화면
npm run test:db     44  pgTAP — 정책이 막는가
npm run test:flow   28  실제 Supabase 한 바퀴 — 가입·거절·저장·수정·되읽기
```

뒤의 둘은 Docker 로컬 스택이 떠 있어야 돌아서 `verify` 에 **안** 넣었다. CI 는 앞의
둘만 돌리고, e2e 에는 껍데기 Supabase 접속값을 준다.

## 2단계(음력) 끝났다 (2026-08-24)

커밋 `0e34ee6`(표·검증) → `d9410e9`(입력 경로). 남은 것은 **4단계의 가족·친구 Person**
하나다.

- `scripts/generate-lunar-table.mjs` → `src/lib/saju/lunar/lunarTable.generated.ts`.
  음력 **1912~2100년** 189해, 윤달 69. 28KB.
- 규칙은 KASI **음력 운용지침(2017-07-01 시행)**. 전문과 검증 자료 모두
  박한얼·민병희·안영숙, PKAS 32(3), 2017, 407~420 (doi 10.5303/PKAS.2017.32.3.407).
  이 논문이 이 작업의 전부다 — 규칙 넷, 하한 1912의 근거, 대조용 표 넷이 다 여기 있다.
- 검증은 밖에서 온 자료로만: 윤달 배치 69해(Table 8, 1984 윤10·2033 윤11 포함),
  한국↔중국이 갈린 61개 달의 초하루(Table 7), 자정에 붙은 삭·동지(Table 2·3).
  전부 `src/lib/saju/lunar/validation/kasiCases.ts`. **첫 실행에 전부 통과했다.**
- 변환 API: `solarFromLunar` · `lunarFromSolar`, 거부 이유 세 갈래
  (`out-of-range`·`no-such-leap-month`·`no-such-day`). 6만 9천 날 전수 왕복 시험.
- 앱: `Query.calendar` 추가(주소는 `cal`, 음력일 때만 싣는다), 변환은 `chart.ts` 의
  `solarDateOf` 한 곳. 폼이 「양력 …로 계산합니다」를 계산 전에 보여준다.
- DB: `20260824210000_accept_lunar_input.sql` 이 두 RPC 의 `0A000` 을 걷고
  `lunar_input_needs_conversion` 검사식을 더한다.

**시험 네 층: 1143 unit · 51 e2e · 45 pgTAP · 31 flow.**

여전히 **한 번도 배포 안 했다.** Supabase Site URL 이 `localhost:3000` 이다.

## 4단계 나머지의 화면 구조는 정해졌다 (2026-08-24)

「저장된 두 Person 의 궁합을 어디서 계산하는가」를 사용자와 좁혀 **ADR 0007 의 「이행」
절**에 적었다. 새 ADR 을 세우지 않은 이유는 ADR 0007 이 이미 「서버는 저장된 Person id
로만 계산한다」고 정해 뒀기 때문이다(11행).

`/me/compat?a=<id>&b=<id>` — 서버가 사용자 JWT 로 판본 둘을 읽고 기존 순수 코드로
계산한다. 조회용 definer RPC 도 service_role 도 안 만든다. 판단은
`db-and-auth-decisions.md` 의 「무엇을 내려보낼지는 접근 근거가 정한다」·「없는 것과 못
보는 것을 다르게 말하면 존재가 샌다」·「같은 값이 한 자리에서는 뜻이 있고」 항목.

**구현은 아직 하나도 안 했다.** 남은 것은 `create_managed_person` RPC, Person 목록·추가
화면, `/me/compat` 셋이다 — 4단계에 남은 것은 「가족·친구 Person」 **하나가 아니라
그것과 수동 궁합 둘**이다.

`231618e` 의 근거 문장 넷을 `3d46245` 가 바로잡았다(claim 뒤 `viewer` 때문에 managed 의
근거는 「내가 입력한 사람이라서」가 아니라 「RLS 가 이미 열어 준 범위라서」다 / definer
금지는 managed 경로에만 / 판별자를 밖에 내놓지 않고 `payloadForViewer` 하나만 연다 /
재사용 대상은 `CompatCalculator` 가 아니라 `CompatView`).

**PRD 에서 `관계 유형` 을 뺐다**(US 19·UserPersonAccess 항목). `CONTEXT.md` 의
localLabel 이 `_Avoid_: relationship` 이라 적어 뒀고 스키마도 처음부터
`local_label`·`note`·`role` 셋뿐이었다 — 어긋나 있던 것은 PRD 쪽이었다.

## 4단계 끝났다 (2026-08-24) — 다음은 5단계(discovery)다

커밋 `b8e9471`(가족·친구 Person + `/me/compat`) → `b9f2df4`(서버를 세워 두드리는 검사).
**PRD 1~4단계가 다 끝났다.** 다음은 5단계 — DiscoveryProfile·opt-in·`discovery-v0`·
노출 기록·후보 화면이다.

- **DB 는 `create_managed_person` 하나만 늘었다**(`20260824230000_manage_people.sql`).
  `user_person_access`·저장 자리 한도 트리거·정책 넷은 처음부터 서 있었고, 없던 것은
  `authenticated` 에 `insert` 가 없어서 생긴 「Person 을 만드는 길」 하나였다.
  claim 은 옮기지 않는다(그것이 `create_self_person` 과의 유일한 차이).
  메모에 상한 200자와 「빈 문자열 금지」 검사식을 함께 걸었다.
- **화면 셋**: `/me/people`(목록·추가·라벨/메모·목록에서 빼기),
  `/me/compat?a=&b=`(GET 폼으로 둘 고르기 + 결과), `/me/compat/not-found.tsx`.
  `/me` 는 둘로 가는 링크만 얻었다.
- **`CompatView` 를 `app/compat-view.tsx` 로 떼어 익명 화면과 함께 쓴다.**
  화면마다 다른 사실은 `notice` 프롭 한 자리로만 드러난다.
- **`payloadForViewer(personId)`**(`app/me/payload.ts`)가 밖으로 나가는 유일한 문.
  판별자는 내보내지 않는 심볼이라 밖에서 payload 를 지을 수 없다.
- **시험 네 층: 1148 unit · 51 e2e · 61 pgTAP · 68 flow.**
  flow 는 이제 스크립트 둘이다 — `check-onboarding.mjs`(31) + `check-managed.mjs`(37).
  뒤엣것은 `NEXT_DIST_DIR=.next-check` 로 서버를 따로 지어 띄우고 HTTP 로 잰다
  (`next dev` 는 한 폴더에 하나만 떠서 켜 둔 개발 서버와 다툰다).

**아직 한 번도 배포 안 했다.** Supabase Site URL 이 여전히 `localhost:3000` 이고,
대시보드에서만 되는 설정 셋은 그대로다 — 「붙어 있는 실물」 항목 참조.

**안 한 것 하나**: 목록에서 뺀 Person 의 행은 DB 에 남는다(엣지만 지운다). 아무도 못
보지만 지워지지도 않는다. 마지막 엣지가 사라질 때 Person 을 지우는 트리거는 claim·merge
와 함께 정할 일이라 4단계에서는 손대지 않았다.

## 5단계(discovery) 끝났다 (2026-08-25) — 다음은 6단계(MatchRequest)다

커밋 `4921711` 하나. PRD US 26~35 이고, 정책의 뼈대는 ADR 0003 이 이미 정해 뒀으므로
새 ADR 대신 그 문서에 **「이행」 절**을 붙였다(2026-08-25).

**새로 정한 것은 하나 — 오행 요약을 저장한다.** 셋이 한꺼번에 참이라 다른 길이 없었다:
후보의 출생 원문은 브라우저로 나가면 안 되고(ADR 0008), **Supabase RPC 는 로그인한
사람이 직접 부를 수 있고**, DB 는 명식을 계산할 수 없고, service_role 은 사용자 경로에
안 쓴다(ADR 0006). 그래서 **참여자가 자기 오행 요약(다섯 오행의 개수·비중·글자 수)을
풀에 내놓는다.** 어느 판본에서 나왔는지를 함께 들어서, 낡으면 틀린 순서가 아니라
**탈락**이 되고 그 사람이 화면을 열면 스스로 낫는다.

- **표 셋**: `discovery_profile`(별명·소개·선호·참여 시각·요약·판본),
  `discovery_hidden`(다시 보지 않기 — 차단이 아니다), `discovery_impression`(노출 기록,
  **사용자는 못 읽는다**).
- **두 축은 SQL 에도 있다**(`discovery_complement` · `discovery_combined_balance`).
  RPC 가 내주는 것이 곧 브라우저가 볼 수 있는 것이라, 벡터를 내주고 화면에서 접을 수
  없기 때문이다. TypeScript 쪽은 `src/lib/matching/elementAxes.ts` 한 자리로 모아
  `match-v0` 와 `discovery-v0` 가 같은 자를 쓴다(match-v0 숫자는 안 움직였다).
- **정책은 `src/lib/discovery`**: 가중치 0.54/0.46(match-v0 의 남은 두 축을 다시 나눈
  값이고 지금부터는 따로 산다), 탐색 20%, 씨앗은 `사용자:오늘`.
- **화면 `/me/discovery`**: 프로필·참여 동의·후보 목록·다시 보지 않기. 후보 카드로
  나가는 것은 별명·소개·자리·탐색 여부·한 줄 설명뿐 — 점수도 두 축의 값도 안 나간다.
- **하드 제외**: 자기 자신·미참여·중지·낡은 요약·양쪽 성별 조건, 그리고 쌍에 걸린 셋
  (다시 보지 않기·차단·살아 있는 결정) — 셋은 `discovery_unavailable` 한 함수가 든다.
  **나이 조건은 없다**(본인확인 몫).
- **시험 네 층: 1179 unit · 51 e2e · 199 pgTAP · 151 flow.** flow 검사도 격리를 넣어 **DB 를 안 비워도 반복 실행된다**(두 번 연속 돌려 확인).
  flow 는 스크립트 넷이다 — `check-onboarding`(31) · `check-managed`(37) ·
  `check-discovery`(39) · `check-match`(44 — 동시 수락·차단 겨루기를 `Promise.all` 로 잰다). 서버 띄우는 부분은 `scripts/next-server.mjs`.

## 6단계 — 요청·동의·Match·알림 (2026-08-25, 마이그레이션 `20260825120000_match_request.sql`)

표 넷(`match_request`·`match`·`notification`·`block`)과 ADR 0009. **셋은 브라우저에
한 줄도 안 열려 있고**(`block` 만 읽기), 읽는 길은 `definer` 함수뿐이다 —
`my_match_requests` · `my_matches` · `my_notifications` · `unread_notifications`.
쓰는 길은 `request_match(상대 하나)` · `respond_to_match_request` ·
`cancel_match_request` · `block_user` · `mark_notifications_read`.

- **요청은 노출 기록에 매인다** — 후보로 뜬 적 없는 사람에게는 못 청한다. 판본 둘·추천
  이유 양방향·정책 버전을 함수가 그 자리에서 잡는다(앱이 실어 보내지 않는다).
- **거절의 말이 하나다** — 없는 사람·미참여·차단·이미 결정 있음·본 적 없음이 같은 문장.
- **살아 있는 결정은 한 쌍에 하나**(pending·accepted·rejected 를 한 유일 인덱스에).
  거절은 되돌리지 않고 서로의 후보에서도 내려간다. 무효·거둠은 다시 청할 수 있다.
- **수락은 판본을 다시 본다** — 어긋나면 수락이 아니라 무효. 확인·전이·Match·양쪽 알림이
  한 트랜잭션. 중복 수락은 Match 를 둘로 만들지 않는다.
- **판본을 쌓는 그 트랜잭션이 pending 을 무효로 만든다**(`add_person_revision` 안).
  지문이 같으면 아무것도 안 쌓이므로 이름·메모 수정은 무효화하지 않는다.
- **차단은 되돌리지 않는다**(용어집) — delete 권한 자체가 없다. 걸면 살아 있던 요청을
  방향에 따라 cancelled/rejected 로 거두고, 차단 사실은 알리지 않는다.
- **거둔 요청의 통보는 서지 않는다**(행은 남는다). 알림 문구는 DB 가 저장하지 않고
  `src/lib/consent` 가 짓는다.
- **검수에서 P1 다섯이 나와 고친 뒤 커밋했다**: ① 자격 검사와 쓰기 사이가 안 잠겨 차단
  직후 pending 이 남았다 → `lock_users` 로 셋을 줄 세웠다. ② `p_accept = null` 이
  수락으로 떨어졌다. ③ 제재된 요청자의 Match 가 만들어졌다. ④ **바뀐 성별 조건을 옛 노출 기록이 우회했다**
  — 자격이 후보 질의의 `where` 절에만 있어서 요청 쪽이 빠뜨렸다. `discovery_eligible`
  한 함수에 모았다. ⑤ 자기 상태를 잠그기 전에만 물어서 그 사이 커밋된 제재를 못 봤다. 더해서 요청이 **지금과 같은
  요약의** 노출 기록만 쓰게 했고(옛 카드로 청하면 이유가 갈렸다), 알림 가시성을
  `visible_notifications()` 한 자리로 모았다.
- **화면**: `/me/requests`(알림함·받은 요청+동의 화면·보낸 요청·성립한 Match·끝난 요청),
  후보 카드의 「상세 궁합 요청하기」, `/me` 의 안 읽은 알림 배지.
  **Match 결과 화면은 아직 없다 — 7단계.**

**공개 범위를 한 번 잘못 좁혔다가 바로잡았다**(커밋 `77f8b7e`). 처음에 「후보 카드는
어느 오행인지 부르지 않는다(개수로만)」로 적었는데, 사용자가 **제품 의도와 반대**라고
정정했다 — Discovery 는 궁합을 보고 싶게 만드는 맛보기이고 오행 추천 이유는 적극적으로
보여주는 것이 목적이다. 지금은 채우는 오행의 이름과 뜻을 말하고(`ELEMENT_MEANING`),
닫는 것은 원문·여덟 글자·십성·신살·형충회합·운·상대의 전체 오행 구성이다. 형충회합과
상세 근거는 **상호 동의 이후**에 열린다. 경계는 정책의 `discloses`·`withholds` 에 값으로 있다.

**신뢰 경계도 한 번 더 좁혔다**(커밋 `72f89c7`). 후보를 고르는 RPC 와 노출을 남기는
RPC 가 따로였는데, 뒤엣것은 인증 사용자가 후보 id·자리·탐색 여부를 적어 넣는 모양이라
같은 후보 백 번·자리 999 가 열려 있었다. **`discovery_board()` 하나**로 합쳤다 — 고르고·
줄 세우고·섞고·기록하고 카드를 낸다. **부르는 쪽이 넣을 인자가 하나도 없고** 씨앗도 DB 가
정한다. 줄 세우기가 SQL 로 내려갔고 `src/lib/discovery` 에는 정책 선언과 말만 남았다.
두 축을 세는 함수는 실행 권한을 거뒀고, `is_active_account` 는 인자를 없앴다(uuid 를 받으면
남의 상태를 묻는 문이 된다). 오행 배열은 `with ordinality` 로 차례를 붙든다.

**중지 계정**도 같은 흐름에서 잡았다 — 읽기 정책이 상태를 안 묻고 있었다(정책 열한 개를
다시 썼다).

## 배포 (2026-08-25 확인)

**이미 배포돼 있고 GitHub 자동 연동도 돌고 있다.** 몰랐던 것이 아니라 로드맵이 낡았던 것이다.

- Vercel 프로젝트 `saju`(`prj_DfSzva1bCwl4JXT5gm4mRotiyBiv`, team `sungheeyoons-projects`),
  프로덕션 별칭 **https://saju-snowy.vercel.app**.
- **main 에 푸시하면 자동 배포된다** — `c8422a4` 를 `vercel[bot]` 이 Production 으로 올렸고
  커밋 상태 검사도 success 다. `saju-git-main-…` 별칭이 git 연결의 증거.
- 접속값은 Supabase 통합이 넣어 뒀다(`NEXT_PUBLIC_SUPABASE_URL` ·
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 포함 16개). `/` 200, `/me` → `/auth` 307 확인.
- **Auth URL 도 맞췄다(사용자가 대시보드에서, 2026-08-25).** 밖에서 재어 확인했다:
  Site URL = `https://saju-snowy.vercel.app`, 허용 목록에 프로덕션·프리뷰 와일드카드·
  localhost 가 있고 **남의 도메인은 Site URL 로 되돌려진다**(과하게 열려 있지 않다).
  구글 콘솔은 건드릴 것이 없었다 — 거기 등록된 주소는 Supabase 콜백이다.
- **밖에서 Auth 설정을 재는 법**: `/auth/v1/authorize` 의 `redirect_to` 는 **검증 전 값을
  그대로 돌려주므로 근거가 안 된다.** `/auth/v1/verify?type=signup&token=아무거나
  &redirect_to=X` 를 쓰면 GoTrue 가 **검증된** 주소로 303 을 낸다 — 허용 밖이면 Site URL
  로 간다. 계정도 메일도 안 생긴다. (WAF 가 내는 403 HTML 을 GoTrue 응답으로 읽지 말 것.)
- **사용자가 배포 환경에서 직접 확인했다(2026-08-25): 구글 로그인 왕복도, 초대 안 된
  주소가 `/auth/denied` 로 막히는 것도 둘 다 된다.** 즉 관문 훅이 원격에서 살아 있다.
  이로써 배포 사슬 전체가 한 번은 실제로 돌았다 — 푸시 → 빌드 → 배포 → 로그인 → 관문.
- **`supabase config push` 는 쓰면 안 된다.** 로컬 `config.toml` 을 통째로 올리는 명령인데
  그 파일에는 `[auth.external.google]` 이 아예 없고 `site_url` 이 localhost 다 — 원격의
  구글 설정을 지우게 된다. 두 칸은 대시보드나 Management API 로 고친다. **6단계까지 커밋·푸시됐다(2026-08-25, `c8422a4`).** `20260825120000_match_request.sql` 도 원격에 적용됐다(9개 전부 local=remote).

**PRD 가 요구한 E2E 는 아직 없다 — 이슈 #2 로 열어 뒀다** — 「초대 로그인 → … → 요청 → 수락 → 차단을 데스크톱과
모바일에서」. 지금 e2e 는 **백엔드 없이 도는 것이 계약**이라(껍데기 접속값으로 CI 에서
돌린다) 로그인 흐름은 flow 검사가 대신 든다. 열려면 e2e 가 로컬 Supabase 를 요구하게
되므로 별도 판단이 필요하다.

## 7단계 완료 — 고정 `match-v0` 공유 결과 (2026-08-25, `5d62325`)

`/me/match/[matchId]` 가 섰다. 두 원국 **사이**의 형충회합 표 + L3 조립 문장 + 고정
`match-v0` 카드. 명식 표도 근거 패널도 없다(그 둘은 궁합 화면의 몫). `/me/requests` 의
Match 카드에서 「함께 보기」로 들어간다.

**ADR 0010 을 새로 썼다 — 열쇠 하나가 생겼다.** 셋이 한꺼번에 참이라 다른 길이 없었다:
브라우저에 상대 원문을 못 내려보내고(definer RPC 가 내주는 것이 곧 브라우저가 보는 것),
DB 는 명식을 못 만들고, 형충회합 959줄을 SQL 에 다시 적으면 판정하는 자리가 둘이 된다
(오행 두 축 40줄과 다르다). 그래서 서버가 두 판본을 읽어 계산하고 자른다. 구멍의 모양:

- `my_match_scope(match_id)` — 사용자 JWT · `auth.uid()` 로 판정. 별명·소개·두 축의 말·
  **매인 판본 id 둘**만 나간다. 당사자 아니면 0행(없는 것과 같은 답).
- `match_calculation_inputs(match_id)` — **`service_role` 만** 실행. 그 Match 가 매어 둔
  판본만 내준다(앱이 판본 id 를 손으로 못 댄다). 사용자 id 를 안 받는다.
- `visible_matches()` — 좁힘 한 벌(`visible_notifications` 규율). `my_matches` 와
  `my_match_scope` 가 그 위에 선다.
- 앱: `app/me/match/inputs.ts`(열쇠 드는 유일한 자리) → `result.ts`(자르는 유일한 문,
  두 `Saju` 가 여기서 나고 죽는다) → `[matchId]/page.tsx`.
- Vercel 에 `SUPABASE_SECRET_KEY`(sb_secret_…) 가 Production 까지 이미 있다. 없으면
  화면이 「지금은 열 수 없습니다」로 선다(빈 화면 아님).

화면 조각도 갈랐다: `app/between-view.tsx`(사이 칸 셋 — `Compatibility` 만 받는다,
`Saju` 를 못 받게 해서 규율을 타입에 적었다), `app/match-index.tsx`(`MatchPreview` 만
받는 지표 카드 + `ScoringNote`). `CompatView` 도 이것들 위에 다시 섰다.

`MATCH_DISCLOSURE` 를 좁혔다 — 관계 표가 걸린 글자를 적으므로 「상대의 글자도 그 자리
에서는 보입니다」를 넣고, 숨기는 쪽은 「여덟 글자 **전부**와 그 위의 판정」으로 고쳤다.

**시험 네 층: 1184 unit · 51 e2e · 229 pgTAP · 186 flow.** 새로 `supabase/tests/11_match_result.test.sql`(30)
과 `scripts/check-result.mjs`(35). flow 가 재는 것: 두 사람이 같은 지표(94 vs 94), 상대
생년월일·출생지·명식 표·근거 패널이 본문에 없음, 당사자 아니면 404(없는 Match 와 같은
코드), RPC 직접 호출 거절, 판본 id 를 알아도 그 판본은 못 읽음, **차단하면 열쇠로도 안 열림**,
그리고 **매인 판본**(상대가 05:20 으로 고쳐도 94 그대로 — 새 판본으로 계산하면 97 이다).

**원격까지 나갔다(2026-08-25).** `supabase db push` 로 10번째 마이그레이션이 적용됐고
(local=remote 10개), `git push` → Vercel Production 배포 Ready. 배포된 곳에서
`/me/match/<uuid>` 가 로그인 화면으로 307 하는 것까지 확인했다. `supabase config push` 는
여전히 쓰면 안 된다.

## 8단계 완료 — 판본 참조 수명주기 (2026-08-25)

PRD 가 9d4b1ed 에서 단계를 하나 끼워 넣었다(ADR 0011·0012). 0012(Match 동의에 여덟 글자
포함)는 그 커밋이 이미 코드에 반영했고, **남아 있던 것이 0011 = 새 8단계**였다.
`supabase/migrations/20260825180000_revision_retention.sql`:

- terminal 요청(rejected·invalidated·cancelled)은 판본 FK 를 **놓는다.** 대신 요청이
  `requester_fingerprint`·`addressee_fingerprint` 를 든다(insert 트리거가 채운다).
  놓는 일은 before-update 트리거가 하고 검사식이 「terminal 인데 판본을 든」 상태를 막는다
  — terminal 로 가는 자리가 넷이라(거절·거둠·무효·차단) 넷 다에 적지 않았다.
- `revisions_in_use()` 는 표 이름을 적지 않는다. `pg_constraint` 를 읽어
  **`person_chart_revision` 을 가리키는 FK 전부**에서 참조를 모은다 — Reading 이 붙는 날
  이 함수를 안 봐도 그 판본이 지켜진다.
- `retain_person_revisions(person)` 이 미참조 이전 판본을 최근 둘까지 줄인다. 부르는
  자리 셋: `add_person_revision` 마지막 줄(무효화 **뒤에**), match_request after-update
  트리거, discovery_profile `element_revision_id` after-update 트리거.
- `person_chart_revision.created_at` 기본값을 `clock_timestamp()` 로 바꿨다. `now()` 는
  트랜잭션 시각이라 pgTAP(파일 하나가 한 트랜잭션) 안에서 쌓인 판본들이 **같은 시각**을
  갖고, 그러면 「가장 오래된 것을 지운다」가 아무것이나 지우는 일이 된다.
- 화면: `/me` 의 **판본 이력 목록을 내렸다**(ADR 0011 — 판본 선택기·무한 이력 금지).
  이제 현재 판본 한 줄만 id 로 읽는다. 문구는 `app/revision.ts` 의
  `REVISION_REPLACED_NOTE`·`REVISION_RETENTION_NOTE` 가 든다(revise 폼과 `/me/compat` 이
  같은 문장을 읽는다).

**시험 네 층: 1184 unit · 51 e2e · 255 pgTAP · 191 flow.** 새로
`supabase/tests/12_revision_retention.test.sql`(26)과 `check-onboarding.mjs` 의 정리 검사 5건.

**원격까지 나갔다(2026-08-25, `dc3294b`).** `supabase db push` 로 11번째 마이그레이션이
적용됐고(local=remote 11개), `git push` → Vercel Production Ready. 배포된 곳에서 `/` 200 ·
`/me` → 307 `/auth` 확인. 마이그레이션 마지막 줄이
`select public.retain_person_revisions(p.id) from public.person p;` 라 원격에 이미 쌓여
있던 미참조 판본은 그때 정리됐다.

### 8단계 보정 — 12번째 마이그레이션 (2026-08-25, `6c875a3`)

검수에서 P1 두 건이 나왔고 **둘 다 재어 보고 사실이었다.**

- **terminal 요청의 지문은 원문 폐기가 아니다.** 열쇠 없는 SHA-256 이고 출생 입력
  후보 공간이 작다 — 시각만 모르면 1,440 개를 0.6ms 에 맞히고, 아무것도 몰라도 전체가
  10^10 이라 파이썬 단일코어 1.5 시간이다(둘 다 실측). 지문 컬럼을 지우고
  `requester_revision_tag`·`addressee_revision_tag`(그때 그 판본의 uuid, FK 아님)로
  바꿨다. 같은 입력을 쓰는 두 사람의 값이 다른 것으로 pgTAP 이 잰다.
  `person_chart_revision.fingerprint` 는 그대로 — 그 행은 원문을 들고 있다.
- **판본 저장이 겹치면 deadlock.** insert(부모에 key share) → `update person`(더 센
  잠금) 차례라 40P01. 300 회씩 두 갈래로 재현했고 `perform 1 from person ... for update`
  로 1,200 회 0 건. **`20260824170000` 부터 있던 것**이고 8단계가 만든 게 아니다.
  pgTAP 은 한 세션이라 못 잰다 — `check-onboarding.mjs` 에 12 건 동시 호출 회귀 검사를
  뒀다(잠금 빼면 6~8 건이 깨지는 것을 확인 = 공허하지 않다).
- 곁들여 P2: `revisions_in_use(uuid[])` 로 후보를 좁히고 FK 인덱스 5 개, 무효화는
  문장 트리거로 사람별 1 회. P3: `07_discovery` 격리를 첫 후보 단언보다 앞으로
  (자리가 10 개뿐이라 참여자 36 명에서 목표가 밀렸다 — 재현·수정·54 명에서도 통과).

**시험: 1184 unit · 51 e2e · 257 pgTAP · 193 flow.** 마이그레이션 12 개 전부 원격 적용,
Vercel Production Ready.

## 다음: 9단계 — redacted Evidence 와 Reading 파이프라인

PRD: 「redacted Evidence 와 Reading 파이프라인을 만들고 내부 AI 품질 게이트를 반복한다.」
`matchResultForViewer` 가 이미 잘라 둔 것 위에 선다 — 모델에 넘길 근거는 그 경계를 넘지
않는다(ADR 0008). `notification` 검사식에 `reading_ready`·`reading_failed` 가 아직 없다
(일부러 안 넣었다 — 그때 넣는다). Reading 표가 판본 FK 를 들면 `revisions_in_use()` 가
자동으로 그것을 지킨다 — 정리 함수를 고칠 필요가 없다.

**안 한 것**: 사진(스토리지를 안 켰다), 신고, 계정 삭제 흐름.
