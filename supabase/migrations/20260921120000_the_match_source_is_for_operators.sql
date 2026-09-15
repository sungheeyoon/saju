-- 인연 궁합의 원문 근거는 운영자만 읽는다 (ADR 0068)
--
-- `my_reading_artifacts` 는 `reading_scope` 를 지나는 사람에게 근거(`evidence`)·프롬프트
-- (`prompt`)·생성 설정(`generation`)을 내준다. 자기 풀이·저장한 사람·비공개 궁합에서 그 사람은
-- **자기가 넣은 자료의 주인**이다. 인연 궁합은 아니다 — 저장된 근거에는 **상대의** 명식이 들고,
-- 옛 컷(`legacy-v0`)은 상대의 억부 후보·가중 세력·성별·계산 옵션까지 든다.
--
-- 그런데 이 함수는 `authenticated` 에게 열려 있었고 `/me/reading/inspect` 는 로그인만 물었다.
-- **두 당사자가 서로의 그 값을 읽을 수 있었다.** ADR 0008 은 근거를 「클라이언트가 직접 조회할
-- 수 없게」 둔다고 적었다.
--
-- 고치는 것은 **한 줄의 조건**이다.
--
-- - `match` 요청은 **운영자일 때만** 행이 나온다. 판정은 DB 안에서 한다(`is_operator()`) — 화면이
--   묻고 숨기면 직접 RPC 호출이 그대로 연다.
-- - **운영자에게도 `reading_scope` 는 그대로다.** 운영자라서 모든 Match 의 근거를 보는 권한을
--   새로 만들지 않는다 — 자기가 당사자인 Match 만 읽는다.
-- - `self`·`person`·`private` 는 한 글자도 안 바뀐다.
-- - 본문(`my_reading`)은 건드리지 않는다. 옛 `reading` 행도 지우거나 덮어쓰지 않는다.
--
-- 반환 모양과 인자가 같으므로 `create or replace` 로 바꾼다. 권한은 그대로 두되 다시 적는다.

create or replace function public.my_reading_artifacts(
  p_kind text,
  p_person_a uuid default null,
  p_person_b uuid default null,
  p_match_id uuid default null
)
returns table (evidence text, prompt text, prompt_version text, generation jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select r.evidence, r.prompt, r.prompt_version, r.generation
  from public.reading_scope(p_kind, p_person_a, p_person_b, p_match_id) s
  join public.reading r
    on r.kind = s.kind
   and r.owner_user_id is not distinct from s.owner_user_id
   and r.person_a = s.person_a
   and r.person_b is not distinct from s.person_b
   and r.match_id is not distinct from s.match_id
  where s.kind <> 'match' or public.is_operator();
$$;

revoke execute on function public.my_reading_artifacts(text, uuid, uuid, uuid) from anon, public;
grant execute on function public.my_reading_artifacts(text, uuid, uuid, uuid) to authenticated;
