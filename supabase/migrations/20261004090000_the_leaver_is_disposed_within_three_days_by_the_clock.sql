-- 탈퇴의 처분을 **크론이 한다** — 신청 뒤 3일 안에, 운영자 없이 (G-53, ADR 0094 덧)
--
-- 2026-09-23 까지는 운영자가 runbook 의 질의로 대기 중인 계정을 보고 `forget_user` 한 줄을 쳤다.
-- 기한은 「영업일 3일」이었고 그것을 세는 자리는 운영자의 달력뿐이었다. 사람의 결정으로 둘을 바꾼다.
--
--   · **달력의 3일이다.** 주말 · 공휴일을 안 가른다. 공휴일 자료도 외부 달력도 안 쓴다
--   · **앱에서 신청한 경우 하나만 대상이다.** 시계는 `app_user.deletion_requested_at`(신청 시각)이다.
--     연락처로 요청하는 경로는 두지 않는다
--
-- ## 언제 처분하나 — 신청 뒤 하루가 지나면 집는다
--
-- 신청 즉시가 아니라 하루를 두는 것은 **되돌릴 틈**이다. 앱에는 신청을 거두는 버튼이 없고,
-- 잘못 눌렀다는 연락이 오면 운영자가 상태를 `active` 로 되돌린다(runbook) — 처분 뒤에는 길이 없다.
-- 남은 이틀은 **다시 시도할 여유**다. 크론이 한 시간마다 돌므로 첫 시도는 신청 뒤 24~25시간이고,
-- 실패해도 기한(72시간)까지 스무 번 넘게 다시 집는다.
--
-- ## 한 계정이 실패해도 다른 계정은 간다
--
-- 계정마다 따로 감싼다(`begin … exception`). 처분과 흔적 검사가 한 덩어리라 흔적이 남으면
-- 처분째 되감기고 — 계정은 그대로 대기에 남아 다음 시간에 다시 집힌다. **흔적이 남은 계정을
-- 성공으로 적지 않는다**는 것이 이 모양의 요점이다.
--
-- ## 기록 — 누구였는지는 성공하면 안 남긴다
--
-- `account_disposal` 이 시도를 센다. 실패한 줄은 아직 살아 있는 계정의 id 를 든다(다시 집고
-- 운영자가 읽어야 하므로). **성공하면 그 칸을 비운다** — 지운 사람의 id 를 처분 기록이 들고
-- 있으면 지운 것이 아니다. 남는 것은 신청 시각 · 처분 시각 · 시도 수뿐이다.

create table public.account_disposal (
  id uuid primary key default gen_random_uuid(),
  /** 처분을 기다리는 계정. 처분이 끝나면 비운다 — 지운 사람을 가리키지 않는다 */
  user_id uuid unique,
  requested_at timestamptz not null,
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  last_error text check (last_error is null or length(last_error) <= 500),
  disposed_at timestamptz,
  constraint disposed_forgets_who check ((disposed_at is null) = (user_id is not null))
);

comment on table public.account_disposal is
  '탈퇴 처분의 시도 기록 — 처분이 끝나면 누구였는지(user_id)를 비운다. 크론(dispose_requested_accounts)만 쓴다.';

alter table public.account_disposal enable row level security;
revoke all on public.account_disposal from anon, authenticated, service_role;

/** 신청 뒤 이만큼 지나면 집는다 — 위 「언제 처분하나」 */
create or replace function public.account_disposal_grace()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '1 day' $$;

/** 이 안에 끝나야 한다 — 화면과 처리방침이 말하는 수 */
create or replace function public.account_disposal_deadline()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '3 days' $$;

revoke execute on function public.account_disposal_grace() from anon, public, authenticated, service_role;
revoke execute on function public.account_disposal_deadline() from anon, public, authenticated, service_role;

/**
 * 처분 뒤 **그 사람의 흔적이 남았나** — 남은 자리의 이름들. 빈 배열이면 깨끗하다.
 *
 * 자리를 손으로 나열하지 않는다. `auth.users` · `app_user` 를 가리키는 FK 전부를 카탈로그에서
 * 읽어 센다 — 새 표가 생겨도 여기를 안 고친다. FK 가 없는 자리 셋(감사 로그 · 로그인 중간
 * 상태 · 계정 자체)과, 트리거가 비우는 **떠난 쪽의 여덟 글자**는 따로 센다.
 *
 * @param p_matches 처분 **전에** 그 사람이 들어 있던 Match 들 — 처분 뒤에는 칸이 비어 못 찾는다
 */
create or replace function public.account_residue(
  p_user_id uuid, p_mail text, p_matches uuid[], p_sides text[])
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  found text[] := array[]::text[];
  fk record;
  n integer;
