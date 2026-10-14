# 처리방침의 근거 — 줄마다 조문 · 코드 · 출처

> **법률 자문이 아니다. 변호사 검토 전의 근거 모음이다.** 처리방침의 줄마다 무엇을 근거로 적었는지 — 조문 원문 · 코드의 자리 ·
> 받는 회사의 공식 문서 · 참고한 다른 서비스 — 를 한 곳에 모은다. 「표에 적었으니 적법하다」는 뜻이 아니다. 법적 판단은 변호사가
> 하고, 묻고 싶을 때 묻는 선택 검토로 남는다(`docs/legal/counsel-request.md` 「B-9」, ADR 0180).

화면의 처리방침 원문은 `src/lib/consent/notice.ts` 의 `noticeFor` · `TRANSFERS` 이고 `/privacy` 가 그대로 그린다. 이 문서는
**`notice-v8`**(G-66 · G-71 을 묶은 내용 개정, ADR 0180)이 더한 줄을 든다 — 그 앞 판의 줄은 `docs/legal/privacy-v8-draft.md` 「부록 A」가
출처를 든다. 처리방침 문장을 바꾸는 PR 은 이 문서의 그 줄도 같은 PR 에서 고친다(ADR 0180 의 7).

**「확인 전」** 은 공식 문서에서 찾지 못한 값이다 — 지어 쓰지 않았다. 찾은 날 그 칸을 채우고 출처를 단다.

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

**다시 확인받기는 법 의무로 적지 않았다.** 내용 개정 때 확인한 사람을 다시 부르는 것(`NOTICE_ACK_FLOOR`, ADR 0095)은 우리
정책이다 — 제30조 ② 가 요구하는 것은 「공개」다. 그 확인이나 브라우저의 알림 허용을 국외 이전의 동의로 쓰지 않는다(ADR 0180).

## 판단 둘 — 무엇을 왜 적나 (운영자 2026-10-15)

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

### 2. OpenAI 로 가는 항목에 성별 · 시간 앎을 따로 적는다

- 둘은 입력값이라 「여덟 글자에서 나온 사실」로 보기 어렵다. 모델에 가는 자료(`RedactedChartEvidence`)는 `meta` 에서
  `inputTime` · `resolvedTime` · `instant` · `corrections` · `totalCorrectionMinutes` 만 자른다(`src/lib/saju/evidence/redacted.ts:65-69`) —
  `meta.gender` · `meta.hourKnown`(`src/lib/saju/index.ts:147` · `:149`)은 남아 본 풀이와 첫 화면의 문단(`src/lib/reading/taste-run.ts:86`) 모두에 간다.
- 궁합풀이는 두 사람을 부르는 이름과 고른 사이를 프롬프트에 싣는다(`src/lib/reading/prompt.ts:1322` `namingBlock` · `:1365`
  `relationOf`, 차려지는 자리 `:1529-1531`). v7 은 이것을 적지 않았다 — 공개 출시판 초안 「부록 A 어긋남 1」이 이미 든 사실이다.
- **고친 것 하나** — 공개 출시판 초안(`docs/legal/privacy-v8-draft.md`) 4절 표가 「보내지 않는 것」에 성별을 적었다. 위 코드와 어긋나
  「보내는 것」으로 옮겼다(2026-10-15).

## 줄마다 — `notice-v8` 이 더하거나 고친 것

