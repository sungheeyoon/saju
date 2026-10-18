# 처리방침의 근거 — 줄마다 조문 · 코드 · 출처

> **법률 자문이 아니다. 변호사 검토 전의 근거 모음이다.** 처리방침의 줄마다 무엇을 근거로 적었는지 — 조문 원문 · 코드의 자리 ·
> 받는 회사의 공식 문서 · 참고한 다른 서비스 — 를 한 곳에 모은다. 「표에 적었으니 적법하다」는 뜻이 아니다. 법적 판단은 변호사가
> 하고, 묻고 싶을 때 묻는 선택 검토로 남는다(`docs/legal/counsel-request.md` 「B-9」, ADR 0180).

화면의 처리방침 원문은 `src/lib/consent/notice.ts` 의 `noticeFor` · `TRANSFERS` 이고 `/privacy` 가 그대로 그린다. 이 문서는
**`notice-v8`**(G-66 의 내용 개정, ADR 0180)이 더한 줄을 든다. 새 메시지 알림(G-71)은 그 판에 없다 — 아래 「푸시 회사 넷」은 알림을
켜기 전에 따로 올릴 판의 재료다 — 그 앞 판의 줄은 `docs/legal/privacy-v8-draft.md` 「부록 A」가
출처를 든다. 처리방침 문장을 바꾸는 PR 은 이 문서의 그 줄도 같은 PR 에서 고친다(ADR 0180 의 9).

**「확인 전」** 은 공식 문서에서 찾지 못한 값이다 — 지어 쓰지 않았다. 찾은 날 그 칸을 채우고 출처를 단다.

## 조문 항목 → 처리방침 줄 대조표 (`notice-v8`, 2026-10-15)

**운영자 지시(2026-10-15): 「법적 근거를 바탕으로 해라」.** 행은 법이 요구하는 항목이고, 처리방침 문장은 이 표에서 「빠짐」이 나온 자리만
고친다. 「채움」은 그 항목에 맞는 문장이 있다는 뜻이지 그 문장으로 법을 지켰다는 판정이 아니다. 조문의 원문 · 링크는 아래 「조문 — 원문과
확인한 날」, 모두 2026-10-15 에 국가법령정보센터에서 읽은 판(시행 2026. 9. 11.)이다.

갈래 — **첫** = 로그인하지 않은 첫 화면의 짧은 사주 문단 · **사주** = 사주풀이 · **궁합** = 직접 고른 두 사람의 궁합 · 인연 궁합.

### 남은 항목 — 네 칸 (운영자 2026-10-15 「조사 범위를 더 늘리지 않는다」)

**법이 요구하는 대상은 우리 서비스의 개인정보 처리 · 이전이다.** 공급업체 내부 운영 전체(지원 직원 개개인의 국가, 회사 내부 기록 전부, 보안 구조의
예외 전부)의 미확인은 게시 차단 사유가 아니다. 우리 개인정보가 실제로 이전되는 처리의 국가 · 항목 · 목적 · 기간 · 수령자 · 연락처 · 거부 방법만 채운다.

