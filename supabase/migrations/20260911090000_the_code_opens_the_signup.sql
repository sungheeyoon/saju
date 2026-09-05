-- ---------------------------------------------------------------------------
-- 가입은 **한 폼**이고, 문을 여는 것은 **코드**다 (ADR 0042)
-- ---------------------------------------------------------------------------

/**
 * 지금까지 들어오는 문은 **이메일 명단**이었다(`invite`, ADR 0006). 운영자가 주소를
 * 하나씩 넣어야 했고, 넣기 전에는 로그인 버튼이 아무 일도 안 하는 버튼이었다. 테스터를
 * 부르는 일이 「주소를 받아서 → SQL 로 넣고 → 다시 알려 준다」 세 걸음이었다.
 *
 * 코드로 바꾼다. 운영자가 코드를 하나 만들고 그 문자열만 전하면, 받은 사람이 스스로
 * 들어온다. **명단은 걷는다** — 문이 둘이면 둘 다 지켜야 하고, 그중 하나는 언젠가 잊힌다.
 *
 * ## 코드에 붙는 것은 둘이다 — **하루 · 최대 N명**
 *
 * 기한 없는 코드는 새면 영원히 열린 문이다. 수 없는 코드는 한 사람이 퍼뜨리면 정원이
 * 없다. 둘을 함께 두면 새어도 **오늘 N명**까지다.
 *
 * 하루의 경계는 **서울 자정**이다. 운영자가 「오늘 열 명」이라고 말할 때의 오늘과 같은
 * 날이어야 한다(`reading_spend_today` 와 같은 규율).
 *
 * ## 쓴 수는 **세지 않고 센다**
 *
 * 코드 행에 `used` 를 두고 올리지 않는다. 계정 쪽에 「어느 코드로 왔나」를 적고, 정원은
 * 그 수를 세어 답한다 — 어차피 **어느 계정이 어느 코드로 왔는지**를 남겨야 하고, 그
 * 값이 있으면 따로 세는 자리는 두 번째 진실이 된다(`reading_credits_used` 와 같다).
 *
 * ## 무엇이 달라지나 — **미완성 계정이 생긴다**
 *
 * 명단이 문을 지킬 때는 `auth.users` 에 아무나 못 들어왔다. 이제 구글 계정이 있으면
 * 누구나 `auth.users` 행 하나를 만든다. 그 대신 **가입이 끝나지 않은 계정**이라는 상태가
 * 생기고, 되돌릴 수 없는 첫 쓰기 둘(`create_self_person`·`create_managed_person`)이 그
 * 상태를 거절한다. 관문(`proxy.ts`)은 그런 사람을 `/signup` 으로 보낸다.
 *
 * 관문에 둘만 남는 것이 이 판단의 요점이다 — **베타가 끝났나**, **가입이 끝났나**.
 * 안내·이름이 각자 문을 세우던 것을 「가입」 하나가 든다.
 */

-- ---------------------------------------------------------------------------
-- 1. 코드
-- ---------------------------------------------------------------------------

create table public.signup_code (
  /**
   * 사람이 손으로 옮겨 적는 값이다. 대소문자로 갈리면 「안 되는데요」의 절반이
   * 그것이므로 **대문자 하나로만 산다** — 넣는 쪽도 묻는 쪽도 `upper` 를 지난다.
   */
  code text primary key check (
    code = upper(btrim(code)) and length(code) between 4 and 24
  ),
  /** 누구에게 준 코드인가 — 운영자가 알아볼 메모 */
  note text,
  /** 이 코드가 사는 **하루**. 하루가 지나면 죽는다 */
  valid_on date not null,
  /** 이 코드로 들어올 수 있는 **사람 수** */
  max_uses integer not null check (max_uses between 1 and 1000),
  created_at timestamptz not null default now()
);

/*
  정책을 하나도 만들지 않는다. `invite` 와 같은 까닭이다 — 살아 있는 코드가 열려 있으면
  로그인한 아무나 그것을 읽어 퍼뜨릴 수 있고, 그 순간 정원이 뜻을 잃는다.
*/
alter table public.signup_code enable row level security;
revoke all on public.signup_code from anon, authenticated;

