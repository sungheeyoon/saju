# 인연 궁합의 원문 근거는 운영자만 읽는다

## 무엇이 열려 있었나

`my_reading_artifacts` 는 `reading_scope` 를 지나는 사람에게 저장된 근거(`evidence`)·프롬프트
(`prompt`)·생성 설정(`generation`)을 내준다. `authenticated` 에게 열려 있고, 그것을 그리는
`/me/reading/inspect` 는 로그인만 묻는다.

자기 풀이·저장한 사람·비공개 궁합에서는 부르는 사람이 **자기가 넣은 자료의 주인**이라 문제가 없다.
인연 궁합은 아니다. 저장된 근거에는 **상대의** 명식이 들고, 옛 운영 컷(ADR 0067 의 `legacy-v0`)은 상대의
억부 후보·가중 오행 세력·성별·조자시 옵션·절기 경계 문장까지 든다. 두 당사자는 주소 하나나 RPC 직접
호출로 **서로의 그 값을 읽을 수 있었다.** ADR 0008 은 근거를 「클라이언트가 직접 조회할 수 없게」
둔다고 적었다.

## 결정

`20260921120000_the_match_source_is_for_operators.sql` — 조건 한 줄.

- `match` 요청은 **운영자일 때만** 행이 나온다. 판정은 DB 안에서 한다(`public.is_operator()`) — 화면이
  숨기면 직접 RPC 가 그대로 연다.
- **운영자에게도 `reading_scope` 는 그대로다.** 운영자라서 모든 Match 의 근거를 보는 권한은 없다 —
  자기가 당사자인 Match 만.
- `self`·`person`·`private` 는 그대로다. 본문(`my_reading`)도 그대로다.
- 옛 `reading` 행은 지우거나 덮어쓰지 않는다.

## 확인한 다른 길

- `reading`·`reading_run`·`reading_job` 표 — `authenticated`·`anon` 에게 권한이 없다
- `evidence`·`prompt`·`generation` 을 돌려주는 다른 RPC — 없다
- 결과 화면 `/me/match/[id]` — 서버가 계산한 `Compatibility` 를 서버 컴포넌트 안에서만 쓰고, 브라우저로
  넘기는 것은 여덟 글자(`SharedPillarChart`)뿐이다

**남은 길 하나** — `my_reading` 이 돌려주는 `output` 에는 모델이 쓴 **검사용 근거 절**이 붙어 있다.
화면은 서버에서 잘라 내지만(`readingBody`) RPC 를 직접 부르면 그 절까지 온다. 거기에는 모델이 인용한
경로와 층(`compatibility.eokbuMatch [후보]` 같은 것)이 적힐 수 있다. 이 ADR 은 그것을 닫지 않았다 —
본문 조회를 건드리는 일이라 따로 정한다.

## 시험

`supabase/tests/13_reading.test.sql` — 받은 쪽·청한 쪽 당사자(못 읽음) · 본문은 읽음 · 자기 풀이·비공개
궁합 근거는 그대로 · 무관한 사용자(못 읽음) · 당사자가 아닌 운영자(못 읽음) · 당사자인 운영자(읽음) ·
익명(함수 자체가 닫힘).
