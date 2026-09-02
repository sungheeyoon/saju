-- 날짜는 언제든 옮길 수 있다 — 그리고 **옮기면 다시 알린다**
--
-- 종료일을 코드 상수로 두었다. 바꾸려면 배포해야 하고, 그건 「언제든」이 아니다.
-- 표로 옮긴다. 다만 옮기는 순간 하나가 따라온다 — **이미 안내를 본 사람은 다른 날짜를
-- 본 사람이다.** 보유기간이 바뀌면 그건 알린 내용이 바뀐 것이고, 다시 알려야 한다.
--
-- 그래서 확인 기록이 **판본과 날짜를 함께** 든다. ADR 0024 는 「날짜는 문구가 아니므로
-- 판본에 안 넣는다」고 적었는데, 그 근거는 「그날까지 아무도 이 안내를 본 적이 없다」였다.
-- 날짜가 실행 중에 움직이는 순간 그 근거가 사라진다.

-- ---------------------------------------------------------------------------
-- 일정 — **덮어쓰지 않고 쌓는다**
-- ---------------------------------------------------------------------------

/**
 * 언제 끝나고 언제까지 지우는가.
 *
 * **한 줄을 고치지 않고 새 줄을 넣는다.** 이것은 사용자에게 한 약속이고, 약속은 바뀐
 * 기록이 남아야 무엇을 언제 약속했는지 답할 수 있다. `update` 로 덮으면 「우리가 그때
 * 뭐라고 했더라」에 답할 방법이 없다.
 *
 * 지금 값은 **가장 나중에 넣은 줄**이다. 비어 있으면 아직 정하지 않은 것이고, 그동안은
 * 아무도 시작할 수 없다 — 못 지나가는 것이 이 값을 잊지 않게 하는 장치다(ADR 0024).
 */
create table public.beta_schedule (
  id bigint generated always as identity primary key,
  /** 베타가 끝나는 날 */
  ends_on date not null,
  /** 종료 뒤 파기까지의 여유. 파기 기한은 이 둘에서 나며 따로 적지 않는다 */
  purge_within_days integer not null default 30
    check (purge_within_days between 1 and 365),
  /** 왜 이 날로 정했나 — 옮길 때 근거를 함께 남긴다 */
  note text,
  set_at timestamptz not null default now()
);

-- 표는 안 보인다. 이력은 운영자의 것이고, 화면에 필요한 것은 **지금 값 하나**뿐이다.
alter table public.beta_schedule enable row level security;
revoke all on public.beta_schedule from anon, authenticated;

/**
 * 지금 일정 — **로그인하지 않은 사람도 읽는다.**
 *
 * 처리방침은 초대 메일에 실리므로 로그인 없이 열려야 한다(ADR 0024). 그래서 `anon`
 * 에게도 연다. 내주는 것은 날짜 둘뿐이고, 그 둘은 처리방침이 이미 공개하는 값이다.
 *
 * 파기 기한을 **여기서 짓는다.** 부르는 쪽이 더하면 화면마다 더하게 되고, 그중 하나가
 * 다른 수를 더하는 날이 온다.
 */
