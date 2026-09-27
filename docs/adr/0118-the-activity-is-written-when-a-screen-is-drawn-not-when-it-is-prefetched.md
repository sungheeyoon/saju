# 활동은 화면이 그려질 때 적고, 미리 받기는 적지 않는다

> **섰다**(2026-09-27). 운영자 결정 — 미리 받기가 활동으로 적히는 버그를 고친다. ADR 0092 의 「적는 자리는 `proxy.ts` 하나」를
> 고친다(1분 억제 · 구간 · 표는 그대로). PRD §7.2 「브라우저의 prefetch 는 활동이 아니다」를 코드가 처음으로 지킨다.

## 잰 것 (2026-09-27, Next 16.3.6)

- **관문은 미리 받기를 못 가른다.** `server/web/adapter.js` 가 관문에 넘기기 전에 `FLIGHT_HEADERS`
  (`rsc` · `next-router-state-tree` · `next-router-prefetch` · `next-hmr-refresh` · `next-router-segment-prefetch`)를 지우고
  `_rsc` 도 걷는다. 문서가 같은 말을 한다(`03-file-conventions/proxy.md` 「During RSC requests, Next.js strips internal Flight
  headers」). 남는 머리(`sec-fetch-*` · `accept`)는 미리 받기와 앱 안 이동이 같다 — 둘 다 `fetch` 다. `purpose` · `sec-purpose` 는
  Next 의 미리 받기가 안 싣는다(`client/components/segment-cache/cache.js` 가 붙이는 것은 `RSC` · `Next-Router-Prefetch` ·
  `Next-Router-Segment-Prefetch` · `Next-Url` 뿐). 그래서 `proxy.ts` 의 가름은 **한 번도 안 걸렸다.**
- 들어오는 요청을 날것으로 찍으니(ADR 0117 의 방법), 홈에서 탭 넷을 두 바퀴 누르는 동안 계정마다 미리 받기가 **열일곱 번**
  갔고(탭 넷 · 사람 · 소식 · 내 풀이 · 저장한 사람 타일) 그 **모두**에서 `touch_activity` 가 불렸다. #284 의 뼈대 뒤로 탭이
  화면에 들기만 해도 미리 받기가 간다 — 누르지 않아도 「지금 활동 중」이 됐다.
- `skipProxyUrlNormalize` 를 켜면 관문이 그 머리를 본다. 안 골랐다 — 관문의 주소 · 되돌림 `Location` 정규화가 **전부** 바뀌는
  설정이고(문서: 「Most projects don't need this option」), 가르는 표식이 Next 내부의 머리다. 그리고 `prefetch={true}`(Full)
  미리 받기는 `Next-Router-Prefetch` 를 **안 싣는다**(`cache.js` 의 `FetchStrategy.Full`) — 지금은 쓰는 자리가 없지만, 누가 쓰는
  순간 조용히 다시 샌다.

## 정한 것

**화면을 여는 것(GET)은 그 화면이 그려질 때 적는다.** 로그인을 스스로 묻는 한 자리 `signedInUser`(ADR 0117)가 서명을 확인한 뒤
`touch_activity` 를 떠나보내고 `after` 로 끝까지 살린다 — 응답을 안 붙든다. 한 그림 안에서 레이아웃과 화면이 둘 다 부르면
React `cache` 로 한 번이다. 미리 받기는 화면을 그리지 않는다 — 뼈대가 있는 탭은 뼈대까지, 없는 화면은 관문만 돈다(ADR 0116).
그래서 이 자리에는 가를 것이 없고, Next 가 머리를 어떻게 다루든 안 흔들린다.

**서버 액션(POST)은 관문이 적는다.** 미리 받기는 언제나 GET 이라 GET 이 아닌 요청은 사람이 누른 것이다. 액션은 `signedInUser` 를
부르지 않는 것이 대부분이라 관문에 남긴다 — 메시지를 보내는 것도 활동이다(PRD §7.2).

## 잠그지 않은 것 · 대가

- **적는 자리가 둘이다**(관문의 POST · 화면의 GET). 한 자리로 모으려면 관문이 미리 받기를 가려야 하는데, 위의 까닭으로 못 한다.
- 로그인을 묻는 화면이 `signedInUser` 를 안 부르고 새로 서면 그 화면을 연 것은 활동이 아니다. 지금 matcher 안의 화면은 전부
  부른다(ADR 0117 의 스물둘).
- `signedInUser` 를 부르는 서버 액션(`passCandidate`)은 관문과 함께 두 번 부른다 — 1분 억제가 한 번만 적는다.
- e2e 「미리 받기는 활동이 아니고, 연 화면과 눌러서 간 화면은 활동이다」가 든다 — 활동을 한 시간 전으로 돌린 뒤 브라우저의 미리
  받기와 같은 머리의 요청 여덟을 같은 쿠키로 보내고 안 적힌 것을, 탭을 눌러 적힌 것을 본다. 개발 서버는 미리 받기를 안 하므로
  요청을 직접 보낸다. 관문에서 적던 코드로 되돌리면 붉다(확인했다).
