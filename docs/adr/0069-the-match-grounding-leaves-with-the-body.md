# 인연 궁합의 근거 절은 본문 조회로 안 나간다

## 무엇이 열려 있었나

ADR 0068 은 근거 **자료**(`my_reading_artifacts`)를 운영자로 좁히면서 「남은 길」을 하나 적어 두었다 —
`my_reading` 이 내주는 `output` 에는 모델이 쓴 `### 근거 (검사용)` 절이 붙어 있고, 그 절은 모델이 받은
경로와 층을 인용한다(`compatibility.eokbuMatch [후보]` 같은 것). 옛 컷(`legacy-v0`)은 상대의 억부 후보·
가중 오행 세력까지 모델에 실었으므로 그 절이 **상대의 원국 판정**을 인용할 수 있다.

화면은 서버 경계에서 그 절을 잘랐다(`readingBody`). 자르지 않는 길이 둘이었다.

- **RPC 직접 호출** — `my_reading` 을 그대로 부르면 원문이 온다.
- **검산 화면** — `/me/reading/inspect?kind=match&m=…` 는 로그인만 물었고, `readingGroundingOf` 가
  운영자 조건이 없는 `my_reading` 을 읽어 근거 절을 **화면에 폈다.** 주소만 알면 비운영자 당사자가 본다.

로컬 재현으로 값을 봤다(2026-09-16). 비운영자 당사자 둘 다 `my_reading` 에서 근거 절과
`compatibility.eokbuMatch` 인용을 받았고, 같은 자리에서 `my_reading_artifacts` 는 0행이었다.

## 결정

`20260922090000_the_match_grounding_is_for_operators.sql`.

- **일반 조회는 인연 궁합의 사용자 본문만 낸다.** `my_reading` 이 `match` 일 때 근거 절을 자른다.
- 자르는 규칙에 이름을 준다 — `public.reading_user_body(text)`. 앱의 `readingBody` 와 **같은 정규식**이고,
  두 자리에서 따로 자르면 갈린다. 갈리는 날 열려 있는 쪽은 언제나 사용자 쪽이라 시험이 둘 다 잰다.
- **저장된 원문은 그대로 둔다.** 옛 행을 덮어쓰거나 지우지 않는다 — 되짚을 때 읽을 것이 그것이다.
- 운영자가 원문을 읽는 문을 따로 연다 — `public.match_reading_source(uuid)`. **운영자 여부와 당사자
  범위를 둘 다** 본다(`is_operator()` + `reading_scope`). 운영자라서 남의 Match 를 여는 권한은 새로
  만들지 않는다(ADR 0068 과 같은 규율).
- `self`·`person`·`private` 는 한 글자도 안 바뀐다. 그 셋에서 부르는 사람은 자기가 넣은 자료의 주인이고,
  검산 화면도 그 셋은 `my_reading` 을 그대로 읽는다.
- 화면은 「운영자인가」를 묻지 않는다. 물으면 판정하는 자리가 둘이 되고, 둘은 언젠가 어긋난다.

## 시험

`supabase/tests/13_reading.test.sql` — 원문을 근거 절이 붙은 모양으로 바꿔 놓고 잰다. 비운영자 당사자
(근거 절 없음 · 본문은 그대로 · 원문 문 0행) · 당사자인 운영자(원문 1행 · 근거 절 있음 · 그래도 본문
조회에는 없음) · 당사자가 아닌 운영자(0행) · 익명(함수가 닫힘) · 자르는 규칙 자체 두 줄.

## 확인한 다른 길

- `my_readings`(목록)는 본문을 안 든다 — 점수와 한 줄 요약뿐이다.
- 공유본(`share_my_reading`)은 서버가 `readingBody` 로 자른 글을 넘긴다. 인연 궁합은 애초에 공유가 닫혀
  있다(ADR 0063).
- `reading`·`reading_run` 표는 `authenticated`·`anon` 에게 권한이 없다.
