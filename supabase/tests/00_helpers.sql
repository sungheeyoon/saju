-- 시험이 공유하는 손잡이 — 시험이 아니라 도구다. plan 을 세우지 않는다.
--
-- `supabase test db` 는 이름 순으로 돌리므로 이 파일이 먼저 선다. 여기서 만든 것은
-- 로컬 DB 에만 남는다 — `supabase/tests/` 는 원격으로 올라가지 않는다.

create extension if not exists pgtap with schema extensions;
create schema if not exists tests;

-- pg_prove 는 plan 이 없는 파일을 「망가진 시험」으로 읽는다. 도구 파일이라도
-- 한 줄은 세워 둔다 — 손잡이가 안 서면 나머지가 전부 이유 없이 무너지므로,
-- 그 자리를 여기서 먼저 알려 주는 것이 맞다.
select plan(5);

/**
 * 시험의 종료일 — **오늘에서 센다.** 서울 날짜로 다다음 달 1일이다(29~62일 뒤 — 가장 짧은 것이 1월 31일 → 3월 1일).
 *
 * 한동안 `2026-10-31` 을 적어 두었다. 운영의 종료일과 같은 값이라 맞아 보였지만, 그날이
 * 지나면 `beta_is_over()` 가 참이 되어 가입도 첫 입력도 닫히고 — 시험 63 파일 중 45 가
 * 아무것도 안 고쳤는데 붉어진다(2026-09-28, 로컬의 종료일을 어제로 옮겨 쟀다). 시험이
 * 재려는 것은 「열려 있는 동안」이지 운영이 약속한 그날이 아니다.
 *
 * **하루가 아니라 달로 센다.** e2e 와 흐름 검사가 같은 규칙을 쓰는데(`scripts/beta-dates.mjs`
 * 의 `checkEndsOn`), 그쪽은 자정을 걸쳐 돌 수 있다 — 날로 세면 도는 도중에 값이 바뀌어
 * 새 줄이 서고 앞선 계정이 모두 안내로 돌아간다. 달로 세면 그 자리가 한 해에 열두 번이다.
 * 서울 날짜로 세든 UTC 로 세든 종료일까지 4주가 넘게 남는다.
 *
 * `months_ahead` 는 「운영자가 미뤘다」를 흉내 내는 자리가 쓴다 — 기본값보다 늦은 날.
 */
create or replace function tests.beta_ends_on(months_ahead integer default 2)
returns date
language sql
stable
as $$
  select (date_trunc('month', (now() at time zone 'Asia/Seoul')::date)
          + make_interval(months => months_ahead))::date;
$$;

/**
 * 시험이 쓰는 일정을 세운다 — **지금 줄이 그 날짜가 아니면 새 줄을 넣는다.**
 *
 * 표는 쌓으므로 지우지 않는다. 마이그레이션이 넣은 운영의 첫 줄(고정 종료일)이 지금 줄로
 * 남아 있어도 그 위에 시험의 줄이 선다 — 파일마다 트랜잭션이 되돌아가므로 밖에는 안 남는다.
 * 이미 그 날짜이고 운영자 정보가 있으면 아무것도 안 한다. 그래야 한 파일에서 여러 번
 * 불러도 계정들이 같은 줄을 본다.
 *
 * `e2e/session.ts` · `scripts/notice.mjs` 의 `scheduleBeta` 와 같은 규칙이다.
 */
create or replace function tests.schedule_beta()
returns bigint
language plpgsql
security definer
as $$
begin
  insert into public.beta_schedule
    (ends_on, note, operator_name, operator_officer, operator_contact)
  select tests.beta_ends_on(), '시험', '만세력 운영자', '시험 담당', 'ops@example.com'
  where coalesce((select s.ends_on from public.current_beta_schedule() s), '1900-01-01')
          <> tests.beta_ends_on()
     or (select s.operator_contact from public.current_beta_schedule() s) is null;

  return (select s.schedule_id from public.current_beta_schedule() s);
end;
$$;