/** 오늘 — **서울 자정**이 경계다 */
create or replace function public.signup_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Seoul')::date $$;

revoke execute on function public.signup_today() from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 2. 계정이 드는 두 칸
-- ---------------------------------------------------------------------------

/**
 * `signed_up_at` — **가입이 끝난 때.** 비어 있으면 아직 아니다.
 *
 * `notice_ack_at` 이나 `nickname` 으로 대신할 수 있었다. 안 그런 이유는 그 둘이 각자
 * 다른 물음에 답하기 때문이다 — 「안내를 언제 봤나」와 「무엇으로 불리나」. 「가입이
 * 끝났나」를 그 둘의 곱으로 물으면 묻는 자리마다 곱셈이 한 벌씩 생기고, 셋 중 하나는
 * 언젠가 다르게 곱한다.
 *
 * `signup_code` — **어느 코드로 왔나.** 코드가 서기 전에 들어온 계정은 비어 있다.
 * 정원을 세는 것이 이 칸이므로, 계정이 지워지면 그 자리도 함께 돌아온다.
 *
 * FK 를 `no action` 으로 둔다 — **누가 그 코드로 들어왔는지가 곧 기록**이라, 쓰인 코드는
 * 지울 수 없어야 한다. 지워지게 두면 정원을 세는 근거와 「어느 코드로 왔나」가 같은 날
 * 함께 사라진다.
 */
alter table public.app_user
  add column signed_up_at timestamptz,
  add column signup_code text references public.signup_code (code);

create index app_user_by_signup_code on public.app_user (signup_code)
  where signup_code is not null;

/**
 * **이미 들어와 있는 사람은 그대로 둔다.**
 *
 * 코드가 없던 시절에 안내를 보고 이름을 지은 계정은 가입이 끝난 계정이다. 여기서
 * 안 메우면 그 사람들이 다음 배포에 `/signup` 으로 튕기고, 줄 수 있는 코드가 없다.
 *
 * `signup_code` 는 **비워 둔다.** 없던 것을 지어 넣으면 「어느 코드로 왔나」가 거짓이
 * 된다 — 비어 있는 것이 곧 「코드 이전」이라는 사실이다.
 */
update public.app_user
set signed_up_at = notice_ack_at
where notice_ack_at is not null and nickname is not null;

-- ---------------------------------------------------------------------------
-- 3. 가입을 끝내는 **한 문**
-- ---------------------------------------------------------------------------

/**
 * 코드·이름·안내 확인을 **한 트랜잭션**에 적는다.
 *
 * 셋을 갈라 두면 「코드는 썼는데 이름이 없는」·「이름은 있는데 안내를 안 본」 계정이
 * 생긴다. 관문이 그런 사람을 어디로 보낼지 다시 정해야 하고, 그 자리가 지금 걷어 내는
 * 바로 그 자리다.
 *
 * ## 이미 가진 것은 다시 안 묻는다
 *
 * 안내가 새 판본이 되면 이미 가입한 사람도 여기로 돌아온다(관문이 「가입 완료」에 그
 * 확인을 넣는다). 그때 코드와 이름은 이미 있으므로 `null` 로 와도 된다 — 화면도 그
 * 칸을 안 세운다. **코드는 한 사람에게 한 번만 쓰인다.**
 *
 * ## 판본과 줄을 화면이 들고 온다
 *
 * `acknowledge_notice` 와 같은 규율이다. 서버가 스스로 「지금 값」을 적으면 사용자가
 * 읽은 것과 남는 기록이 갈린다 — 읽은 것을 적어야 그 기록이 뜻이 있다.
 */