| 처리방침의 줄(`src/lib/consent/notice.ts`) | 사실의 출처(코드) | 조문 |
| --- | --- | --- |
| 「무엇을 받고」 — 생년월일시 줄: 저장은 내 사주 · 사람 저장 · 궁합 열기 때, 첫 화면 입력은 계산과 문단에만 쓰고 저장 안 함 | 저장은 누름이다 — 「저장하고 계속하기」(`app/save-for-reading.tsx`), 궁합 열기는 두 사람을 대상으로 남긴다(`app/compat-picker.tsx:172` `openPairScreen` → `/me/compat?a=…&b=…`). 첫 화면 입력은 주소 `#` 뒤 모양 그대로(`app/taste/taste.tsx:67`)로 서버에 가고 `sajuOfDraft`(`app/taste/taste-run.ts:107`)가 계산만 한다 — DB 에 원문 칸이 없다(ADR 0143 의 6). 회원의 `/saju` 계산은 브라우저에서 한다(`app/saju-calculator.tsx:266`) | 제30조 ① 1 |
| 「무엇을 받고」 — 새 메시지 알림의 구독 주소와 암호화 열쇠(운영자 확정 문구 2026-10-10) | 구독은 끄기 · 로그아웃 · 404/410 · 계정의 10개 초과 · 탈퇴 때 지운다(ADR 0156 「보존」) | 제30조 ① 1 · 2 |
| 「언제까지 두나요」 — 첫 화면 기록 24시간, 5분마다 정리 | 세션 · artifact `expires_at = now() + 24 hours`, 정리는 `status <> 'claimed'` 인 세션 · 만료된 artifact · 24시간 지난 한도 사건(`supabase/migrations/20261118090000_…sql:163` · `:199` · `:1090` · `:1095`), 크론 `taste-sweep` `1-59/5 * * * *`(같은 파일 `:1151`). 「24시간 뒤 즉시」가 아니다 — 정리 주기만큼 늦을 수 있다 | 제30조 ① 2 · 3의2 |
| 같은 절 — 기록의 항목: 브라우저 · IP 를 알아보는 값(서버 비밀의 HMAC), 사주를 가리키는 요약값, 만든 문단 | `app/taste/taste-visitor.ts:61` `browserHmacOf` · `:71` `ipHmacOf`(날짜별 키), 지문(SHA-256, `src/lib/reading/taste-run.ts` `tasteFingerprintSourceOf`), 세션의 `preview_markdown` 사본(`…sql:191`) | 제30조 ① 1 · 2 |
| 같은 절 — 가입해 이어 받으면 계정의 풀이 자료로, 탈퇴 때 지움 | `claimed_by … on delete cascade`(`…sql:200`), 단계 표도 세션을 따라 지워진다(`supabase/migrations/20261119090000_…sql:28`) | 제30조 ① 2 |
| 같은 절 — 쿠키 7일 | `app/taste/taste-visitor.ts:48` `BROWSER_COOKIE_DAYS` · `:51` `CLAIM_COOKIE_DAYS`, `maxAge` `:116` · `:144`. httpOnly | 제30조 ① 7 |
| 「풀이를 만들 때 밖으로 나가는 것」 — 첫 화면 문단도 OpenAI 가 씀 · 보내는 것에 성별 · 시간 앎 · 궁합의 이름과 사이 | 위 「판단 둘」 | 제30조 ① 1 · 4 |
| 같은 절 — 여덟 글자로 날짜와 2시간 범위를 거꾸로 찾을 수 있음 | ADR 0143 의 6 「잠그지 않는 사실 둘」 · G-66 기록 「숨기지 않을 사실」 | — (사실의 공개) |
| 같은 절 — 첫 화면 문단의 거부 방법과 효과: 넣지 않으면 일어나지 않고, 가입 · 그 밖의 이용에 영향 없음 | 로그인한 사람은 그 문단을 받지 않는다(`app/taste/taste-run.ts:130` `if (await hands.member()) return TASTE_CLOSED`) — 가입 뒤의 길과 무관하다 | 제28조의8 ② 5 꼴 |
| 「맡겨서 처리하는 곳」 — 알림 전달은 브라우저를 만든 회사의 푸시 서비스 | 받는 푸시 서비스 넷(`src/lib/push/index.ts:197-206`, DB 도 같은 표 `supabase/migrations/20261121090000_…sql:89-92`) | 제30조 ① 4 |
| 「국외로 나가는 것」 — OpenAI 의 「언제」 · 「목적」 · 「보유기간」 | 위 「판단 둘」. 「회수용 보관 약 10분 · 오·남용 점검 기록 최대 30일」은 v7 의 문장 그대로이고 이 판에서 다시 재지 않았다(출처는 초안 「부록 A」) | 제28조의8 ② 1~4 |
| 같은 절 — Vercel · Supabase 의 항목에 첫 화면 입력 · 임시 기록 · 구독 | Vercel 함수가 첫 화면 입력을 받아 계산한다(서버 액션), Supabase 가 임시 기록과 구독을 든다 | 제28조의8 ② 1 |
| 같은 절 — 푸시 회사 넷의 줄 | 아래 「푸시 회사 넷」 | 제28조의8 ② 1~4 |
| 같은 절 — 거부: 세 곳은 필수, 푸시 넷은 알림을 켤 때만 · 끄면 안 나가고 메시지는 앱 안에서 그대로 | 알림은 기본 꺼짐이고 켜는 것은 사람이다(ADR 0156). 끄는 자리는 계정 관리(`app/me/settings/page.tsx:25`) | 제28조의8 ② 5 |

