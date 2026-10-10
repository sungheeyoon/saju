-- 품질 검사에 걸린 글도 내보내고, 걸린 검사를 시도마다 적고, 날짜 · 풀이 종류 · 검사 코드별 수를 한 줄로 본다 — 넓히기 (ADR 0163)
--
-- 운영자 결정(2026-10-10): 「문장 규칙 검사를 통과하지 못한다고 버려지는 게 아니라 프로세스를 일단 결과를 내고, 서비스를
-- 개선해 나아가야 하는 게 맞지 않냐? 모든 풀이들이 그렇고, 운영자가 분석할 수 있는 칸으로 뭐 정리하던가 이래야지」.
-- 막는 것은 출생 원문 누출 · 동의 범위 밖 판정 · 화면이 그릴 수 없는 꼴 셋뿐이고, 나머지 검사는 걸려도 글을 저장한다
-- (갈래 표는 ADR 0163). 이 파일은 그 기록이 앉을 자리만 연다.
--
-- ## 무엇이 서나
--
-- 1. **시도마다의 기록** — `reading_run.check_findings` · `taste_artifact.check_findings`(+ `checked_attempt`). 걸린 검사의
--    `{code, detail}` 배열이다. `detail` 은 「너무 길다(1,820자)」 수준의 짧은 설명이고 **글 원문 · 이용자 자료를 받지 않는다** —
--    길이 상한(200자)과 키 둘만 받는 모양 검사가 그 경계다. 무엇을 적을지는 앱이 고른다(`src/lib/reading/check.ts` ·
--    `src/lib/reading/taste-run.ts`).
-- 2. **날짜별 수** — `check_finding_daily_count`. (서울 날짜, 풀이 종류, 검사 코드)마다 내보낸 시도 수 · 막은 시도 수. 개인을
--    가리키는 칸이 없다 — `taste_daily_count` 와 같이 지우지 않는다. 시도 하나를 적을 때마다 `checked` 줄이 하나 는다(분모).
-- 3. **문 둘** — `note_reading_checks(run, findings)` · `note_taste_checks(artifact, attempt, findings)`. 열쇠(`service_role`)만
--    부른다. 시도가 닫힌 뒤에 한 번만 적는다(두 번째부터는 `false`, 아무것도 안 는다). 내보냈는가 막았는가는 시도의 상태가
--    답한다 — `succeeded` 면 내보냄, `failed` 면 막음.
-- 4. **운영자용 뷰** — `reading_check_daily`. `select * from public.reading_check_daily order by day desc, kind, total desc`
--    한 줄로 본다. 앱은 안 읽는다 — `taste_daily` 처럼 `service_role` 에도 닫는다.
--
-- ## 올리는 차례 — 앱보다 먼저다(넓히기, ADR 0071)
--
-- 칸 셋과 문 둘 · 뷰 하나가 새로 설 뿐이다. 있는 문(`save_reading` · `fail_reading_job` · `finish_taste`)은 한 글자도 안
-- 바뀐다 — 지금 나가 있는 앱은 새 문을 모르고 그대로 돈다. 이 PR 의 앱이 새 문을 부르므로 이 파일이 먼저 올라야 한다 — 없으면
-- 기록만 못 적고(부속이라 저장 · 화면은 그대로 선다, 기록에 원문만 남는다) 글은 그대로 선다.
--
-- ## 겹치는 칸 — 좁힐 것이 없다
--
-- `reading_run.failure_detail` 은 그대로 남는다. 그 칸은 **실패의 까닭 한 줄**이다(모델 오류 · 시간 초과 · 저장 거절도 거기
-- 적힌다). 검사가 막은 시도는 앞으로도 첫 막음 코드와 설명을 거기 적고, 걸린 검사 전부는 `check_findings` 가 든다 — 같은 시도의
-- 두 갈래(실패의 까닭 · 검사 목록)라 하나로 접지 않는다.
--
-- 재는 자리는 `supabase/tests/88_check_findings.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 모양 검사 — 짧은 설명만
-- ---------------------------------------------------------------------------

/**
 * 검사 기록의 모양 — 배열, 서른둘 이하, 원소마다 키가 `code` · `detail` 둘뿐. 코드는 실패 코드와 같은 꼴(`^[a-z0-9-]{1,64}$`)이고
 * `checked`(분모 줄의 이름)는 못 쓴다. 설명은 1~200자 — 글 원문이 들어올 만한 길이를 안 받는다.
 */
create function public.check_findings_valid(p_findings jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_findings) = 'array'
    and jsonb_array_length(p_findings) <= 32
    and not exists (
      select 1
      from jsonb_array_elements(p_findings) f
      where jsonb_typeof(f) <> 'object'
         or (select array_agg(k order by k) from jsonb_object_keys(f) k) is distinct from array['code', 'detail']
         or jsonb_typeof(f -> 'code') <> 'string'
         or jsonb_typeof(f -> 'detail') <> 'string'
         or (f ->> 'code') !~ '^[a-z0-9-]{1,64}$'
         or (f ->> 'code') = 'checked'
         or char_length(f ->> 'detail') not between 1 and 200),
    false);
$$;

-- ---------------------------------------------------------------------------
-- 2. 칸 — 시도마다
-- ---------------------------------------------------------------------------

alter table public.reading_run
  add column check_findings jsonb
    constraint reading_run_check_findings_shape check (check_findings is null or public.check_findings_valid(check_findings));

comment on column public.reading_run.check_findings is
  '이 시도에서 걸린 검사 — {code, detail} 배열. 원문 없음. 시도가 닫힌 뒤 한 번 적는다(`note_reading_checks`). 빈 배열은 「검사했고 걸린 것 없음」.';

alter table public.taste_artifact
  add column check_findings jsonb
    constraint taste_artifact_check_findings_shape check (check_findings is null or public.check_findings_valid(check_findings)),
  add column checked_attempt integer
    constraint taste_artifact_checked_attempt_range check (checked_attempt between 1 and 3);

comment on column public.taste_artifact.check_findings is
  '마지막으로 적은 시도(`checked_attempt`)에서 걸린 검사 — {code, detail} 배열. 원문 없음. 행과 함께 24시간 뒤 지운다.';

-- ---------------------------------------------------------------------------
-- 3. 날짜별 수 — 지우지 않는다
-- ---------------------------------------------------------------------------

create table public.check_finding_daily_count (
  day date not null,
  /** 풀이 종류 — `READING_KINDS`(`src/lib/reading/policy.ts`) 넷과 로그인 전 맛보기 */
  kind text not null check (kind in ('self', 'person', 'private', 'match', 'taste')),
  /** 검사 코드 — `checked` 는 그날 적은 시도 전부(분모)다 */
  code text not null check (code ~ '^[a-z0-9-]{1,64}$'),
  /** 이 코드가 걸리고도 내보낸 시도 수 */
  shipped bigint not null default 0 check (shipped >= 0),
  /** 이 코드가 걸린 채 막힌 시도 수 — 막은 까닭이 이 코드가 아닐 수도 있다(같은 시도의 다른 코드가 막았을 수 있다) */
  blocked bigint not null default 0 check (blocked >= 0),
  primary key (day, kind, code)
);

comment on table public.check_finding_daily_count is
  '검사 기록의 날짜별 수 — (서울 날짜, 풀이 종류, 검사 코드)마다 내보냄 · 막음. 개인을 가리키는 칸이 없다 — 지우지 않는다.';

alter table public.check_finding_daily_count enable row level security;
revoke all on table public.check_finding_daily_count from public, anon, authenticated, service_role;

/** 시도 하나의 검사 기록을 날짜별 수에 더한다 — `checked` 하나 + 코드마다 하나(한 시도에 같은 코드가 둘이어도 하나) */
create function public.tally_check_findings(p_kind text, p_findings jsonb, p_shipped boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.check_finding_daily_count (day, kind, code, shipped, blocked)
  select (now() at time zone 'Asia/Seoul')::date, p_kind, c.code,
         case when p_shipped then 1 else 0 end, case when p_shipped then 0 else 1 end
  from (
    select 'checked'::text as code
    union
    select distinct f ->> 'code' from jsonb_array_elements(p_findings) f
  ) c
  on conflict (day, kind, code) do update
  set shipped = public.check_finding_daily_count.shipped + excluded.shipped,
      blocked = public.check_finding_daily_count.blocked + excluded.blocked;
$$;

-- ---------------------------------------------------------------------------
-- 4. 문 둘 — 열쇠만, 닫힌 시도에 한 번
-- ---------------------------------------------------------------------------

/**
 * 풀이 시도 하나의 검사 기록을 적는다 — 시도가 닫힌 뒤에(`save_reading` · `fail_reading_job` 다음) 회수(`app/me/reading/collect.ts`)가
 * 부른다. 내보냄 · 막음은 시도의 상태로 가른다.
 *
 * **한 번만 적는다.** 이미 적은 시도 · 아직 도는 시도는 `false` 이고 아무것도 안 는다 — webhook 과 복구기가 같은 회수를 지나도
 * 두 번 세지 않는다.
 *
 * @returns 이번에 적었는가
 * @throws 22023 기록의 모양이 틀렸다(키 · 코드 꼴 · 설명 길이 · 개수)
 * @throws P0002 그런 시도가 없다
 */
create function public.note_reading_checks(p_run_id uuid, p_findings jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.reading_run;
begin
  if not public.check_findings_valid(p_findings) then
    raise exception 'checks: findings are an array of {code, detail}' using errcode = '22023';
  end if;

  select * into run from public.reading_run r where r.id = p_run_id for update;
  if run.id is null then
    raise exception 'checks: no such run' using errcode = 'P0002';
  end if;

  if run.status = 'running' or run.check_findings is not null then
    return false;
  end if;

  update public.reading_run r set check_findings = p_findings where r.id = run.id;
  perform public.tally_check_findings(run.kind, p_findings, run.status = 'succeeded');
  return true;
end;
$$;

/**
 * 맛보기 시도 하나의 검사 기록을 적는다 — `finish_taste` 가 `recorded` 로 답한 뒤에 서버(`app/taste-run.ts`)가 부른다. 내보냄 ·
 * 막음은 artifact 의 상태로 가른다.
 *
 * **그 시도에 한 번만 적는다.** artifact 가 없거나 · 도는 중이거나 · 지금 시도 번호가 아니거나 · 이 시도를 이미 적었으면 `false`
 * 이고 아무것도 안 는다.
 *
 * @returns 이번에 적었는가
 * @throws 22023 기록의 모양이 틀렸다 · 시도 번호가 없다
 */
create function public.note_taste_checks(p_artifact_id uuid, p_attempt integer, p_findings jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.taste_artifact;
begin
  if not public.check_findings_valid(p_findings) then
    raise exception 'checks: findings are an array of {code, detail}' using errcode = '22023';
  end if;

  if p_attempt is null then
    raise exception 'checks: attempt is required' using errcode = '22023';
  end if;

  select * into target from public.taste_artifact a where a.id = p_artifact_id for update;
  if target.id is null
     or target.status = 'running'
     or target.attempts <> p_attempt
     or target.checked_attempt is not distinct from p_attempt then
    return false;
  end if;

  update public.taste_artifact a
  set check_findings = p_findings, checked_attempt = p_attempt
  where a.id = target.id;
  perform public.tally_check_findings('taste', p_findings, target.status = 'succeeded');
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. 운영자용 뷰 — 한 줄로 본다
-- ---------------------------------------------------------------------------

/**
 * 검사 기록의 날짜별 한 줄 — 운영자가 `select * from public.reading_check_daily order by day desc, kind, total desc` 로 본다.
 * 개인이 없다.
 *
 * - `checked` — 그날 그 종류에서 검사를 적은 시도 전부(분모)
 * - `shipped` · `blocked` — 이 코드가 걸리고도 내보낸 · 막힌 시도 수
 * - `share` — 적은 시도 가운데 이 코드가 걸린 몫(%, 소수 첫째 자리)
 */
create view public.reading_check_daily with (security_invoker = true) as
select
  c.day,
  c.kind,
  c.code,
  c.shipped,
  c.blocked,
  c.shipped + c.blocked as total,
  coalesce(t.shipped + t.blocked, 0) as checked,
  round(100.0 * (c.shipped + c.blocked) / nullif(t.shipped + t.blocked, 0), 1) as share
from public.check_finding_daily_count c
left join public.check_finding_daily_count t
  on t.day = c.day and t.kind = c.kind and t.code = 'checked'
where c.code <> 'checked';

comment on view public.reading_check_daily is
  '검사 기록의 날짜별 수 — 풀이 종류 · 검사 코드마다 내보냄 · 막음 · 몫. 개인 없음. 앱은 안 읽는다.';

revoke all on public.reading_check_daily from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. 권한 — 문 둘은 열쇠에만, 나머지는 아무에게도
-- ---------------------------------------------------------------------------

revoke execute on function
  public.check_findings_valid(jsonb),
  public.tally_check_findings(text, jsonb, boolean),
  public.note_reading_checks(uuid, jsonb),
  public.note_taste_checks(uuid, integer, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  public.note_reading_checks(uuid, jsonb),
  public.note_taste_checks(uuid, integer, jsonb)
to service_role;
