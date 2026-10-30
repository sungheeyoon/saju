# Expo 앱 첫 라운드 — 인계 (2026-10-30)

요구사항이 아니다. 앱을 이어 받는 세션이 먼저 읽는 사정이고, 남은 일의 원본은 `docs/product/gaps.md` 의 G-123 이다.

## 지금 있는 것

- `mobile/` — Expo SDK 58. 저장소 뿌리는 npm workspace 가 아니고, `mobile/metro.config.js` 가 `src/lib` · `app` 을 들여다본다.
  `apps/web` 꼴로 옮기지 않기로 했다 — 경로에 묶인 CI · 경계 시험 · 린트가 커서, 이득이 설정 몇 줄이다.
- 입력 · 만세력 결과(#882, #884) · 구글 로그인(#883). 계산 · 입력 규칙 · 표의 판단과 문단은 `src/lib` 를 웹과 함께 쓴다.
- 글꼴은 웹의 woff2 조각을 네이티브가 못 읽고 합쳐지지도 않아(CID CFF) 배포 압축의 M · B OTF 를 `mobile/assets/fonts/` 에 넣었다.
  판정은 운영자 몫이다(`docs/legal/font-grounds.md`).

## 운영자가 정한 것

- **입구** — 앱은 입력 화면으로 열리고 「사주 보기」가 구글 로그인 → 가입 → 결과로 간다. 비로그인 전용 결과는 없다. 다음 실행부터 홈.
- **차례** — 화면을 다 그린 뒤 붙이지 않고, 기능 하나가 실제로 돌게 하며 그 화면을 웹과 맞춘다. 기능 하나에 PR 하나.
- **이름** — 지금 결과는 「만세력 결과」다. 「사주풀이」는 모델이 쓰는 글이고 앱에 없다.
- 시험은 아이폰 Expo Go(화면) + PC 에뮬레이터(로그인). Apple Developer 는 iOS 출시 준비 때.

## 시험하는 법

- 운영자 폰은 **아이폰**이다 — APK 는 못 깐다. Expo Go 는 네이티브 구글 로그인이 없어 개발 환경에서는 로그인을 건너뛴다(`__DEV__`).
- WSL 이라 `mobile/` 에서 `npx expo start --tunnel`(Expo Go) · `npx expo start --dev-client --tunnel`(개발 빌드). 띄울 때마다 터널 주소가 바뀐다.
- 에뮬레이터: Windows Android Studio, API 37 Google Play 이미지, 앱 ID `com.mannalmap.app`, EAS 프로젝트 `@sungheeyoon/mannalmap`.
  로그는 Metro 로 안 왔다 — `adb.exe logcat`(Windows SDK 의 `platform-tools`)으로 읽는다.
- `mobile/.env.local` 은 git 에 없다. `.env.example` 을 보고 뿌리의 `.env.development.local` 공개 값으로 채운다.
  웹 클라이언트 ID 는 `<Supabase 주소>/auth/v1/authorize?provider=google` 의 리디렉션에서 읽힌다.
- 개발 빌드도 **운영 Supabase** 를 본다.

## 틀렸던 것 — 되풀이하지 않는다

- 운영 사이트 폼을 제출해 맛보기 모델 호출 한 건이 나갔다. 화면 캡처는 로컬 렌더로 하고, 운영 폼은 제출하지 않는다.
- 폰 기종을 묻지 않고 안드로이드부터 밟아 APK 를 아이폰에 받게 했다.
- Expo Go 에서 저장이 자동 반영 안 된 까닭은 못 가렸다 — 터널 연결인지 Fast Refresh 설정인지.
- 구글 로그인이 처음 던진 오류의 원인도 못 잡았다. 가상 폰의 구글 계정 설정을 끝낸 뒤 됐다.

## 운영에 남은 것

- 위 맛보기 호출의 임시 기록, 에뮬레이터 로그인으로 생겼을 수 있는 가입 전 계정 하나. 운영 DB 를 안 읽어 확인하지 않았다.
- #882 · #884 는 웹 import 를 옮겼다 — 다음 묶음 배포 뒤 웹 결과 화면을 본다.
