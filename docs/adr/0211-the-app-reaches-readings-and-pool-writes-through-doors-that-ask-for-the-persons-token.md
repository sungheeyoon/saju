# 앱은 그 사람의 토큰을 묻는 `app/api/mobile` 문으로 풀이와 풀 쓰기에 닿고, 판정은 웹과 같은 것을 탄다

> **운영자 답을 기다린다.** 결정 점검표의 「누가 무엇을 할 수 있는가」(관문 밖의 새 문) · 「실패했을 때 열리는가 닫히는가」에 걸린다.
> 「비용」은 호출의 수가 늘지 않는다고 적었고 그 판단도 함께 묻는다. 앱용 API 를 낸다는 방향 자체는 G-123 이 정했다.

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

대상은 `ReadingTarget` 네 갈래 그대로라 궁합 · 인연 궁합도 같은 문을 쓴다.

### 자격 — 관문이 쿠키로 하던 일을 토큰으로 그대로 (`app/api/mobile/session.ts`)

- 토큰은 **Auth 서버에 묻는다**(`getUser`) — 관문과 같은 문이다. 서명만 보면 끊긴 세션 · 지워진 계정을 못 알아챈다.
- 가입 · 안내 재확인 · 종료는 웹이 지나는 **`gateFor`** 에 같은 값을 넣는다.
- 정지 · 풀이권 · 중복 누름 · 대상 잠금은 새로 안 쓴다 — 그 사람의 JWT 로 `start_reading_run` 이 묻는다. 누름 열쇠는 앱이 누를 때 짓고, 없으면 400 이다.
- 풀 쓰기의 사람 id 는 **Auth 의 답**이고 본문에서 안 받는다. 여덟 글자 · 요약은 서버가 짓는다. 열쇠를 부르는 파일은 늘지 않았다(`KEY_HOLDERS` 그대로).

### 실패하면 닫는다 — 웹과 다른 자리 하나

| 못 한 것 | 웹 | 앱의 문 |
| --- | --- | --- |
| Auth 가 토큰을 거절 | 로그인으로 | 401 |
| Auth 에 못 닿음 | 로그인 안 된 것으로 | 503 — 세션은 안 걷는다 |
| **계정을 못 읽음** | 관문은 지나가게 두고 화면이 실패를 말한다 | **503 — 문을 안 연다** |
| 일정을 못 읽음 | 가입을 마쳤으면 지나간다(종료는 DB 가 막는다) | 같다 |

계정만 다른 것은 이 문 뒤에 실패를 말할 화면이 없고 곧바로 비용이 나가는 길이 있어서다.

### 비용 — 누름 하나에 시도 하나, 그대로

모델이 불리는 길은 `POST /api/mobile/reading` 하나이고 웹과 같은 몸통(`openAndSend`)이다. 읽는 문은 모델을 안 부른다. 앱의 기다림은 웹과 같은 `watchRun`(3초, 앱이 뒤로 가면 쉼)이다. 물음마다 Auth 한 번 · 계정 · 일정 · 시도를 읽는 것도 웹의 관문 + 액션과 같은 수다. 새 제공자 · 새 비밀은 없다.

### 웹과 일부러 다른 것

- **맛보기 잇기가 없다.** 귀속 표는 브라우저의 쿠키이고 앱에는 로그인 전 사주 문단이 없다(입구 결정).
- **화면을 무르지 않는다.** 받는 쪽이 RSC 가 아니다. 끝난 것을 본 앱이 풀이 칸을 한 번 더 읽는다.
- **기다리는 물음은 활동으로 안 적는다.** 사람이 낸 요청이 아니다(ADR 0118).

## 코드의 모양

- `signedInUser` 는 관문 안에서만 돈다(`app/auth/signed-in.boundary.test.ts`). 그래서 쿠키에 묶인 일을 떼었다: 맛보기 잇기는 `app/me/reading/press.ts`, 쿠키의 사람은 `app/me/chart-writes.ts`. 시도의 몸통과 열쇠 문(`pipeline.ts` · `keyed-chart-writes.ts`)은 클라이언트 · 세션을 묻는 길(`ChartWriter`)을 받는다. 잠금은 약해지지 않았다.
- 읽기는 앱이 RPC 를 바로 안 부르고 문을 지난다. 근거 절을 자르는 경계(ADR 0008)가 서버에 남고, 웹의 어댑터를 한 벌로 쓴다.
- 앱과 함께 쓰는 판단은 `src/lib/reading/` 으로 내렸다(`reading-flow` · `outline` · `panel-chrome` · `watch-run` · `markdown-blocks` · `target` · `door`). 웹의 글자 · 동작은 그대로다.

## 받아들인 것

- 관문 밖 문이 는다. 함수마다 맨 먼저 자격을 묻는지, 누름의 문이 모델 상한만큼 사는지, 라우트가 열쇠를 직접 안 드는지를 `app/me/reading/boundary.test.ts` 가 잰다.
- 요청 수 제한을 따로 두지 않았다. 모델까지 가는 길은 `start_reading_run` 의 풀이권 · 대상 잠금이 웹과 같이 막는다.
