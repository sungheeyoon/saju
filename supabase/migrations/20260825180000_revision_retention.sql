-- 판본 보존 — 개수보다 **참조**가 먼저다
--
-- ADR 0004 는 「고칠 때마다 덮어쓰지 않는다」를 정했다. 그 말이 「모든 이전 입력을
-- 영원히 든다」는 뜻으로 읽혀 왔고, 지금 DB 가 하는 일이 정확히 그것이다. ADR 0011 이
-- 그 둘을 갈랐다 — 과거 동의와 결과를 재현하는 데 필요한 판본과, 더는 아무 사건도
-- 가리키지 않는 이전 입력은 **수명이 다르다.**
--
-- 여기서 하는 일은 둘이다.
--
-- 1. 성립하지 않은 요청이 판본을 붙들고 있던 것을 놓게 한다. 거절·무효·거둠은 사건과
--    시각과 이유와 **지문**을 남기지, 그 요청 하나 때문에 정확한 과거 출생 입력을
--    영구 보존하지 않는다.
-- 2. 아무 기록도 가리키지 않는 이전 판본을 최근 두 개까지만 둔다. 전체 표에 세 행만
--    허용하는 것이 **아니다** — 여러 Match 가 서로 다른 입력을 정당하게 붙들고 있으면
--    참조된 판본은 셋을 넘는다.

-- ---------------------------------------------------------------------------
-- 쌓인 차례가 뜻을 가진다
-- ---------------------------------------------------------------------------

/**
 * `created_at` 이 표시용이던 것이 오늘부터 **판정에 쓰인다** — 어느 것이 가장 오래된
 * 미참조 판본인지를 이 값이 정한다.
 *
 * `now()` 는 트랜잭션이 열린 시각이라 한 트랜잭션 안에서 쌓인 둘에게 **같은 값**을
 * 준다. 그러면 「가장 오래된 것을 지운다」가 둘 중 아무것이나 지우는 일이 되고, 그것을
 * 재려는 시험은 실행마다 다른 답을 본다(pgTAP 은 파일 하나가 한 트랜잭션이다).
 *
 * 행이 쓰인 시각을 쓴다. 판본은 append 되는 기록이라 이쪽이 원래 뜻에도 맞다.
 */
alter table public.person_chart_revision
  alter column created_at set default clock_timestamp();

-- ---------------------------------------------------------------------------
-- 요청은 지문을 든다 — 판본을 놓아도 「무엇에 대한 요청이었나」가 남게
-- ---------------------------------------------------------------------------

alter table public.match_request
  add column requester_fingerprint text,
  add column addressee_fingerprint text;

/**
 * 요청이 잡은 두 입력의 지문.
 *
 * **손으로 적을 자리를 남기지 않는다**(`revision_fingerprint` 와 같은 규율). 호출부가
 * 채워 넣게 하면 잊을 수 있는 자리가 하나 생기고, 그 자리가 잊히는 순간 판본을 놓은
 * 요청은 자기가 무엇에 대한 것이었는지 말하지 못한다.
 */
create or replace function public.set_request_fingerprints()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select r.fingerprint into new.requester_fingerprint
  from public.person_chart_revision r where r.id = new.requester_revision_id;

  select r.fingerprint into new.addressee_fingerprint
  from public.person_chart_revision r where r.id = new.addressee_revision_id;

  return new;
end;
$$;

create trigger request_fingerprints
before insert on public.match_request
for each row execute function public.set_request_fingerprints();

-- 이미 쌓인 요청도 같은 값을 든다. 판본을 놓기 **전에** 채워야 한다.
update public.match_request r
set requester_fingerprint = req.fingerprint,
    addressee_fingerprint = adr.fingerprint
from public.person_chart_revision req, public.person_chart_revision adr
where req.id = r.requester_revision_id and adr.id = r.addressee_revision_id;

alter table public.match_request
  alter column requester_fingerprint set not null,
  alter column addressee_fingerprint set not null;

-- ---------------------------------------------------------------------------
-- 성립하지 않은 요청은 판본을 놓는다
-- ---------------------------------------------------------------------------

alter table public.match_request
  alter column requester_revision_id drop not null,
  alter column addressee_revision_id drop not null;