/**
 * 구글 로그인만 한다 — **가입은 아직 안 끝났다.**
 *
 * 이메일 명단이 문을 지킬 때는 이 상태가 화면에만 있었다. 명단을 걷은 뒤로는(ADR 0042)
 * 실재하는 상태다 — 구글 계정만 있고 코드도 이름도 안내 확인도 없는 계정.
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
  base text;
  taken text;
  n integer := 0;
begin
  /*
    일정도 함께 세운다 — 확인 기록이 **본 날짜**를 들기 때문이다. 없으면 `/me` 관문이
    「일정이 바뀌었다」로 읽고 모두를 안내 화면으로 돌려보낸다.
  */
  perform tests.schedule_beta();

  update public.app_user
  set notice_version = 'notice-for-tests',
      notice_schedule_id = (select s.schedule_id from public.current_beta_schedule() s),
      notice_ends_on = (select s.ends_on from public.current_beta_schedule() s),
      notice_ack_at = now(),
      improvement_consent = false,
      contact_consent = false
  where id = new_id;

  /*
    **이름도 함께 짓는다** — 안내와 같은 까닭이다.

    첫 입력 앞의 관문이 하나 더 늘었다(#14). 실제 사람은 프로필 화면에서 이름을 짓고
    오므로 이 손잡이도 같은 자리를 지난다 — 안 지나면 거의 모든 파일이 사주를 못 만들고,
    그러면 이 관문 하나가 다른 모든 시험을 막는다. 관문 자체를 재는 시험은 `signup_raw`
    로 만들거나 이름을 지운다.

    메일 앞자리에서 따되 **부딪히면 숫자를 붙인다.** 이름이 유일해졌으므로, 한 파일에서
    두 사람의 앞자리가 같으면 손잡이가 그 자리에서 멈춘다 — 시험이 재려던 것과 상관없는
    자리에서.
  */
  base := left(regexp_replace(split_part(signup_email, '@', 1), '[^0-9A-Za-z가-힣]', '', 'g'), 8);
  if length(base) < 2 then base := base || '벗'; end if;
  taken := base;
  while exists (
    select 1 from public.app_user u
    where public.nickname_key(u.nickname) = public.nickname_key(taken)
  ) loop
    n := n + 1;
    taken := left(base, greatest(1, 8 - length(n::text))) || n::text;
  end loop;

  /*
    **가입이 끝난 것으로 둔다**(ADR 0042). 코드는 안 붙인다 — 코드가 서기 전에 들어온
    계정이 그 모양이고, 여기서 재려는 것은 코드가 아니라 그다음이다. 코드 자체는
    `01_signup_code` 가 실제 문(`complete_signup`)으로 잰다.
  */
  update public.app_user set nickname = taken, signed_up_at = now() where id = new_id;

  return new_id;
end;
$$;

/**
 * 여덟 글자 한 벌 — **모양만 맞으면 된다.**
 *
 * 입력을 쓰는 문이 스냅샷을 함께 받으면서(ADR 0071 · A1) 시험도 그 값을 대야 한다.
 * 그런데 **DB 는 「이 여덟 글자가 저 입력에서 나왔나」를 끝내 못 본다** — 절기·자시·경도가
 * TypeScript 엔진에 있기 때문이다. 문이 보는 것은 셋뿐이다: 낱자가 천간 열·지지 열둘
 * 안인가, 일간이 일주의 천간인가, 시주의 유무가 입력과 맞는가.
 *
 * 그래서 시험은 **그 셋을 만족하는 한 벌**을 쓴다. 진짜 명식을 여기 적어 두면 엔진을
 * 고치는 날 이 파일이 조용히 거짓이 되고, 그것을 아무도 안 본다 — 엔진이 내는 값과
 * 저장된 값이 같은지는 **앱을 띄워 재는 자리**가 잰다(`e2e`, ADR 0071 「재는 자리」).
 *
 * **일간을 인자로 받는다.** 두 사람이 같은 여덟 글자를 들면 「누구 것을 베꼈나」를
 * 재는 시험이 언제나 통과한다.
 *
 * @param with_hour 시각을 아는 사람인가. `false` 면 시주가 `null` 이다 — 정오로 메운
 *   시주가 아니라 **없음**이어야 하고, 문이 `birth_time` 과 대조한다.
 */
create or replace function tests.chart(
  day_stem text default '丙',
  with_hour boolean default true
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'year', jsonb_build_object('stem', '甲', 'branch', '子'),
    'month', jsonb_build_object('stem', '乙', 'branch', '丑'),
    'day', jsonb_build_object('stem', day_stem, 'branch', '寅'),
    'hour', case when with_hour
      then jsonb_build_object('stem', '丁', 'branch', '卯') end,
    'dayMaster', day_stem);
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

/**
 * 저장 자리 한도 — **시험이 수를 손으로 적지 않게.**
 *
 * `person_limit()` 은 모든 역할에 닫혀 있어서(상수를 내주는 함수라도 닫는다),
 * `set local role authenticated` 뒤에는 시험이 그것을 못 부른다. 그래서 `definer` 로
 * 한 겹 감싼다 — `tests.signup` 이 같은 이유로 definer 인 것과 같은 자리다.
 *
 * 한도를 옮기는 날 **시험이 옛 수를 지키는 일**이 없게 하려는 것이다. 그것은 시험이
 * 깨지는 것보다 나쁘다: 깨지면 우리가 보지만, 옛 수를 지키면 아무도 안 본다.
 */
create or replace function tests.person_limit()
returns integer
language sql
stable
security definer
as $$ select public.person_limit() $$;

/** 풀이권 총량 — `tests.person_limit()` 과 같은 자리, 같은 까닭이다 */
create or replace function tests.reading_credit_limit()
returns integer
language sql
stable
security definer
as $$ select public.reading_credit_limit() $$;

/**
 * 필요한 기운 요약 한 벌 — 매칭 풀에 서려면 오행 요약 옆에 이것도 있어야 한다(ADR 0113).
 *
 * 앱은 엔진의 억부로 짓는다(`src/lib/discovery/need-summary.ts`). 시험은 모양만 맞는 한 벌을 쓴다 —
 * 카드 점수의 셈 자체는 `60_card_score_v2` 가 TS 와 같은 표로 잰다. 셈 이름은 **지금 DB 의 이름**을 싣는다 —
 * `definer` 인 것은 그 이름을 내는 함수가 모든 역할에 닫혀 있어서다(`tests.person_limit` 과 같은 자리).
 */
