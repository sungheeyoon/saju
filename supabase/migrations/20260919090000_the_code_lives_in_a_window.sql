-- 테스트 코드가 **하루가 아니라 창(window)을 산다**
--
-- 지금까지 코드는 하루였다(`valid_on`). 「새어도 오늘 N명까지」를 노린 모양이고 1차
-- 테스터를 그렇게 받았다. 2차를 받으려니 그 모양이 안 맞는다 — **밤 열 시에 공지를
-- 올리면 쓸 수 있는 시간이 두 시간**이다.
--
-- ## 지키던 것은 하루가 아니라 정원이었다
--
-- 「새어도 N명까지」를 실제로 지키는 값은 `max_uses` 다. 그 수는 **누적**이라 —
-- `app_user.signup_code` 로 세므로 날이 바뀌어도 안 돌아온다 — 창을 이틀로 늘려도
-- 스무 명은 스무 명이다. 하루라는 제한이 지키던 것은 「오래된 코드가 영원히 살지
-- 않는다」 하나이고, 그것은 끝나는 날을 적는 것으로 그대로 지켜진다.
--
-- ## 옛 줄은 하루짜리 그대로다
--
-- `valid_until` 을 `valid_on` 으로 채운다. 이미 나간 코드의 수명을 우리가 늘리지
-- 않는다 — 그 코드를 받은 사람들에게 한 약속이 하루였다.

alter table public.signup_code add column valid_until date;

update public.signup_code set valid_until = valid_on where valid_until is null;

/** 끝나는 날이 시작보다 앞설 수는 없다 — 하루짜리면 둘이 같다 */
alter table public.signup_code
  add constraint signup_code_window_is_forward check (valid_until >= valid_on);

/**
 * **안 적으면 하루짜리다.**
 *
 * `not null` 을 그냥 걸면 이미 적혀 있는 INSERT 가 전부 깨진다 — 절차서(`docs/ops/runbook.md`)
 * 의 한 줄도, 시험 두 파일도. 그 자리들이 뜻하던 것은 「하루」였고 그 뜻은 바뀌지
 * 않았다. 그래서 **비워 두면 하루**로 채운다.
 *
 * 기본값(`default`)으로는 못 한다 — 같은 행의 다른 열을 볼 수 없다.
 */
create or replace function public.signup_code_defaults_to_one_day()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.valid_until is null then
    new.valid_until := new.valid_on;
  end if;
  return new;
end;
$$;

create trigger signup_code_one_day_unless_said
before insert or update of valid_on, valid_until on public.signup_code
for each row execute function public.signup_code_defaults_to_one_day();

revoke execute on function public.signup_code_defaults_to_one_day()
  from anon, authenticated, public;

/* 트리거가 채우고 나서 건다 — 그래야 「안 적으면 하루」와 「비어 있을 수 없다」가 함께 참이다 */
alter table public.signup_code alter column valid_until set not null;

comment on column public.signup_code.valid_on is
  '이 코드가 사는 첫날 (서울 날짜)';
comment on column public.signup_code.valid_until is
  '이 코드가 사는 마지막 날 (서울 날짜, 포함). 하루짜리면 valid_on 과 같다';

-- ---------------------------------------------------------------------------
-- 판정 — 한 줄만 바뀐다
-- ---------------------------------------------------------------------------

/**
 * **바뀌는 것은 날짜 비교 한 줄뿐이다.**
 *
 * `valid_on <> 오늘` 이던 자리가 `오늘 not between valid_on and valid_until` 이 된다.
 * 없는 코드와 지난 코드를 한 문장으로 말하는 규율도, 행을 잠그고 정원을 세는 차례도
 * 그대로다 — 그 둘을 건드리면 이 마이그레이션이 재는 것이 둘이 된다.
 */
CREATE OR REPLACE FUNCTION public.complete_signup(p_code text, p_nickname text, p_version text, p_schedule_id bigint, p_improvement boolean, p_contact boolean)
 RETURNS void
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
    if not found
       or public.signup_today() not between code_row.valid_on and code_row.valid_until then
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
$function$;
