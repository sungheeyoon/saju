# Expo 앱 라운드 — 인계 (2026-10-30)

요구사항이 아니다. 앱을 이어 받는 세션이 먼저 읽는 사정이고, 남은 일의 원본은 `docs/product/gaps.md` 의 G-123 이다.
아래 「지금 있는 것」은 main 의 사실이다. 손대기 전에 `gh pr list` 로 열린 PR 을 본다 — 같은 화면을 다시 짓지 않게.

## 지금 있는 것

- `mobile/` — Expo SDK 58. 저장소 뿌리는 npm workspace 가 아니고, `mobile/metro.config.js` 가 `src/lib` · `app` 을 들여다본다(`app` 은 `db-error.ts` 때문).
  `apps/web` 꼴로 옮기지 않기로 했다 — 경로에 묶인 CI · 경계 시험 · 린트가 커서, 이득이 설정 몇 줄이다.
- 라우트는 `mobile/src/app/` 에 있다. 표는 아래 「화면을 옮기는 차례」.
- 판정 · 글자 · 표의 문단은 `src/lib` 를 웹과 함께 쓴다. 앱 글자가 웹과 같은지는 `scripts/mobile-*-copy.test.ts` 가 잰다.
- 앱이 쿠키 · 서버 액션을 못 쓰는 자리는 토큰을 묻는 `app/api/mobile/` 문을 지난다(ADR 0211). 나머지는 그 사람의 JWT 로 DB 함수를 바로 부른다.
- 사진 올리기는 스위치가 `db` 인 동안만 앱에서 된다. `s3` 면 올리는 자리가 안 선다(`mobile/src/settings/photos.ts`).
- 가입 — 웹과 같은 한 폼이고 판정 · 글자는 `src/lib/consent/signup.ts` 를 함께 쓴다. 처리방침은 `EXPO_PUBLIC_SITE_URL` 로 웹을 열고, 값이 없는 빌드에는 그 링크가 안 선다.
- 글꼴은 웹의 woff2 조각을 네이티브가 못 읽고 합쳐지지도 않아(CID CFF) 배포 압축의 M · B OTF 를 `mobile/assets/fonts/` 에 넣었다.
  판정은 운영자 몫이다(`docs/legal/font-grounds.md`).

## 운영자가 정한 것

- **입구** — 앱은 입력 화면으로 열리고 「사주 보기」가 구글 로그인 → 가입 → 결과로 간다. 비로그인 전용 결과는 없다. 다음 실행부터 홈. 2026-10-30 에 다시 답했다 — 입력 화면 그대로.
- **차례** — 화면을 다 그린 뒤 붙이지 않고, 기능 하나가 실제로 돌게 하며 그 화면을 웹과 맞춘다. 기능 하나에 PR 하나.
- **이름** — 지금 결과는 「만세력 결과」다. 「사주풀이」는 모델이 쓰는 글이다.
- 시험은 아이폰 Expo Go(화면) + PC 에뮬레이터(로그인). Apple Developer 는 iOS 출시 준비 때.

2026-10-30 의 답:

- **「모든 페이지 남김없이」** — 안내 화면도 앱 네이티브로 옮긴다. 옛 판단 「웹을 연다」는 뒤집혔다.
- **운영자 화면 `/ops/*` 는 앱에 안 연다** — #899 를 닫았고 코드는 그 가지에 남아 있다.
- **앱용 문 ADR 0211 「이대로 진행」, 사진 올리기 문 「연다」.**
- **공유본** — 앱 라우트는 있으나 링크는 웹으로 연다. 앱 열기는 스토어 출시 때.
- **구매** — 앱에는 없다(PG 미정).
- **제외** — `/taste` · `/me/credits/done` · `/me/reading/inspect` · 웹 푸시(G-71 보류).

## 시험하는 법

- 운영자 폰은 **아이폰**이다 — APK 는 못 깐다. Expo Go 는 네이티브 구글 로그인이 없어 개발 환경에서는 로그인을 건너뛴다(`__DEV__`).
- WSL 이라 `mobile/` 에서 `npx expo start --tunnel`(Expo Go) · `npx expo start --dev-client --tunnel`(개발 빌드). 띄울 때마다 터널 주소가 바뀐다.
- 에뮬레이터: Windows Android Studio, API 37 Google Play 이미지, 앱 ID `com.mannalmap.app`, EAS 프로젝트 `@sungheeyoon/mannalmap`.
  로그는 Metro 로 안 왔다 — `adb.exe logcat`(Windows SDK 의 `platform-tools`)으로 읽는다.
- `mobile/.env.local` 은 git 에 없다. `.env.example` 을 보고 뿌리의 `.env.development.local` 공개 값으로 채운다.
  웹 클라이언트 ID 는 `<Supabase 주소>/auth/v1/authorize?provider=google` 의 리디렉션에서 읽힌다.
