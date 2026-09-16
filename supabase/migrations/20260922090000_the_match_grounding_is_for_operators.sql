-- 인연 궁합의 근거 절은 본문 조회로 안 나간다 (ADR 0069)
--
-- ADR 0068 은 근거 **자료**(`my_reading_artifacts`)를 운영자로 좁혔다. 그때 「남은 길」로 적어 둔 것이
-- 이것이다 — `my_reading.output` 에는 모델이 쓴 `### 근거 (검사용)` 절이 붙어 있고, 그 절은 모델이 받은
-- 경로와 층을 인용한다(`compatibility.eokbuMatch [후보]` 같은 것). 옛 컷(`legacy-v0`)은 상대의 억부
-- 후보·가중 세력까지 모델에 실었으므로, 그 절이 **상대의 원국 판정**을 인용할 수 있다.
--
-- 화면은 서버 경계에서 그 절을 잘랐다(`readingBody`). 자르지 않는 길이 둘 있었다 —
-- RPC 직접 호출과, 로그인만 묻던 검산 화면(`/me/reading/inspect?kind=match`)이 근거 절을 펴던 것.
--
-- - **일반 조회(`my_reading`)는 인연 궁합의 사용자 본문만 낸다.** 자르는 규칙을 이름 붙여 한 자리에
--   둔다(`public.reading_user_body`) — 앱의 `readingBody` 와 **같은 정규식**이다. 두 자리에서 따로
--   자르면 언젠가 갈리고, 갈리면 열려 있는 쪽이 사용자 쪽이다.
-- - `self`·`person`·`private` 는 한 글자도 안 바뀐다. 그 셋에서 부르는 사람은 자기가 넣은 자료의 주인이다.
-- - **저장된 원문은 그대로 둔다.** 옛 행을 덮어쓰지 않는다 — 되짚을 때 읽을 것이 그것이다.
-- - 운영자가 원문을 읽는 문을 따로 연다(`match_reading_source`). 운영자 **여부와 기존 당사자 범위를
--   모두** 본다 — 운영자라서 남의 Match 를 여는 권한은 새로 만들지 않는다(ADR 0068 과 같은 규율).

-- ---------------------------------------------------------------------------
-- 자르는 규칙 — 앱의 `readingBody` 와 한 벌
-- ---------------------------------------------------------------------------

/**
 * 사용자가 읽는 본문 — 내부 검토용 근거 절을 뺀다.
 *
 * 앱의 `src/lib/reading/display.ts` 가 같은 자리에서 자른다(`/^###\s+근거(?:\s+\(검사용\))?\s*$/m`).
 * 이 함수는 그 규칙의 **DB 쪽 한 벌**이고, 인연 궁합에서는 이쪽이 마지막 문이다 — 앱이 안 잘라도
 * 여기서 이미 잘려 나간다.
 *
 * 절이 없으면 원문 그대로다. 빈 글자로 뭉개지 않는다.
 *
 * **터는 글자를 손으로 적는다.** `btrim` 의 기본은 공백 하나뿐이라 줄바꿈이 남고, 그러면 같은 글이
 * 앱(`.trim()`)과 여기서 다르게 나온다 — 시험이 그 차이를 잡았다.
 */
create or replace function public.reading_user_body(p_output text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_output is null then null
    when pos = 0 then p_output
    else btrim(left(p_output, pos - 1), E' \t\r\n')
  end
  from (
    select coalesce(
      regexp_instr(p_output, '^###[[:space:]]+근거([[:space:]]+\(검사용\))?[[:space:]]*$', 1, 1, 0, 'n'),
      0) as pos
  ) found;
$$;

revoke execute on function public.reading_user_body(text) from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 일반 조회 — 인연 궁합은 본문만
-- ---------------------------------------------------------------------------

/**
 * 반환 모양과 인자가 같아 `create or replace` 로 바꾼다. 바뀌는 것은 `output` 한 칸이고,
 * **`match` 일 때만** 잘린다.
 */
create or replace function public.my_reading(
  p_kind text,
  p_person_a uuid default null,
  p_person_b uuid default null,
  p_match_id uuid default null
)
returns table (
  id uuid,
  kind text,
  score smallint,
  metaphor text,
  output text,
  model text,
  viewed_at timestamptz,
  created_at timestamptz,
  viewer_is_first boolean,
  from_current_revision boolean,
  source_run_id uuid,
  my_feedback jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.kind, r.score, r.metaphor,
    case when s.kind = 'match' then public.reading_user_body(r.output) else r.output end,
    r.model, r.viewed_at, r.created_at,
    s.viewer_is_first,
    r.revision_a = s.revision_a and r.revision_b is not distinct from s.revision_b,
    r.source_run_id,
    (
      select jsonb_build_object(
        'usefulness', f.usefulness,
        'perceivedFit', f.perceived_fit,
        'feltLength', f.felt_length,
        'issueTags', to_jsonb(f.issue_tags),
        'comment', f.comment)
      from public.reading_feedback f
      where f.reading_run_id = r.source_run_id
        and f.respondent_user_id = (select auth.uid())
    )
  from public.reading_scope(p_kind, p_person_a, p_person_b, p_match_id) s
  join public.reading r
    on r.kind = s.kind
   and r.owner_user_id is not distinct from s.owner_user_id
   and r.person_a = s.person_a
   and r.person_b is not distinct from s.person_b
   and r.match_id is not distinct from s.match_id;
$$;

revoke execute on function public.my_reading(text, uuid, uuid, uuid) from anon, public;
grant execute on function public.my_reading(text, uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 운영자가 원문을 읽는 문
-- ---------------------------------------------------------------------------

/**
 * 인연 궁합의 **저장된 원문** — 운영자이고, 그 Match 의 당사자일 때만.
 *
 * 두 조건을 **둘 다** 본다. `reading_scope` 가 당사자인지를 답하고 `is_operator()` 가 운영자인지를
 * 답한다 — `my_reading_artifacts` 와 같은 모양이다(ADR 0068). 화면이 묻고 숨기는 것으로는 RPC 직접
 * 호출이 그대로 열리므로 판정은 DB 안에 둔다.
 *
 * `match` 만 받는다. 다른 kind 의 근거 절은 `my_reading` 이 지금도 그대로 내주므로 이 문이 할 일이 없다.
 */
create or replace function public.match_reading_source(p_match_id uuid)
returns table (output text, prompt_version text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.output, r.prompt_version
  from public.reading_scope('match', null, null, p_match_id) s
  join public.reading r
    on r.kind = s.kind
   and r.match_id is not distinct from s.match_id
   and r.person_a = s.person_a
   and r.person_b is not distinct from s.person_b
  where public.is_operator();
$$;

revoke execute on function public.match_reading_source(uuid) from anon, public;
grant execute on function public.match_reading_source(uuid) to authenticated;
