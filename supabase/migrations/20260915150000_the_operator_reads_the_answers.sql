-- 설문을 **운영자가 화면에서 읽는다**
--
-- 답은 여덟 달째 `reading_feedback` 에 쌓이는데, 그것을 읽는 길은 Supabase 대시보드의
-- SQL Editor 하나였다(`docs/ops/runbook.md` 「설문 읽기」). 그 길에는 두 가지가 걸린다.
--
--   · **운영 DB 에 손으로 SQL 을 친다.** 읽기만 하는 일에 매번 쓰기 권한이 있는 자리로
--     들어가는 것이고, 옆 문장을 잘못 고르면 그것이 `delete` 인 날이 온다.
--   · **집계가 문서에만 있다.** 문서의 질의는 아무도 안 재므로, 열 이름이 바뀌는 날
--     조용히 틀린 수를 낸다.
--
-- 그래서 집계를 **함수로 옮기고 화면 하나를 연다**(`/ops/survey`, ADR 0061).
--
-- ## 「누구인가」를 표가 답한다
--
-- 풀이권 예외(`20260912090000`)에는 `is_operator` 같은 깃발을 일부러 안 세웠다. 그 표가
-- 답하는 것은 **얼마나**였고, 거기에 역할 이름을 붙이면 「운영자는 무엇을 더 할 수
-- 있나」가 그 표의 문제가 되기 때문이다.
--
-- 여기서 필요한 것은 그 질문이 아니라 **누구인가**다. 답을 읽어도 되는 사람이 누구인지는
-- 자료이지 규칙이 아니고, 함수 안에 이메일을 박아 두면 사람 하나가 코드에 남는다.
--
-- **깃발이 문을 여는 것이 아니다.** 이 표는 「이 사람이 운영자인가」에만 답하고, 무엇을
-- 할 수 있는지는 문마다 따로 정한다 — 아래 넷은 각자 `is_operator()` 를 묻는다. 운영자
-- 라는 이름으로 열리는 문의 목록은 이 표가 아니라 그 물음의 개수다.
--
-- 풀이권 예외는 그대로 둔다. **얼마나**와 **누구인가**는 다른 질문이고, 합치면 운영자가
-- 되는 것이 곧 풀이권을 더 받는 것이 된다.

create table if not exists public.operator (
  user_id uuid primary key references auth.users (id) on delete cascade,
  /** 누구를 왜 세웠나 — 초대 표·풀이권 예외의 메모와 같은 자리다 */
  note text not null,
  added_at timestamptz not null default now()
);

comment on table public.operator is
  '운영자 — 「이 사람이 운영자인가」에만 답한다. 무엇을 할 수 있는지는 문마다 따로 묻는다. 운영자가 SQL 로 넣는다.';

alter table public.operator enable row level security;

-- 정책을 하나도 안 만든다. **읽는 문도 안 연다** — 누가 운영자인지는 밖에서 물을 일이
-- 아니고, 물을 수 있으면 그 답이 곧 「이 사람을 노려라」가 된다. `service_role` 에도
-- 안 준다: 그 열쇠가 새면 스스로를 운영자로 세우는 문이 되기 때문이다(ADR 0006).
revoke all on public.operator from anon, authenticated, service_role;

/**
 * 지금 부른 사람이 운영자인가 — **밖에서는 못 묻는다.**
 *
 * 아래 넷만 부른다. `authenticated` 에게 열어 두면 화면이 「나는 운영자인가」를 물어
 * 메뉴를 세우게 되고, 그러면 판정하는 자리가 둘이 된다 — 화면이 물어서 세운 길과 DB 가
 * 내주는 자료가 갈리는 날, 사용자는 눌러도 아무것도 없는 줄을 본다.
 */
create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.operator o where o.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_operator() from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 세는 자리 — **집계는 여기 있고 화면은 그리기만 한다**
-- ---------------------------------------------------------------------------

/**
 * 답이 얼마나 들어왔나 — **비어 있을 때 그 까닭까지 답한다.**
 *
 * 설문 전체가 개선 활용 동의 뒤에 있으므로(`leave_reading_feedback`), 아무도 동의하지
 * 않았으면 답이 0이다. 그때 화면에 「답 0」만 서면 고장으로 읽힌다 — 동의 분포를 같이
 * 내주면 그 0이 **아직 아무도 안 물어본 0**인지 **거절당한 0**인지가 갈린다.
 *
 * `null` 과 `false` 를 갈라 센다. `null` 은 안 물어본 것이고 `false` 는 거절한 것이다.
 *
 * **비율은 안 낸다.** 완성된 풀이에는 동의하지 않은 사람의 것이 섞여 있어서 「답 ÷ 완성」
 * 은 답할 수 있었던 사람 중 몇이 답했는가가 아니다. 세어 본 수만 내주고, 나누는 것은
 * 나눌 수 있게 된 다음의 일이다.
 */
create or replace function public.operator_survey_overview()
returns table (
  answers integer,
  respondents integer,
  answered_runs integer,
  succeeded_runs integer,
  consented integer,
  declined integer,
  unasked integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.reading_feedback)::integer,
    (select count(distinct f.respondent_user_id) from public.reading_feedback f)::integer,
    (select count(distinct f.reading_run_id) from public.reading_feedback f)::integer,
    (select count(*) from public.reading_run r where r.status = 'succeeded')::integer,
    (select count(*) from public.app_user u where u.improvement_consent is true)::integer,
    (select count(*) from public.app_user u where u.improvement_consent is false)::integer,
    (select count(*) from public.app_user u where u.improvement_consent is null)::integer;
