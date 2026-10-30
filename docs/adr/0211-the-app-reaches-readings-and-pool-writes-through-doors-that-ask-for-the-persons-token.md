# 앱은 그 사람의 토큰을 묻는 `app/api/mobile` 문으로 풀이와 풀 쓰기에 닿고, 판정은 웹과 같은 것을 탄다

> **운영자 결정 2026-10-30**(조율자가 옮김) — 「이대로 진행」. 결정 점검표의 「누가 무엇을 할 수 있는가」(관문 밖의 새 문) · 「실패했을 때 열리는가 닫히는가」 ·
> 「비용」에 걸린 표에 답했다. 요청에 답하는 문은 그 답 뒤에 조율자가 같은 ADR 로 더했다 — 새 판정 · 새 호출은 없다.

## 무엇이 막혀 있었나

앱(`mobile/`)은 쿠키도 서버 액션도 없다. 지금 코드에서 앱이 직접 못 하는 일은 둘이다.

1. **풀이를 연다** — `generateReading` 은 서버 액션이고, 제출은 열쇠와 모델 호출이라 서버에서만 된다(`app/me/reading/pipeline.ts`).
2. **내 사주를 저장한다** — `create_self_person` 등 풀에 오르는 값의 문 넷은 `service_role` 에만 열려 있다(ADR 0136). 그 앞이 막혀 풀이의 대상도 못 세운다.

## 정한 것

### 문 — 전부 `Authorization: Bearer <Supabase access token>`

| 문 | 하는 일 | 웹의 짝 |
| --- | --- | --- |
| `POST /api/mobile/reading` | 시도를 연다 | `generateReading` |
| `GET /api/mobile/reading` · `/reading/run` · `/readings` | 풀이 칸 · 기다림 · 보관함을 읽는다. 모델을 안 부른다 | 화면의 읽기 · `readingRunState` |
| `POST /api/mobile/me/self-person` · `/me/person-input` | 내 사주 저장 · 입력 수정 | `saveSelfPerson` · `editPersonInput` |
| `POST` · `PUT /api/mobile/me/participation` | 참여 켜고 끄기 · 참여 열기 | `setDiscoveryParticipation` · `openDiscoveryParticipation` |
| `POST /api/mobile/matching/respond` | 받은 요청에 답하고, 수락이면 응답 뒤에 궁합풀이를 떠나보낸다 | `respondToRequest` |
| `GET /api/mobile/photo/{id}?n=&s=` | 사진 한 장을 읽는다. 올리기는 없다 | `/me/photo/{id}` · `/me/photo/{id}/{n}` |

대상은 `ReadingTarget` 네 갈래 그대로라 궁합 · 인연 궁합도 같은 문을 쓴다.

### 자격 — 관문이 쿠키로 하던 일을 토큰으로 그대로 (`app/api/mobile/session.ts`)

- 토큰은 **Auth 서버에 묻는다**(`getUser`) — 관문과 같은 문이다. 서명만 보면 끊긴 세션 · 지워진 계정을 못 알아챈다.
- 가입 · 안내 재확인 · 종료는 웹이 지나는 **`gateFor`** 에 같은 값을 넣는다.
- 정지 · 풀이권 · 중복 누름 · 대상 잠금은 새로 안 쓴다 — 그 사람의 JWT 로 `start_reading_run` 이 묻는다. 누름 열쇠는 앱이 누를 때 짓고, 없으면 400 이다.
- 풀 쓰기의 사람 id 는 **Auth 의 답**이고 본문에서 안 받는다. 여덟 글자 · 요약은 서버가 짓는다. 열쇠를 부르는 파일은 늘지 않았다(`KEY_HOLDERS` 그대로).

**참여 켜고 끄기는 웹의 `/me/settings` 와 같은 주소로 관문을 지난다** — 고지가 「설정에서 언제든 끌 수 있습니다」라고 약속했고, 베타 종료 뒤에도 철회를 여는 `gateFor` 의 예외를 그대로 탄다.

**궁합풀이 제출만 하는 문은 없다.** 열쇠가 여는 `match_run_awaiting_send` 는 요청 id 만 보고 사람을 안 본다. 그래서 그 사람의 JWT 로 `respond_to_match_request` 가 `accepted` 라고 답해야만 같은 요청에서 제출이 돈다 — 남의 요청 id 를 두드릴 길이 없다. 시도는 수락 트랜잭션이 이미 열었으므로 모델 호출의 수는 그대로다.

**사진 문만 가볍다.** 웹의 사진 주소처럼(ADR 0200) 장마다 Auth · 계정 · 일정을 묻지 않고, 토큰의 클라이언트로 같은 `photoResponse` 를 부른다. 상대 사진을 볼 자격 · 정지 · 종료는 `photo_at`(`may_see_photo`)이 그 사람으로 판정한다. 토큰이 없거나 거절되면 없는 사람과 같은 404 다.

### 실패하면 닫는다 — 웹과 다른 자리 하나

| 못 한 것 | 웹 | 앱의 문 |
| --- | --- | --- |
| Auth 가 토큰을 거절 | 로그인으로 | 401 |
| Auth 에 못 닿음 | 로그인 안 된 것으로 | 503 — 세션은 안 걷는다 |
| **계정을 못 읽음** | 관문은 지나가게 두고 화면이 실패를 말한다 | **503 — 문을 안 연다** |
| 일정을 못 읽음 | 가입을 마쳤으면 지나간다. 종료는 대부분 DB 가 막지만 `edit_person_input` 은 안 본다(`20261106090000`) | 같다 — 그 문의 틈도 웹과 같다 |

