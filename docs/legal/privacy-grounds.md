# 처리방침의 근거 — 줄마다 조문 · 코드 · 출처

> **법률 자문이 아니다. 변호사 검토 전의 근거 모음이다.** 처리방침의 줄마다 무엇을 근거로 적었는지 — 조문 원문 · 코드의 자리 ·
> 받는 회사의 공식 문서 · 참고한 다른 서비스 — 를 한 곳에 모은다. 「표에 적었으니 적법하다」는 뜻이 아니다. 법적 판단은 변호사가
> 하고, 묻고 싶을 때 묻는 선택 검토로 남는다(`docs/legal/counsel-request.md` 「B-9」, ADR 0180).

화면의 처리방침 원문은 `src/lib/consent/notice.ts` 의 `noticeFor` · `TRANSFERS` 이고 `/privacy` 가 그대로 그린다. 이 문서는
**`notice-v8`**(G-66 의 내용 개정, ADR 0180)이 더한 줄을 든다. 새 메시지 알림(G-71)은 그 판에 없다 — 아래 「푸시 회사 넷」은 알림을
켜기 전에 따로 올릴 판의 재료다 — 그 앞 판의 줄은 `docs/legal/privacy-v8-draft.md` 「부록 A」가
출처를 든다. 처리방침 문장을 바꾸는 PR 은 이 문서의 그 줄도 같은 PR 에서 고친다(ADR 0180 의 8).

**「확인 전」** 은 공식 문서에서 찾지 못한 값이다 — 지어 쓰지 않았다. 찾은 날 그 칸을 채우고 출처를 단다.

## 조문 항목 → 처리방침 줄 대조표 (`notice-v8`, 2026-10-15)

**운영자 지시(2026-10-15): 「법적 근거를 바탕으로 해라」.** 행은 법이 요구하는 항목이고, 처리방침 문장은 이 표에서 「빠짐」이 나온 자리만
고친다. 「채움」은 그 항목에 맞는 문장이 있다는 뜻이지 그 문장으로 법을 지켰다는 판정이 아니다. 조문의 원문 · 링크는 아래 「조문 — 원문과
확인한 날」, 모두 2026-10-15 에 국가법령정보센터에서 읽은 판(시행 2026. 9. 11.)이다.

갈래 — **첫** = 로그인하지 않은 첫 화면의 짧은 사주 문단 · **사주** = 사주풀이 · **궁합** = 직접 고른 두 사람의 궁합 · 인연 궁합.

### 제28조의8 ② — 국외로 나가는 곳마다

| 항목(조문 원문) | Supabase | Vercel | OpenAI | 상태 |
| --- | --- | --- | --- | --- |
| 1 「이전되는 개인정보 항목」 | 「구글 계정 이메일, 생년월일시·출생지·성별, 계산된 명식과 저장된 풀이, 첫 화면의 짧은 사주 문단을 만들며 남기는 임시 기록」 — 첫 · 사주 · 궁합 | 「접속 기록과 요청 정보, 그리고 저장·수정하시거나 첫 화면에서 사주를 보실 때 서버를 지나가는 생년월일시·출생지·성별」 — 첫 · 사주 · 궁합 | 「계산된 명식과 태어난 해·나이·성별 등 분석 정보, 궁합풀이에서는 … 이름과 고르신 사이(인연 궁합풀이는 … 닉네임을, 첫 화면의 짧은 사주 문단은 태어난 해·나이를 빼고 …)」 — 첫 · 사주 · 궁합 갈래별 | 채움 |
| 2 「개인정보가 이전되는 국가, 시기 및 방법」 | 「미국」 · 「서비스를 이용하실 때마다 네트워크를 통해 전송」 | 「미국」 · 같은 꼴 | 「미국」 · 「… 그리고 로그인하지 않고 첫 화면에서 사주를 보실 때(짧은 사주 문단) 네트워크를 통해 전송」 | 채움 — 다만 **Supabase 의 국가는 확인 전**(아래 3) |
| 3 「개인정보를 이전받는 자의 성명(법인인 경우에는 그 명칭과 연락처를 말한다)」 | 명칭 「Supabase, Inc.」 · 연락처 **v7 은 링크뿐 → privacy@supabase.com 을 더함** | 명칭 「Vercel Inc.」 · 연락처 **v7 은 링크뿐 → privacy@vercel.com · 우편 주소를 더함** | 명칭 「OpenAI, L.L.C.」 · 연락처 **확인 전** — 공식 처리방침이 403 으로 열리지 않았다. 링크(「문의처는 이곳에 안내」)만 둔다 | Supabase · Vercel 빠짐 → 채움, OpenAI 확인 전. **Supabase 의 명칭도 확인 전**(아래) |
| 4 「… 이용목적 및 보유ㆍ이용 기간」 | 「계정 인증과 데이터베이스 보관」 · 「베타 종료 후 파기 시점까지(첫 화면의 임시 기록은 24시간)」 | 「서비스 운영과 화면 전송, 입력을 데이터베이스로 넘기고 사주를 계산하는 처리」 · 「보관하지 않습니다. 런타임 로그만 1시간」 | 「풀이 글과 점수, 첫 화면의 짧은 사주 문단 생성」 · 「회수용 보관 약 10분(첫 화면의 짧은 사주 문단은 회수용으로 보관하지 않습니다), 별도 오·남용 점검 기록 최대 30일」 | 채움 |
| 5 「개인정보의 이전을 거부하는 방법, 절차 및 거부의 효과」 | 효과 「거부하시면 서비스를 이용하실 수 없습니다」 — **방법 · 절차가 없었다 → 「거부하시려면 가입하지 않거나 계정 관리에서 탈퇴를 신청하시면 됩니다」를 더함** | 같은 줄 | 같은 줄 + 첫 갈래는 「원하지 않으시면 넣지 않으시면 됩니다. 넣지 않으셔도 가입과 그 밖의 이용에는 영향이 없습니다」 | 방법 · 절차 빠짐 → 채움. 첫 갈래는 채움 |

