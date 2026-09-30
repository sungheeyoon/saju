-- 가입과 로그인 거절 — **DB 가 던지는 문장이 상황과 다음 행동을 말한다** (운영자 확정 2026-09-30, `docs/product/copy-ledger.md` 07)
--
-- 앱은 우리 한국어 문장을 그대로 화면에 세운다(`app/db-error.ts`). 그래서 DB 가 던지는 문장이 곧 사람이 읽는
-- 문장이다. `complete_signup` 의 거절은 합쇼체였고(#338 이 「검토 대기」로 남긴 줄), 몇은 무엇을 하면 되는지를
-- 안 말했다.
--
-- 이 마이그레이션은 **문장만 바꾼다.** 2026-09-30 에 로컬의 `pg_proc.prosrc` 를 재어 바꿀 문장을 던지는 함수
-- 27개를 찾았고, 각 함수를 **살아 있는 정의**(`pg_get_functiondef`)에서 떠서 문장만 갈았다(ADR 없음 — 전례는
-- `20260929090000_the_suspended_account_is_told_in_one_sentence.sql`). 서명 · 보안 · `search_path` · errcode ·
-- 나머지 본문은 그대로다. `create or replace` 라 권한과 주석도 남는다.
--
-- - **`complete_signup`** — 거절 열 문장. 「이용이 정지된 계정입니다.」는 이용 제한 고지라 그대로 둔다. 「선택 항목에
--   답해 주세요.」 · 「테스트 코드를 넣어 주세요.」는 확정 표에 없어 그대로다.
--   - 「계정을 찾지 못했어요. 다시 로그인해 주세요.」 — 이 자리에 오는 것은 `auth.uid()` 는 있는데 `app_user` 행이
--     없을 때뿐이다. 행은 `auth.users` 에 넣을 때 트리거가 만들고(`handle_new_auth_user`) `auth.users` 가 지워질 때만
--     함께 지워진다(`on delete cascade`). 그러니 지워진 계정의 토큰이 아직 살아 있는 동안이고, 다시 로그인하면 새
--     `auth.users` 와 새 행이 선다 — 재로그인이 실제로 푼다. 정지 · 탈퇴 대기는 행이 있으므로 이 문장에 안 온다.
--   - 「코드를 여러 번 잘못 입력했어요. 한 시간 뒤 다시 시도해 주세요.」 — 잠금은 미끄러지는 한 시간 창이다
--     (`signup_code_miss_window()`). 잠긴 동안의 시도는 적지 않으므로 창 안의 줄이 열 개 밑으로 내려가면 풀린다 —
--     열 번째 틀린 시도의 한 시간 뒤보다 늦게 풀리는 일은 없다. 「한 시간 뒤」는 늘 참이다.
-- - **「로그인이 필요합니다.」 → 「로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.」** — 같은 문장을 던지는
--   함수 전부(27개, `complete_signup` 포함). 모두 `actor is null` 에서 `28000` 으로 던진다.
-- - **「이미 쓰고 있는 닉네임입니다.」 → 「이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.」** —
--   `complete_signup` 과 `save_my_profile`(두 자리 — 먼저 보는 자리와 유일 색인에 걸린 자리).
--
-- 안 바꾼 것 — 같은 뜻의 **다른 문장**이거나 다시 로그인해도 안 풀리는 자리다.
--
-- - `save_my_profile` · `nickname_is_available` 의 「닉네임은 2자에서 8자까지입니다.」 — 확정 표의 문장과 글자가 다르다.
-- - `set_contact_consent` · `set_improvement_consent` 의 「계정을 찾지 못했습니다.」 — `status = 'active'` 인 행만
--   고치므로 정지 · 탈퇴 대기 계정도 이 문장을 받는다. 다시 로그인해도 안 풀린다.
-- - 「비공개 테스트가 끝났습니다.」를 던지는 다른 함수 넷(`create_self_person` · `leave_reading_feedback` ·
--   `save_service_survey` · `start_reading_run_for`) — 확정 표가 가입 함수의 줄로만 정했다.
--
-- 재는 자리는 `supabase/tests/70_refusals_say_what_to_do.test.sql` — 옛 문장을 던지는 함수가 0 인지와, 대표
-- 거절이 새 문장으로 서는지.

CREATE OR REPLACE FUNCTION public.block_user(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = actor then
    raise exception '자기 자신은 차단할 수 없습니다.' using errcode = '22023';
  end if;

  -- 넣는 것과 거두는 것 사이에 요청 하나가 끼면 차단된 쌍에 pending 이 남는다.
  perform public.lock_users(actor, p_user_id);

  -- 잠그기 전에 물은 것은 그 사이에 커밋된 제재를 못 본다(`request_match` 와 같은 이유).
  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  insert into public.block (user_id, blocked_user_id)
  select actor, p_user_id
  where exists (select 1 from public.app_user u where u.id = p_user_id)
  on conflict do nothing;

  with ended as (
    update public.match_request
    set status = case when requester_user_id = actor then 'cancelled' else 'rejected' end,
        decided_at = now()
    where status = 'pending'
      and ((requester_user_id = actor and addressee_user_id = p_user_id)
        or (requester_user_id = p_user_id and addressee_user_id = actor))
    returning id, requester_user_id, status
  )
  insert into public.notification (user_id, kind, request_id)
  select ended.requester_user_id, 'request_rejected', ended.id
  from ended
  where ended.status = 'rejected';

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_match_request(p_request_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  req public.match_request;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  select * into req from public.match_request where id = p_request_id for update;

  if not found or req.requester_user_id <> actor then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  if req.status <> 'pending' then
    return req.status;
  end if;

  update public.match_request
  set status = 'cancelled', decided_at = now()
  where id = req.id;

  return 'cancelled';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.clear_my_photo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  perform 1 from public.app_user where id = actor for update;

  delete from public.profile_photo where user_id = actor;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.complete_signup(p_code text, p_nickname text, p_version text, p_schedule_id bigint, p_improvement boolean, p_contact boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if p_version is null or length(btrim(p_version)) = 0 then
    raise exception '안내를 확인하지 못했어요. 새로고침한 뒤 다시 확인해 주세요.' using errcode = 'check_violation';
  end if;

  if p_improvement is null or p_contact is null then
    raise exception '선택 항목에 답해 주세요.' using errcode = 'check_violation';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났어요.' using errcode = 'check_violation';
  end if;

  select * into now_row from public.current_beta_schedule();

  if not found or now_row.operator_contact is null then
    raise exception '아직 테스트 기간이 정해지지 않았어요.' using errcode = 'check_violation';
  end if;

  if p_schedule_id is distinct from now_row.schedule_id then
    raise exception '안내가 바뀌었어요. 새로고침한 뒤 다시 확인해 주세요.'
      using errcode = 'check_violation';
  end if;

  select * into account from public.app_user u where u.id = actor for update;

  if not found then
    raise exception '계정을 찾지 못했어요. 다시 로그인해 주세요.' using errcode = 'no_data_found';
  end if;

  if account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /*
    **이름은 없을 때만 짓는다.** 있는 사람이 이 문으로 이름을 갈아 끼우게 두면 가입
    문이 곧 개명 문이 되고, 개명에는 이미 자기 자리가 있다(`save_my_profile`).
  */
  if account.nickname is null then
    if length(name) < 2 or length(name) > 8 then
      raise exception '닉네임을 2~8자로 입력해 주세요.' using errcode = '22023';
    end if;

    if exists (
      select 1 from public.app_user u
      where u.id <> actor
        and u.nickname is not null
        and public.nickname_key(u.nickname) = public.nickname_key(name)
    ) then
      raise exception '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.' using errcode = '23505';
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
    /*
      **가입이 닫혀 있으면 새 사람은 여기서 멈춘다**(ADR 0105). 코드가 살아 있어도 그렇다 — 운영자가 자리를
      비운 동안 들어온 사람의 신고를 볼 사람이 없다. 문장은 코드가 지금 안 된다는 기존 문장이다. 이미 가입한
      사람이 안내를 다시 확인하는 길(위 조건의 밖)은 안 막는다.
    */
    if exists (select 1 from public.signup_pause p where p.resumed_at is null) then
      raise exception '사용할 수 없는 코드예요. 코드를 다시 확인해 주세요.' using errcode = '42501';
    end if;

    if wanted = '' then
      raise exception '테스트 코드를 넣어 주세요.' using errcode = '22023';
    end if;

    /*
      **틀린 코드가 한 시간에 열 번이면 맞는 코드도 안 받는다.** 맞는 코드를 받으면 한도가 뜻이 없다 — 열한 번째에
      맞히면 들어오므로 맞힐 때까지 두드리는 것이 그대로다. 센 것은 이 계정의 틀린 시도뿐이다.
    */
    if (select count(*) from public.signup_code_miss m
        where m.user_id = actor and m.missed_at > now() - public.signup_code_miss_window())
       >= public.signup_code_miss_limit() then
      raise exception '코드를 여러 번 잘못 입력했어요. 한 시간 뒤 다시 시도해 주세요.' using errcode = '42501';
    end if;

    select * into code_row from public.signup_code c where c.code = wanted for update;

    /*
      **없는 코드와 지난 코드를 한 문장으로 말한다.** 갈라 말하면 「그런 코드는 있는데
      어제 것」이 되고, 그것은 코드 하나를 맞혔다는 답이다.
    */
    if not found
       or public.signup_today() not between code_row.valid_on and code_row.valid_until then
      /*
        **던지지 않고 적고 돌아간다.** 던지면 트랜잭션이 통째로 되감겨 이 한 줄도 사라진다 — 틀린 시도를 셀
        길이 그것뿐이다. 창 밖의 옛 줄은 여기서 걷는다(이 계정 것만).
      */
      delete from public.signup_code_miss m
      where m.user_id = actor and m.missed_at <= now() - public.signup_code_miss_window();
      insert into public.signup_code_miss (user_id) values (actor);
      return false;
    end if;

    select count(*) into taken
    from public.app_user u where u.signup_code = code_row.code;

    if taken >= code_row.max_uses then
      raise exception '오늘 이 코드로 들어올 수 있는 인원이 다 찼어요.' using errcode = '42501';
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

  -- 들어왔으면 틀린 시도는 더 셀 까닭이 없다
  delete from public.signup_code_miss m where m.user_id = actor;

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_managed_person(p_local_label text, p_note text, p_calendar text, p_original_date date, p_solar_date date, p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text, p_time_basis text, p_chart jsonb, p_chart_engine_version text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  new_person uuid;
begin
  /** 관문이 값 검사보다 먼저다 — `create_self_person` 과 같은 자리, 같은 까닭 */
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor;

  if account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if account.signed_up_at is null then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  new_person := public.new_person_with_input(
    p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);

  insert into public.user_person_access (user_id, person_id, local_label, note, role)
  values (actor, new_person, p_local_label, nullif(btrim(p_note), ''), 'owner');

  if not public.may_edit_person_input(new_person, actor) then
    raise exception '이 사람의 출생정보를 쌓을 수 없습니다.' using errcode = '42501';
  end if;

  return new_person;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_self_person(p_local_label text, p_calendar text, p_original_date date, p_solar_date date, p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text, p_time_basis text, p_chart jsonb, p_chart_engine_version text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  new_person uuid;
begin
  /**
   * **관문이 값 검사보다 먼저다.**
   *
   * 여덟 글자를 먼저 재면, 가입을 안 끝낸 사람이 빈 값으로 두드렸을 때 「여덟 글자를
   * 함께 보내야 합니다」(22004)가 난다 — 그 사람이 들어야 할 말은 「가입을 먼저
   * 끝내 주세요」다. 자격을 다 물은 **뒤에** 값을 본다.
   */
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
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

  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  new_person := public.new_person_with_input(
    p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);

  insert into public.user_person_access (user_id, person_id, local_label, role)
  values (actor, new_person, p_local_label, 'owner');

  update public.app_user set self_person_id = new_person where id = actor;

  return new_person;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.edit_person_input(p_person_id uuid, p_calendar text, p_original_date date, p_solar_date date, p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text, p_time_basis text, p_chart jsonb, p_chart_engine_version text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
begin
  /** 관문이 값 검사보다 먼저다 — 남의 것을 두드린 사람은 그 사실부터 들어야 한다 */
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if (select status from public.app_user where id = actor) <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if not public.may_edit_person_input(p_person_id, actor) then
    raise exception '이 사람의 출생정보를 고칠 수 없습니다.' using errcode = '42501';
  end if;

  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  return public.write_person_input(
    p_person_id, actor, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_discovery_participation(p_person_id uuid, p_summary jsonb, p_need jsonb DEFAULT NULL::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  mine public.person;
  opted_out timestamptz;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /*
    **여기서는 행을 안 잠근다.** 이 함수는 홈을 열 때마다 도는 자리이고, 잠그면 한 사람의
    두 탭이 서로를 기다린다. 겹쳐 들어와도 마지막 쓰기가 같은 값을 쓴다.
  */
  select * into account from public.app_user where id = actor;

  -- 내 사주가 아니면 아무 일도 아니다. 가족·친구를 고쳤다고 내 노출이 바뀌지 않는다.
  if account.self_person_id is null or account.self_person_id is distinct from p_person_id then
    return false;
  end if;

  if account.nickname is null then
    return false;
  end if;

  select opted_out_at into opted_out from public.discovery_profile where user_id = actor;
  if opted_out is not null then
    return false;
  end if;

  -- 필요한 기운 요약의 모양도 같은 거절이다 — 앱만 짓는 값이라 사용자가 고칠 것이 따로 없다
  if not public.is_element_summary(p_summary)
     or (p_need is not null and not public.is_need_summary(p_need)) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  select * into mine from public.person where id = account.self_person_id;

  if mine.calendar is null then
    return false;
  end if;

  /*
    `p_need` 가 비면 **있던 필요한 기운 요약을 그대로 둔다** — 옛 앱이 두 인자로 불러도 백필한 값을
    지우지 않는다. 그 사이 입력이 바뀌었으면 요약의 판본이 어긋나 자격에서 저절로 빠진다.
  */
  insert into public.discovery_profile (
    user_id, opted_in_at, element_summary,
    element_input_version, element_chart_engine_version,
    need_summary, need_input_version, need_chart_engine_version)
  values (
    actor, now(), p_summary,
    mine.input_version, mine.chart_engine_version,
    p_need,
    case when p_need is null then null else mine.input_version end,
    case when p_need is null then null else mine.chart_engine_version end)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        element_summary = excluded.element_summary,
        element_input_version = excluded.element_input_version,
        element_chart_engine_version = excluded.element_chart_engine_version,
        need_summary = coalesce(excluded.need_summary, public.discovery_profile.need_summary),
        need_input_version = case when excluded.need_summary is null
          then public.discovery_profile.need_input_version else excluded.need_input_version end,
        need_chart_engine_version = case when excluded.need_summary is null
          then public.discovery_profile.need_chart_engine_version else excluded.need_chart_engine_version end;

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.lock_my_photos()
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  perform 1 from public.app_user where id = actor for update;
  return actor;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_chat_read(p_match_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  room uuid;
  marked bigint;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  select r.id into room
  from public.chat_room r
  where r.match_id = p_match_id and public.chat_room_readable(r.id);

  if room is null then
    raise exception 'chat: no such room' using errcode = '42501';
  end if;

  update public.chat_read k
  set last_read_seq = coalesce(
        (select max(m.seq) from public.chat_message m where m.room_id = room), 0),
      read_at = now()
  where k.room_id = room and k.user_id = actor
  returning k.last_read_seq into marked;

  return marked;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.my_discovery_board()
 RETURNS TABLE(candidate_user_id uuid, nickname text, intro text, has_photo boolean, seat integer, exploration boolean, supplied_elements text[], balance_band text, preview_score integer, activity text, avatar_element text, photo_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_need jsonb;
  my_chart jsonb;
  opted timestamptz;
  snap uuid;
  snap_summary jsonb;
  snap_policy text;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.need_summary, p.opted_in_at
    into my_summary, my_need, opted
  from public.discovery_profile p where p.user_id = actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  select pe.current_chart into my_chart
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  /*
    **사람 단위로 먼저 줄을 세운다**(ADR 0120). 아래 `for update` 는 덱이 있을 때만 잠글 행이 있다 — 덱이 없는
    첫 읽기 둘이 나란히 오면 둘 다 「덱 없음」을 보고 덱을 두 벌 세웠다. 뒤 읽기는 앞 트랜잭션이 끝날 때까지 여기서
    기다렸다가 앞이 세운 덱을 읽는다.
  */
  perform pg_advisory_xact_lock(hashtext('discovery:deck:' || actor::text));

  /*
    덱을 잠그고 읽는다 — 같은 사람의 두 읽기가 나란히 채우면 같은 자리에 두 사람을 앉히려다 한쪽이 부딪힌다.
  */
  select s.id, s.viewer_summary, s.policy_version
    into snap, snap_summary, snap_policy
  from public.discovery_candidate s
  where s.user_id = actor
  order by s.seq desc
  limit 1
  for update;

  /*
    **새 덱은 덱이 없거나 · 내 요약이 바뀌었거나 · 정책이 바뀌었을 때만 선다.** 24시간 재생성은 없다 — 덱은
    떠나는 사람만큼만 바뀌고, 떠난 자리는 아래에서 바로 채운다.
  */
  if snap is null
     or snap_summary is distinct from my_summary
     or snap_policy is distinct from 'v2-beta' then
    snap := public.refresh_discovery_snapshot_for(actor, gen_random_uuid()::text);
  else
    -- 씨앗은 **DB 가 짓는다** — 밖에서 받으면 씨앗을 바꿔 가며 다시 뽑을 수 있다
    perform public.fill_discovery_deck(actor, snap, gen_random_uuid()::text);
  end if;

  return query
  select
    slot.candidate_user_id,
    who.nickname,
    who.intro,
    photo.n > 0,
    slot.position,
    slot.exploration,
    slot.supplied_elements,
    slot.balance_band,
    least(100, greatest(0, round(public.discovery_preview_score_v2(
      my_chart, my_summary, my_need, tp.current_chart, theirs.element_summary, theirs.need_summary))))::integer,
    public.activity_band_of(slot.candidate_user_id),
    case when photo.n > 0 then null
         else public.day_master_element_of(slot.candidate_user_id) end,
    photo.n
  from public.discovery_candidate_slot slot
  join public.app_user who on who.id = slot.candidate_user_id
  join public.person tp on tp.id = who.self_person_id
  join public.discovery_profile theirs on theirs.user_id = slot.candidate_user_id
  cross join lateral (
    select count(*)::integer as n from public.profile_photo f where f.user_id = slot.candidate_user_id
  ) photo
  where slot.snapshot_id = snap
    and public.discovery_eligible(actor, slot.candidate_user_id)
    and theirs.element_summary = slot.candidate_summary
  order by slot.position;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.my_passed_connections()
 RETURNS TABLE(candidate_user_id uuid, nickname text, intro text, has_photo boolean, passed_at timestamp with time zone, supplied_elements text[], balance_band text, preview_score integer, avatar_element text, photo_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_need jsonb;
  my_chart jsonb;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.need_summary into my_summary, my_need
  from public.discovery_profile p where p.user_id = actor;

  if my_summary is null then
    return;
  end if;

  select pe.current_chart into my_chart
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  return query
  select
    p.passed_user_id,
    who.nickname,
    who.intro,
    photo.n > 0,
    p.passed_at,
    public.discovery_supplied_elements_v1(my_summary, theirs.element_summary),
    public.discovery_balance_band(
      public.discovery_count_balance_v1(my_summary, theirs.element_summary)
    ),
    least(100, greatest(0, round(public.discovery_preview_score_v2(
      my_chart, my_summary, my_need, tp.current_chart, theirs.element_summary, theirs.need_summary))))::integer,
    case when photo.n > 0 then null
         else public.day_master_element_of(p.passed_user_id) end,
    photo.n
  from public.discovery_passed p
  join public.app_user who on who.id = p.passed_user_id
  join public.person tp on tp.id = who.self_person_id
  join public.discovery_profile theirs on theirs.user_id = p.passed_user_id
  cross join lateral (
    select count(*)::integer as n from public.profile_photo f where f.user_id = p.passed_user_id
  ) photo
  where p.user_id = actor
    and public.discovery_passed_kept(actor, p.passed_user_id)
    and public.discovery_pair_eligible(actor, p.passed_user_id)
  order by p.passed_at desc, p.passed_user_id desc
  limit 20;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.nickname_is_available(p_nickname text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  name text := btrim(p_nickname);
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if name is null or length(name) < 2 or length(name) > 8 then
    raise exception '닉네임은 2자에서 8자까지입니다.' using errcode = '22023';
  end if;

  return not exists (
    select 1 from public.app_user u
    where u.id <> actor
      and public.nickname_key(u.nickname) = public.nickname_key(name)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_discovery_snapshot_for(p_actor uuid, p_seed text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  my_summary jsonb;
  opted timestamptz;
  made uuid;
begin
  if p_actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.app_user u where u.id = p_actor and u.status = 'active'
  ) then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.opted_in_at
    into my_summary, opted
  from public.discovery_profile p where p.user_id = p_actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(p_actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  insert into public.discovery_candidate (user_id, policy_version, viewer_summary)
  values (p_actor, 'v2-beta', my_summary)
  returning id into made;

  perform public.fill_discovery_deck(p_actor, made, p_seed);

  -- 덱은 이어지므로 「직전」이 없다 — 한 세대만 남긴다
  delete from public.discovery_candidate s
  where s.user_id = p_actor and s.id <> made;

  return made;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.report_chat_message(p_message_id uuid, p_reason text, p_detail text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  trimmed text := nullif(btrim(coalesce(p_detail, '')), '');
  chosen public.chat_message;
  room public.chat_room;
  context integer := public.chat_snapshot_context();
  new_report uuid;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /** 가입이 끝난 계정만 — 공개 출시에서 가입은 본인인증을 품는다(ADR 0101) */
  if not exists (select 1 from public.app_user u where u.id = actor and u.signed_up_at is not null) then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  /** 이 사람의 신고를 줄 세운다 — 중복과 하루 수를 이 자물쇠 안에서 센다 */
  perform 1 from public.app_user u where u.id = actor for update;

  if p_reason is null or p_reason not in ('harassment', 'impersonation', 'inappropriate', 'other') then
    raise exception '신고 사유를 골라 주세요.' using errcode = '22023';
  end if;

  if trimmed is not null and length(trimmed) > 1000 then
    raise exception '적어 주신 내용이 너무 깁니다.' using errcode = '22023';
  end if;

  select m.* into chosen from public.chat_message m where m.id = p_message_id;

  if found then
    select r.* into room
    from public.chat_room r
    where r.id = chosen.room_id and public.chat_room_readable(r.id);
  end if;

  if chosen.id is null or room.id is null or chosen.sender_user_id is null then
    raise exception 'chat: no such message' using errcode = '42501';
  end if;

  if chosen.sender_user_id = actor then
    raise exception '자기 자신은 신고할 수 없습니다.' using errcode = '22023';
  end if;

  /**
   * 같은 메시지 · 같은 사유로 처리 필요인 신고가 있으면 또 쌓지 않는다 — 안 봤거나 추가 확인 필요로 보류한 것.
   * 정의는 운영자 목록과 같은 `report_is_open` 하나다(ADR 0107).
   * 같은 사람의 **다른** 메시지는 저마다 다른 근거라 막지 않는다 — 하루 한도가 그 수를 묶는다.
   */
  if exists (
    select 1 from public.report r
    join public.chat_report_snapshot s on s.report_id = r.id
    where r.reporter_user_id = actor and s.message_id = chosen.id
      and r.reason = p_reason and public.report_is_open(r.reviewed_at, r.review_outcome)
  ) then
    raise exception '같은 사유의 신고가 이미 접수되어 검토 중입니다.' using errcode = '23505';
  end if;

  /** 하루 수는 중복 뒤에 센다 — 같은 신고를 다시 낸 사람에게는 「이미 접수」가 먼저 선다 */
  perform public.hold_report_quota(actor);

  insert into public.report (reporter_user_id, reported_user_id, reason, detail)
  values (actor, chosen.sender_user_id, p_reason, trimmed)
  returning id into new_report;

  insert into public.chat_report_snapshot (
    report_id, match_id, message_id, context_before, context_after, messages)
  select
    new_report, room.match_id, chosen.id, context, context,
    coalesce(jsonb_agg(jsonb_build_object(
      'message_id', x.id,
      'seq', x.seq,
      'sender_user_id', x.sender_user_id,
      'body', x.body,
      'created_at', x.created_at,
      'chosen', x.id = chosen.id
    ) order by x.seq), '[]'::jsonb)
  from (
    (select b.* from public.chat_message b
     where b.room_id = room.id and b.seq < chosen.seq
     order by b.seq desc limit context)
    union all
    (select c.* from public.chat_message c where c.id = chosen.id)
    union all
    (select a.* from public.chat_message a
     where a.room_id = room.id and a.seq > chosen.seq
     order by a.seq asc limit context)
  ) x;

  return new_report;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.report_user(p_user_id uuid, p_reason text, p_detail text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  trimmed text := nullif(btrim(coalesce(p_detail, '')), '');
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /** 가입이 끝난 계정만 — 공개 출시에서 가입은 본인인증을 품는다(ADR 0101) */
  if not exists (select 1 from public.app_user u where u.id = actor and u.signed_up_at is not null) then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  /** 이 사람의 신고를 줄 세운다 — 중복과 하루 수를 이 자물쇠 안에서 센다 */
  perform 1 from public.app_user u where u.id = actor for update;

  if p_user_id is null or p_user_id = actor then
    raise exception '자기 자신은 신고할 수 없습니다.' using errcode = '22023';
  end if;

  if p_reason is null or p_reason not in ('harassment', 'impersonation', 'inappropriate', 'other') then
    raise exception '신고 사유를 골라 주세요.' using errcode = '22023';
  end if;

  if trimmed is not null and length(trimmed) > 1000 then
    raise exception '적어 주신 내용이 너무 깁니다.' using errcode = '22023';
  end if;

  /**
   * **아무나 신고할 수는 없다.** 마주친 적 있는 사람만 신고할 수 있다 — 후보로 봤거나,
   * 요청을 주고받았거나, Match 가 성립한 사이다. 이 조건이 없으면 uuid 를 넣어 보는
   * 것만으로 남의 계정에 신고를 쌓을 수 있다.
   */
  if not exists (
    select 1 from public.discovery_impression i
    where i.viewer_user_id = actor and i.candidate_user_id = p_user_id
    union all
    select 1 from public.match_request r
    where (r.requester_user_id = actor and r.addressee_user_id = p_user_id)
       or (r.requester_user_id = p_user_id and r.addressee_user_id = actor)
    union all
    select 1 from public.match m
    where (m.user_low = actor and m.user_high = p_user_id)
       or (m.user_low = p_user_id and m.user_high = actor)
  ) then
    raise exception '마주친 적 없는 사람은 신고할 수 없습니다.' using errcode = '42501';
  end if;

  /**
   * 같은 사람 · 같은 사유로 처리 필요인 신고가 있으면 또 쌓지 않는다 — 안 봤거나 추가 확인 필요로 보류한 것.
   * 정의는 운영자 목록과 같은 `report_is_open` 하나다(ADR 0107).
   */
  if exists (
    select 1 from public.report r
    where r.reporter_user_id = actor and r.reported_user_id = p_user_id
      and r.reason = p_reason and public.report_is_open(r.reviewed_at, r.review_outcome)
  ) then
    raise exception '같은 사유의 신고가 이미 접수되어 검토 중입니다.' using errcode = '23505';
  end if;

  /** 하루 수는 중복 뒤에 센다 — 같은 신고를 다시 낸 사람에게는 「이미 접수」가 먼저 선다 */
  perform public.hold_report_quota(actor);

  insert into public.report (reporter_user_id, reported_user_id, reason, detail)
  select actor, p_user_id, p_reason, trimmed
  where exists (select 1 from public.app_user u where u.id = p_user_id);

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.request_account_deletion()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status = 'deletion_requested' then
    -- 두 번 눌러도 처음 요청한 시각을 밀어내지 않는다.
    return true;
  end if;

  if account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  update public.app_user
  set status = 'deletion_requested', deletion_requested_at = now()
  where id = actor;

  update public.discovery_profile
  set opted_in_at = null,
      element_summary = null,
      element_input_version = null,
      element_chart_engine_version = null
  where user_id = actor;

  with ended as (
    update public.match_request
    set status = case when requester_user_id = actor then 'cancelled' else 'rejected' end,
        decided_at = now()
    where status = 'pending'
      and (requester_user_id = actor or addressee_user_id = actor)
    returning id, requester_user_id, status
  )
  insert into public.notification (user_id, kind, request_id)
  select ended.requester_user_id, 'request_rejected', ended.id
  from ended
  where ended.status = 'rejected';

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.request_match(p_candidate_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_version integer;
  their_summary jsonb;
  their_version integer;
  shown public.discovery_impression;
  counted record;
  new_request uuid;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if p_candidate_user_id is null or p_candidate_user_id = actor then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  /** **묻기 전에 잠근다** — 자격 확인과 insert 사이에 낀 차단·입력 수정이 새 pending 을 놓친다. */
  perform public.lock_users(actor, p_candidate_user_id);

  /** **잠근 뒤에 나를 다시 본다** — 그 사이 커밋된 제재를 새 스냅숏이 본다. */
  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  -- 내 쪽 자격은 갈라서 말한다. 내가 고칠 수 있는 것이고, 이유를 모르면 못 고친다.
  select p.element_summary into my_summary
  from public.discovery_profile p
  where p.user_id = actor and p.opted_in_at is not null;

  if my_summary is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  /**
   * **셈 전에 사람 자물쇠를 잡는다** — `start_reading_run_for` 와 같은 자물쇠다(ADR 0106). 계정 행만
   * 잠그면 풀이 시작과 이 요청이 나란히 마지막 한 번을 읽고 둘 다 지나간다.
   */
  perform pg_advisory_xact_lock(hashtext('reading:user:' || actor::text));

  select * into counted from public.reading_credits_used(actor);

  if counted.used + counted.reserved + counted.requested >= public.reading_credit_limit_for(actor) then
    raise exception '풀이권이 없어 요청할 수 없습니다. 요청 한 건이 풀이권 한 번을 잡고, 동의가 나면 그 한 번으로 궁합 풀이가 만들어집니다.'
      using errcode = 'check_violation';
  end if;

  /** 상대 쪽은 **한 문장으로만** 거절하고, 자격은 후보 목록과 **같은 함수**에 묻는다. */
  if not public.discovery_eligible(actor, p_candidate_user_id) then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  select p.element_summary into their_summary
  from public.discovery_profile p
  where p.user_id = p_candidate_user_id;

  select pe.input_version into my_version
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  select pe.input_version into their_version
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = p_candidate_user_id;

  /** **내가 본 그 카드**를 찾는다 — 요약 두 벌이 지금과 같은 기록만 고른다(ADR 0009). */
  select i.* into shown
  from public.discovery_impression i
  where i.viewer_user_id = actor
    and i.candidate_user_id = p_candidate_user_id
    and i.viewer_summary = my_summary
    and i.candidate_summary = their_summary
  order by i.shown_at desc
  limit 1;

  if their_summary is null or shown.id is null then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  insert into public.match_request (
    requester_user_id, addressee_user_id,
    requester_input_version, addressee_input_version,
    impression_id, policy_version,
    supplied_to_requester, supplied_to_addressee, balance_band
  )
  values (
    actor, p_candidate_user_id,
    my_version, their_version,
    shown.id, shown.policy_version,
    shown.supplied_elements,
    public.discovery_supplied_elements_v1(shown.candidate_summary, shown.viewer_summary),
    public.discovery_balance_band(shown.combined_balance)
  )
  returning id into new_request;

  insert into public.notification (user_id, kind, request_id)
  values (p_candidate_user_id, 'request_received', new_request);

  return new_request;

exception
  when unique_violation then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.respond_to_match_request(p_request_id uuid, p_accept boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  req public.match_request;
  requester_now integer;
  addressee_now integer;
  new_match uuid;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  /** **`null` 은 답이 아니다** — 명시적 동의 경계에서 「모름」이 「예」로 읽히면 안 된다. */
  if p_accept is null then
    raise exception '수락인지 거절인지 정해 주세요.' using errcode = '22004';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /** **읽고 → 잠그고 → 다시 읽는다.** 계정을 먼저, 요청을 나중에 — `block_user` 와 같은 차례다. */
  select * into req from public.match_request where id = p_request_id;

  -- 없는 요청과 남의 요청의 답이 **같다.**
  if not found or req.addressee_user_id <> actor then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  perform public.lock_users(req.requester_user_id, actor);

  select * into req from public.match_request where id = p_request_id for update;

  if not found or req.addressee_user_id <> actor then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  if req.status <> 'pending' then
    return req.status;
  end if;

  /**
   * **기한이 지난 요청은 답이 아니라 만료다.**
   *
   * 미는 일은 cron 이 하지만 그것이 늦을 수 있다. 늦은 사이에 수락되면 이미 풀린
   * 풀이권으로 Match 가 서고, 그러면 예약이 지키던 약속이 깨진다.
   */
  if req.expires_at <= now() then
    update public.match_request
    set status = 'expired', decided_at = now()
    where id = req.id;

    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_expired', req.id);

    return 'expired';
  end if;

  /** **양쪽 계정이 살아 있어야 한다.** 상대가 중지됐다는 것은 알리지 않는다. */
  if exists (
    select 1 from public.app_user u
    where u.id in (req.requester_user_id, req.addressee_user_id) and u.status <> 'active'
  ) then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  /**
   * **그 사이에 입력이 바뀌었나** — 세는 수로 묻는다(ADR 0071).
   *
   * 앞서는 판본 id 를 견줬다. 같은 물음이고, 답이 달라지는 자리가 하나 있다: 출생지만
   * 고쳐 여덟 글자가 그대로여도 **입력은 바뀐 것이다.** 요청은 그때 동의하려던 입력에
   * 매여 있으므로 무효가 맞다.
   */
  select pe.input_version into requester_now
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = req.requester_user_id;

  select pe.input_version into addressee_now
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = req.addressee_user_id;

  if requester_now is distinct from req.requester_input_version
     or addressee_now is distinct from req.addressee_input_version
  then
    update public.match_request
    set status = 'invalidated', decided_at = now()
    where id = req.id;

    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_invalidated', req.id),
           (req.addressee_user_id, 'request_invalidated', req.id);

    return 'invalidated';
  end if;

  if p_accept is not true then
    update public.match_request
    set status = 'rejected', decided_at = now()
    where id = req.id;

    -- 거절은 요청한 쪽에만 알린다. 내가 거절했다는 것은 내가 안다.
    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_rejected', req.id);

    return 'rejected';
  end if;

  update public.match_request
  set status = 'accepted', decided_at = now()
  where id = req.id;

  /**
   * **동의 당시 여덟 글자를 베낀다** (#68). 값은 `person.current_chart` 에서 오고 앱은
   * 한 글자도 안 댄다 — 넘기면 DB 는 그 값이 그 입력에서 나온 것인지 알 수 없다.
   */
  insert into public.match (
    request_id, user_low, user_high,
    chart_low, chart_high, chart_engine_low, chart_engine_high
  )
  select
    req.id,
    least(req.requester_user_id, req.addressee_user_id),
    greatest(req.requester_user_id, req.addressee_user_id),
    lo.current_chart,
    hi.current_chart,
    lo.chart_engine_version,
    hi.chart_engine_version
  from public.app_user low_user
  join public.person lo on lo.id = low_user.self_person_id
  join public.app_user high_user
    on high_user.id = greatest(req.requester_user_id, req.addressee_user_id)
  join public.person hi on hi.id = high_user.self_person_id
  where low_user.id = least(req.requester_user_id, req.addressee_user_id)
  returning id into new_match;

  -- 성립은 **양쪽 다** 알아야 하는 사건이다.
  insert into public.notification (user_id, kind, request_id, match_id)
  values (req.requester_user_id, 'request_accepted', req.id, new_match),
         (req.addressee_user_id, 'request_accepted', req.id, new_match);

  /**
   * **동의가 예약을 쓴다** — 시도는 **요청자 이름으로** 선다.
   *
   * 여기서 던지면 **수락 전체가 되돌아간다.** 시도를 못 여는 이유는 여럿이고 그중 어느
   * 것도 「동의하지 말라」는 뜻이 아니다. 동의는 두 사람이 정한 사실이므로 그 사실을 못
   * 여는 시도가 취소하게 두지 않는다.
   */
  begin
    perform public.start_reading_run_for(
      req.requester_user_id, 'match', 'match-accept:' || req.id::text,
      null, null, new_match);
  exception
    when others then null;
  end;

  return 'accepted';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_passed_connection(p_candidate_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  snap uuid;
  mine jsonb;
  my_need jsonb;
  theirs jsonb;
  their_need jsonb;
  supplied text[];
  slot record;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;
  -- 같은 계정의 복원들을 직렬화한다.
  perform 1 from public.app_user where id = actor for update;
  if not public.discovery_pair_eligible(actor, p_candidate_user_id) then
    raise exception '지금은 이 인연을 다시 만나볼 수 없습니다. 목록을 새로 열어 주세요.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.discovery_passed p
                 where p.user_id = actor and p.passed_user_id = p_candidate_user_id) then
    raise exception '이미 복원되었거나 보관 중인 인연이 아닙니다. 목록을 새로 열어 주세요.' using errcode = '42501';
  end if;

  -- 지나침을 해제하기 전에 현재 스냅샷을 준비한다. 자동 추천으로 먼저 끼어들지 않는다.
  perform 1 from public.my_discovery_board();
  select s.id into snap from public.discovery_candidate s
    where s.user_id = actor order by s.seq desc limit 1 for update;
  select p.element_summary, p.need_summary into mine, my_need
    from public.discovery_profile p where p.user_id = actor;
  select p.element_summary, p.need_summary into theirs, their_need
    from public.discovery_profile p where p.user_id = p_candidate_user_id;
  supplied := public.discovery_supplied_elements_v1(mine, theirs);

  delete from public.discovery_candidate_slot s
    where s.snapshot_id = snap and s.candidate_user_id = p_candidate_user_id;
  -- 높은 자리부터 옮겨 즉시 검사되는 복합 기본키와 충돌하지 않는다.
  for slot in select s.position from public.discovery_candidate_slot s
              where s.snapshot_id = snap order by s.position desc loop
    update public.discovery_candidate_slot set position = slot.position + 1
      where snapshot_id = snap and position = slot.position;
  end loop;
  insert into public.discovery_candidate_slot
    (snapshot_id, position, candidate_user_id, candidate_summary, exploration, supplied_elements, balance_band)
  values (snap, 0, p_candidate_user_id, theirs, false, supplied,
          public.discovery_balance_band(public.discovery_count_balance_v1(mine, theirs)));
  insert into public.discovery_impression
    (viewer_user_id, candidate_user_id, policy_version, position, exploration,
     viewer_summary, candidate_summary, supplied_elements, complement, combined_balance)
  values (actor, p_candidate_user_id, 'v2-beta', 0, false, mine, theirs, supplied,
          public.discovery_need_complement_v2(my_need, mine, their_need, theirs),
          public.discovery_count_balance_v1(mine, theirs));
  delete from public.discovery_passed p
    where p.user_id = actor and p.passed_user_id = p_candidate_user_id;
  return jsonb_build_object(
    'card', (select to_jsonb(c) from public.my_discovery_board() c where c.candidate_user_id = p_candidate_user_id),
    'passed', (select coalesce(jsonb_agg(p), '[]'::jsonb) from public.my_passed_connections() p)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_my_profile(p_nickname text, p_intro text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  name text := btrim(p_nickname);
  about text := nullif(btrim(coalesce(p_intro, '')), '');
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if name is null or length(name) < 2 or length(name) > 8 then
    raise exception '닉네임은 2자에서 8자까지입니다.' using errcode = '22023';
  end if;

  if about is not null and length(about) > 300 then
    raise exception '소개는 300자까지입니다.' using errcode = '22023';
  end if;

  /*
    **먼저 묻고, 그래도 인덱스가 막게 둔다.** 물어보는 것과 쓰는 것 사이에 남이 같은
    이름을 채 갈 수 있다. 그 좁은 틈에서 나오는 것은 여전히 제약 위반 문장이라, 그
    자리도 같은 말로 받아 낸다.
  */
  if exists (
    select 1 from public.app_user u
    where u.id <> actor
      and public.nickname_key(u.nickname) = public.nickname_key(name)
  ) then
    raise exception '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.' using errcode = '23505';
  end if;

  update public.app_user
  set nickname = name, intro = about
  where id = actor;

exception
  when unique_violation then
    raise exception '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.' using errcode = '23505';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_service_survey(p_liked text[], p_unknown text[], p_improve text[], p_improve_text text, p_wants text[], p_wants_new text[], p_price_solo text, p_price_pair text, p_price_factors text[], p_free_text text, p_price_options text[], p_submit boolean DEFAULT false)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  ctx record;
  solo text := nullif(btrim(p_price_solo), '');
  pair text := nullif(btrim(p_price_pair), '');
  factors text[] := coalesce(p_price_factors, array[]::text[]);
  said text := nullif(btrim(p_improve_text), '');
  more text := nullif(btrim(p_free_text), '');
  asked text[];
  anything boolean;
  when_submitted timestamptz;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /* 끝난 서비스가 새 자료를 받지 않는다 — 풀이 설문과 같은 규율이다 */
  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = 'check_violation';
  end if;

  select * into ctx from public.service_survey_context();

  if not ctx.consented then
    raise exception '설문은 풀이 개선에 활용하는 데 동의하신 뒤에 받을 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  if ctx.schedule_id is null then
    raise exception '아직 시작하지 않았습니다.' using errcode = 'check_violation';
  end if;

  if public.survey_sole_conflict(p_liked, array['none', 'not_enough'])
     or public.survey_sole_conflict(p_unknown, array['all_known', 'not_sure'])
     or public.survey_sole_conflict(p_improve, array['none', 'unsure'])
     or public.survey_sole_conflict(p_wants, array['unsure', 'none_again'])
     or public.survey_sole_conflict(p_wants_new, array['none']) then
    raise exception '함께 고를 수 없는 답이 섞여 있습니다.' using errcode = 'check_violation';
  end if;

  if not ctx.read_solo then solo := null; end if;
  if not ctx.read_pair then pair := null; end if;
  if not (ctx.read_solo or ctx.read_pair) then factors := array[]::text[]; end if;

  asked := array(select s from unnest(array['solo', 'pair']) s
                 where (s = 'solo' and ctx.read_solo) or (s = 'pair' and ctx.read_pair));

  anything := coalesce(cardinality(p_liked), 0) > 0
           or coalesce(cardinality(p_unknown), 0) > 0
           or coalesce(cardinality(p_improve), 0) > 0
           or said is not null
           or coalesce(cardinality(p_wants), 0) > 0
           or coalesce(cardinality(p_wants_new), 0) > 0
           or solo is not null
           or pair is not null
           or cardinality(factors) > 0
           or more is not null;

  if p_submit and not anything then
    raise exception '답을 하나도 고르지 않으셨습니다.' using errcode = 'check_violation';
  end if;

  insert into public.service_survey as s (
    user_id, schedule_id, survey_version,
    liked, unknown_features, improve, improve_text,
    wants, wants_new,
    price_solo, price_pair, price_options, price_asked, price_factors, free_text,
    credits_left, usage, saved_at, submitted_at
  )
  values (
    actor, ctx.schedule_id, 'service-survey-v1',
    coalesce(p_liked, array[]::text[]),
    coalesce(p_unknown, array[]::text[]),
    coalesce(p_improve, array[]::text[]),
    said,
    coalesce(p_wants, array[]::text[]),
    coalesce(p_wants_new, array[]::text[]),
    solo, pair, coalesce(p_price_options, array[]::text[]), asked, factors, more,
    ctx.credits_left,
    jsonb_build_object(
      'readSolo', ctx.read_solo,
      'readPair', ctx.read_pair,
      'creditsLeft', ctx.credits_left,
      'readings', (select count(*) from public.reading r
                   where r.owner_user_id = actor
                      or (r.kind = 'match' and r.match_id in (
                            select m.id from public.match m
                            where m.user_low = actor or m.user_high = actor))),
      'matches', (select count(*) from public.match m
                  where m.user_low = actor or m.user_high = actor),
      'discovery', exists (select 1 from public.discovery_profile p
                           where p.user_id = actor and p.opted_in_at is not null)),
    now(),
    case when p_submit then now() end
  )
  on conflict (user_id) do update
  set liked = excluded.liked,
      unknown_features = excluded.unknown_features,
      improve = excluded.improve,
      improve_text = excluded.improve_text,
      wants = excluded.wants,
      wants_new = excluded.wants_new,
      price_solo = excluded.price_solo,
      price_pair = excluded.price_pair,
      price_options = excluded.price_options,
      price_asked = excluded.price_asked,
      price_factors = excluded.price_factors,
      free_text = excluded.free_text,
      credits_left = excluded.credits_left,
      usage = excluded.usage,
      survey_version = excluded.survey_version,
      saved_at = now(),
      submitted_at = coalesce(s.submitted_at, excluded.submitted_at),
      updated_at = case
        when p_submit and s.submitted_at is not null then now()
        else s.updated_at
      end
  returning s.submitted_at into when_submitted;

  return when_submitted;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.send_chat_message(p_match_id uuid, p_body text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  room public.chat_room;
  recent integer;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if p_body is null or btrim(p_body) = '' then
    raise exception 'chat: the body is blank' using errcode = '22023';
  end if;

  if length(p_body) > public.chat_message_max_length() then
    raise exception '적어 주신 내용이 너무 깁니다.' using errcode = '22023';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  -- 내 전송을 줄 세운다. 한도의 셈이 잠금 뒤에 있어야 두 창이 같은 29 를 못 본다.
  perform 1 from public.app_user u where u.id = actor for update;

  -- 잠그기 전에 물은 것은 그 사이에 커밋된 제재를 못 본다(`request_match` 와 같은 이유).
  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select r.* into room
  from public.chat_room r
  where r.match_id = p_match_id and actor in (r.user_low, r.user_high);

  if not found then
    raise exception 'chat: no such room' using errcode = '42501';
  end if;

  if room.closed_at is not null then
    return 'closed';
  end if;

  select count(*) into recent
  from public.chat_message m
  where m.sender_user_id = actor
    and m.created_at > now() - public.chat_rate_window();

  if recent >= public.chat_rate_limit() then
    insert into public.chat_rate_limit_hit (user_id, room_id) values (actor, room.id);
    return 'rate_limited';
  end if;

  insert into public.chat_message (room_id, sender_user_id, body)
  values (room.id, actor, p_body);

  return 'sent';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.service_survey_context()
 RETURNS TABLE(schedule_id bigint, credits_left integer, read_solo boolean, read_pair boolean, consented boolean, beta_over boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  counted record;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  select * into counted from public.reading_credits_used(actor);

  return query
  select
    (select s.schedule_id from public.current_beta_schedule() s),
    greatest(0, public.reading_credit_limit_for(actor)
                - counted.used - counted.reserved - counted.requested),
    exists (
      select 1 from public.reading r
      where r.owner_user_id = actor and r.kind in ('self', 'person')),
    exists (
      select 1 from public.reading r
      where (r.owner_user_id = actor and r.kind = 'private')
         or (r.kind = 'match' and r.match_id in (
               select m.id from public.match m
               where m.user_low = actor or m.user_high = actor))),
    coalesce((select u.improvement_consent from public.app_user u where u.id = actor), false),
    public.beta_is_over();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_discovery_participation(p_on boolean, p_summary jsonb, p_need jsonb DEFAULT NULL::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  mine public.person;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if not p_on then
    insert into public.discovery_profile (user_id, opted_out_at)
    values (actor, now())
    on conflict (user_id) do update
      set opted_in_at = null,
          opted_out_at = now(),
          element_summary = null,
          element_input_version = null,
          element_chart_engine_version = null,
          need_summary = null,
          need_input_version = null,
          need_chart_engine_version = null;
    return false;
  end if;

  if account.self_person_id is null then
    raise exception '먼저 내 사주를 등록해 주세요.' using errcode = '23502';
  end if;

  if account.nickname is null then
    raise exception '먼저 닉네임을 정해 주세요.' using errcode = '23502';
  end if;

  select * into mine from public.person where id = account.self_person_id;

  if mine.calendar is null then
    raise exception '저장된 출생정보를 찾지 못했습니다.' using errcode = '23502';
  end if;

  if not public.is_element_summary(p_summary)
     or (p_need is not null and not public.is_need_summary(p_need)) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  insert into public.discovery_profile (
    user_id, opted_in_at, element_summary,
    element_input_version, element_chart_engine_version,
    need_summary, need_input_version, need_chart_engine_version)
  values (
    actor, now(), p_summary,
    mine.input_version, mine.chart_engine_version,
    p_need,
    case when p_need is null then null else mine.input_version end,
    case when p_need is null then null else mine.chart_engine_version end)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        opted_out_at = null,
        element_summary = excluded.element_summary,
        element_input_version = excluded.element_input_version,
        element_chart_engine_version = excluded.element_chart_engine_version,
        need_summary = coalesce(excluded.need_summary, public.discovery_profile.need_summary),
        need_input_version = case when excluded.need_summary is null
          then public.discovery_profile.need_input_version else excluded.need_input_version end,
        need_chart_engine_version = case when excluded.need_summary is null
          then public.discovery_profile.need_chart_engine_version else excluded.need_chart_engine_version end;

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.start_reading_run_for(p_actor uuid, p_kind text, p_idempotency_key text, p_person_a uuid DEFAULT NULL::uuid, p_person_b uuid DEFAULT NULL::uuid, p_match_id uuid DEFAULT NULL::uuid, p_model text DEFAULT NULL::text, p_prompt_version text DEFAULT NULL::text)
 RETURNS TABLE(run_id uuid, person_a uuid, person_b uuid, match_id uuid, viewer_is_first boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  scope record;
  existing uuid;
  recent integer;
  counted record;
  started uuid;
  today integer;
begin
  if p_actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  select * into scope
  from public.reading_scope_for(p_actor, p_kind, p_person_a, p_person_b, p_match_id);

  -- 0행이 곧 거절이다. 없는 대상과 못 보는 대상을 여기서도 가르지 않는다.
  if not found then
    raise exception '결과를 만들 수 있는 대상이 아닙니다.' using errcode = 'check_violation';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || p_actor::text));
  perform pg_advisory_xact_lock(hashtext(
    'reading:target:' || scope.kind
      || ':' || coalesce(scope.owner_user_id::text, '')
      || ':' || coalesce(scope.person_a::text, '')
      || ':' || coalesce(scope.person_b::text, '')
      || ':' || coalesce(scope.match_id::text, '')));

  update public.reading_run r
  set status = 'failed', failure_code = 'expired', finished_at = now()
  where r.status = 'running'
    and r.created_at <= now() - public.reading_run_timeout()
    and r.kind = scope.kind
    and r.person_a is not distinct from scope.person_a
    and r.person_b is not distinct from scope.person_b
    and r.match_id is not distinct from scope.match_id;

  select r.id into existing
  from public.reading_run r
  where r.user_id = p_actor and r.idempotency_key = p_idempotency_key;

  if existing is not null then
    return;
  end if;

  select r.id into existing
  from public.reading_run r
  where r.status = 'running'
    and r.created_at > now() - public.reading_run_timeout()
    and r.kind = scope.kind
    and r.person_a is not distinct from scope.person_a
    and r.person_b is not distinct from scope.person_b
    and r.match_id is not distinct from scope.match_id;

  if existing is not null then
    return;
  end if;

  select * into counted from public.reading_credits_used(p_actor);

  if counted.used + counted.reserved + counted.requested >= public.reading_credit_limit_for(p_actor) then
    if counted.reserved > 0 then
      raise exception '지금 만들고 있는 풀이가 마지막 풀이권을 쓰고 있어요. 그것이 끝나면 다시 눌러 주세요.'
        using errcode = 'check_violation';
    end if;

    if counted.requested > 0 then
      raise exception '보낸 인연 요청이 풀이권을 잡고 있어요. 요청을 거두거나 상대의 답을 기다려 주세요.'
        using errcode = 'check_violation';
    end if;

    raise exception '풀이권을 다 쓰셨습니다. 테스트 기간에는 %번까지 만들 수 있어요.',
      public.reading_credit_limit_for(p_actor)
      using errcode = 'check_violation';
  end if;

  select count(*) into recent
  from public.reading_run r
  where r.user_id = p_actor
    and r.created_at > now() - interval '1 hour';

  if recent >= public.reading_rate_limit() then
    raise exception '한 시간에 만들 수 있는 결과 수를 넘었습니다. 잠시 뒤에 다시 시도해 주세요.'
      using errcode = 'check_violation';
  end if;

  /**
   * **오늘 전체가 다 찼는가** — 이 사람 것이 아니라 서비스 것이다.
   *
   * 코드를 갈라 둔다(`53400` configuration_limit_exceeded). 사람 자격은 전부
   * `check_violation` 이고 그것은 「당신이 고칠 수 있는 것」이다. 이 벽은 그 사람이
   * 무엇을 해도 오늘은 안 열린다.
   *
   * **풀이권은 안 나간다.** 여기까지 오면 시도 행 자체를 안 만들기 때문이다.
   */
  today := public.reading_spend_today();

  if today >= public.reading_daily_budget() then
    raise exception '오늘 만들 수 있는 풀이를 모두 썼습니다. 내일 다시 열립니다.'
      using errcode = '53400';
  end if;

  insert into public.reading_run (
    user_id, kind, person_a, person_b, match_id, idempotency_key, model, prompt_version
  )
  values (
    p_actor, scope.kind, scope.person_a, scope.person_b, scope.match_id,
    p_idempotency_key, p_model, p_prompt_version
  )
  returning id into started;

  /**
   * 방금 넣은 것까지 세서 문턱을 넘었으면 알린다. **아직 아무도 막히지 않았다** —
   * 다음 사람이 막힌다. 그것이 이 알림이 서는 이유다.
   */
  today := today + 1;

  if today >= public.reading_daily_budget() then
    perform public.notify_ops(
      'reading-budget-reached',
      format('오늘 시도 %s건으로 하루 상한(%s)을 채웠습니다. 다음 누름부터 막힙니다.',
             today, public.reading_daily_budget()));
  elsif today >= public.reading_budget_warning() then
    perform public.notify_ops(
      'reading-budget-warning',
      format('오늘 시도 %s건으로 하루 상한(%s)의 80%%를 넘었습니다.',
             today, public.reading_daily_budget()));
  end if;

  perform public.freeze_reading_input(
    started, p_actor, scope.kind, scope.person_a, scope.person_b, scope.match_id);

  return query select
    started, scope.person_a, scope.person_b, scope.match_id, scope.viewer_is_first;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_activity()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  written integer;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    return false;
  end if;

  insert into public.user_activity (user_id, last_active_at)
  values (actor, now())
  on conflict (user_id) do update
    set last_active_at = excluded.last_active_at
    where public.user_activity.last_active_at < excluded.last_active_at - public.presence_write_window();

  get diagnostics written = row_count;
  return written > 0;
end;
$function$
;