## 푸시 회사 넷 — 실제로 나가는 것

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
| 받는 법인 | Google LLC. 「Google LLC의 privacy team」, 국내대리인 「구글코리아 유한회사」 — https://policies.google.com/privacy/additional?hl=ko&gl=kr | 「Mozilla Corporation」 — https://www.mozilla.org/en-US/privacy/firefox/ | 「Microsoft Corporation」(EEA · 영국 · 스위스는 Microsoft Ireland Operations Limited) — https://www.microsoft.com/ko-kr/privacy/privacystatement | 한국 보충 고지의 이전 표에 「Apple Inc. … 미국」, 근거 「개인정보 보호법 제28조의8 제1항 제3호 (위탁)」 — https://www.apple.com/kr/legal/privacy/kr/ |
| 연락처 | 「이메일: googlekrsupport@google.com」, 국내대리인 「data-access-requests@google.com」 · 02-722-7778(같은 곳) | 「compliance@mozilla.com」, Data Subject Access Request Portal(같은 곳). 한국 창구 확인 전 | 개인정보 보호 팀 문의 양식(같은 곳). 주소 「One Microsoft Way, Redmond, Washington 98052, USA」. 한국 창구 확인 전(바닥글의 한국마이크로소프트 연락처는 개인정보 창구가 아니다) | 「개인정보 보호 팀 전화번호: +82 02 6712 6700 웹사이트: apple.com/kr/privacy/contact」(같은 곳) |
| 처리 국가 | FCM 은 「global service」 — 「any of the Google Cloud Platform locations or Google data center locations」(https://firebase.google.com/support/privacy). 한국 고지는 「국외에 소재하는 Google의 데이터 센터」 — **나라 이름은 확인 전** | 「Mozilla (and our servers) are based in the United States.」 | 회사 전체로 「일반적으로 주요 저장소 위치는 사용자의 지역 또는 미국」. **푸시 서비스의 처리 국가는 확인 전** | 「일반적으로 미국의 Apple Inc.에 저장됩니다」 |
| 알림의 보관 | 「the maximum period of time that FCM stores and attempts to deliver the message」 = 보낸 쪽이 정한 TTL(최대 28일) — https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan. 우리는 1시간 | **확인 전**(공식 문서 없음. 소스 코드의 최대 TTL 30일과 지원 문서의 검색 요약만 있다 — 인용하지 않는다) | **확인 전**(WNS 문서는 Windows 앱의 캐시만 말한다) | 「it may store the notification for 30 days or fewer, depending on the value you specify … removes the notification from storage permanently」 — 위 Apple 웹 푸시 문서. 우리는 1시간 |
| 그 밖의 기록 · 보유기간 | 확인 전 | 확인 전 | 확인 전 | 확인 전 |
| 사이트 운영자에게 걸리는 약관 | 확인 전(Firebase 를 쓰지 않고 브라우저 구독 주소로만 보내는 경우의 약관은 문서에 없다) | 확인 전 | 확인 전 | 「You don't need to join the Apple Developer Program to send web push notifications.」 운영자 약관은 확인 전 |
| 그 회사가 보는 것 | 확인 전 | 저장 칸 「data Payload … headers … ttl … timestamp」, `Topic` 은 「replace previously sent, unreceived subscription updates」 — https://mozilla-services.github.io/autopush-rs/architecture.html · http.html | 확인 전 | TTL · Authorization(VAPID) · Content-Encoding · Topic · Urgency 머리를 읽는다, 페이로드는 서버가 암호화 — Apple 웹 푸시 문서 |

**Microsoft 는 한 칸 더 확인 전이다** — Edge 의 웹 푸시가 `*.notify.windows.com`(WNS)으로 간다는 것을 Microsoft 의 공식 문서에서
찾지 못했다. Edge 의 웹 푸시 안내(https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/push)는 WNS 를 말하지
않는다. 그 호스트는 ADR 0156 이 실제 구독 주소를 보고 표에 넣었다(`src/lib/push/index.ts:199`).

**처리방침에 쓴 값** — 위 표에서 확인한 것만이다. 처리 국가는 Google · Microsoft 를 「미국 등 그 회사의 데이터 센터가 있는 국가」로,
Mozilla · Apple 을 「미국」으로 적었다. 보유기간은 넷 모두 「기기에 전달될 때까지, 길어야 1시간만 보관하도록 요청합니다. 그 밖에
회사가 남기는 기록은 위 회사의 처리방침을 따릅니다」 — 우리가 아는 것은 요청뿐이라서다.

## 참고한 다른 서비스 (2026-10-15 에 열어 봤다 — 근거가 아니라 견줄 거리다)

- **MT**(https://www.heremt.com/legal/privacy/, 시행 2026-10-13) 8절 — 푸시 줄 「Google LLC ( googlekorea@google.com ) 미국 … 푸시 알림
  식별자 … 서비스 이용 시점에 네트워크를 통해 전송 … 푸시 알림 발송 … 위탁 목적 달성 시까지」, 근거 「「개인정보 보호법」 제28조의8
  제1항 제3호」, 거부 「푸시 알림 식별자 이전은 기기의 알림 권한을 해제하여 거부할 수 있습니다. 거부하시면 알림을 받을 수 없습니다.」
  Google 한 곳만 든다(앱이라서다). 연락처가 Google 한국 고지의 주소(googlekrsupport@google.com)와 다르다.
- **SAZU**(https://www.sazu.app/privacy, v2026.10.09) — 제1 · 6 · 7조에 푸시가 없다. 제7조는 받는 곳을 나라로만 든다(예: 「Google(미국):
  AI 분석(Gemini), 광고(AdMob), 분석(GA4)」 · 「Supabase(한국/미국/EU)」) — 연락처 · 보유기간이 없다.

## 열린 것

- 위 「확인 전」 칸 — 채워지기 전에는 웹 푸시를 켜지 않는다(ADR 0180 의 5 · G-71).
- 변호사에게 묻는다면 — `docs/legal/counsel-request.md` 「B-9」(선택 검토).
