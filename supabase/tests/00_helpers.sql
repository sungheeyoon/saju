-- 시험이 공유하는 손잡이 — 시험이 아니라 도구다. plan 을 세우지 않는다.
--
-- `supabase test db` 는 이름 순으로 돌리므로 이 파일이 먼저 선다. 여기서 만든 것은
-- 로컬 DB 에만 남는다 — `supabase/tests/` 는 원격으로 올라가지 않는다.

create extension if not exists pgtap with schema extensions;
create schema if not exists tests;

-- pg_prove 는 plan 이 없는 파일을 「망가진 시험」으로 읽는다. 도구 파일이라도
-- 한 줄은 세워 둔다 — 손잡이가 안 서면 나머지가 전부 이유 없이 무너지므로,
-- 그 자리를 여기서 먼저 알려 주는 것이 맞다.
select plan(2);

/**
 * 가입만 한다 — **안내는 아직 안 봤다.**
 *
 * 초대 훅은 GoTrue 안에서 도는 것이라 여기서는 지나간다 — 훅 자체는 함수를 직접
 * 불러 따로 잰다. 여기서 재려는 것은 **가입한 뒤에 무엇이 보이는가**다.
 *
 * `security definer` 인 것은 역할을 `authenticated` 로 바꾼 뒤에도 부를 수 있게
 * 하려는 것이다.
 */
create or replace function tests.signup_raw(signup_email text)
returns uuid
language plpgsql
security definer
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
          signup_email, now(), now());
  return new_id;
end;
$$;

/**
 * 가입하고 **안내까지 지난** 척한다.
 *
 * 첫 입력 앞에 관문이 하나 생겼다(`create_self_person`). 실제 사람은 안내 화면을
 * 지나며 그 값을 남기므로, 「가입한 사람」을 흉내 내는 이 손잡이도 같은 자리를 지난다 —
 * 안 지나면 거의 모든 파일이 사주를 못 만들고, 그러면 이 관문 하나가 다른 모든 시험을
 * 막는다.
 *
 * 선택 동의는 **거절해 둔다.** 필요한 파일이 켜면 되고, 기본값이 참이면 「동의한
 * 사람에게만」을 재는 시험이 우연히 통과한다.
 */
create or replace function tests.signup(signup_email text)
returns uuid
language plpgsql
security definer
as $$
declare
  new_id uuid := tests.signup_raw(signup_email);
begin
  /*
    일정도 함께 세운다 — 확인 기록이 **본 날짜**를 들기 때문이다. 없으면 `/me` 관문이
    「일정이 바뀌었다」로 읽고 모두를 안내 화면으로 돌려보낸다.
  */
  insert into public.beta_schedule
    (ends_on, note, operator_name, operator_officer, operator_contact)
  select '2026-10-31'::date, '시험', '만세력 운영자', '시험 담당', 'ops@example.com'
  where not exists (select 1 from public.beta_schedule);

  update public.app_user
  set notice_version = 'notice-for-tests',
      notice_schedule_id = (select s.schedule_id from public.current_beta_schedule() s),
      notice_ends_on = (select s.ends_on from public.current_beta_schedule() s),
      notice_ack_at = now(),
      improvement_consent = false,
      contact_consent = false
  where id = new_id;
  return new_id;
end;
$$;

/**
 * 그 사람의 JWT 를 든 척하는 문장 — 시험 파일이 그대로 실행한다.
 *
 * 역할까지 바꾸는 것이 핵심이다. `postgres` 로 재면 표 소유자라 RLS 를 그냥
 * 지나가고, 그러면 「막힌다」를 한 번도 못 잰 채 전부 통과한다.
 *
 *   set local role authenticated;
 *   select set_config('request.jwt.claims', tests.claims(actor), true);
 */
create or replace function tests.claims(actor uuid)
returns text
language sql
immutable
as $$
  select json_build_object('sub', actor::text, 'role', 'authenticated')::text;
$$;

-- 시험은 역할을 `authenticated` 로 바꾼 채로 이 손잡이들을 부른다.
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

select has_function('tests', 'signup', array['text'], '가입한 척하는 손잡이가 선다');
select has_function('tests', 'signup_raw', array['text'], '안내를 안 본 손잡이도 선다');
select * from finish();