| 우리 개인정보에 적용되는 사실 | 적용 조문 | 공개 자료 · 계약으로 확인한 값 | 정말 부족한 값 |
| --- | --- | --- | --- |
| 이용할 때마다 요청 경로 · 계정 id 가 든 로그가 Supabase 의 EU 데이터센터에 저장된다 | 제28조의8 ② 1~5 · 시행령 31 ① 2 | 국가 EU · 기간 1일(무료) · 수령자 Supabase Pte. Ltd. · 연락처 privacy@supabase.com(FAQ · 요금 · 로그 문서) | 없음. (로그에 IP 가 드는지는 항목의 「등」이 덮는다 — 차단 사유 아님) |
| 우리가 지원을 요청하거나 보안 사고가 나면 Supabase 가 DB 에 접근할 수 있다 | 같음 | 수령자 Supabase, Inc.(미국, FAQ) · 목적 · 조건(FAQ). 기간 — **사실**: DPA 11.2 「On expiry of the Retention Period, Supabase shall delete all copies of Covered Data」(Retention Period = 계약 만료 뒤 30일) · Schedule 3 「Retention period: The duration of the Agreement, unless earlier deletion is requested by the Customer」. **해석**: 지원 접근 때 본 정보도 이 「Covered Data」에 들어 같은 기한을 따른다고 본다 — 지원 접근만의 보관 기간을 정한 조항은 없다 | 없음. 처리방침은 「접근한 정보의 보관 기간을 따로 정하지 않았습니다. 계약상 … 30일이 지나면 맡긴 정보를 지웁니다」로 사실(조항)만 말한다 |
| 같은 조건에서 Vercel 이 요청 정보에 접근할 수 있다 | 같음 | 수령자 Vercel Inc. · 국가 미국(DPA 13.1 「primary processing facilities are in the United States」) · 연락처 privacy@vercel.com. 기간 — **사실**: DPA 12.1 「Termination or expiration of the Agreement serves as instruction for Vercel to delete all Customer Data … within a commercially reasonable timeframe.」 **해석**: 지원 접근 때 본 정보도 이 「Customer Data」로 같은 기한을 따른다고 본다 | 없음. 처리방침은 사실(조항)만 말한다 |
| 풀이 · 첫 화면 문단을 만들 때 명식 · 분석 정보 · (직접 고른 궁합의) 사이가 OpenAI 로 간다 — 이름 · 닉네임은 안 간다(reading PR 뒤) | 같음 | 수령자 OpenAI OpCo, LLC(서비스 약관 · DPA) · 항목 · 시기 · 목적(코드) · 기간 약 10분 · 최대 30일(API 문서) · 한국 리전은 처리 「No」. **국가 · 연락처 — 2026-10-15 운영자 확인, 이 기계 403**: 공식 하위처리자 목록(https://openai.com/policies/sub-processor-list/)에 개인정보 문의 `privacy@openai.com`, OpenAI OpCo, LLC 의 API 처리 위치 미국, API 인프라 하위처리자는 여러 국가. 계약 법인의 출처로 DPA(https://openai.com/policies/data-processing-addendum/ — 운영자 쪽에서 열림) | 없음. 처리방침은 「미국, 그리고 하위 처리자가 있는 여러 나라 — 목록: …」로 본체와 하위처리자를 가른다(데이터 레지던시 없는 우리 구성). 「미국에서만」이라고 쓰지 않는다 |
| 첫 화면 기록(서울) · 쿠키 7일 · 계정에 이어진 기록 | 제30조 ① 1 · 2 · 7 | 코드 · 마이그레이션 | 없음 |
| 안전성 확보 조치 | 시행령 31 ① 3 | 행 단위 접근 정책 · 운영자 권한 · 접속기록 · HTTPS · 저장 암호화 · 비밀키 | 없음 |

**OpenAI 는 일반 처리방침과 API 근거를 섞지 않는다.** 일반 처리방침(https://openai.com/policies/privacy-policy/)은 OpenAI 가 스스로 처리하는 것이고 API
고객 콘텐츠의 국가 · 기간 · 하위처리자는 고객 약관 · DPA · API 문서 · 하위처리자 목록이 정한다. 처리방침에 적은 기간(약 10분 · 30일)은 API 문서의 값이고,
국가와 연락처는 하위처리자 목록의 값이다(운영자 확인).

### 갈래별로 OpenAI 에 가는 묶음 — 판정 없이

여덟 글자가 개인정보인지는 법이 정하지 않았다 — 제2조 1호 나목은 「다른 정보와 쉽게 결합하여 알아볼 수 있는」지를 묻고, 그것은 받는 쪽이 가진 정보와
함께 가는 값에 달렸다. **묶음마다 판단이 다를 수 있다는 것만 적는다** — 어느 묶음이 개인정보인지 판정하지 않는다.

| 갈래 | 가는 묶음(사람을 가리킬 수 있는 값만) | 함께 가는 것 · 빠지는 것 | 코드 |
| --- | --- | --- | --- |
| 첫 화면의 짧은 사주 문단 | 여덟 글자 · 성별 · 시간 앎 | 분석 정보. 해 · 나이 · 절입 날짜 · 대운은 뺀다. 이름 · 계정 없음 | `src/lib/reading/taste-run.ts:51-60` |
| 인연 궁합풀이 | 두 사람의 여덟 글자 | 시간 앎 · 두 사주 사이의 관계. 성별 · 해 · 나이는 뺀다 | `src/lib/saju/evidence/shared.ts:88-104` · `:147-158`, 이름은 `20260925090000_…sql:186-230` |
| 사주풀이 | 여덟 글자 · 해 · 나이 · 성별 | 분석 정보 · 대운수 · 절입 날짜 · 시간 앎. 이름은 싣지 않는다 | `src/lib/saju/evidence/redacted.ts:31-41` |
| 직접 고른 궁합풀이 | 두 사람의 여덟 글자 · 해 · 나이 · 성별 + 고른 사이 | 위와 같다 | 같은 파일 |

**이름 · 닉네임은 보내지 않는다** — 운영자 결정(2026-10-15) 「궁합풀이에 이름 · 닉네임을 보내지 않는다」. 프롬프트를 자리 호칭(「첫 번째 분」)으로 바꾸고 화면에서
이름으로 치환하는 PR(reading)이 main 에 든 뒤에 이 판이 머지된다 — 이 표와 처리방침은 그 뒤의 사실이다. 그 PR 전의 코드는 이름(`local_label`) · 닉네임을
실었다(`src/lib/reading/prompt.ts:1322` `namingBlock`, `20260925090000_…sql:186-230`). 사이(고른 관계)는 그대로 보낸다.

### 첫 화면 문단 — 주소를 열기만 해도 요청이 나가는가 (코드 경로, 2026-10-15)

**나간다 — 코드 경로로 확인했다. 로컬 재현(스택을 띄워 요청을 본 것)은 하지 않았다.**

1. `/` 가 `SajuCalculator` 를 세운다(`app/page.tsx:33`).
2. 주소의 `#` 뒤를 읽어 입력으로 만든다 — 제출 없이(`app/saju-calculator.tsx:51-52` `useHashParams` → `queryFromSearchParams`).
3. 입력이 서면 계산하고(`:99`) 결과가 선다(`:215` `result.ok` → `:233` `CalculatorResult`).
4. 로그인하지 않았고 세션을 알면 `Taste` 를 세운다(`:265-284`).
5. `Taste` 의 잠긴 목차가 마운트되며(`app/taste/taste.tsx:88` → `:217` `useTasteAnswer`) `useEffect` 가 묻는다(`:149` `askTaste` → `:119` `requestTaste`).
6. 서버 액션(`app/taste/actions.ts:33`)이 `serveTaste` 로 예약하고, 같은 입력의 글이 없으면 모델을 부른다(`app/taste/taste-run.ts:176`).

e2e 가 같은 길을 밟는다 — `page.goto('/#name=민수&date=1990-05-15&hour=14:30')` 만으로 결과가 선다(`e2e/taste.spec.ts:111`). 그래서 처리방침의 거부 줄에
「생년월일시가 담긴 주소를 여시면」을 둔다. 동작은 바꾸지 않았다(따로 기능 판단).

### 처리마다 — 사실 · 추정 · 미확인 (운영자 2026-10-15 「확인된 것만 처리방침에 싣는다」)

**처리방침에 싣는 것은 「사실」 칸뿐이다.** 「회사가 공개하지 않습니다」 · 「미국 등」은 법 요건을 채운 것으로 다루지 않는다 — 운영자 승인으로도
채워지지 않는다. 국외 이전 해당 여부의 법적 판정은 하지 않는다. 출처는 모두 2026-10-15 에 열었다.

**우리 계정 값(읽기로 잼, 2026-10-15)** — Supabase 운영 프로젝트 `xgdeguyxgkillndraonc` `region: ap-northeast-2`, 조직 `qlichigttxdmyzmjmjsi`(「sungheeyoon's
Org」) **`plan: free`**(Management API `GET /v1/organizations/{slug}`) — Vercel 마켓플레이스 조직(`vercel_icfg_…`)이 아니다. Vercel 프로젝트 `saju` 는 팀
`team_o5pywRSbdzfxjkQCnddUKaL5` 의 것이고 그 팀 **`billing.plan: hobby`**(`vercel api /v2/teams/…`), `serverlessFunctionRegion: icn1`. **AWS 접속기록 반출은
꺼져 있다** — Vercel 환경 변수에 `AUDIT_EXPORT_*` 가 하나도 없다(`vercel env ls`, 이름만 봄) — 그러면 반출은 `state: 'off'`(`app/api/cron/audit-export/export.ts:133`).

| 처리 | 사실(출처 · 원문) | 추정 | 미확인 |
| --- | --- | --- | --- |
| Supabase DB · 인증 | 서울. 「The region you choose also determines where your primary project data is stored.」(https://supabase.com/docs/guides/platform/regions) · 「Your PostgreSQL database, as well as Auth service and Storage objects are hosted in that region, alongside backups.」(https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq, 「Version 1 — October 6, 2026」) | — | 구글 로그인의 콜백 · 토큰 교환 위치 |
| Supabase 백업 | Free 요금제는 자동 백업이 없다(https://supabase.com/pricing). 있으면 리전 안(위 FAQ 「alongside backups」) | — | — |
| Supabase 스토리지 · CDN | 쓰지 않는다(사진은 Postgres `bytea`, ADR 0040). FAQ 의 네 번째 범주 「If you use our Storage service, content may be cached or served through a global CDN outside your region」는 해당 없음 | — | — |
| Supabase 리전 밖 처리의 네 범주 | FAQ 원문 그대로 — ① 「Customer Account Information: Your account setup, configuration, and billing data may be processed by centralized systems outside your region.」 「We are controllers of this data.」 ② 「Customer Support Requests: Our support team, located globally to provide 24/7 coverage, may access your data when you request help … report issues, or when we identify and respond to security incidents.」 「We are processors of this data.」 ③ 「Usage Information: Telemetry, logs, and service metadata are processed outside your region to operate and secure the platform.」 「Commonly, we are processors of this data.」 ④ 「Content Delivery: If you use our Storage service, content may be cached or served through a global CDN outside your region … depending on your configuration and end-user locations.」 | ① 은 운영자 계정의 정보라 이용자의 개인정보가 아니다 | — |
| Supabase 로그(③) | 「Logs are ingested and stored at EU-based data centers.」 · 「This includes operational analytics, performance metrics, and platform health monitoring (not your application data).」(FAQ). 로그에는 요청 경로와 계정 id 가 든다 — 「The User filter matches the user's ID in Auth actor IDs or API Gateway JWT subjects」 · Pathname 필터는 「a request path」(https://supabase.com/docs/guides/telemetry/logs). 보관 1일(Free, https://supabase.com/pricing 「Log retention (API & Database) 1 day」) | — | 로그에 접속 IP 가 드는지(문서에 없음). FAQ 의 「not your application data」와 계정 id · 경로가 든 로그가 어떻게 맞물리는지 |
| Supabase 지원 접근(②) | 조건부 — 우리가 요청할 때 · 보안 사고 대응 때만. 「Support staff can access only projects relevant to your request, and we log all access.」 · 「Supabase, Inc. (United States) provides technical support and operational services.」 · 「Your data flows to Supabase, Inc. only when necessary for support or operations」(FAQ). 이전 수단 「Supabase transfers data to Singapore and to the US under the Standard Contractual Clauses (SCCs)」 | — | 미국 밖 지원 인력의 국가(「located globally」) — 공급업체 내부 운영이라 차단 사유 아님. 보관 기간은 계약으로 채움(DPA 11.2) |
| Supabase Realtime(**저장 위치와 전달 경로를 가른다**) | 우리 앱은 DB 에서 Broadcast 를 보낸다 — 트리거가 `realtime.send(…, 'changed', 'user:<uid>', true)`(`supabase/migrations/20261120090000_the_app_hears_what_changed_on_one_private_channel.sql:7`), 실은 것은 `{ area, match_id, seq }` 뿐. 그 메시지는 우리 DB(서울)의 `realtime.messages` 에 3일 남는다 — 「The `realtime.messages` table is partitioned by day.」 · 「Partitions are retained for 3 days before being deleted.」(https://supabase.com/docs/guides/realtime/architecture) | — | **국외 노드를 지나는지** — 「Clients can connect to any node in the cluster」 · 「connects to it from the closest region possible」만 있고, 한국 이용자가 어느 노드에 붙는지는 문서에 없다. 처리방침에 국외로 싣지 않는다. 위탁 절은 「신호의 기록도 이 데이터베이스에 3일 남습니다」로 **저장만** 말한다 — 전달 경로가 서울이라는 뜻이 아니다 |
| Supabase 계약 법인 | 약관 §1(j)(https://supabase.com/terms): AWS 마켓플레이스 구매면 「Supabase, Inc.」, 아니면 「Supabase Pte. Ltd., a Singapore corporate entity」. FAQ 「Supabase Pte. Ltd. (Singapore) is the primary data processor under our agreements.」 | 우리 조직은 무료 요금제의 직접 조직이라 마켓플레이스 구매가 아니다 → Supabase Pte. Ltd. | 운영자가 AWS 마켓플레이스로 산 적이 있는지(무료라 없을 것으로 본다) |
| Vercel 함수 · 입력 계산(**실행 위치와 전달 경로를 가른다**) | 함수 실행은 서울 `icn1`(우리 설정). Hobby 는 한 리전(https://vercel.com/docs/functions/configuring-functions/region). 요청은 가까운 PoP 를 거쳐 리전으로 간다(「PoPs terminate TCP and route requests over a private network to the nearest Vercel region」, https://vercel.com/docs/regions) — 위탁 절은 「서버 처리(함수 실행)는 서울 리전」으로만 적는다 | — | 국외에서 접속할 때 라우팅 미들웨어(`proxy.ts`)가 그 가까운 리전에서 돈다(「Vercel deploys Routing Middleware to all regions by default」) — 국외 접속자에게만 해당, 처리방침에 싣지 않음 |
| Vercel 런타임 로그 | Hobby 1시간(https://vercel.com/docs/logs/runtime 「Hobby: 1 hour of logs」) | DPA 「Vercel's primary processing facilities are in the United States」(https://vercel.com/legal/dpa §13.1)로 보아 미국일 수 있다 | **저장 위치** — 처리방침에 국외로 싣지 않고, 위탁 절에 보관 기간만 적었다 |
| Vercel 지원 접근 | 조건부 — 「Vercel personnel are prohibited from viewing Customer Content, except when instructed by you」(https://vercel.com/legal/privacy-policy, 2026-06-01). 법인 「Vercel Inc., a Delaware corporation」, 주된 처리 시설 미국(DPA §13.1) | — | — (보관 기간은 계약으로 채움 — DPA 12.1) |
| OpenAI 모델 호출 | 국외 — 데이터 레지던시를 따로 걸지 않은 프로젝트로 보이고(설정은 운영자 확인), 한국 리전은 처리 「None」. 「OpenAI may also process and temporarily store Customer Content outside of the Region to deliver the services.」 · 보관 「roughly 10 minutes」 · 「up to 30 days」(https://developers.openai.com/api/docs/guides/your-data). 법인 「(a) OpenAI OpCo, LLC for Customers located outside the EEA or Switzerland」(https://cdn.openai.com/osa/openai-services-agreement.pdf v.010126) | — | — **2026-10-15 운영자 확인(이 기계 403)**: 하위처리자 목록에 API 처리 위치 미국 · 하위처리자 여러 국가 · 연락처 `privacy@openai.com`(위 「남은 항목」). 법인 소재지로 대신한 것이 아니다 |
| AWS S3 | 반출이 꺼져 있다(위 계정 값) — 지금 처리 없음 | — | — |

### 국외 이전의 근거 — 처리마다 적용 가능성과 조건 (시행령 제31조 ① 2)

**법률 자문이 아니다 — 변호사 검토 전의 따짐이다. 결론은 「적용 가능성과 필요한 조건」이고 단정하지 않는다.** 제28조의8 ① 3 은 「정보주체와의
계약의 **체결** 및 이행을 위하여 개인정보의 처리위탁ㆍ보관이 필요한 경우」로서 처리방침에 공개한 경우다. 개인정보위 해설(https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS212&mCode=C040030000&nttId=9830)은
「정보주체와 체결한 계약을 이행하거나 계약을 체결하는 과정에서 정보주체의 요청에 따른 조치를 이행하기 위하여 필요한 경우」로 풀고, 필요한지는
「서비스. 제품의 성격 및 사업 구조 등을 종합적으로 고려하여 판단」한다고 한다. **첫 화면에 동의창을 더하지 않는다**(운영자 2026-10-15) — 가입 전이라는
이유만으로 ①3 을 배제하지 않고, 불확실하다고 전부 별도 동의로 돌리지 않는다.

| 처리 | 적용 가능성 | 필요한 조건(사실로 확인할 것) | 남은 물음 |
| --- | --- | --- | --- |
| OpenAI — 회원이 누른 사주풀이 · 궁합풀이, 수락으로 만들어지는 인연 궁합풀이 | 높다 — 가입한 이용자가 누른 생성 요청(수락 포함)의 이행이고, 풀이 생성이 이 서비스의 내용이다 | 생성을 사람이 누르거나 수락할 때만 부른다(`app/me/reading/*` · ADR 0038) | — (처리방침에 ①3 으로 적었다) |
| OpenAI — 가입 전 첫 화면의 짧은 사주 문단 | **있을 수 있다 — 조건부** | ① **이용자의 요청인가** — 방문자가 생년월일시를 넣고 사주를 보거나, 생년월일시가 든 주소(`#` 뒤, ADR 0007)를 열면 결과가 서고 그때 서버를 부른다(`app/saju-calculator.tsx` 의 `useHashParams` → `app/taste/taste.tsx` 의 `requestTaste`). **남이 보낸 그런 주소를 열기만 해도 부른다** — 그것을 이 방문자의 요청으로 볼지가 조건이다. 처리방침의 거부 줄에 「생년월일시가 담긴 주소를 여시면」을 더했다 ② **그 요청을 이행하는 데 국외 처리위탁이 필요한가** — 문단은 모델이 사람마다 쓴다(ADR 0143 의 1). 국내에서 같은 생성을 하는 수단은 지금 없다 ③ **무료 문단이 계약 체결 과정의 일부인가** — 문단은 본 풀이의 잠긴 목차 첫 절에 서고, 가입하면 그 문단이 멈춘 물음에서 첫 풀이가 잇는다(ADR 0143 · 「2026-10-09 덧」). 가입 전 방문자의 상당수는 가입하지 않는다 — 「체결하는 과정」으로 볼지가 갈린다 | 가입하지 않는 방문자에게도 「체결 과정」이 서는가. 무료 체험이 그 과정에 드는가(B-9) |
| Supabase — 로그(EU) | **있을 수 있다 — 조건부** | 서비스 운영 · 보안에 필요한 위탁인가 — FAQ 는 범위를 「Telemetry, logs, and service metadata … to operate and secure the platform」으로 적는다. 우리가 고른 데이터베이스 서비스를 쓰는 한 따로 끌 수 없다(무료 요금제). 담기는 것은 요청 경로 · 계정 id 등이고 저장 내용은 아니다 | 이용자의 요청에 따른 조치의 이행에 「필요」한가 — 운영 · 보안을 계약 이행의 일부로 볼지 |
| Supabase · Vercel — 지원 접근 | **있을 수 있다 — 조건부** | 범위와 목적이 좁은가 — Supabase 「only when you request help or when we detect and respond to security incidents」 · 「Support staff can access only projects relevant to your request, and we log all access」, Vercel 「prohibited from viewing Customer Content, except when instructed by you」 | 우리(처리자)가 요청한 지원 · 사고 대응을 계약 이행에 필요한 위탁으로 볼지. 지원 접근만의 보유기간을 정한 조항은 없다 — 계약 종료 뒤 삭제 조항만 있다(위 「남은 항목」의 사실 / 해석) |

처리방침에는 회원의 풀이 생성에만 ①3 을 적었다. 나머지 셋은 위 조건을 사실로 채운 뒤 운영자가 정한다 — 보고에 올렸다.

### 거부 — 처리마다 (제28조의8 ② 5)

| 처리 | 거부할 수 있나 · 방법 | 효과 | 처리방침 문장 |
| --- | --- | --- | --- |
| OpenAI — 풀이 · 인연 궁합 · 첫 화면 | 있다 — 누르지 않기 · 수락하지 않기 · 첫 화면에 넣지 않기 | 풀이와 문단을 못 받고 인연 궁합 요청을 수락할 수 없다(수락이 궁합풀이를 만든다). 사주 계산 · 저장은 그대로 | 「OpenAI 로의 이전은 … 일어나지 않습니다. 그 경우 …」 |
| Supabase 로그 · 지원 접근, Vercel 지원 접근 | 따로 거부할 수 없다 — 이용하는 동안 생긴다 | 가입하지 않거나 탈퇴 | 「… 따로 거부할 수 없습니다. 원하지 않으시면 가입하지 않거나 …」 |

v7 의 「세 곳 모두 … 반드시 필요해, 거부하시면 서비스를 이용하실 수 없습니다」는 핵심 처리(풀이 생성)의 필요성과 개별 처리(로그 · 지원 접근)의 필요성을
한 주장으로 묶었다 — 위처럼 갈랐다.

### 제28조의8 ② 와 시행령 제31조 ① — 국외로 나가는 줄마다

| 항목 | Supabase Pte. Ltd.(로그) | Supabase, Inc.(지원) | Vercel Inc.(지원) | OpenAI OpCo, LLC | 상태 |
| --- | --- | --- | --- | --- | --- |
| ② 1 항목 | 이용 기록(경로 · 계정 id) | 접근되는 DB 정보 | 접근되는 요청 정보 | 명식 · 분석 정보 · 사이(갈래별) | 채움 |
| ② 2 국가 · 시기 · 방법 | 「유럽연합(EU)의 데이터센터」 · 이용할 때마다 | 「미국」 · 그 경우에만 | 「미국」 · 그 경우에만 | 「미국, 그리고 하위 처리자가 있는 여러 나라」 · 누를 때 · 수락 때 · 첫 화면 | 채움(OpenAI 는 운영자 확인) |
| ② 3 명칭 · 연락처 | privacy@supabase.com | privacy@supabase.com | privacy@vercel.com · 우편 | privacy@openai.com | 채움 |
| ② 4 목적 · 보유기간 | 운영 · 보안 · 1일 | 지원 · 보안 · 계약 조항(끝나면 30일 뒤 삭제) — 지원 접근에 따로 정한 기간은 없다고 적음 | 지원 · 보안 · 계약 조항(끝나면 삭제) — 같은 꼴 | 생성 · 약 10분 · 30일 | 채움(지원 접근 둘은 조항의 사실만, 해석은 근거 문서) |
| ② 5 거부 | 따로 거부 불가 · 탈퇴 | 같음 | 같음 | 거부 가능 · 효과 | 채움(처리마다 갈랐다) |
| 시행령 31 ① 2 국외 이전의 근거 | 없음 | 없음 | 없음 | 회원 풀이만 ①3 | **로그 · 지원 접근 · 첫 화면의 근거 빠짐**(단정 못 함) |

### 시행령 제31조 ① 3 — 안전성 확보 조치

v7 부터 빠져 있던 절을 `notice-v8` 에 「개인정보를 지키는 조치」로 더했다(운영자 2026-10-15). **코드 · 운영 문서로 확인되는 조치만**, 보안 설정의 상세값은
적지 않는다.

| 처리방침 줄 | 근거 |
| --- | --- |
| 저장된 정보는 데이터베이스의 행 단위 접근 정책으로 본인과 그 정보를 볼 수 있는 상대에게만 열립니다. | 행 단위 접근 정책(RLS) — `supabase/migrations/` 에 `enable row level security` 64 곳(2026-10-15 셈). 상대에게 보이는 범위는 ADR 0012 · 0037 · `DISCOVERY_DISCLOSURE` |
| 운영자의 열람 권한은 운영자로 등록된 계정에만 있습니다. 운영자가 운영자 화면이나 정해진 조회 도구로 개인정보를 열람하면 누가·언제·무엇을 열람했는지 기록을 남깁니다. | 운영자 판정은 `is_operator()` 하나(`supabase/migrations/20260915150000_the_operator_reads_the_answers.sql`, ADR 0123 「잰 것」). 접속기록은 `audit.operator_access` — 운영자 화면 · `npm run db:remote` · 설문 문(ADR 0105, `docs/ops/runbook/security.md` 「운영자 접속기록」 표) |
| 이용자와 서비스 사이, 서비스와 데이터베이스 사이의 전송은 HTTPS 로 암호화합니다. | Vercel 「Every deployment on Vercel is served over an HTTPS connection.」 · 「HTTPS redirection is an industry standard and can't be disabled.」(https://vercel.com/docs/cdn-security/encryption, 2026-09-15). Supabase 「accept only HTTPS connections using TLS 1.2 or TLS 1.3」(https://supabase.com/docs/guides/security/platform-security) |
| 저장된 정보는 데이터베이스에서 암호화해 보관합니다. | 「All customer data is encrypted at rest with AES-256 and in transit via TLS.」(https://supabase.com/security, 2026-10-15 — 앞서 docs/guides/security 에서 못 찾았다고 적은 것은 틀렸다) |
| 외부 서비스의 비밀키와 데이터베이스 관리 열쇠는 서버에만 둡니다. | 비밀은 `NEXT_PUBLIC_` 이 아닌 이름으로 서버 층에서만 읽는다 — `scripts/secret-env.mjs` 머리 · `scripts/secret-env.test.ts` |

**적지 않은 것과 까닭**
- **운영자 2단계 인증** — 쓰지 않는다(운영자 결정 2026-10-15, ADR 0182). 운영자 로그인은 구글 간편로그인만이고, 운영자 화면은 운영자 판정(`is_operator()`)만 묻는다. 안전성 확보조치 기준 제6조 제2항과의 대조는 바로 아래 절이다(G-65).
- **접속기록의 빈틈** — Supabase SQL Editor · Table Editor · `db query --linked` 를 직접 부르면 읽기는 남지 않는다(`log_statement = ddl`, `docs/ops/runbook/security.md`).
  그래서 처리방침은 「운영자 화면이나 정해진 조회 도구로」라고 범위를 적었다. 이 빈틈을 막을지는 운영 결정이다.

### 운영자 로그인 — 안전성 확보조치 기준 제6조 제2항 (G-65)

2026-10-18 에 원문을 열어 확인했다.

판정하지 않는다 — 요건 · 우리 사실 · 남는 물음만 적는다. 구글 간편로그인만 쓰는 것은 운영자 결정이다(ADR 0182).

**요건 — 원문**

| 출처 | 원문(필요한 대목만) | 링크 · 확인한 날 |
| --- | --- | --- |
| 고시 현행판 — 개인정보보호위원회고시 제2026-9호(2026-07-01 발령 · 시행, 국가법령정보센터 「현행」) 제6조 ② | 「개인정보처리자는 개인정보처리시스템에 대한 정당한 접근 권한을 가진 자(다만, 정보주체는 제외한다)가 정보통신망을 통해 외부에서 개인정보처리시스템에 접속하려는 경우 인증서, 보안토큰, 일회용 비밀번호 등 안전한 인증수단을 적용하여야 한다. 다만, 이용자가 아닌 정보주체의 개인정보를 처리하는 개인정보처리시스템의 경우 가상사설망 등 안전한 접속수단 또는 안전한 인증수단을 적용할 수 있다.」 | https://www.law.go.kr/admRulLsInfoP.do?admRulSeq=2100000281400 · 2026-10-18 |
| 같은 고시, 제2025-9호(2025-10-31)의 부칙 제1조 | 「… 다만, 제4조제1항 제12호 및 제13호, 제5조제1항 및 제6항, 제6조제2항, 제8조제1항 및 제2항은 발령한 날의 1년 후부터 시행한다.」 — 위 글은 이날부터다. 안내서(아래)는 「(’26.11.1 부 시행)」으로 적는다 | 같은 곳 · 2026-10-18 |
| 그 전의 글 — 제2023-6호 제6조 ② | 「개인정보처리자는 개인정보취급자가 정보통신망을 통해 외부에서 개인정보처리시스템에 접속하려는 경우 인증서, 보안토큰, 일회용 비밀번호 등 안전한 인증수단을 적용하여야 한다. …」(단서는 같다) | https://law.go.kr/flDownload.do?flSeq=133609911 · 2026-10-18 |
| 같은 고시 제2조 12 | 「"내부망"이란 인터넷망 차단, 접근 통제시스템 등에 의해 인터넷 구간에서의 접근이 통제 또는 차단되는 구간을 말한다.」 | 현행판 · 2026-10-18 |
| 개인정보위 「개인정보의 안전성 확보조치 기준 안내서」(2025.11, 게시판의 현재 안내서) 68쪽 — 제6조 ② 해설 | 「안전한 인증수단 : 타인이 쉽게 도용하거나 위조할 수 없는 보안 수준을 갖춘 인증 방식을 말한다. 예를 들어, 개인정보처리시스템에 접속한 자의 비밀번호 인증 외에 일회용 비밀번호(OTP) 등 추가적인 인증 수단을 적용하는 것이 이에 해당될 수 있다.」 예시는 인증서(PKI) · 보안토큰 · 일회용 비밀번호(OTP) 셋이다 | https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030000&nttId=11641 · 2026-10-18 |
| 같은 안내서 63쪽 — 제5조 ⑤(「인증수단을 안전하게 적용하고 관리」) 해설 | 「인증수단의 예시」에 비밀번호 인증 · OTP · 생체 · SMS · 전화 인증과 나란히 「소셜 로그인: 포털사이트 등에서 제공하는 인증수단을 이용하여 본인 여부를 확인」이 있다. 제6조 ② 의 「안전한 인증수단의 예시」(68쪽)에는 소셜 로그인이 없다 | 같은 곳 · 2026-10-18 |
| 같은 안내서 143쪽 FAQ 4 | 「외부에서 이용자의 개인정보를 처리하는 개인정보처리시스템에 접속하는 경우 안전한 인증수단(일회용 비밀번호, 인증서 등)을 적용하여야 합니다.」 | 같은 곳 · 2026-10-18 |
| 개인정보위 보도자료(2025-07-10) — ㈜비와이엔블랙야크 과징금 13억 9,100만 원 | 「재택근무 등의 사유로 외부에서 관리자 페이지에 접속이 가능하도록 운영하면서 아이디, 비밀번호 외 안전한 인증수단을 적용하지 않은 사실이 확인되었다.」 요약 줄은 「안전한 인증수단(아이디/비밀번호 외 다중인증 등)」. 의결서 원문은 열지 않았다 | https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS074&mCode=C020010000&nttId=11343 · 2026-10-18 |

**우리 사실**

- 앱의 로그인은 구글 하나다 — `app/auth/sign-in-button.tsx:27`(`signInWithOAuth`, `provider: 'google'`). 운영 화면은 aal 을 묻지 않고 운영자 판정 · 접속기록만 남는다 — `docs/ops/runbook/operators.md:45`.
- 운영 화면은 회원 화면과 같은 공개 주소에 있다. `proxy.ts:174` 는 `/ops` 를 관문 밖에 두고 세션만 갱신하며, 접속 IP 로 거르는 줄은 없다 — 위 제2조 12 의 「내부망」에 해당하는 구간이 없다.
- 구글 계정의 2단계 인증이 켜져 있는지는 운영자 구글 계정의 설정이다 — 앱 · Supabase 는 묻지도 기록하지도 않고, 저장소에 확인 날짜도 없다(`docs/ops/runbook/operators.md` 「운영자 로그인」 · G-23 ⑨ 의 목록은 Supabase · Vercel · GitHub · PortOne · AWS).
- Supabase Auth 의 이메일 공급자는 켜져 있다 — e2e · 운영 확인 계정이 비밀번호로 든다(`docs/product/gaps/records/g-23.md:86`). 운영자 판정은 계정(`public.operator`)에 붙으므로 운영자 계정에 비밀번호가 없는지는 따로 보아야 하는 사실이다.

**남는 물음**

- 구글 간편로그인이 그 자체로 제6조 ② 의 「안전한 인증수단」인가 — 안내서는 소셜 로그인을 제5조 ⑤ 의 인증수단 예시에만 두고, 제6조 ② 에서는 「비밀번호 인증 외에 … 추가적인 인증 수단」을 예로 든다. 운영자 구글 계정의 2단계 인증을 켜는 것만으로 이 요건에 대는 근거가 되는지는 고시 · 안내서에 적혀 있지 않다 — 운영자(필요하면 변호사)가 답한다.
- 위 글의 시행일 — 부칙은 「발령한 날의 1년 후부터」, 안내서는 2026-11-01. 그 전의 글(제2023-6호)도 「개인정보취급자가 … 외부에서」 접속할 때 같은 수단을 적는다.

### 제30조 ① — 첫 화면 처리에 대해

이 판(시행 2026. 9. 11.)의 호 번호다 — 1 목적 · 2 처리 및 보유 기간 · 3의2 파기 · 4 위탁 · 5 권리 · 6 보호책임자 · 7 자동 수집 장치. 조율자
메모의 번호(4 · 6 · 9 · 10)는 이 판에 없다.

| 항목(조문 원문) | v8 의 문장(첫 갈래) | 상태 |
| --- | --- | --- |
| 1 「개인정보의 처리 목적」 | 「로그인하지 않고 첫 화면에서 사주를 보실 때 받은 입력은 계산하고 짧은 사주 문단을 쓰는 데만 쓰고 저장하지 않습니다.」 | 채움 |
| 2 「개인정보의 처리 및 보유 기간」 | 「…만든 때부터 24시간 뒤 지웁니다」 · 「…계정의 풀이 기록으로 남고 탈퇴하실 때 지웁니다」 · 「쿠키는 7일 뒤 사라지며」 | 채움 |
| 3의2 「개인정보의 파기절차 및 파기방법」 | 시점은 위 2. 절차 · 방법은 「파기 절차와 방법」 절의 일반 줄(「전자적 파일은 데이터베이스에서 삭제하며, 복구할 수 없습니다」)이 덮는다 | 채움(일반 절) |
| 4 「개인정보처리의 위탁에 관한 사항」 | v7 「풀이 생성은 OpenAI 에 맡깁니다」 — 첫 화면 문단은 풀이가 아니다(`docs/context/evidence.md:49-51`) → **「풀이와 첫 화면의 짧은 사주 문단 생성은 OpenAI 에 맡깁니다」로 고침**. 첫 화면의 임시 기록과 입력 계산이 서울 리전에서 처리된다는 것도 위탁 절이 든다 | 빠짐 → 채움 |
| 5 「정보주체와 법정대리인의 권리ㆍ의무 및 그 행사방법」 | 「권리와 행사 방법」 절의 일반 줄 | 채움(일반 절). 첫 화면 기록은 계정에 매이지 않아 행사 경로가 따로 없다 — 확인 전 |
| 6 「… 개인정보 보호책임자의 성명 … 연락처」 | 「개인정보처리자: … · 개인정보 보호책임자: … · 연락처: …」(일정 표의 값) | 채움 |
| 7 「인터넷 접속정보파일 등 개인정보를 자동으로 수집하는 장치의 설치ㆍ운영 및 그 거부에 관한 사항」 | 설치 · 운영 「로그인하지 않고 첫 화면에서 사주를 보시거나 가입해 이어 받으실 때 이 브라우저에 쿠키를 둡니다. 쿠키는 7일 뒤 사라지며」 · 거부 「브라우저에서 언제든 지우실 수 있습니다」 | 설치 · 운영 채움. **거부의 효과는 확인 전** — 쿠키를 막은 브라우저에서 문단이 어떻게 되는지 재지 않았다. 로그인 쿠키는 v7 부터 이 절이 없다(첫 갈래 밖 — 공개 출시판 초안 10절이 든다) |

### 법이 요구하지 않는데 적은 줄

| 줄 | 왜 적나 |
| --- | --- |
| 「사주풀이·궁합풀이를 받지 않고, 궁합 요청도 수락되지 않고, 첫 화면에서 사주를 보지 않으시면 이 처리는 일어나지 않습니다.」 | 요구 항목 아님 — v7 의 같은 줄이 사실과 어긋나 바로잡으려고 |
| 「인연 궁합풀이에는 태어난 해·나이·성별을 빼고 … 첫 화면의 짧은 사주 문단에는 태어난 해·나이를 빼고 보냅니다.」 | ② 1(항목)의 갈래 구분 — 요구는 항목이고, 갈래별 문장은 v7 의 「여덟 글자 … 만」을 바로잡으려고 |
| 「정확한 생년월일시와 태어난 지역, 분 단위 시각은 보내지 않습니다. …」 | 요구 항목 아님 — v7 그대로 |

### 근거 경로 — 확인 전 · 변호사 선택 검토(B-9)에 올림

- **국외 이전(제28조의8 ① 3)** — 개인정보보호위원회 Q&A(https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS212&mCode=C040030000&nttId=9830,
  2024-01-02 게시, 2026-10-15 열람)는 이 호를 「정보주체와 체결한 계약을 이행하거나 계약을 체결하는 과정에서 정보주체의 요청에 따른 조치를
  이행하기 위하여 필요한 경우로서 국외에서 개인정보 처리위탁이 필요하거나 국외에서 개인정보 보관이 필요한 경우를 의미합니다.」로 풀고,
  「다만 특정 업무가 정보 주체의 요청에 따른 조치를 이행하기 위하여 필요한 경우인지 여부는 해당 사업자가 제공하는 서비스. 제품의 성격 및
  사업 구조 등을 종합적으로 고려하여 판단이 필요합니다.」라고 한다. **가입 전 방문자가 첫 화면에서 문단을 요청하는 것이 이 경로에 드는지는
  판정하지 않는다** — 확인 전, `docs/legal/counsel-request.md` B-9 에 올렸다.
- **수집(제15조 ①)** — 같은 꼴로, 첫 화면 입력을 받는 근거가 어느 호인지 판정하지 않는다. 제15조의 원문은 이 세션에서 국가법령정보센터에서
  열지 못했다(조문 링크를 찾지 못함) — **인용 확인 전**. B-9 에 함께 올렸다.

## 조문 — 원문과 확인한 날

모두 국가법령정보센터의 「개인정보 보호법」(시행 2026. 9. 11., 법률 제21445호, 2026. 3. 10. 일부개정)이고 2026-10-15 에 읽었다.

| 조문 | 원문(필요한 대목만) | 링크 |
| --- | --- | --- |
| 제2조 1호 나목 | 「해당 정보만으로는 특정 개인을 알아볼 수 없더라도 다른 정보와 쉽게 결합하여 알아볼 수 있는 정보. 이 경우 쉽게 결합할 수 있는지 여부는 다른 정보의 입수 가능성 등 개인을 알아보는 데 소요되는 시간, 비용, 기술 등을 합리적으로 고려하여야 한다.」 | https://law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900040612 |
| 제28조의8 ① 본문 | 「개인정보처리자는 개인정보를 국외로 제공(조회되는 경우를 포함한다)ㆍ처리위탁ㆍ보관(이하 이 절에서 "이전"이라 한다)하여서는 아니 된다.」(단서의 각 호가 예외) | https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029334951 |
| 제28조의8 ① 3 | 「정보주체와의 계약의 체결 및 이행을 위하여 개인정보의 처리위탁ㆍ보관이 필요한 경우로서 다음 각 목의 어느 하나에 해당하는 경우」 — 가목 「제2항 각 호의 사항을 제30조에 따른 개인정보 처리방침에 공개한 경우」 · 나목 「전자우편 등 대통령령으로 정하는 방법에 따라 제2항 각 호의 사항을 정보주체에게 알린 경우」 | 같은 곳 |
| 제28조의8 ② | 1 「이전되는 개인정보 항목」 2 「개인정보가 이전되는 국가, 시기 및 방법」 3 「개인정보를 이전받는 자의 성명(법인인 경우에는 그 명칭과 연락처를 말한다)」 4 「개인정보를 이전받는 자의 개인정보 이용목적 및 보유ㆍ이용 기간」 5 「개인정보의 이전을 거부하는 방법, 절차 및 거부의 효과」 | 같은 곳 |
| 제30조 ① | 1 「개인정보의 처리 목적」 2 「개인정보의 처리 및 보유 기간」 3의2 「개인정보의 파기절차 및 파기방법(…)」 4 「개인정보처리의 위탁에 관한 사항(해당되는 경우에만 정한다)」 7 「인터넷 접속정보파일 등 개인정보를 자동으로 수집하는 장치의 설치ㆍ운영 및 그 거부에 관한 사항(해당하는 경우에만 정한다)」 | https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029332499 |
| 시행령 제31조 ① (시행 2026. 9. 11., 대통령령 제36671호) | 「법 제30조제1항제8호에서 "대통령령으로 정한 사항"이란 다음 각 호의 사항을 말한다.」 — 1 「처리하는 개인정보의 항목」 2 「법 제28조의8제1항 각 호에 따라 개인정보를 국외로 이전하는 경우 국외 이전의 근거와 같은 조 제2항 각 호의 사항」 3 「제30조에 따른 개인정보의 안전성 확보 조치에 관한 사항」 4 「국외에서 국내 정보주체의 개인정보를 직접 수집하여 처리하는 경우 개인정보를 처리하는 국가명」 | https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1033215161 |
| 제30조 ② | 「개인정보처리자가 개인정보 처리방침을 수립하거나 변경하는 경우에는 정보주체가 쉽게 확인할 수 있도록 대통령령으로 정하는 방법에 따라 공개하여야 한다.」 | 같은 곳 |

개인정보보호위원회의 설명(카드뉴스 「이것이 궁금하다! 개정 개인정보보호법 관련 자주 묻는 질문들」, 2024-01-02) — 제28조의8 ①3 은
「국외에서 개인정보 처리위탁이 필요하거나 국외에서 개인정보 보관이 필요한 경우를 의미합니다.」 처리방침에 무엇을 적는지는 그 글에
없다. https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS212&mCode=C040030000&nttId=9830

**다시 확인받기가 법 의무인지는 판정하지 않았다 — 다시 확인받는 것은 우리 정책이다.** 내용 개정 때 확인한 사람을 다시 부르는
것(`NOTICE_ACK_FLOOR`, ADR 0095)을 법이 시킨다고 적지 않는다. 제30조 ② 의 글자는 「공개」다. 그 확인이나 (알림을 켤 때의) 브라우저 알림 허용을 국외 이전의 동의로 쓰지 않는다(ADR 0180).

## 판단 셋 — 무엇을 왜 적나 (운영자 2026-10-15)

### 1. 첫 화면의 짧은 사주 문단은 OpenAI 의 「언제」에 따로 선다

- **판정하지 않는 것** — OpenAI 로 가는 여덟 글자 · 성별 · 시간 앎 · 분석값이 제2조 1호 나목의 개인정보인지. 「쉽게 결합」은 받는
  쪽이 가진 다른 정보에 달렸고, 그것은 입증되지 않았다. 그래서 처리방침에도 「개인정보 국외 이전이므로」 같은 법적 성격을 쓰지 않는다.
- **적는 까닭 둘** — ① 지금 판(`notice-v7`)의 「사주풀이·궁합풀이를 받지 않고 궁합 요청도 수락되지 않으면 이 처리는 일어나지
  않습니다」가 사실과 어긋난다. 첫 화면에서 로그인하지 않고 생일을 넣으면 `app/taste/actions.ts:33` 의 `requestTaste` 가
  `app/me/reading/model.ts:177` 의 `callModel` 로 OpenAI 를 부른다(`app/taste/taste-run.ts:176`). ② 우리 쪽 처리 — 생년월일시를 서버가
  받는 것, 쿠키, IP 의 HMAC, 가입 뒤 세션이 계정에 이어지는 것 — 는 제30조 ① 1 · 2 · 7 의 목적 · 보유기간 · 자동 수집 장치 설명 대상이다.
- **「풀이」로 묶지 않는다** — 용어집이 로그인 전 결과를 「**풀이**가 아니다」라고 적는다(`docs/context/evidence.md:49-51`). 그래서 「언제」
  칸은 「사주풀이 · 궁합풀이를 받을 때」에 넣지 않고 「로그인하지 않고 첫 화면에서 사주를 보실 때(짧은 사주 문단)」를 따로 든다.
- **호출의 모양(조율자가 쟀다, 2026-10-15)** — 첫 화면의 호출은 `callModel` 이고 `store: false`(`app/me/reading/generation.ts:25`),
  metadata · 사용자 식별자를 싣지 않는다. 본 풀이 호출은 `background: true` 에 `metadata: { reading_run_id }`(`app/me/reading/model.ts:306`,
  우리 내부 id)다. 그래서 보유기간 칸에 「첫 화면의 짧은 사주 문단은 회수용으로 보관하지 않습니다」를 덧붙였다.

### 2. OpenAI 로 가는 항목 — 정확히, 설명은 짧게 (운영자 2026-10-15)

처리방침은 필드 이름을 늘어놓지 않고 묶는다 — 「계산된 명식과 태어난 해 · 나이 · 성별 등 분석 정보」. 갈래가 다른 만큼만 갈라 적는다
(아래 3). 사이는 적고, 이름 · 닉네임은 보내지 않는다고 적는다(위 「갈래별 묶음」).

- 성별 · 시간 앎은 입력값이라 「여덟 글자에서 나온 사실」로 보기 어렵다. 모델에 가는 자료(`RedactedChartEvidence`)는 `meta` 에서
  `inputTime` · `resolvedTime` · `instant` · `corrections` · `totalCorrectionMinutes` 만 자른다(`src/lib/saju/evidence/redacted.ts:65-69`) —
  `meta.gender` · `meta.hourKnown`(`src/lib/saju/index.ts:147` · `:149`)은 남아 본 풀이와 첫 화면의 문단(`src/lib/reading/taste-run.ts:86`) 모두에 간다.
- **이름은 궁합의 갈래마다 다르다.** 프롬프트는 두 사람을 부르는 이름과 사이를 싣는다(`src/lib/reading/prompt.ts:1322` `namingBlock` ·
  `:1365` `relationOf`, 차려지는 자리 `:1529-1531`). 그 값은 DB 가 짓는다(`supabase/migrations/20260925090000_the_job_is_frozen_when_the_attempt_opens.sql:186-230`) —
  인연 궁합(`match`)은 두 사람의 `app_user.nickname`, 사이는 없음(`'relation', null`). 직접 고른 궁합(`private`)은 등록할 때 붙인
  `user_person_access.local_label` 과 고른 사이(`pair_relation`). 사주풀이(`self` · `person`)는 이름을 프롬프트에 싣지 않는다 — `namingBlock` 은
  궁합 절에만 선다(`:1487`). v7 은 이것을 적지 않았다 — 공개 출시판 초안 「부록 A 어긋남 1」이 이미 든 사실이다. 「무엇을 받고」에
  닉네임 · 붙인 이름 줄이 없어 함께 더했다. **운영자가 궁합풀이에 이름 · 닉네임을 보내지 않기로 했다(2026-10-15)** — 위 이름 경로는 reading PR 이 걷고,
  처리방침은 그 뒤의 사실(「이름·닉네임은 보내지 않습니다」)을 적는다.

### 3. 해 · 나이 · 성별은 갈래마다 다르다 — 처리방침은 빠지는 것만 갈라 적는다 (운영자 2026-10-15, 코드는 그대로)

- **사주풀이 · 직접 고른 궁합풀이** — 잘라 낸 근거(`RedactedEvidence`)를 그대로 보낸다. 자르는 자리(`src/lib/saju/evidence/redacted.ts:31-41`
  `REDACTED_PATHS`)에 해 `pillars.meta.sajuYear` · 나이 `now.age` · 절입 날짜(`pillars.meta.monthTerm.date` · `nextTerm.date`) · 대운수 ·
  경계 절기의 날짜가 없다 — 모두 나간다. 해와 나이가 함께 가므로 태어난 날짜와 2시간 범위가 하나로 정해질 것으로 본다 — **검증 전**
  (절기 · 자정 경계까지 재지 않았다).
- **첫 화면의 짧은 사주 문단** — 그 자리들을 더 뺀다(`src/lib/reading/taste-run.ts:51-60` `TASTE_DROPPED_PATHS` — `now` · `daeun` ·
  `sajuYear` · 절입 · 중기 날짜). 성별과 시간 앎은 남는다. 같은 여덟 글자는 60년마다 돌아오고, 그 주기 안에서 날짜와 2시간 범위가
  정해진다(ADR 0143 의 6).
- **인연 찾기의 궁합풀이(`limited-v1`, `src/lib/saju/evidence/shared.ts:43`)** — 빼는 것이 아니라 고른 칸만 싣는다(`:88-104`
  `LIMITED_FIELDS`). 여덟 글자 · 시간 앎 · 두 사주 사이의 관계 · 글자 수로 센 오행 보완 · 두 일간 사이 십성 · 한계 문장. 성별
  (`meta.gender`) · 해와 절입(`pillars.meta.{sajuYear,monthTerm,nextTerm}`) · 대운 · 지금 운(나이)은 뺀다(`:147-158` `WITHHELD_BOTH`,
  `:153` 성별). 그래서 첫 화면 문단과 같이 60년 주기 안의 역산이다. 이름은 닉네임이다(위 2).
- 「60년 주기」는 첫 화면 문단과 인연 궁합에만 참이다. ADR 0143 의 6 · G-66 기록의 「숨기지 않을 사실」은 첫 화면 문단에 대해 쓴 문장이다.
- **역산 문장은 처리방침에 넣지 않는다**(운영자 2026-10-15) — 「60년마다」도 「하나로 정해진다」도. 법이 요구하는 항목이 아니고 경계까지
  검증하지 않았다. 위 셋은 근거로만 남는다.
- **고친 것 하나** — 공개 출시판 초안(`docs/legal/privacy-v8-draft.md`) 4절 표가 「보내지 않는 것」에 성별을 적었다. 위 코드와 어긋나
  「보내는 것」으로 옮겼다(2026-10-15).

## 줄마다 — `notice-v8` 이 더하거나 고친 것

| 처리방침의 줄(`src/lib/consent/notice.ts`) | 사실의 출처(코드) | 조문 |
| --- | --- | --- |
| 「무엇을 받고」 — 생년월일시 줄: 저장은 내 사주 · 사람 저장 · 궁합 열기 때, 첫 화면 입력은 계산과 문단에만 쓰고 저장 안 함 | 저장은 누름이다 — 「저장하고 계속하기」(`app/save-for-reading.tsx`), 궁합 열기는 두 사람을 대상으로 남긴다(`app/compat-picker.tsx:172` `openPairScreen` → `/me/compat?a=…&b=…`). 첫 화면 입력은 주소 `#` 뒤 모양에서 이름을 뺀 것(`app/taste/taste-draft.ts` `tasteDraftOf`, 운영자 2026-10-15 — 서버가 쓰지 않는 이름을 보내지 않는다)으로 서버에 가고 `sajuOfDraft`(`app/taste/taste-run.ts:107`)가 계산만 한다 — DB 에 원문 칸이 없다(ADR 0143 의 6). 회원의 `/saju` 계산은 브라우저에서 한다(`app/saju-calculator.tsx:266`) | 제30조 ① 1 |
| 「언제까지 두나요」 — 첫 화면 기록은 만든 때부터 24시간 뒤 지움(처리방침은 정리 주기를 적지 않는다) | 세션 · artifact `expires_at = now() + 24 hours`, 정리는 `status <> 'claimed'` 인 세션 · 만료된 artifact · 24시간 지난 한도 사건(`supabase/migrations/20261118090000_…sql:163` · `:199` · `:1090` · `:1095`), 크론 `taste-sweep` `1-59/5 * * * *`(같은 파일 `:1151`). 「24시간 뒤 즉시」가 아니다 — 정리 주기만큼 늦을 수 있다 | 제30조 ① 2 · 3의2 |
| 같은 절 — 기록의 항목: 이 브라우저와 접속을 알아보는 값, 계산된 사주를 다시 알아낼 수 있는 값, 만든 문단(구현 — 서버 비밀의 HMAC, 여덟 글자 · 성별 · 시간 앎의 지문 — 은 이 칸에만) | `app/taste/taste-visitor.ts:61` `browserHmacOf` · `:71` `ipHmacOf`(날짜별 키), 지문(SHA-256 — 원문이 여덟 글자 · 성별 · 시간 앎이고 경우의 수가 60⁴ × 2 × 2 남짓이라 대입으로 풀린다, `src/lib/reading/taste-run.ts:132-142` `tasteFingerprintSourceOf`, ADR 0143 의 6), 세션의 `preview_markdown` 사본(`…sql:191`) | 제30조 ① 1 · 2 |
| 같은 절 — 가입해 이어 받으면 계정의 풀이 기록으로, 탈퇴 때 지움 | `claimed_by … on delete cascade`(`…sql:200`), 단계 표도 세션을 따라 지워진다(`supabase/migrations/20261119090000_…sql:28`) | 제30조 ① 2 |
| 같은 절 — 쿠키 7일, 첫 화면에서 사주를 볼 때(문단을 받기 전) 놓인다 | 문단 요청이 모델을 부르기 전에 `tasteVisitor` 가 쿠키를 심는다(`app/taste/taste-visitor.ts:103-117`, `app/taste/taste-run.ts` `serveTaste` 의 `hands.visitor()`). `:48` `BROWSER_COOKIE_DAYS` · `:51` `CLAIM_COOKIE_DAYS`, `maxAge` `:116` · `:144`. httpOnly | 제30조 ① 7 |
| 「풀이를 만들 때 밖으로 나가는 것」 — 첫 화면 문단도 OpenAI 가 씀 · 「계산된 명식과 태어난 해 · 나이 · 성별 등 분석 정보」 · 궁합의 사이 · 이름 · 닉네임은 안 보냄 · 인연 궁합은 해 · 나이 · 성별을 빼고 · 첫 화면 문단은 해 · 나이를 뺌 | 위 「판단 셋」의 2 · 3 | 제30조 ① 1 · 4 |
| 「무엇을 받고」 — 닉네임과 등록할 때 붙인 이름(새 줄) | 위 「판단 셋」의 2 | 제30조 ① 1 |
| 같은 절 — 첫 화면 문단의 거부 방법과 효과: 넣지 않으면 일어나지 않고, 가입 · 그 밖의 이용에 영향 없음 | 로그인한 사람은 그 문단을 받지 않는다(`app/taste/taste-run.ts:130` `if (await hands.member()) return TASTE_CLOSED`) — 가입 뒤의 길과 무관하다 | 제28조의8 ② 5 꼴 |
| 「국외로 나가는 것」 — OpenAI 의 「언제」 · 「목적」 · 「보유기간」 | 위 「판단 셋」. 「회수용 보관 약 10분 · 오·남용 점검 기록 최대 30일」은 v7 의 문장 그대로이고 이 판에서 다시 재지 않았다(출처는 초안 「부록 A」) | 제28조의8 ② 1~4 |
| 「맡겨서 처리하는 곳」 — 서울 리전에서 처리 · 보관하는 것(DB · 로그인 · 임시 기록, 서버 처리 · 입력 계산) / 「국외로 나가는 것」 — 국외에서 처리 · 접근되는 것만 | 위 「처리마다 — 사실 · 추정 · 미확인」 | 제30조 ① 4 · 제28조의8 ② |

## 푸시 회사 넷 — 알림을 켜기 전에 따로 올릴 판의 재료 (`notice-v8` 에 없음)

`notice-v8` 은 이 줄들을 싣지 않는다(운영자 2026-10-15, ADR 0180) — 처리 국가 · 보유기간이 빈 표를 완성된 고지로 올리지 않는다. 아래
「확인 전」 칸이 차면 알림을 켜기 전에 따로 게시하고(내용 개정 — 그때 전원 다시 확인), 그다음 VAPID 열쇠를 넣는다(G-71).

**나가는 것**(`app/api/push/dispatch/send.ts:127-131` 의 `generateRequestDetails`):

- 구독 주소(endpoint) — 그 회사가 발급한 주소다. 그 회사의 호스트만 받는다(`src/lib/push/index.ts:205-206`).
- 암호화된 페이로드 — 이동할 주소 `/me/chat/<방 id>` 와 묶음 표 `chat-<방 id>` 뿐이다(`src/lib/push/index.ts:62` `pushPayloadFor`).
  메시지 본문 · 닉네임 · 사진은 없다. 회사는 내용을 못 읽는다.
- `Topic` 머리 — 방 id 에서 하이픈을 뺀 16진 32글자(`src/lib/push/index.ts:75` `pushTopicFor`). **암호화되지 않는다** — 회사가 본다.
- `TTL` 3600초 · `Urgency: high` 머리, VAPID 서명(우리 서버의 열쇠 — 이용자의 정보가 아니다).
- **나가지 않는 것** — 서버에 둔 구독 열쇠(`p256dh` · `auth`)는 페이로드를 암호화하는 데 쓰이고 회사로 가지 않는다.
- `PUSH_TTL_SECONDS = 3600`(`src/lib/push/index.ts:22`)은 「못 닿은 알림을 길어야 이만큼 들고 있으라」는 **요청**이다. 회사의
  보유기간이 아니다 — 처리방침은 「보관하도록 요청합니다」로 적고 「1시간 뒤 삭제」로 쓰지 않는다.

**회사마다**(모두 2026-10-15 에 공식 문서를 열어 읽었다):

| 칸 | Google — FCM `fcm.googleapis.com` | Mozilla — autopush `*.push.services.mozilla.com` | Microsoft — `*.notify.windows.com` | Apple — `*.push.apple.com` |
| --- | --- | --- | --- | --- |
| 어느 기기 · 브라우저 | Chrome, 그리고 안드로이드의 다른 Chromium 브라우저(삼성 인터넷 · Opera 등) — 우리 표의 근거는 `src/lib/push/index.ts:197`. 회사 문서로는 확인 전 | Firefox | **Windows 의 Edge(118 이상)만** — 「Forces Microsoft Edge to use its built-in WNS push client to connect to the Windows Push Notification Service」, 지원 판 「Windows: ≥ 118 · macOS: Not supported · Android: Not supported · iOS: Not supported」 — https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/forcebuiltinpushmessagingclient (ms.date 2026-05-20). 다른 플랫폼의 Edge 가 어느 서비스로 가는지는 확인 전 | Safari, 홈 화면에 추가한 웹 앱(iOS · iPadOS 16.4 이상) |
| 받는 법인 | Google LLC. 「Google LLC의 privacy team」, 국내대리인 「구글코리아 유한회사」 — https://policies.google.com/privacy/additional?hl=ko&gl=kr | 「Mozilla Corporation」 — https://www.mozilla.org/en-US/privacy/firefox/ | 「Microsoft Corporation」(EEA · 영국 · 스위스는 Microsoft Ireland Operations Limited) — https://www.microsoft.com/ko-kr/privacy/privacystatement | 한국 보충 고지의 이전 표에 「Apple Inc. … 미국」, 근거 「개인정보 보호법 제28조의8 제1항 제3호 (위탁)」 — https://www.apple.com/kr/legal/privacy/kr/ |
| 연락처 | 「이메일: googlekrsupport@google.com」, 국내대리인 「data-access-requests@google.com」 · 02-722-7778(같은 곳) | 「compliance@mozilla.com」, Data Subject Access Request Portal(같은 곳). 한국 창구 확인 전 | 개인정보 보호 팀 문의 양식(같은 곳). 주소 「One Microsoft Way, Redmond, Washington 98052, USA」. 한국 창구 확인 전(바닥글의 한국마이크로소프트 연락처는 개인정보 창구가 아니다) | 「개인정보 보호 팀 전화번호: +82 02 6712 6700 웹사이트: apple.com/kr/privacy/contact」(같은 곳) |
| 처리 국가 | FCM 은 「global service」 — 「any of the Google Cloud Platform locations or Google data center locations」(https://firebase.google.com/support/privacy). 한국 고지는 「국외에 소재하는 Google의 데이터 센터」 — **나라 이름은 확인 전** | 「Mozilla (and our servers) are based in the United States.」 | 회사 전체로 「일반적으로 주요 저장소 위치는 사용자의 지역 또는 미국」. **푸시 서비스의 처리 국가는 확인 전** | 「일반적으로 미국의 Apple Inc.에 저장됩니다」 |
| 알림의 보관 | 「the maximum period of time that FCM stores and attempts to deliver the message」 = 보낸 쪽이 정한 TTL(최대 28일) — https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan. 우리는 1시간 | **확인 전**(공식 문서 없음. 소스 코드의 최대 TTL 30일과 지원 문서의 검색 요약만 있다 — 인용하지 않는다) | **확인 전**(WNS 문서는 Windows 앱의 캐시만 말한다) | 「it may store the notification for 30 days or fewer, depending on the value you specify … removes the notification from storage permanently」 — 위 Apple 웹 푸시 문서. 우리는 1시간 |
| 그 밖의 기록 · 보유기간 | 확인 전 | 확인 전 | 확인 전 | 확인 전 |
| 사이트 운영자에게 걸리는 약관 | 확인 전(Firebase 를 쓰지 않고 브라우저 구독 주소로만 보내는 경우의 약관은 문서에 없다) | 확인 전 | 확인 전 | 「You don't need to join the Apple Developer Program to send web push notifications.」 운영자 약관은 확인 전 |
| 그 회사가 보는 것 | 확인 전 | 저장 칸 「data Payload … headers … ttl … timestamp」, `Topic` 은 「replace previously sent, unreceived subscription updates」 — https://mozilla-services.github.io/autopush-rs/architecture.html · http.html | 확인 전 | TTL · Authorization(VAPID) · Content-Encoding · Topic · Urgency 머리를 읽는다, 페이로드는 서버가 암호화 — Apple 웹 푸시 문서 |

**Microsoft 의 호스트** — Edge 정책 문서가 Windows 의 Edge 가 WNS 로 간다는 것을 말한다(위 표). 호스트 `*.notify.windows.com` 은 ADR 0156
이 실제 구독 주소를 보고 넣었다(`src/lib/push/index.ts:199`). Edge 의 웹 푸시 안내(https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/push)는
WNS 를 말하지 않는다. 처리방침에 적을 때는 「Windows 의 Edge」로만 적는다.

**게시할 때 쓸 값의 초안**(2026-10-15 의 #715 첫 판에 넣었다가 뺐다) — 처리 국가는 Google · Microsoft 를 「미국 등 그 회사의 데이터 센터가
있는 국가」로, Mozilla · Apple 을 「미국」으로. 보유기간은 「기기에 전달될 때까지, 길어야 1시간만 보관하도록 요청합니다」 — 우리가 아는
것은 요청뿐이다. 이 초안은 빈칸이 남은 채라 운영자가 게시하지 않기로 했다.

## 참고한 다른 서비스 (2026-10-15 에 열어 봤다 — 근거가 아니라 견줄 거리다)

- **MT**(https://www.heremt.com/legal/privacy/, 시행 2026-10-13) 8절 — 푸시 줄 「Google LLC ( googlekorea@google.com ) 미국 … 푸시 알림
  식별자 … 서비스 이용 시점에 네트워크를 통해 전송 … 푸시 알림 발송 … 위탁 목적 달성 시까지」, 근거 「「개인정보 보호법」 제28조의8
  제1항 제3호」, 거부 「푸시 알림 식별자 이전은 기기의 알림 권한을 해제하여 거부할 수 있습니다. 거부하시면 알림을 받을 수 없습니다.」
  Google 한 곳만 든다(앱이라서다). 연락처가 Google 한국 고지의 주소(googlekrsupport@google.com)와 다르다.
- **SAZU**(https://www.sazu.app/privacy, v2026.10.09) — 제1 · 6 · 7조에 푸시가 없다. 제7조는 받는 곳을 나라로만 든다(예: 「Google(미국):
  AI 분석(Gemini), 광고(AdMob), 분석(GA4)」 · 「Supabase(한국/미국/EU)」) — 연락처 · 보유기간이 없다.

## 열린 것

- 위 「확인 전」 칸 — 채운 뒤 푸시 고지를 따로 게시하고, 그 뒤에 웹 푸시를 켠다(ADR 0180 · G-71).
- 변호사에게 묻는다면 — `docs/legal/counsel-request.md` 「B-9」(선택 검토).

## 회사에 물을 것 — 없음 (2026-10-15)

OpenAI 의 처리 국가 · 개인정보 연락처는 운영자가 공식 하위처리자 목록에서 확인했다(위 「남은 항목」). 운영자가 페이지를 복사하거나 회사에 문의해야만
진행된다는 조건은 걷었다. 남은 문의는 없다.