- **EAS 빌드는 `.env.local` 을 못 본다** — 같은 값을 `npx eas-cli@latest env:create` 로 그 프로필의 environment(`development` · `production`)에 넣는다.
- **네이티브 모듈을 더한 PR 뒤에는 개발 빌드를 다시 굽는다** — `npx eas-cli@latest build --profile development --platform android`. 옛 빌드에는 그 모듈이 없다.
- 개발 빌드도 **운영 Supabase** 를 본다.
- Expo Go 에서 가입 화면만 보려면 터널 주소 뒤에 `/--/signup` 을 붙여 연다 — 세션이 없으면 처음 가입하는 폼이 선다(`__DEV__`). 제출은 세션이 없어 거절된다.
- PC 에서 화면을 재는 법은 `docs/agents/delegation/local-env.md` 「앱을 웹 번들로 재기」. 운영 DB 를 안 밟는다.
- **검사는 `mobile/` 에서 `npx tsc --noEmit` · `npx expo lint`.** 뿌리의 린트 · CI 는 `mobile/` 의 린트를 안 돈다. #896 이 세울 때 오류 3 · 경고 2 가 있던 위반으로 남았다.
- **`.expo/types` 가 낡으면 `tsc` 가 새 라우트를 모른다** — 라우트 타입은 `expo start` 가 짓고 gitignore 다. 다시 띄우거나 `mobile/.expo/types` 를 걷고 다시 잰다.
- **Metro 가 낡은 번들을 준다** — `EXPO_PUBLIC_*` 는 번들에 박히고, 옮긴 `src/lib` 파일 · 새 `tsconfig` 경로도 옛 것을 들고 있을 수 있다. 고친 것이 안 보이면 `npx expo start --clear` 로 다시 띄운다.
- **가지를 임시로 합쳐 재면 rerere 가 그 해결을 기억한다** — `docs/agents/delegation/local-env.md` 「로컬 환경의 함정」.

## 화면을 옮기는 차례

앞줄의 값을 뒷줄이 쓰는 차례로 옮겼다. 큰 차례의 원본은 G-123 이다. 「있다」는 라우트가 main 에 있다는 뜻이고 실기기에서 본 것은 아니다.

| 차례 | 화면(웹 주소) | main 의 앱 |
| --- | --- | --- |
| 1 | 입력 · 만세력 결과 `/saju` · 가입 `/signup` · 홈 `/me` | 있다 |
| 2 | 풀이 요청 · 풀이 보기 `/me/readings` · `/me/readings/[subject]` | 있다(ADR 0211) |
| 3 | 저장한 사람 `/me/people` · `/me/people/[personId]` | 있다. 출생 정보 수정은 아직 없다 |
| 4 | 궁합 `/me/compat` · `/me/readings/compat` | `/me/compat` 만 있다. 궁합풀이는 아직 없다 |
| 5 | 프로필 · 설정 · 설문 `/me/profile` · `/me/settings` · `/me/survey` | 있다. 사진 올리기는 위 「지금 있는 것」 |
| 6 | 인연 `/me/discovery` · `/me/matching` · `/me/requests` · `/me/match/[matchId]` · `/me/matching/history` · `/me/readings/match/[matchId]` | 아직 없다 |
| 7 | 채팅 `/me/chat` · `/me/chat/[matchId]` | 있다 |
| 8 | 풀이권 `/me/credits` · `/me/credits/history` | 보기만 있다. 구매 없음(PG 미정) |
| 9 | 공유본 `/share/*` · 첫 화면 `/` | 있다. `/` 의 소개는 앱의 `/landing`, 링크는 웹으로 연다 |
| 10 | 안내 · 약관 `/about` · `/help` · `/privacy` · `/terms` · `/refund` · `/auth` · `/auth/denied` · `/closed` | 아직 없다 — 앱 네이티브로 옮긴다(운영자 2026-10-30) |
| 끼우지 않음 | 푸시 | G-71 이 `보류` 다 — 운영자가 다시 꺼낸다 |
| 옮기지 않음 | `/ops/*` · `/me/reading/inspect` · `/me/credits/done` · `/taste` | 운영자 결정 2026-10-30 |

`/compat` 은 따로 없다 — 앱의 `/landing` 「궁합 보기」가 로그인 뒤 `/me/compat` 으로 간다.

## 틀렸던 것 — 되풀이하지 않는다

- 운영 사이트 폼을 제출해 맛보기 모델 호출 한 건이 나갔다. 화면 캡처는 로컬 렌더로 하고, 운영 폼은 제출하지 않는다.
- 폰 기종을 묻지 않고 안드로이드부터 밟아 APK 를 아이폰에 받게 했다.
- Expo Go 에서 저장이 자동 반영 안 된 까닭은 못 가렸다 — 터널 연결인지 Fast Refresh 설정인지.
- 구글 로그인이 처음 던진 오류의 원인도 못 잡았다. 가상 폰의 구글 계정 설정을 끝낸 뒤 됐다.
- 「`.env.example` 을 보고」라고 적었는데 그 파일이 없었다 — 뿌리 `.gitignore` 의 `.env*` 가 막아 커밋되지 않았다. 가입 PR 에서 `mobile/.gitignore` 로 풀었다.
- 「`src/lib` · `app` 을 들여다본다」도 틀렸다 — 그때 설정에는 `src/lib` 뿐이었고, `app/` 은 가입 PR 이 `db-error.ts` 때문에 더했다.

## 운영에 남은 것

- 위 맛보기 호출의 임시 기록, 에뮬레이터 로그인으로 생겼을 수 있는 가입 전 계정 하나. 운영 DB 를 안 읽어 확인하지 않았다.
- 앱 라운드의 PR 들은 웹 import 를 옮겼다(#882 · #884 등) — 다음 묶음 배포 뒤 웹 결과 화면을 본다.