create or replace function tests.need(primary_element text default '木', heaviest_element text default '金')
returns jsonb
language sql
stable
security definer
as $$
  select jsonb_build_object(
    'primary', primary_element, 'heaviest', heaviest_element, 'rule', public.discovery_need_rule());
$$;

/**
 * 풀에 오르는 값을 쓰는 문 넷 — **서버 모듈이 하는 일을 시험이 흉내 낸다**(G-64 길 ①, ADR 0136).
 *
 * 그 문들은 열쇠(`service_role`)에만 열려 있고 첫 인자로 사람 id 를 받는다. 앱에서는
 * `app/me/keyed-chart-writes.ts` 가 **세션에서** 그 id 를 얻어 넘긴다. 시험의 세션은 `request.jwt.claims` 이므로
 * 여기서 `auth.uid()` 를 읽어 넘긴다 — 인자는 옛 판(사람 id 가 없는 판)과 같아서, 시험 파일은 `public.` 을
 * `tests.` 로 바꾸기만 했다. `definer` 인 것은 `authenticated` 로 역할을 바꾼 뒤에도 열쇠의 문을 부르려는 것이다.
 *
 * 로그인하지 않은 채 부르면 `null` 이 넘어가고 문이 로그인 거절로 선다 — 옛 판과 같은 답이다.
 * 사용자 역할이 문을 **직접** 못 부른다는 것은 `72_pool_values_keyed` 가 잰다.
 */
create or replace function tests.create_self_person(
  p_local_label text, p_calendar text, p_original_date date, p_solar_date date,
  p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text,
  p_time_basis text, p_chart jsonb, p_chart_engine_version text)
returns uuid
language sql
security definer
as $$
  select public.create_self_person((select auth.uid()), p_local_label, p_calendar, p_original_date, p_solar_date,
    p_birth_time, p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);
$$;

create or replace function tests.edit_person_input(
  p_person_id uuid, p_calendar text, p_original_date date, p_solar_date date,
  p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text,
  p_time_basis text, p_chart jsonb, p_chart_engine_version text)
returns integer
language sql
security definer
as $$
  select public.edit_person_input((select auth.uid()), p_person_id, p_calendar, p_original_date, p_solar_date,
    p_birth_time, p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);
$$;

/**
 * 참여의 두 문은 **요약을 지은 입력의 판 둘**을 더 받는다 — 서버 모듈은 요약을 지은 입력의 판을 싣는다. 시험의 요약은
 * 모양만 맞는 한 벌이라 「지은 입력」이 따로 없으므로, 손잡이가 **지금 저장된** 판을 읽어 싣는다. 그래서 옛 판처럼
 * 참 · 거짓으로 답한다 — `on` · `joined` 이면 참. 판이 엇갈린 갈래(`stale`)는 `71_pool_summary_is_stamped_with_its_input`
 * 이 문을 직접 불러 잰다.
 */
create or replace function tests.my_versions(actor uuid, out input_version integer, out chart_engine_version text)
language sql
stable
security definer
as $$
  select p.input_version, p.chart_engine_version
  from public.app_user u join public.person p on p.id = u.self_person_id
  where u.id = actor;
$$;

create or replace function tests.set_discovery_participation(p_on boolean, p_summary jsonb, p_need jsonb default null)
returns boolean
language sql
security definer
as $$
  select public.set_discovery_participation((select auth.uid()), p_on, p_summary, p_need,
    (select v.input_version from tests.my_versions((select auth.uid())) v),
    (select v.chart_engine_version from tests.my_versions((select auth.uid())) v)) = 'on';
$$;

create or replace function tests.ensure_discovery_participation(
  p_person_id uuid, p_summary jsonb, p_need jsonb default null)
returns boolean
language sql
security definer
as $$
  select public.ensure_discovery_participation((select auth.uid()), p_person_id, p_summary, p_need,
    (select v.input_version from tests.my_versions((select auth.uid())) v),
    (select v.chart_engine_version from tests.my_versions((select auth.uid())) v)) = 'joined';
$$;

-- 시험은 역할을 `authenticated` 로 바꾼 채로 이 손잡이들을 부른다.
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

select has_function('tests', 'signup', array['text'], '가입한 척하는 손잡이가 선다');
select has_function('tests', 'signup_raw', array['text'], '가입을 안 끝낸 손잡이도 선다');
select ok(public.is_chart_snapshot(tests.chart()), '손잡이가 내는 여덟 글자는 문을 지나간다');
select ok(public.is_need_summary(tests.need()), '손잡이가 내는 필요한 기운 요약은 모양이 맞다');
select ok(
  tests.beta_ends_on() > (now() at time zone 'Asia/Seoul')::date + 28,
  '시험의 종료일은 오늘에서 4주 넘게 남는다 — 날짜를 적어 두면 그날 모든 파일이 붉어진다');
select * from finish();
