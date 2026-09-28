-- 틀린 가입 코드는 계정마다 한 시간에 열 번까지다 (ADR 0124, 보안 감사 3~14 의 하나, 운영자 승인 2026-09-28)
--
-- `complete_signup` 은 `authenticated` 에 열려 있고(`20260911090000_the_code_opens_the_signup.sql:268-271`), 코드를
-- 맞춰 보는 데 **횟수 제한이 없다.** 로그인만 하면 PostgREST 로 코드를 끝없이 두드릴 수 있다. runbook 「초대」의 본보기
-- 코드가 `SAJU1001` 이다 — 앞 넷이 정해지면 남는 것은 만 가지다. 틀린 코드는 「지금 쓸 수 있는 코드가 아닙니다.」 한
-- 문장으로 거절하지만(없는 코드와 지난 코드를 가르지 않는다) 맞으면 곧바로 들어오므로 두드리는 쪽에는 그것으로 충분하다.
--
-- ## 무엇이 바뀌나
--
-- - **틀린 시도를 적는다** — `signup_code_miss`(계정 · 시각). 사용자에게 안 열린 표다.
-- - **한 시간에 열 번 틀리면 그 계정은 한 시간 동안 코드를 못 넣는다** — 맞는 코드도. 거절 문장은 새것이다(운영자 승인).
-- - **틀린 코드는 던지지 않고 `false` 를 낸다.** 던지면 적은 줄이 함께 되감기므로 셀 수가 없다. 그래서 반환형이
--   `void` → `boolean` 이 된다(`true` = 가입을 끝냈다 · 안내를 다시 확인했다, `false` = 코드가 안 맞는다). 앱은
--   `false` 에 지금과 같은 문장(「지금 쓸 수 있는 코드가 아닙니다.」)을 세운다.
-- - 나머지 거절(가입 멈춤 · 빈 코드 · 정원 · 닉네임 · 안내 판본)은 그대로 던진다 — 코드를 맞히는 데 쓰이지 않는다.
--
-- ## 옛 앱과
--
-- 반환형만 바뀌고 이름 · 인자는 그대로다. 이 마이그레이션이 먼저 서고 앱이 나중에 나가는 동안(runbook 「배포」),
-- 옛 앱은 `false` 를 성공으로 읽어 `/me` 로 보내고 관문이 `/signup` 으로 되돌린다 — 틀린 코드에 문장이 안 선다.
-- 가입은 일어나지 않는다(이름 · 코드 · 안내 확인을 적는 `update` 앞에서 돌아간다).
--
-- ## 운영자 결정(2026-09-28)
--
-- 「예, 10번/1시간」 — 한도 · 창 · 거절 문장을 제안대로 승인했다. 수는 아래 두 함수 한 곳에 있다.
--
-- 재는 자리는 `supabase/tests/66_signup_code_misses.test.sql`.

create table public.signup_code_miss (
  user_id uuid not null references public.app_user (id) on delete cascade,
  missed_at timestamptz not null default now()
);

/** 한 계정의 창 안 줄을 세는 자리 — `complete_signup` 이 틀린 코드마다 · 가입마다 탄다 */
create index signup_code_miss_by_user on public.signup_code_miss (user_id, missed_at);

alter table public.signup_code_miss enable row level security;
-- 정책을 하나도 만들지 않는다 — 사용자가 읽을 까닭도 지울 까닭도 없다. 쓰는 것은 `complete_signup` 하나다
revoke all on public.signup_code_miss from anon, authenticated;

/** 창 안에서 받는 틀린 시도의 수 — 운영자 승인 2026-09-28 */
create function public.signup_code_miss_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

/** 틀린 시도를 세는 창 — 운영자 승인 2026-09-28 */
create function public.signup_code_miss_window()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '1 hour' $$;

revoke execute on function public.signup_code_miss_limit() from anon, authenticated, public;
revoke execute on function public.signup_code_miss_window() from anon, authenticated, public;

-- 반환형이 바뀌므로 다시 만든다. 본문은 `20261010110000_the_signup_can_be_paused.sql` 의 정의(지금 로컬 · 운영의 것)에
-- 위 셋을 더한 것이다
drop function public.complete_signup(text, text, text, bigint, boolean, boolean);

create function public.complete_signup(p_code text, p_nickname text, p_version text, p_schedule_id bigint, p_improvement boolean, p_contact boolean)
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
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
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
    /*
      **가입이 닫혀 있으면 새 사람은 여기서 멈춘다**(ADR 0105). 코드가 살아 있어도 그렇다 — 운영자가 자리를
      비운 동안 들어온 사람의 신고를 볼 사람이 없다. 문장은 코드가 지금 안 된다는 기존 문장이다. 이미 가입한
      사람이 안내를 다시 확인하는 길(위 조건의 밖)은 안 막는다.
    */
    if exists (select 1 from public.signup_pause p where p.resumed_at is null) then
      raise exception '지금 쓸 수 있는 코드가 아닙니다.' using errcode = '42501';
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
      raise exception '코드를 여러 번 잘못 넣었습니다. 한 시간 뒤에 다시 시도해 주세요.' using errcode = '42501';
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

  -- 들어왔으면 틀린 시도는 더 셀 까닭이 없다
  delete from public.signup_code_miss m where m.user_id = actor;

  return true;
end;
$function$;

revoke execute on function public.complete_signup(text, text, text, bigint, boolean, boolean) from anon, public;
grant execute on function public.complete_signup(text, text, text, bigint, boolean, boolean) to authenticated;