/**
 * **판본을 드는 것은 아직 결정되지 않았거나 성립한 요청뿐이다.**
 *
 * `pending` 은 수락 여부를 정할 때까지 양쪽 입력을 붙든다 — 동의한 대상과 계산 대상이
 * 같은지 수락 순간에 다시 물어야 하기 때문이다. `accepted` 는 Match 가 같은 두 행을
 * 이어받으므로 붙들어도 더 보존되는 것이 없다.
 *
 * 나머지 셋은 놓는다. 둘 중 하나만 놓는 상태는 만들 수 없다 — 한쪽만 남으면 「이 요청은
 * 판본을 드는가」에 답이 둘이 된다.
 */
alter table public.match_request
  add constraint revision_is_held_only_while_it_decides check (
    case when status in ('pending', 'accepted')
      then requester_revision_id is not null and addressee_revision_id is not null
      else requester_revision_id is null and addressee_revision_id is null
    end
  );

/**
 * 놓는 일을 **호출부가 기억하지 않는다.**
 *
 * 요청이 terminal 로 가는 자리가 넷이다 — 거절(`respond_to_match_request`), 거둠
 * (`cancel_match_request`), 무효(`invalidate_pending_requests` · 수락 직전 판본 확인),
 * 차단(`block_user`). 넷 다에 「판본을 null 로」를 적으면 언젠가 하나만 안 고쳐지고,
 * 안 고쳐진 쪽은 언제나 더 오래 붙드는 쪽이다.
 */
create or replace function public.settled_request_releases_revisions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('rejected', 'invalidated', 'cancelled') then
    new.requester_revision_id := null;
    new.addressee_revision_id := null;
  end if;
  return new;
end;
$$;

create trigger settled_request_releases_revisions
before update on public.match_request
for each row execute function public.settled_request_releases_revisions();

-- ---------------------------------------------------------------------------
-- 무엇이 참조되고 있는가 — **표를 손으로 세지 않는다**
-- ---------------------------------------------------------------------------

/**
 * 지금 어떤 판본이 어딘가에 매여 있는가.
 *
 * 표 이름을 적어 두고 훑을 수도 있었다. 그러면 Reading 이 붙는 날(PRD 9단계) 아무도
 * 이 함수를 다시 보지 않고, 그날 정리 작업은 **이미 공유된 결과의 근거를 지운다.**
 * 되돌릴 수 없는 삭제 앞에서 「빠뜨렸는지」를 사람의 기억에 맡길 수 없다.
 *
 * 그래서 묻는 자리를 FK 자체로 옮긴다. `person_chart_revision` 을 가리키는 외래키가
 * 하나라도 있으면 그 열이 여기 자동으로 선다. **정책은 「누가 FK 를 드는가」로 적히고,
 * 정리 함수는 그 정책을 읽기만 한다** — terminal 요청이 위에서 판본을 놓은 것이 곧
 * 「그 요청은 더 이상 참조가 아니다」라는 선언이 되는 이유다.
 */
create or replace function public.revisions_in_use()
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  sources text;
begin
  select string_agg(
    format('select %I as id from %I.%I', a.attname, n.nspname, c.relname),
    ' union all ')
  into sources
  from pg_constraint k
  join pg_class c on c.oid = k.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
  where k.contype = 'f'
    and k.confrelid = 'public.person_chart_revision'::regclass
    and cardinality(k.conkey) = 1;

  -- 가리키는 표가 하나도 없으면 참조도 없다. 빈 문자열을 실행하지 않는다.
  if sources is null then
    return;
  end if;

  return query execute
    format('select s.id from (%s) s where s.id is not null', sources);
end;
$$;

revoke execute on function public.revisions_in_use() from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 정리 — 미참조 이전 판본은 최근 둘까지
-- ---------------------------------------------------------------------------

/**
 * 한 Person 의 미참조 이전 판본을 최근 두 개로 줄인다.
 *
 * 현재 판본은 `person.current_revision_id` 가 가리키므로 위 함수가 이미 지킨다 — 여기에
 * 「현재는 빼고」를 다시 적지 않는다. 세는 자리가 둘이면 하나를 잊는다.
 *
 * **uuid 를 받지만 남의 것을 묻는 문이 아니다.** 클라이언트 역할에서 부를 수 없게 막고,
 * 부르는 자리는 전부 DB 안이다. 이 함수가 내주는 것은 지운 개수뿐이라 남의 Person 을
 * 넣어도 알아낼 수 있는 것이 없지만, 그래도 문을 열어 두지 않는다.
 */
