-- 놓은 자리에 지문을 남기면 놓은 것이 아니다 — 그리고 판본 저장은 줄을 세운다
--
-- 11번째 마이그레이션이 둘을 틀렸다. 재어 보고 알았다.
--
-- 1. **terminal 요청에 남긴 지문은 원문 폐기가 아니다.** 열쇠 없는 SHA-256 이고
--    입력 공간이 작다 — 다른 칸을 안다면 시각 1,440 개를 1 밀리초 안에 대입해 맞히고,
--    아무것도 모르더라도 (양력 · 1930~2010 · 도시 20 개) 전체가 10¹⁰ 뿐이라 흔한
--    노트북 코어 하나로 두 시간이 안 걸린다. 판본 행을 지워 놓고 그 옆에 지문을
--    남기는 것은 **지운 값을 다시 계산할 수 있게 남겨 두는 것**이다.
-- 2. **판본 저장이 겹치면 deadlock 이 난다.** 새 판본을 먼저 넣고(부모 행에 key share)
--    그 다음 `person.current_revision_id` 를 고치는데(같은 행에 더 센 잠금), 두 호출이
--    겹치면 서로가 든 것을 서로 기다린다. 300 회씩 두 갈래로 겹쳐 돌려 40P01 을 재현했다.
--    이 차례 자체는 `20260824170000_revise_chart.sql` 부터 있었다 — 11 번째가 만든 것이
--    아니라 그때부터 있던 것을 이제야 잰 것이다.

-- ---------------------------------------------------------------------------
-- 무엇에 대한 요청이었나 — 지문이 아니라 **아무것도 담지 않은 표**로
-- ---------------------------------------------------------------------------

/**
 * 그때 그 판본을 가리키던 값.
 *
 * FK 가 **아니다.** 붙들지 않으므로 정리가 그 판본을 지울 수 있고, 지운 뒤에도 이 값은
 * 남는다. 그런데 값 자체는 무작위 uuid 라 **출생 입력을 담지 않는다** — 지문과 다른
 * 점이 정확히 여기다. 지문은 입력에서 계산된 값이라 되돌릴 수 있고, 이 표는 입력과
 * 아무 관계가 없어 되돌릴 것이 없다.
 *
 * 답할 수 있는 질문은 그대로다. 「두 요청이 같은 입력에 대한 것이었나」(값이 같은가),
 * 「이 요청이 저 Match 가 매어 둔 판본에 대한 것이었나」(그 판본이 살아 있는 동안).
 * 답할 수 없게 되는 것은 「그 입력이 무엇이었나」뿐이고, 그것이 답할 수 없어야 하는
 * 질문이다.
 */
alter table public.match_request
  add column requester_revision_tag uuid,
  add column addressee_revision_tag uuid;

/**
 * 이미 쌓인 요청도 표를 든다.
 *
 * 아직 판본을 들고 있으면 그 id 를 쓰고, 이미 놓았으면 지문으로 그 사람의 판본 중에서
 * 찾는다. **사람으로 좁힌다** — 지문만으로 찾으면 같은 입력을 가진 남의 판본을 집을 수
 * 있고, 그러면 요청이 남을 가리키게 된다.
 *
 * 판본이 이미 정리된 요청은 찾을 것이 없어 빈 채로 남는다. 지어서 채우지 않는다.
 */
update public.match_request r
set requester_revision_tag = coalesce(
      r.requester_revision_id,
      (select v.id from public.person_chart_revision v
       where v.fingerprint = r.requester_fingerprint
         and v.person_id = (select u.self_person_id from public.app_user u
                            where u.id = r.requester_user_id)
       limit 1)),
    addressee_revision_tag = coalesce(
      r.addressee_revision_id,
      (select v.id from public.person_chart_revision v
       where v.fingerprint = r.addressee_fingerprint
         and v.person_id = (select u.self_person_id from public.app_user u
                            where u.id = r.addressee_user_id)
       limit 1));

/** 되돌릴 수 있는 값은 지운다. 컬럼째 없애야 다음 배포에서 다시 채워지지 않는다 */
drop trigger request_fingerprints on public.match_request;
drop function public.set_request_fingerprints();

alter table public.match_request
  drop column requester_fingerprint,
  drop column addressee_fingerprint;

