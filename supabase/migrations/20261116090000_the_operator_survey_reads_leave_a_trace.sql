-- 운영자가 설문 집계와 적어 주신 글을 읽을 때마다 접속기록에 한 줄이 남는다 (ADR 0105 추기 2026-10-01)
--
-- 운영자 결정(2026-10-01): `/ops/survey` 의 문(`app/ops/survey/read.ts`)이 부르는 설문 문 일곱을 ADR 0105 의 운영자
-- 접속기록 범위에 넣는다. 그 전에는 runbook 「운영자 접속기록」 표가 `/ops/survey` 를 「안 적는다 — 집계뿐」으로 두었는데,
-- 일곱 중 둘(`operator_survey_comments` · `operator_service_survey_texts`)은 이용자가 적은 글 원문을 낸다.
--
-- ## 신고 문 셋과 같은 원칙 (`20261010100000`)
--
-- - **문이 적는다** — 일곱이 `stable` 에서 `volatile` 로 바뀌고 성공한 읽기를 **같은 트랜잭션에서** 적는다. PostgREST 로
--   문을 직접 두드려도 빠지지 않는다. 문 하나가 한 줄이다 — 화면 한 번은 일곱 줄이다.
-- - **원문을 안 적는다** — 동작 이름만 적고 대상(`target_report_id`) · 거른 조건(`filter_summary`)은 비운다. 설문 답 ·
--   적어 주신 글은 기록에 안 들어간다 — 반출본은 Object Lock 으로 지울 수 없다.
-- - **거절은 문 밖에서 적는다** — 운영자가 아니면 문은 그대로 `42501` 을 던지고(적은 줄은 되감긴다), 앱의 문이 거절을
--   받으면 `note_operator_denial` 을 제 트랜잭션에서 부른다. 그 문이 설문 동작 일곱을 받게 한다. 화면은 머리 문의 이름
--   (`survey.overview`) 하나로 적는다 — 신고 상세가 두 문을 부르고 `reports.detail` 하나로 적는 것과 같다.
--
-- 동작 이름 — `survey.overview` · `survey.by_version` · `survey.tags` · `survey.comments`(풀이 설문 넷),
-- `survey.service_overview` · `survey.service_counts` · `survey.service_texts`(서비스 설문 셋).
--
-- ## 옛 앱에 안전하다
--
-- 서명 · 반환 칸 · 권한이 그대로다(`create or replace` — 지우고 다시 짓지 않으므로 grant 도 그대로). 옛 앱은 거절을 안
-- 적을 뿐 같은 답을 받는다. 반출(`audit_export_batch`)은 동작을 걸러 내지 않으므로 새 동작을 그대로 가져간다.
--
-- 재는 자리는 `supabase/tests/78_operator_survey_access_log.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 기록 표가 설문 동작을 받는다
-- ---------------------------------------------------------------------------

alter table audit.operator_access drop constraint operator_access_action_check;
alter table audit.operator_access add constraint operator_access_action_check
  check (action in ('reports.list', 'reports.detail', 'reports.snapshot', 'credits.refund_basis',
                    'audit.export_status',
                    'survey.overview', 'survey.by_version', 'survey.tags', 'survey.comments',
                    'survey.service_overview', 'survey.service_counts', 'survey.service_texts',
                    'cli.query', 'cli.result'));

alter table audit.operator_access drop constraint app_access_names_the_operator;
alter table audit.operator_access add constraint app_access_names_the_operator check (
  channel <> 'app' or (actor_user_id is not null and actor_name is null and purpose is null
                       and sql_sha256 is null and result_of is null and result is null and error_class is null
                       and (action like 'reports.%' or action like 'credits.%' or action like 'audit.%'
                            or action like 'survey.%')));

-- ---------------------------------------------------------------------------
-- 2. 풀이 설문 넷 — 몸은 `20260915150000` 그대로, 읽으면 적는다
-- ---------------------------------------------------------------------------

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
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('survey.overview', null, null, 'allowed');

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
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('survey.by_version', null, null, 'allowed');

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

create or replace function public.operator_survey_tags()
returns table (
  prompt_version text,
  tag text,
  answers integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('survey.tags', null, null, 'allowed');

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

/** 적어 주신 글 — 글은 화면으로만 나가고 기록에는 동작 이름만 남는다 */
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
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('survey.comments', null, null, 'allowed');

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

-- ---------------------------------------------------------------------------
-- 3. 서비스 설문 셋 — 몸은 `20260915180000` · `20260915210000`(counts) 그대로, 읽으면 적는다
-- ---------------------------------------------------------------------------

create or replace function public.operator_service_survey_overview()
returns table (
  submitted integer,
  drafts integer,
  priced_solo integer,
  priced_pair integer,
  updated integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('survey.service_overview', null, null, 'allowed');

  return query
  select
    count(*) filter (where s.submitted_at is not null)::integer,
    count(*) filter (where s.submitted_at is null)::integer,
    count(*) filter (where s.submitted_at is not null and s.price_solo is not null)::integer,
    count(*) filter (where s.submitted_at is not null and s.price_pair is not null)::integer,
    count(*) filter (where s.updated_at is not null)::integer
  from public.service_survey s;
end;
$$;

create or replace function public.operator_service_survey_counts()
returns table (
  question text,
  choice text,
  answers integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('survey.service_counts', null, null, 'allowed');

  return query
  with said as (
    select * from public.service_survey s where s.submitted_at is not null
  ),
  spread as (
    select 'liked'::text as q, t as c from said, unnest(said.liked) t
    union all select 'unknown', t from said, unnest(said.unknown_features) t
    union all select 'improve', t from said, unnest(said.improve) t
    union all select 'wants', t from said, unnest(said.wants) t
    union all select 'wantsNew', t from said, unnest(said.wants_new) t
    union all select 'priceFactors', t from said, unnest(said.price_factors) t
    union all select 'priceSolo', said.price_solo from said where said.price_solo is not null
    union all select 'pricePair', said.price_pair from said where said.price_pair is not null
  )
  select spread.q, spread.c, count(*)::integer
  from spread
  group by spread.q, spread.c
  order by spread.q, count(*) desc, spread.c;
end;
$$;

/** 적어 주신 글 — 글은 화면으로만 나가고 기록에는 동작 이름만 남는다 */
create or replace function public.operator_service_survey_texts()
returns table (
  improve_text text,
  free_text text,
  price_solo text,
  price_pair text,
  submitted_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('survey.service_texts', null, null, 'allowed');

  return query
  select s.improve_text, s.free_text, s.price_solo, s.price_pair, s.submitted_at
  from public.service_survey s
  where s.submitted_at is not null
    and (s.improve_text is not null or s.free_text is not null)
  order by s.submitted_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. 거절을 적는 문이 설문 동작을 받는다 — 몸은 `20261013090000` 그대로
-- ---------------------------------------------------------------------------

create or replace function public.note_operator_denial(p_action text, p_report_id uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or public.is_operator() then
    return;
  end if;

  if p_action is null
     or p_action not in ('reports.list', 'reports.detail', 'reports.snapshot', 'credits.refund_basis',
                         'survey.overview', 'survey.by_version', 'survey.tags', 'survey.comments',
                         'survey.service_overview', 'survey.service_counts', 'survey.service_texts') then
    raise exception 'operator: unknown action' using errcode = '22023';
  end if;

  -- 세기 전에 그 사람의 줄을 세운다 — 나란히 온 두 번째는 첫째의 커밋 뒤에 센다
  perform pg_advisory_xact_lock(hashtextextended('audit:denial:' || actor::text, 0));

  if (select count(*) from audit.operator_access a
      where a.actor_user_id = actor and a.outcome = 'denied'
        and a.at > clock_timestamp() - interval '1 hour') >= 30 then
    return;
  end if;

  perform audit.note_app_access(p_action, p_report_id, null, 'denied');
end;
$$;