create or replace function public.complete_signup(
  p_code text,
  p_nickname text,
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
  actor uuid := (select auth.uid());
  account public.app_user;
  now_row record;
  code_row public.signup_code;
  wanted text := upper(btrim(coalesce(p_code, '')));
  name text := btrim(coalesce(p_nickname, ''));
  taken integer;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

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

  select * into account from public.app_user u where u.id = actor for update;

  if not found then
    raise exception '계정을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  /*
    **이름은 없을 때만 짓는다.** 있는 사람이 이 문으로 이름을 갈아 끼우게 두면 가입
    문이 곧 개명 문이 되고, 개명에는 이미 자기 자리가 있다(`save_my_profile`).
  */
  if account.nickname is null then
    if length(name) < 2 or length(name) > 8 then
      raise exception '닉네임은 2~8자입니다.' using errcode = '22023';
    end if;

    if exists (
      select 1 from public.app_user u
      where u.id <> actor
        and u.nickname is not null
        and public.nickname_key(u.nickname) = public.nickname_key(name)
    ) then
      raise exception '이미 쓰고 있는 닉네임입니다.' using errcode = '23505';
    end if;
  else
    name := account.nickname;
  end if;

  /*
    **코드는 처음 들어올 때만 묻는다.**

    행을 잠그고 나서 센다. 안 잠그면 같은 코드로 동시에 눌린 둘이 각자 「아직 자리가
    있다」를 읽고 둘 다 들어온다 — 정원이 하나 넘치는 자리가 정확히 여기다.
  */
  if account.signed_up_at is null then
    if wanted = '' then
      raise exception '테스트 코드를 넣어 주세요.' using errcode = '22023';
    end if;

    select * into code_row from public.signup_code c where c.code = wanted for update;

    /*
      **없는 코드와 지난 코드를 한 문장으로 말한다.** 갈라 말하면 「그런 코드는 있는데
      어제 것」이 되고, 그것은 코드 하나를 맞혔다는 답이다.
    */
    if not found or code_row.valid_on <> public.signup_today() then
      raise exception '지금 쓸 수 있는 코드가 아닙니다.' using errcode = '42501';
    end if;

    select count(*) into taken
    from public.app_user u where u.signup_code = code_row.code;

    if taken >= code_row.max_uses then
      raise exception '이 코드는 오늘 정원이 찼습니다.' using errcode = '42501';
    end if;
  end if;

  update public.app_user u
  set nickname = name,
      signup_code = coalesce(u.signup_code, code_row.code),
      signed_up_at = coalesce(u.signed_up_at, now()),
      notice_version = p_version,
      notice_schedule_id = now_row.schedule_id,
      notice_ends_on = now_row.ends_on,
      notice_ack_at = now(),
      improvement_consent = p_improvement,
      contact_consent = p_contact
  where u.id = actor;

  /*
    개선 동의를 끄면서 가입하는 사람은 없다(처음 가입은 답이 없던 상태다). 그런데 안내가
    바뀌어 다시 지나는 사람은 켰던 것을 끌 수 있다 — `acknowledge_notice` 와 같은 자리다.
  */
  if p_improvement = false then
    delete from public.reading_feedback f where f.respondent_user_id = actor;
  end if;
end;
$$;

revoke execute on function public.complete_signup(text, text, text, bigint, boolean, boolean)
  from anon, public;
grant execute on function public.complete_signup(text, text, text, bigint, boolean, boolean)
  to authenticated;

/**
 * **안내 확인만 남기는 문은 없앤다.**
 *
 * `acknowledge_notice` 를 부르는 자리가 하나도 안 남았다. 안내를 처음 확인하는 것도
 * 새 판본을 다시 확인하는 것도 위의 한 문이 한다.
 *
 * 둘을 나란히 두면 안내 기록을 쓰는 자리가 둘이 되고, 그중 하나는 이름도 코드도 안
 * 본다 — 아직 가입이 안 끝난 사람이 그 문으로 확인만 남기면 관문의 셈이 흔들린다.
 * 안 쓰는 문을 남겨 두는 것은 살아 있는 문을 하나 더 지키는 일이다.
 */
drop function if exists public.acknowledge_notice(text, bigint, boolean, boolean);

-- ---------------------------------------------------------------------------
-- 4. 되돌릴 수 없는 첫 쓰기 둘이 **가입을 묻는다**
-- ---------------------------------------------------------------------------

/**
 * 내 사주 — **묻는 것이 하나로 준다.**
 *
 * 안내와 이름을 따로 묻던 두 줄이 `signed_up_at` 하나가 된다. 그 값은 셋을 한 번에
 * 적는 문에서만 서므로(`complete_signup`), 여기서 이름을 다시 묻는 것은 언제나 참인
 * 물음이다 — 늘 참인 검사는 검사가 아니다.
 *
 * 나머지는 그대로다. 바탕은 이름을 넣은 9일자 정의다.
 */
create or replace function public.create_self_person(
  p_local_label text,
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
  account public.app_user;
  new_person uuid;
  new_revision uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = '42501';
  end if;

  if account.signed_up_at is null then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  if account.self_person_id is not null then
    raise exception '이미 자신의 사주를 등록했습니다.' using errcode = '23505';
  end if;

  insert into public.person default values returning id into new_person;

  insert into public.user_person_access (user_id, person_id, local_label, role)
  values (actor, new_person, p_local_label, 'owner');

  insert into public.person_chart_revision (
    person_id, calendar, original_date, solar_date, birth_time,
    gender, city, late_night_rule, time_basis, created_by
  )
  values (
    new_person, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, actor
  )
  returning id into new_revision;

  update public.person set current_revision_id = new_revision where id = new_person;
  update public.app_user set self_person_id = new_person where id = actor;

  return new_person;
end;
$$;

/**
 * 저장한 사람 — **여기도 묻는다.**
 *
 * 이 문은 안내를 한 번도 안 물었다. 화면 관문이 `/me` 를 지키니 닿을 수 없다고 여겼지만,
 * RPC 는 로그인한 사람이 브라우저에서 그대로 부를 수 있다 — **남의 생년월일시가 들어오는
 * 문**이 가입도 안 끝난 계정에게 열려 있었다.
 *
 * 미완성 계정이라는 상태가 생기면서 이 구멍이 실제로 밟히는 자리가 됐다. 코드 없이 구글
 * 로그인만 한 사람이 그 상태이기 때문이다.
 *
 * 바탕은 사이를 묻기 시작한 8월 31일자 정의이고, 바뀐 것은 검사 한 줄이다.
 */
create or replace function public.create_managed_person(
  p_local_label text,
  p_note text,
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
  account public.app_user;
  new_person uuid;
  new_revision uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if account.signed_up_at is null then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  insert into public.person default values returning id into new_person;

  insert into public.user_person_access (user_id, person_id, local_label, note, role)
  values (actor, new_person, p_local_label, nullif(btrim(p_note), ''), 'owner');

  if not public.may_add_revision(new_person, actor) then
    raise exception '이 사람의 출생정보를 쌓을 수 없습니다.' using errcode = '42501';
  end if;

  insert into public.person_chart_revision (
    person_id, calendar, original_date, solar_date, birth_time,
    gender, city, late_night_rule, time_basis, created_by
  )
  values (
    new_person, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, actor
  )
  returning id into new_revision;

  update public.person set current_revision_id = new_revision where id = new_person;

  return new_person;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. 이메일 명단을 **걷는다**
-- ---------------------------------------------------------------------------

/**
 * 지우는 일에서 `invite` 를 뺀다 — 표가 없어지므로.
 *
 * 나머지는 그대로다. 바탕은 5일자 정의이고, 바뀐 것은 명단을 지우던 세 줄뿐이다.
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

  delete from auth.audit_log_entries a
  where a.payload ->> 'actor_id' = p_user_id::text
     or (mail is not null and a.payload ->> 'actor_username' = mail);

  delete from auth.flow_state f where f.user_id = p_user_id;

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

/*
  **훅을 먼저 끄고 지운다.** `supabase/config.toml` 의 `[auth.hook.before_user_created]`
  가 이 함수를 가리키고 있었다 — 그 줄을 지우는 것과 이 파일이 함께 나가야 GoTrue 가
  없는 함수를 부르는 순간이 없다.
*/
drop function if exists public.gate_signup_by_invite(jsonb);
drop table if exists public.invite;