/** 손으로 적을 자리를 남기지 않는다 — 지문 때와 같은 규율 */
create or replace function public.set_request_revision_tags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.requester_revision_tag := new.requester_revision_id;
  new.addressee_revision_tag := new.addressee_revision_id;
  return new;
end;
$$;

create trigger request_revision_tags
before insert on public.match_request
for each row execute function public.set_request_revision_tags();

-- ---------------------------------------------------------------------------
-- 참조를 묻는 자리는 후보로 좁힌다
-- ---------------------------------------------------------------------------

/**
 * **후보 몇 개만 묻는다.**
 *
 * 전에는 참조 표를 통째로 읽어 전부 모았다. 정리는 한 Person 의 판본 서넛만 판정하면
 * 되는데, 그 판정 한 번이 서비스 전체의 참조를 훑는 일이 됐다. 요청 여러 개를 한꺼번에
 * 무효화하면 그 훑기가 요청 수만큼 되풀이된다.
 *
 * 묻는 자리를 FK 에서 읽는 것은 그대로다(ADR 0011). 달라진 것은 **어디를 읽느냐**가
 * 아니라 **무엇을 묻느냐**다. 새 표가 판본을 가리키기 시작하면 여기 자동으로 서고,
 * 그 표의 FK 열에 인덱스를 함께 두어야 이 좁힘이 실제로 값싸진다.
 */
create or replace function public.revisions_in_use(p_candidates uuid[])
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  sources text;
begin
  if p_candidates is null or cardinality(p_candidates) = 0 then
    return;
  end if;

  select string_agg(
    format('select %I as id from %I.%I where %I = any($1)',
           a.attname, n.nspname, c.relname, a.attname),
    ' union all ')
  into sources
  from pg_constraint k
  join pg_class c on c.oid = k.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
  where k.contype = 'f'
    and k.confrelid = 'public.person_chart_revision'::regclass
    and cardinality(k.conkey) = 1;

  if sources is null then
    return;
  end if;

  return query execute format('select s.id from (%s) s where s.id is not null', sources)
    using p_candidates;
end;
$$;

revoke execute on function public.revisions_in_use(uuid[]) from anon, public, authenticated;

/** 인자가 달라졌으므로 옛 함수는 남겨 두지 않는다 — 두 벌이 있으면 하나만 고쳐진다 */
drop function public.revisions_in_use();

-- 좁힘이 값싸지려면 가리키는 쪽에 인덱스가 있어야 한다. FK 는 인덱스를 만들지 않는다.
create index match_request_by_requester_revision
  on public.match_request (requester_revision_id);
create index match_request_by_addressee_revision
  on public.match_request (addressee_revision_id);
create index match_by_low_revision on public.match (low_revision_id);
create index match_by_high_revision on public.match (high_revision_id);
create index discovery_profile_by_element_revision
  on public.discovery_profile (element_revision_id);

