-- 확인은 **그 안내를 쓴 줄**에 매인다 — 그리고 끝나면 설문도 안 받는다
--
-- 확인 기록이 판본과 **종료일**을 들었다. 그것으로는 못 잡는 것이 있다.
--
--   · 처리방침 본문이 크게 바뀌었는데 판본을 안 올리면 아무도 다시 안 본다
--   · 같은 날짜로 **운영자 정보만** 바꾸면 날짜가 그대로라 아무도 다시 안 본다
--
-- 안내의 내용은 **그 표의 한 줄**이 든다(날짜와 운영자). 그러면 비교할 것은 날짜가
-- 아니라 **줄 자체**다. 어느 칸이 바뀌든 새 줄이 되므로, 줄 번호를 견주면 무엇이
-- 바뀌었는지 일일이 셈하지 않아도 된다 — 「무엇을 보여 주었나」에 한 값으로 답한다.
--
-- 문구 판본(`NOTICE_VERSION`)은 그대로 든다. 그것은 코드가 든 내용이라 표가 모른다.

/**
 * **그 줄이 사라지면 확인도 풀린다.**
 *
 * `on delete set null` 이다. 지워진 줄을 계속 가리키게 두면 「무엇을 보여 주었나」에
 * 없는 것을 가리키는 값으로 답하게 되고, `restrict` 로 두면 잘못 넣은 줄을 못 지운다.
 * 풀리면 관문이 지금 안내를 다시 보여 준다 — 그것이 맞는 답이다.
 */
alter table public.app_user add column notice_schedule_id bigint
  references public.beta_schedule (id) on delete set null;

/**
 * 운영자 정보에 **공백을 못 넣는다.**
 *
 * `not null` 만으로는 `''` 가 지나간다. 빈 문자열이 든 안내는 「연락처가 있다」로 판정
 * 되면서 화면에는 아무것도 안 적히는 자리를 만든다 — 없는 것보다 나쁘다.
 */
alter table public.beta_schedule drop constraint operator_is_whole;
alter table public.beta_schedule add constraint operator_is_whole check (
  (operator_name is null) = (operator_officer is null)
  and (operator_name is null) = (operator_contact is null)
  and (operator_name is null or (
    length(btrim(operator_name)) > 0
    and length(btrim(operator_officer)) > 0
    and length(btrim(operator_contact)) > 0))
);

/** 지금 안내 — **줄 번호를 함께 낸다.** 견줄 것이 그 값이다 */
drop function if exists public.current_beta_schedule();

create or replace function public.current_beta_schedule()
returns table (
  schedule_id bigint,
  ends_on date,
  purge_by date,
  purge_within_days integer,
  operator_name text,
  operator_officer text,
  operator_contact text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, s.ends_on, s.ends_on + s.purge_within_days, s.purge_within_days,
    s.operator_name, s.operator_officer, s.operator_contact
  from public.beta_schedule s
  order by s.id desc
  limit 1;
$$;

revoke execute on function public.current_beta_schedule() from public;
grant execute on function public.current_beta_schedule() to anon, authenticated;

/**
 * 확인을 남긴다 — **본 줄**을 함께 받는다.
 *
 * 날짜 대신 줄 번호를 받는다. 같은 날짜로 운영자만 바꿔도 새 줄이므로, 그때도 다시
 * 물어야 한다는 것이 값에서 저절로 따라온다.
 */
create or replace function public.acknowledge_notice(
  p_version text,
  p_schedule_id bigint,
  p_improvement boolean,
  p_contact boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_row record;
begin
  if p_version is null or length(btrim(p_version)) = 0 then
    raise exception '안내 판본을 알 수 없습니다.' using errcode = 'check_violation';
  end if;

  if p_improvement is null or p_contact is null then
    raise exception '선택 항목에 답해 주세요.' using errcode = 'check_violation';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = 'check_violation';
  end if;

  select * into now_row from public.current_beta_schedule();

  if not found or now_row.operator_contact is null then
    raise exception '아직 테스트 기간이 정해지지 않았습니다.' using errcode = 'check_violation';
  end if;

  if p_schedule_id is distinct from now_row.schedule_id then
    raise exception '안내가 바뀌었습니다. 새로고침 후 다시 확인해 주세요.'
      using errcode = 'check_violation';
  end if;

  update public.app_user u
  set notice_version = p_version,
      notice_schedule_id = now_row.schedule_id,
      notice_ends_on = now_row.ends_on,
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

drop function if exists public.acknowledge_notice(text, date, boolean, boolean);

revoke execute on function public.acknowledge_notice(text, bigint, boolean, boolean)
  from anon, public;
grant execute on function public.acknowledge_notice(text, bigint, boolean, boolean)
  to authenticated;

/**
 * 설문도 끝난 뒤에는 안 받는다.
 *
 * 자격을 `reading_scope_for` 에 물었는데 그 함수는 `status` 열만 본다 — 종료일이 그
 * 길에 안 닿았다. 풀이 생성에서 이미 한 번 만난 자리이고, 같은 이유로 여기도 새 답을
 * 받고 있었다. **끝난 서비스가 새 자료를 받으면 안 된다.**
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

  if not exists (
    select 1 from public.reading_scope_for(
      (select auth.uid()), run.kind, run.person_a, run.person_b, run.match_id) s
    where s.person_a is not distinct from run.person_a
      and s.person_b is not distinct from run.person_b
      and s.match_id is not distinct from run.match_id
  ) then
    raise exception '답할 풀이를 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = 'check_violation';
  end if;

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