**Supabase 의 명칭과 국가 — 확인 전, 어긋날 수 있다.** 처리방침은 v1 부터 「Supabase, Inc.(미국)」이다. Supabase 의 공식 문서는 다른 법인을
든다 — 처리방침(https://supabase.com/privacy, 날짜 표기 없음, 2026-10-15 열람) 「Thank you for your interest in Supabase Pte. Ltd.」 · 고객 자료는
「We use such Customer Data primarily as a processor」, 데이터 처리 부속서(https://supabase.com/legal/dpa, 「Version 1」 2026-08-01, 2026-10-15
열람)의 당사자 「Supabase Pte. Ltd」 · 수입자 주소 「65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513」 · 연락처 privacy@supabase.io.
우리 계정이 어느 법인과 맺어졌는지(가입한 때의 약관)를 운영자가 확인하기 전에는 명칭 · 국가를 고치지 않는다. 연락처는 처리방침의 「Contact
Us」 값(privacy@supabase.com)을 실었다.

**Vercel 의 연락처** — https://vercel.com/legal/privacy-policy (「Last Updated June 1, 2026」, 2026-10-15 열람): 「privacy@vercel.com」 · 「440 N
Barranca Avenue #4133」 「Covina, CA 91723」 「United States」, 법인 「Vercel Inc.」.

**OpenAI** — `openai.com/policies/*` 가 이 기계의 요청에 403 이다(2026-10-15, 브라우저 머리를 달아도 같다). 연락처는 확인 전이다. 보유기간의
두 값은 개발자 문서에서 다시 쟀다(https://developers.openai.com/api/docs/guides/your-data, 2026-10-15): 「Background mode stores response data to
disk for roughly 10 minutes to enable polling.」 · 「abuse monitoring logs are generated for all API feature usage and retained for up to 30 days」.

### 제30조 ① — 첫 화면 처리에 대해

이 판(시행 2026. 9. 11.)의 호 번호다 — 1 목적 · 2 처리 및 보유 기간 · 3의2 파기 · 4 위탁 · 5 권리 · 6 보호책임자 · 7 자동 수집 장치. 조율자
메모의 번호(4 · 6 · 9 · 10)는 이 판에 없다.

| 항목(조문 원문) | v8 의 문장(첫 갈래) | 상태 |
| --- | --- | --- |
| 1 「개인정보의 처리 목적」 | 「로그인하지 않고 첫 화면에서 사주를 보실 때 받은 입력은 계산하고 짧은 사주 문단을 쓰는 데만 쓰고 저장하지 않습니다.」 | 채움 |
| 2 「개인정보의 처리 및 보유 기간」 | 「…만든 때부터 24시간 뒤 지웁니다」 · 「…계정의 풀이 기록으로 남고 탈퇴하실 때 지웁니다」 · 「쿠키는 7일 뒤 사라지며」 | 채움 |
| 3의2 「개인정보의 파기절차 및 파기방법」 | 시점은 위 2. 절차 · 방법은 「파기 절차와 방법」 절의 일반 줄(「전자적 파일은 데이터베이스에서 삭제하며, 복구할 수 없습니다」)이 덮는다 | 채움(일반 절) |
| 4 「개인정보처리의 위탁에 관한 사항」 | v7 「풀이 생성은 OpenAI 에 맡깁니다」 — 첫 화면 문단은 풀이가 아니다(`docs/context/evidence.md:49-51`) → **「풀이와 첫 화면의 짧은 사주 문단 생성은 OpenAI 에 맡깁니다」로 고침** | 빠짐 → 채움 |
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
(아래 3). 이름 · 사이와 닉네임은 적는다.

- 성별 · 시간 앎은 입력값이라 「여덟 글자에서 나온 사실」로 보기 어렵다. 모델에 가는 자료(`RedactedChartEvidence`)는 `meta` 에서
  `inputTime` · `resolvedTime` · `instant` · `corrections` · `totalCorrectionMinutes` 만 자른다(`src/lib/saju/evidence/redacted.ts:65-69`) —
  `meta.gender` · `meta.hourKnown`(`src/lib/saju/index.ts:147` · `:149`)은 남아 본 풀이와 첫 화면의 문단(`src/lib/reading/taste-run.ts:86`) 모두에 간다.
- **이름은 궁합의 갈래마다 다르다.** 프롬프트는 두 사람을 부르는 이름과 사이를 싣는다(`src/lib/reading/prompt.ts:1322` `namingBlock` ·
  `:1365` `relationOf`, 차려지는 자리 `:1529-1531`). 그 값은 DB 가 짓는다(`supabase/migrations/20260925090000_the_job_is_frozen_when_the_attempt_opens.sql:186-230`) —
  인연 궁합(`match`)은 두 사람의 `app_user.nickname`, 사이는 없음(`'relation', null`). 직접 고른 궁합(`private`)은 등록할 때 붙인
  `user_person_access.local_label` 과 고른 사이(`pair_relation`). 사주풀이(`self` · `person`)는 이름을 프롬프트에 싣지 않는다 — `namingBlock` 은
  궁합 절에만 선다(`:1487`). v7 은 이것을 적지 않았다 — 공개 출시판 초안 「부록 A 어긋남 1」이 이미 든 사실이다. 「무엇을 받고」에
  닉네임 · 붙인 이름 줄이 없어 함께 더했다.

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
| 「풀이를 만들 때 밖으로 나가는 것」 — 첫 화면 문단도 OpenAI 가 씀 · 「계산된 명식과 태어난 해 · 나이 · 성별 등 분석 정보」 · 궁합의 이름과 사이 · 인연 궁합은 해 · 나이 · 성별을 빼고 닉네임 · 첫 화면 문단은 해 · 나이를 뺌 | 위 「판단 셋」의 2 · 3 | 제30조 ① 1 · 4 |
| 「무엇을 받고」 — 닉네임과 등록할 때 붙인 이름(새 줄) | 위 「판단 셋」의 2 | 제30조 ① 1 |
| 같은 절 — 첫 화면 문단의 거부 방법과 효과: 넣지 않으면 일어나지 않고, 가입 · 그 밖의 이용에 영향 없음 | 로그인한 사람은 그 문단을 받지 않는다(`app/taste/taste-run.ts:130` `if (await hands.member()) return TASTE_CLOSED`) — 가입 뒤의 길과 무관하다 | 제28조의8 ② 5 꼴 |
| 「국외로 나가는 것」 — OpenAI 의 「언제」 · 「목적」 · 「보유기간」 | 위 「판단 셋」. 「회수용 보관 약 10분 · 오·남용 점검 기록 최대 30일」은 v7 의 문장 그대로이고 이 판에서 다시 재지 않았다(출처는 초안 「부록 A」) | 제28조의8 ② 1~4 |
| 같은 절 — Vercel · Supabase 의 항목에 첫 화면 입력 · 임시 기록 | Vercel 함수가 첫 화면 입력을 받아 계산한다(서버 액션), Supabase 가 임시 기록을 든다 | 제28조의8 ② 1 |

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