create or replace function public.retain_person_revisions(p_person_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidates uuid[];
  removed integer;
begin
  if p_person_id is null then
    return 0;
  end if;

  select array_agg(r.id) into candidates
  from public.person_chart_revision r where r.person_id = p_person_id;

  if candidates is null then
    return 0;
  end if;

  with in_use as materialized (
    select u.id from public.revisions_in_use(candidates) as u(id)
  ),
  spare as (
    select r.id, r.created_at
    from public.person_chart_revision r
    where r.person_id = p_person_id
      and not exists (select 1 from in_use i where i.id = r.id)
  ),
  kept as (
    select s.id from spare s order by s.created_at desc, s.id desc limit 2
  ),
  gone as (
    delete from public.person_chart_revision r
    where r.id in (select s.id from spare s)
      and r.id not in (select k.id from kept k)
    returning 1
  )
  select count(*)::int into removed from gone;

  return removed;
end;
$$;

-- ---------------------------------------------------------------------------
-- 한꺼번에 무효가 된 요청은 한 번에 센다
-- ---------------------------------------------------------------------------

/**
 * 행마다 세지 않는다.
 *
 * `invalidate_pending_requests` 는 한 사람의 pending 을 **한 문장으로** 무효화한다.
 * 행 트리거로 두면 그 한 문장이 요청 수만큼 정리를 부르고, 정리마다 양쪽 사람을
 * 훑는다. 문장 트리거로 두면 갈아입은 상태를 한 번에 모아 사람별로 한 번씩만 센다.
 */
drop trigger settled_request_frees_revisions on public.match_request;
drop function public.settled_request_frees_revisions();

create or replace function public.settled_requests_free_revisions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.retain_person_revisions(t.person_id)
  from (
    select distinct u.self_person_id as person_id
    from settled s
    join previous p on p.id = s.id
    join public.app_user u on u.id in (s.requester_user_id, s.addressee_user_id)
    where s.status is distinct from p.status
      and s.status in ('rejected', 'invalidated', 'cancelled')
      and u.self_person_id is not null
  ) t;

  return null;
end;
$$;

create trigger settled_requests_free_revisions
after update on public.match_request
referencing old table as previous new table as settled
for each statement execute function public.settled_requests_free_revisions();

-- ---------------------------------------------------------------------------
-- 판본 저장은 그 사람 자리에서 줄을 선다
-- ---------------------------------------------------------------------------

/**
 * **묻기 전에 잠근다.**
 *
 * 지금 판본이 무엇인지 잠그지 않고 읽으면, 두 저장이 둘 다 「안 바뀌었네」 또는 둘 다
 * 「바뀌었네」를 보고 나란히 나아간다. 나아가면 새 판본을 먼저 넣고(부모 행에 key
 * share) 그 다음 `person.current_revision_id` 를 고치는데(같은 행에 더 센 잠금), 둘이
 * 서로가 든 것을 서로 기다려 deadlock 이 난다(재현했다: 300 회씩 두 갈래, 40P01).
 *
 * Person 행을 먼저 잠그면 두 저장이 줄을 선다. 뒤에 선 쪽은 앞의 결과를 보고 다시
 * 판정하므로 **같은 값을 두 번 저장해 판본이 둘이 되는 일도 함께 없어진다.**
 *
 * 잠그는 차례는 Person → app_user 다(`invalidate_pending_requests` 가 뒤에서 계정을
 * 잠근다). 반대 차례로 두 자원을 잡는 길은 없다.
 */
create or replace function public.add_person_revision(
  p_person_id uuid,
  p_calendar text,
  p_original_date date,
  p_solar_date date,
  p_birth_time time,
  p_gender text,
  p_city text,
  p_late_night_rule text,
  p_time_basis text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_fingerprint text;
  next_fingerprint text;
  new_revision uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if (select status from public.app_user where id = actor) <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  -- 정책이 묻는 것과 **같은 함수**에 묻는다.
  if not public.may_add_revision(p_person_id, actor) then
    raise exception '이 사람의 출생정보를 고칠 수 없습니다.' using errcode = '42501';
  end if;

  -- **자격을 묻고 나서 쓰는 함수는 그 사이를 잠근다.** 지금 판본을 읽기 전에 잡는다.
  perform 1 from public.person where id = p_person_id for update;

  next_fingerprint := public.revision_fingerprint(
    p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis);

  select r.fingerprint into current_fingerprint
  from public.person p join public.person_chart_revision r on r.id = p.current_revision_id
  where p.id = p_person_id;

  -- 아무것도 안 바뀌었으면 쌓지 않는다. **조회는 판본을 만들지 않는다**(ADR 0011).
  if current_fingerprint = next_fingerprint then
    return (select current_revision_id from public.person where id = p_person_id);
  end if;

  insert into public.person_chart_revision (
    person_id, calendar, original_date, solar_date, birth_time,
    gender, city, late_night_rule, time_basis, created_by
  )
  values (
    p_person_id, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, actor
  )
  returning id into new_revision;

  update public.person set current_revision_id = new_revision where id = p_person_id;

  -- ADR 0004 — Evidence 를 바꾸는 수정이 pending 요청을 무효화한다.
  perform public.invalidate_pending_requests(public.claimed_by(p_person_id));

  -- ADR 0011 — 아무것도 가리키지 않게 된 이전 입력은 최근 둘까지만 남는다.
  perform public.retain_person_revisions(p_person_id);

  return new_revision;
end;
$$;

revoke execute on function public.add_person_revision(
  uuid, text, date, date, time, text, text, text, text) from anon, public;
grant execute on function public.add_person_revision(
  uuid, text, date, date, time, text, text, text, text) to authenticated;