계정만 다른 것은 이 문 뒤에 실패를 말할 화면이 없고 곧바로 비용이 나가는 길이 있어서다.

### 비용 — 누름 하나에 시도 하나, 그대로

모델이 불리는 길은 `POST /api/mobile/reading` 하나이고 웹과 같은 몸통(`openAndSend`)이다. 읽는 문은 모델을 안 부른다. 앱의 기다림은 웹과 같은 `watchRun`(3초, 앱이 뒤로 가면 쉼)이다. 물음마다 Auth 한 번 · 계정 · 일정 · 시도를 읽는 것도 웹의 관문 + 액션과 같은 수다. 새 제공자 · 새 비밀은 없다. 상한도 웹과 같은 DB 의 것이다 — 한 사람 시간당 `reading_rate_limit`(20) · 서비스 하루 `reading_daily_budget`(500).

### 웹과 일부러 다른 것

- **맛보기 잇기가 없다.** 귀속 표는 브라우저의 쿠키이고 앱에는 로그인 전 사주 문단이 없다(입구 결정).
- **화면을 무르지 않는다.** 받는 쪽이 RSC 가 아니다. 끝난 것을 본 앱이 풀이 칸을 한 번 더 읽는다.
- **사진을 기기에 담지 않는다**(`mobile/src/ui/photo.tsx`, `expo-image` 의 `cachePolicy="none"`). 웹은 `private, no-cache` 와 판본으로 쓸 때마다 묻지만, 네이티브 이미지 캐시가 그 머리를 따른다고 믿을 수 없고 주소로 담으면 차단 · 계정 바꿈 뒤에도 얼굴이 남는다. 그래서 장마다 바이트를 다시 받는다. 기기에서 재지 못했다.
- **기다리는 물음은 활동으로 안 적는다.** 사람이 낸 요청이 아니다(ADR 0118).

## 코드의 모양

- `signedInUser` 는 관문 안에서만 돈다(`app/auth/signed-in.boundary.test.ts`). 그래서 쿠키에 묶인 일을 떼었다: 맛보기 잇기는 `app/me/reading/press.ts`, 쿠키의 사람은 `app/me/chart-writes.ts`. 시도의 몸통과 열쇠 문(`pipeline.ts` · `keyed-chart-writes.ts`)은 클라이언트 · 세션을 묻는 길(`ChartWriter`)을 받는다. 잠금은 약해지지 않았다.
- 읽기는 앱이 RPC 를 바로 안 부르고 문을 지난다. 근거 절을 자르는 경계(ADR 0008)가 서버에 남고, 웹의 어댑터를 한 벌로 쓴다.
- 앱과 함께 쓰는 판단은 `src/lib/reading/` 으로 내렸다(`reading-flow` · `outline` · `panel-chrome` · `watch-run` · `markdown-blocks` · `target` · `door`). 웹의 글자 · 동작은 그대로다.

## 받아들인 것

- 관문 밖 문이 는다. 함수마다 맨 먼저 자격을 묻는지, 누름의 문이 모델 상한만큼 사는지, 라우트가 열쇠를 직접 안 드는지를 `app/me/reading/boundary.test.ts` 가 잰다.
- 요청 수 제한을 따로 두지 않았다. 모델까지 가는 길은 `start_reading_run` 의 풀이권 · 대상 잠금이 웹과 같이 막는다.

## 추기 — 저장소에 사진 올리기 (2026-10-30)

> **결정 대기** — 결정 점검표의 「누가 무엇을 할 수 있는가」(관문 밖의 새 쓰는 문). 머지 전에 운영자가 답한다.

`GET` · `POST` · `PUT /api/mobile/me/photo` 를 더한다. 앱은 저장소 열쇠를 못 들어(`addStoredPhoto` · `replaceStoredPhoto` 가 서버 액션이다) `s3` 모드에서 사진을 못 올렸다.

- **자격** — `mobileSession` 을 웹의 `/me/profile` 과 같은 주소로 지난다. 사람은 토큰의 답이고 본문에서 안 받는다.
- **몸통은 하나다** — 웹의 액션과 같은 `stored-photo-writes.ts` · `storePhoto` 다. 두 벌 검사(`checkVariants`), 하루 한도 · 여섯 장(`begin_my_photo_upload` 등)은 그대로 그 사람의 JWT 로 DB 가 본다. 새 판정 · 새 열쇠 · 새 제공자는 없다.
- **`GET`** 은 화면이 보일 길(`photoUploadsOnScreen`)을 답한다. 이 배포의 저장소가 켜졌는지는 서버만 안다.
- **실패하면 닫는다** — 저장소가 꺼졌거나 못 썼으면 올리지 않고 웹과 같은 글자로 거절한다. 못 적은 표는 웹과 같이 지울 줄로 넘긴다.
- **읽기는 안 더했다** — `GET /api/mobile/photo/{id}` 가 웹과 같은 `photoResponse` 라 저장소에 사는 장도 이미 읽는다. 시험이 잰다.

받아들인 것: 요청 수 제한을 따로 두지 않는다. 한 번의 본문은 Vercel 함수 한도(4.5MB) 안이고, 쓰기 수는 DB 의 하루 올리기 한도가 막는다.