end;
$$;

/**
 * 판본별로 어떻게 읽혔나 — **답이 매인 시도가 판본과 모델을 들고 있다**(ADR 0022).
 *
 * 이어 붙일 것이 없다. 답 옆에 그 글을 만든 조건이 이미 있으므로, 판본을 바꾼 뒤의
 * 답과 그 전의 답이 섞이지 않는다.
 *
 * 차례는 **개수 순**이다. 평균 순으로 세우면 답 하나짜리 판본이 맨 위에 서고, 표본이
 * 적을 때 먼저 봐야 하는 것은 평균이 아니라 개수다.
 */
create or replace function public.operator_survey_by_version()
returns table (
  prompt_version text,
  model text,
  kind text,
  answers integer,
  usefulness numeric,
  perceived_fit numeric,
  felt_short integer,
  felt_right integer,
  felt_long integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  return query
  select
    r.prompt_version,
    r.model,
    r.kind,
    count(*)::integer,
    round(avg(f.usefulness), 2),
    round(avg(f.perceived_fit), 2),
    count(*) filter (where f.felt_length = 'short')::integer,
    count(*) filter (where f.felt_length = 'right')::integer,
    count(*) filter (where f.felt_length = 'long')::integer
  from public.reading_feedback f
  join public.reading_run r on r.id = f.reading_run_id
  group by r.prompt_version, r.model, r.kind
  order by count(*) desc, r.prompt_version desc nulls last, r.kind;
end;
$$;

/**
 * 무엇이 아쉬웠나 — **판본별 태그 개수.**
 *
 * 이름 여섯은 `reading_feedback.tags_are_known` 이 든다. 여기서 목록을 다시 적지 않는
 * 것은 그 둘이 갈리면 새로 는 이름이 조용히 안 세어지기 때문이다 — 세는 쪽은 들어온
 * 것을 셀 뿐이고, 무엇이 들어올 수 있는지는 검사식 하나가 정한다.
 */
create or replace function public.operator_survey_tags()
returns table (
  prompt_version text,
  tag text,
  answers integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  return query
  select
    r.prompt_version,
    marked.tag,
    count(*)::integer
  from public.reading_feedback f
  join public.reading_run r on r.id = f.reading_run_id
  cross join lateral unnest(f.issue_tags) as marked(tag)
  group by r.prompt_version, marked.tag
  order by count(*) desc, marked.tag;
end;
$$;

/**
 * 적어 주신 글 — **사람이 읽는 유일한 칸이다.**
 *
 * 점수와 태그를 같이 낸다. 글만 떼어 보면 「너무 단정적이에요」에 5점을 준 사람과 2점을
 * 준 사람이 같은 말로 읽힌다.
 *
 * **누가 썼는지는 안 낸다.** 운영자가 답을 고치는 일도, 답한 사람에게 되묻는 일도 없다.
 * 사람을 실으면 그 순간 이 화면이 「누가 뭐라고 했나」가 되고, 답한 사람은 그런 자리에
 * 동의한 적이 없다.
 *
 * **풀이 본문도 안 낸다.** 시도 행에는 글이 없고(`reading_run`), 결과에서 끌어오면
 * 운영자가 사용자의 풀이를 읽는 문이 여기 생긴다.
 */
create or replace function public.operator_survey_comments()
returns table (
  prompt_version text,
  kind text,
  usefulness smallint,
  perceived_fit smallint,
  felt_length text,
  issue_tags text[],
  comment text,
  submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  return query
  select
    r.prompt_version,
    r.kind,
    f.usefulness,
    f.perceived_fit,
    f.felt_length,
    f.issue_tags,
    f.comment,
    f.submitted_at
  from public.reading_feedback f
  join public.reading_run r on r.id = f.reading_run_id
  where f.comment is not null
  order by f.submitted_at desc;
end;
$$;

revoke execute on function public.operator_survey_overview() from anon, public, service_role;
revoke execute on function public.operator_survey_by_version() from anon, public, service_role;
revoke execute on function public.operator_survey_tags() from anon, public, service_role;
revoke execute on function public.operator_survey_comments() from anon, public, service_role;

grant execute on function public.operator_survey_overview() to authenticated;
grant execute on function public.operator_survey_by_version() to authenticated;
grant execute on function public.operator_survey_tags() to authenticated;
grant execute on function public.operator_survey_comments() to authenticated;

-- ---------------------------------------------------------------------------
-- 지금의 운영자
-- ---------------------------------------------------------------------------

/*
  **이메일로 찾는다.** 구글 로그인이 들고 오는 값이고, 이 저장소에서 사람을 가리키는
  값 중 운영자가 손으로 확인할 수 있는 유일한 것이다.

  아직 그 계정이 없는 곳에서는 **한 줄도 안 들어간다** — 로컬과 CI 가 그렇다. 거기서는
  운영자가 없고, 없으면 이 화면은 아무에게도 안 열린다. 시험은 자기 운영자를 스스로
  세운다(`26_operator_survey.test.sql`).

  다음 운영자는 마이그레이션이 아니라 SQL 한 줄이다(`docs/ops/runbook.md`).
*/
insert into public.operator (user_id, note)
select u.id, '만세력 운영자 — 설문을 읽는다'
from auth.users u
where u.email = 'torushy@gmail.com'
on conflict (user_id) do nothing;