begin
  if exists (select 1 from auth.users u where u.id = p_user_id) then
    found := array_append(found, 'auth.users');
  end if;

  if exists (
    select 1 from auth.audit_log_entries a
    where a.payload ->> 'actor_id' = p_user_id::text
       or (p_mail is not null and a.payload ->> 'actor_username' = p_mail)
  ) then
    found := array_append(found, 'auth.audit_log_entries');
  end if;

  if exists (select 1 from auth.flow_state f where f.user_id = p_user_id) then
    found := array_append(found, 'auth.flow_state');
  end if;

  for fk in
    select c.conrelid::regclass::text as tbl, a.attname::text as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid in ('auth.users'::regclass, 'public.app_user'::regclass)
  loop
    execute format('select count(*) from %s where %I = $1', fk.tbl, fk.col)
      into n using p_user_id;
    if n > 0 then
      found := array_append(found, (fk.tbl || '.' || fk.col));
    end if;
  end loop;

  -- 떠난 쪽의 동의 당시 여덟 글자 — 트리거 `match_forgets_the_leavers_chart` 가 비운다
  if exists (
    select 1
    from public.match m
    join unnest(p_matches, p_sides) as s(match_id, side) on s.match_id = m.id
    where (s.side = 'low' and (m.chart_low is not null or m.chart_engine_low is not null))
       or (s.side = 'high' and (m.chart_high is not null or m.chart_engine_high is not null))
  ) then
    found := array_append(found, 'public.match.chart');
  end if;

  return found;
end;
$$;

revoke execute on function public.account_residue(uuid, text, uuid[], text[])
  from anon, public, authenticated, service_role;

/**
 * 한 시간마다 — 신청 뒤 하루가 지난 탈퇴 대기를 처분한다.
 *
 * **여러 번 돌아도 안전하다.** 집는 것은 아직 대기 중인 계정뿐이고(처분된 계정은 행이 없다),
 * 두 실행이 겹치면 `skip locked` 가 같은 계정을 두 번 안 집는다.
 *
 * 알리는 것은 셋뿐이다 — 실패(`account-disposal-failed`), 기한을 넘긴 계정
 * (`account-disposal-overdue`, 사람의 조치가 필요하다). 성공은 안 알린다.
 *
 * @returns 이번에 처분한 수
 */
create or replace function public.dispose_requested_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  due record;
  mail text;
  matches uuid[];
  sides text[];
  left_over text[];
  done integer := 0;
begin
  for due in
    select a.id, a.deletion_requested_at
    from public.app_user a
    where a.status = 'deletion_requested'
      and a.deletion_requested_at <= now() - public.account_disposal_grace()
    order by a.deletion_requested_at
    for update skip locked
  loop
    insert into public.account_disposal (user_id, requested_at)
    values (due.id, due.deletion_requested_at)
    on conflict (user_id) do nothing;

    update public.account_disposal
    set attempts = attempts + 1, last_attempt_at = now()
    where user_id = due.id;

    begin
      select u.email into mail from auth.users u where u.id = due.id;

      select coalesce(array_agg(m.id), array[]::uuid[]),
             coalesce(array_agg(case when m.user_low = due.id then 'low' else 'high' end), array[]::text[])
      into matches, sides
      from public.match m
      where due.id in (m.user_low, m.user_high);

      perform public.forget_user(due.id);

      left_over := public.account_residue(due.id, mail, matches, sides);
      if cardinality(left_over) > 0 then
        raise exception '처분 뒤 흔적이 남았다: %', array_to_string(left_over, ', ');
      end if;

      update public.account_disposal
      set user_id = null, disposed_at = now(), last_error = null
      where user_id = due.id;

      done := done + 1;
    exception
      when others then
        update public.account_disposal
        set last_error = left(sqlerrm, 500)
        where user_id = due.id;

        perform public.notify_ops(
          'account-disposal-failed',
          format('탈퇴 처분이 실패했다 — 계정 %s, 신청 %s: %s',
                 due.id, due.deletion_requested_at, left(sqlerrm, 200)));
    end;
  end loop;

  -- 기한을 넘긴 대기 — 실패가 쌓였거나 크론이 멈췄다. 사람이 볼 차례다
  if exists (
    select 1 from public.app_user a
    where a.status = 'deletion_requested'
      and a.deletion_requested_at <= now() - public.account_disposal_deadline()
  ) then
    perform public.notify_ops(
      'account-disposal-overdue',
      format('신청 뒤 3일이 지난 탈퇴 대기가 %s건 있다 — runbook 「탈퇴 신청의 처리」',
             (select count(*) from public.app_user a
              where a.status = 'deletion_requested'
                and a.deletion_requested_at <= now() - public.account_disposal_deadline())));
  end if;

  return done;
end;
$$;

revoke execute on function public.dispose_requested_accounts()
  from anon, public, authenticated, service_role;

/**
 * 이름으로 지우고 다시 건다 — 두 번 돌리면 일정이 둘이 되지 않게(`match-request-expiry` 와 같다).
 * 매시 23분 — 다른 두 잡(매분 · 매시 7분)과 겹치지 않는 자리.
 */
select cron.unschedule('account-disposal')
where exists (select 1 from cron.job where jobname = 'account-disposal');

select cron.schedule('account-disposal', '23 * * * *', 'select public.dispose_requested_accounts()');