create or replace function public.current_beta_schedule()
returns table (ends_on date, purge_by date, purge_within_days integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.ends_on, s.ends_on + s.purge_within_days, s.purge_within_days
  from public.beta_schedule s
  order by s.id desc
  limit 1;
$$;

revoke execute on function public.current_beta_schedule() from public;
grant execute on function public.current_beta_schedule() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 확인 기록이 **날짜도** 든다
-- ---------------------------------------------------------------------------

/**
 * 이 사람이 **어느 날짜를 보고** 확인했나.
 *
 * 없으면 일정이 바뀌어도 아무도 다시 안 묻게 된다 — 사용자는 11월에 지운다는 안내를
 * 보고 확인했는데 우리는 이듬해까지 들고 있게 되는 것이다.
 */
alter table public.app_user add column notice_ends_on date;

/**
 * 확인을 남긴다 — **본 날짜를 함께 받는다.**
 *
 * 화면이 들고 온 날짜가 지금 일정과 다르면 거절한다. 그 사람이 보고 있던 화면은 낡은
 * 것이고, 낡은 화면에 대고 누른 확인은 지금 약속에 대한 확인이 아니다.
 */
create or replace function public.acknowledge_notice(
  p_version text,
  p_ends_on date,
  p_improvement boolean,
  p_contact boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_ends date;
begin
  if p_version is null or length(btrim(p_version)) = 0 then
    raise exception '안내 판본을 알 수 없습니다.' using errcode = 'check_violation';
  end if;

  if p_improvement is null or p_contact is null then
    raise exception '선택 항목에 답해 주세요.' using errcode = 'check_violation';
  end if;

  select s.ends_on into now_ends from public.current_beta_schedule() s;

  if now_ends is null then
    raise exception '아직 테스트 기간이 정해지지 않았습니다.' using errcode = 'check_violation';
  end if;

  if p_ends_on is distinct from now_ends then
    raise exception '안내가 바뀌었습니다. 새로고침 후 다시 확인해 주세요.'
      using errcode = 'check_violation';
  end if;

  update public.app_user u
  set notice_version = p_version,
      notice_ends_on = now_ends,
      notice_ack_at = now(),
      improvement_consent = p_improvement,
      contact_consent = p_contact
  where u.id = (select auth.uid()) and u.status = 'active';

  if not found then
    raise exception '계정을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if p_improvement = false then
    delete from public.reading_feedback f
    where f.respondent_user_id = (select auth.uid());
  end if;
end;
$$;

-- 날짜를 안 받던 옛 문은 닫는다 — 남겨 두면 그 문으로 들어온 확인에 날짜가 안 남는다.
drop function if exists public.acknowledge_notice(text, boolean, boolean);

revoke execute on function public.acknowledge_notice(text, date, boolean, boolean)
  from anon, public;
grant execute on function public.acknowledge_notice(text, date, boolean, boolean)
  to authenticated;

/** 판본과 시각과 날짜는 함께 있거나 함께 없다 */
alter table public.app_user drop constraint notice_is_a_version_and_a_time;
alter table public.app_user add constraint notice_is_a_version_a_date_and_a_time check (
  (notice_version is null) = (notice_ack_at is null)
  and (notice_version is null) = (notice_ends_on is null)
);

-- ---------------------------------------------------------------------------
-- 설문 — **자격을 먼저 묻는다**
-- ---------------------------------------------------------------------------

/**
 * 검사 차례가 뒤집혀 있었다.
 *
 *   남의 `running`·`failed` 시도 id  →  `check_violation` (완성된 풀이에만…)
 *   남의 `succeeded` 시도 id         →  `no_data_found`  (찾지 못했습니다)
 *
 * 두 답이 다르면 **남의 시도가 어느 상태인지**를 되묻는 문이 된다. 「없는 것과 못 보는
 * 것을 가르지 않는다」고 적어 두고 상태로 갈라 답하고 있었다.
 *
 * 자격을 맨 앞에 세운다. 못 보는 사람에게는 어느 상태든 같은 답이다.
 */
create or replace function public.leave_reading_feedback(
  p_run_id uuid,
  p_usefulness smallint,
  p_perceived_fit smallint,
  p_felt_length text,
  p_issue_tags text[] default array[]::text[],
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  run record;
  consent boolean;
  tags text[];
  said text := nullif(btrim(p_comment), '');
begin
  select * into run from public.reading_run r where r.id = p_run_id;

  if not found then
    raise exception '답할 풀이를 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  /**
   * **자격이 먼저다.** 대상을 푸는 함수의 `self` 갈래는 `p_person_a` 를 안 보므로
   * (부른 사람의 selfPerson 을 스스로 찾는 것이 그 일이다) 「행이 있는가」만으로는
   * 부족하다 — 푼 대상이 이 시도의 대상과 같은지까지 본다.
   */
  if not exists (
    select 1 from public.reading_scope_for(
      (select auth.uid()), run.kind, run.person_a, run.person_b, run.match_id) s
    where s.person_a is not distinct from run.person_a
      and s.person_b is not distinct from run.person_b
      and s.match_id is not distinct from run.match_id
  ) then
    raise exception '답할 풀이를 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  -- 볼 수 있는 사람에게만 상태를 말한다. 못 보는 사람에게는 위에서 이미 끝났다.
  if run.status <> 'succeeded' then
    raise exception '완성된 풀이에만 답할 수 있습니다.' using errcode = 'check_violation';
  end if;

  select u.improvement_consent into consent
  from public.app_user u where u.id = (select auth.uid());

  if coalesce(consent, false) = false then
    raise exception '설문은 풀이 개선에 활용하는 데 동의하신 뒤에 받을 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  select coalesce(array_agg(distinct t order by t), array[]::text[]) into tags
  from unnest(coalesce(p_issue_tags, array[]::text[])) t;

  insert into public.reading_feedback (
    reading_run_id, respondent_user_id,
    usefulness, perceived_fit, felt_length, issue_tags, comment
  )
  values (
    p_run_id, (select auth.uid()),
    p_usefulness, p_perceived_fit, p_felt_length, tags, said
  )
  on conflict (reading_run_id, respondent_user_id) do update
  set usefulness = excluded.usefulness,
      perceived_fit = excluded.perceived_fit,
      felt_length = excluded.felt_length,
      issue_tags = excluded.issue_tags,
      comment = excluded.comment,
      submitted_at = now();
end;
$$;

revoke execute on function public.leave_reading_feedback(
  uuid, smallint, smallint, text, text[], text) from anon, public;
grant execute on function public.leave_reading_feedback(
  uuid, smallint, smallint, text, text[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- 잊는 일이 더 멀리 닿는다
-- ---------------------------------------------------------------------------

/**
 * `auth.users` 를 지워도 남는 것들이 있었다. **FK 가 없어서 cascade 가 안 닿는다.**
 *
 *   auth.audit_log_entries    로그인·로그아웃 기록. 확인해 보니 **모든 행이 이메일**을
 *                             `payload` 에 그대로 들고 있었다. 1225행 중 1225행.
 *   auth.flow_state           OAuth 왕복의 중간 상태. 지금은 비어 있지만 매여 있지 않다.
 *   public.invite             이메일과 운영자 메모. **일부러** 안 지우던 것이다.
 *
 * 앞의 둘은 놓친 것이고, 셋째는 정한 것이었다 — 「삭제는 접근 회수가 아니다」. 그런데
 * **삭제를 요청한 사람의 이메일을 명단에 남겨 두는 것**이 그 구분이 지키려던 것은
 * 아니다. 다시 들어오게 할 일이 생기면 다시 초대하면 된다.
 *
 * 감사 기록을 남겨야 한다면 그건 지우지 않는 것이 아니라 **별도의 근거와 보존 기간과
 * 가명처리 규칙**이 있어야 하는 일이다. 폐쇄 베타에는 그 셋이 없다.
 */
create or replace function public.forget_user(p_user_id uuid)
returns table (people_forgotten integer, revisions_forgotten integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched uuid[];
  gone integer;
  had integer;
  mail text;
begin
  select u.email into mail from auth.users u where u.id = p_user_id;

  if mail is null and not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception '그런 계정이 없습니다.' using errcode = 'no_data_found';
  end if;

  select coalesce(array_agg(e.person_id), array[]::uuid[]) into touched
  from public.user_person_access e where e.user_id = p_user_id;

  select count(*) into had
  from public.person_chart_revision r
  where r.person_id = any(touched)
    and not exists (
      select 1 from public.user_person_access e
      where e.person_id = r.person_id and e.user_id <> p_user_id
    );

  /*
    **먼저 매여 있지 않은 것부터.** `auth.users` 를 지우고 나면 이 행들을 찾을 열쇠가
    사라진다 — 감사 기록은 사용자 id 가 아니라 `payload` 안에 들고 있다.
  */
  delete from auth.audit_log_entries a
  where a.payload ->> 'actor_id' = p_user_id::text
     or (mail is not null and a.payload ->> 'actor_username' = mail);

  delete from auth.flow_state f where f.user_id = p_user_id;

  if mail is not null then
    delete from public.invite i where i.email = lower(mail);
  end if;

  delete from auth.users u where u.id = p_user_id;

  with cleaned as (
    delete from public.person p
    where p.id = any(touched)
      and not exists (
        select 1 from public.user_person_access e where e.person_id = p.id
      )
    returning 1
  )
  select count(*)::integer into gone from cleaned;

  return query select gone, had;
end;
$$;

revoke execute on function public.forget_user(uuid)
  from anon, public, authenticated, service_role;