create or replace function public.retain_person_revisions(p_person_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  if p_person_id is null then
    return 0;
  end if;

  with in_use as materialized (
    select u.id from public.revisions_in_use() as u(id)
  ),
  spare as (
    select r.id, r.created_at
    from public.person_chart_revision r
    where r.person_id = p_person_id
      and not exists (select 1 from in_use i where i.id = r.id)
  ),
  -- **차례를 손으로 고정한다.** 같은 시각에 쌓인 둘이 있으면 `created_at` 만으로는
  -- 어느 것이 남는지 실행마다 달라진다(`discovery_board` 에서 같은 것을 겪었다).
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

revoke execute on function public.retain_person_revisions(uuid)
  from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 참조가 움직이는 자리에서 정리한다
-- ---------------------------------------------------------------------------

/**
 * 요청이 판본을 놓은 **뒤에** 센다.
 *
 * 위 트리거가 `before` 인 것과 짝이다. 놓기 전에 세면 그 요청이 아직 붙들고 있어서
 * 아무것도 지워지지 않고, 다음 수정이 올 때까지 그대로 남는다.
 *
 * 판본을 쌓는 길은 `add_person_revision` 이 스스로 정리하므로 여기 오지 않는다. 여기가
 * 잡는 것은 **입력은 그대로인데 참조만 사라지는** 경우다 — 수락 직전 판본이 어긋나
 * 무효가 되거나, 차단이 살아 있던 요청을 거두는 자리.
 */
create or replace function public.settled_request_frees_revisions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('rejected', 'invalidated', 'cancelled')
  then
    perform public.retain_person_revisions(u.self_person_id)
    from public.app_user u
    where u.id in (new.requester_user_id, new.addressee_user_id);
  end if;

  return null;
end;
$$;

create trigger settled_request_frees_revisions
after update on public.match_request
for each row execute function public.settled_request_frees_revisions();

/**
 * 풀에 올린 요약이 새 판본으로 옮겨 가면 옛 판본은 그때 미참조가 된다.
 *
 * `refresh_discovery_summary` 안에 한 줄을 적을 수도 있었다. 트리거로 두는 것은 그
 * 열을 옮기는 자리가 하나가 아니기 때문이다 — 참여를 끄는 길도 이 열을 비운다.
 */
create or replace function public.moved_summary_frees_revisions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.element_revision_id is distinct from old.element_revision_id then
    perform public.retain_person_revisions(u.self_person_id)
    from public.app_user u
    where u.id = new.user_id;
  end if;

  return null;
end;
$$;

create trigger moved_summary_frees_revisions
after update of element_revision_id on public.discovery_profile
for each row execute function public.moved_summary_frees_revisions();

-- ---------------------------------------------------------------------------
-- 판본을 쌓는 자리 — 마지막 한 줄이 늘었다
-- ---------------------------------------------------------------------------

/**
 * 되쓰는 바탕은 이 함수가 **마지막에 서 있던 정의**다
 * (`20260825120000_match_request.sql`). 처음 것을 베끼면 그 뒤에 다른 층에서 푼 것이
 * 조용히 되감긴다.
 *
 * **차례가 뜻을 가진다.** 무효화가 먼저 돌아야 그 요청들이 판본을 놓고, 놓은 뒤에 세야
 * 방금 미참조가 된 것이 이번 정리에 든다. 뒤집으면 옛 판본은 한 번 더 살아남는다.
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

  next_fingerprint := public.revision_fingerprint(
    p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis);

  select r.fingerprint into current_fingerprint
  from public.person p join public.person_chart_revision r on r.id = p.current_revision_id
  where p.id = p_person_id;

  -- 아무것도 안 바뀌었으면 쌓지 않는다. **조회는 판본을 만들지 않는다**(ADR 0011) —
  -- 요청도 그대로 살고, 정리할 것도 생기지 않는다.
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

  -- ADR 0004 — Evidence 를 바꾸는 수정이 pending 요청을 무효화한다. 같은 트랜잭션이라
  -- 그 사이에 낀 수락이 없다.
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

-- ---------------------------------------------------------------------------
-- 이미 쌓여 있는 것도 같은 규칙 아래로
-- ---------------------------------------------------------------------------

/**
 * 이 마이그레이션 전에 쌓인 미참조 판본은 규칙 밖에 있었다. 규칙이 오늘부터만 도는
 * 것이라면 「최근 둘」은 새로 가입한 사람에게만 참이 된다.
 */
select public.retain_person_revisions(p.id) from public.person p;
