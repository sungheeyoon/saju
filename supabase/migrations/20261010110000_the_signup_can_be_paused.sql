-- 운영자가 자리를 비우면 **새 가입을 닫는다** — 한 줄로 닫고 한 줄로 연다 (ADR 0105)
--
-- 2026-09-24 에 사람이 정했다: 신고는 접수 뒤 3영업일 안에 1차 판단하고, 운영자가 3영업일을 넘게 자리를 비우면
-- 새 가입을 닫는다. 지금 가입의 문은 테스트 코드인데 코드는 여럿이고 각자 기간과 정원을 든다 — 코드를 하나씩
-- 막는 것은 닫는 수단이 아니라 잊기 쉬운 절차다. 그래서 **가입 경로가 확인하는 칸 하나**를 둔다.
--
-- - `public.signup_pause` 에 열린 줄(`resumed_at is null`)이 있으면 `complete_signup` 이 새 사람을 막는다.
--   이미 가입한 사람이 바뀐 안내를 다시 확인하는 길은 안 막는다 — 그 사람은 이미 들어와 있다.
-- - 덮어쓰지 않고 쌓는다 — 언제 · 왜 닫았고 언제 열었는지가 남는다. 열린 줄은 하나뿐이다.
-- - 막는 문장은 **기존 문장**(「지금 쓸 수 있는 코드가 아닙니다.」)이다. 닫힌 동안 참인 말이고 새 문구가 없다.
--   PASS 가 가입의 문이 되는 날(G-20) 코드가 없어지면 이 문장을 그때 다시 본다.
-- - 앱 역할은 이 표를 못 읽는다. 닫고 여는 손은 운영 SQL 이다(runbook 「운영 주기」).
--
-- 함수는 `20260929090000` 의 살아 있는 정의에서 떠서 위 한 조각만 더했다.

create table public.signup_pause (
  id bigint generated always as identity primary key,
  paused_at timestamptz not null default now(),
  /** 왜 닫았나 — 「운영자 부재 10/01~10/06」처럼. 이용자 개인정보를 적지 않는다 */
  reason text not null check (length(btrim(reason)) between 2 and 200),
  resumed_at timestamptz,
  constraint resumed_after_paused check (resumed_at is null or resumed_at >= paused_at)
);

comment on table public.signup_pause is
  '새 가입을 닫은 기간 — 열린 줄(resumed_at is null)이 있으면 complete_signup 이 새 사람을 막는다 (ADR 0105)';

/** 열린 줄은 하나뿐이다 — 둘이면 하나만 닫고 「열었다」고 믿게 된다 */
create unique index signup_pause_one_open on public.signup_pause ((true)) where resumed_at is null;

alter table public.signup_pause enable row level security;
revoke all on public.signup_pause from public, anon, authenticated, service_role;

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
$function$
;
