-- 참여는 기본으로 켜진다 — ADR 0037 의 나머지 절반
--
-- 「내 사주를 저장한 사람은 자동으로 후보 풀에 든다」(PRD §4.1). 스냅샷은 #10 에서 섰고,
-- 이름은 #14 에서 가입할 때 짓게 됐다. 남은 것이 이 한 줄이다.
--
-- **DB 혼자 못 한다.** 오행 요약은 절기·자시·경도 판정이 든 TypeScript 엔진만 계산하고,
-- 그래서 참여의 조건인 요약은 언제나 앱이 넣는다. 그러면 「자동 참여」는 **앱이 요약을
-- 넣는 자리에서 참여가 함께 열리는 일**이 된다. 그 자리는 이미 하나 있다 — 홈이 목록을
-- 열 때 낡은 요약을 고치려고 부르는 함수다. 그 함수의 규칙을 뒤집는 것이 이 마이그레이션의
-- 전부이고, 새 호출부는 하나도 늘지 않는다.

-- ---------------------------------------------------------------------------
-- 끈 적이 있는가 — **「안 켰다」와 「껐다」를 가른다**
-- ---------------------------------------------------------------------------

/**
 * 참여가 기본으로 켜지면서 `opted_in_at is null` 하나가 두 가지 뜻을 갖게 됐다.
 *
 * - 아직 아무 결정도 안 한 사람 — 켜 줘야 한다
 * - 직접 끈 사람 — **다시 켜면 안 된다**
 *
 * 두 상태가 같은 칸을 비우고 있으면, 끈 사람이 홈을 열 때마다 참여가 되살아난다. 그것은
 * 고장이 아니라 **사용자가 한 결정을 우리가 매번 되돌리는 일**이다. 그래서 끈 사건을
 * 따로 든다 — 켠 것이 사건인 것과 같은 까닭이다.
 */
alter table public.discovery_profile
  add column opted_out_at timestamptz;

comment on column public.discovery_profile.opted_out_at is
  '직접 끈 시각. `null` 이면 끈 적이 없다 — 그때만 자동 참여가 열린다.';

/*
  둘이 동시에 참일 수 없다. 켠 상태이면서 끈 상태인 행은 어느 쪽으로도 못 읽고, 읽는
  자리가 여럿이면 각자 다르게 읽는다.
*/
alter table public.discovery_profile
  add constraint opted_in_or_out
  check (opted_in_at is null or opted_out_at is null);

/*
  **이미 있는 행 중 참여 중이 아닌 것은 「껐다」로 읽는다.**

  지금 이 표에서 끈 사람과 안 켠 사람은 **구별되지 않는다** — 끄는 길이 `opted_in_at` 과
  `element_summary` 를 함께 비우고, 아무 결정도 안 한 행도 같은 두 칸이 비어 있다.
  자료가 답을 못 하므로 **둘 중 틀렸을 때 싼 쪽**을 고른다.

  - 끈 사람을 「안 켰다」로 읽으면 다음 방문에 참여가 저절로 켜진다. **동의 없이 남에게
    보이게 되는 것**이고, 되돌릴 수 없다 — 이미 남의 목록에 섰다.
  - 안 켠 사람을 「껐다」로 읽으면 설정 화면이 「쉬는 중」이라고 말한다. 사실과 다르지만
    **한 번 누르면 제자리로 온다.**

  그리고 이 백필이 닿는 것은 **인연 설정 화면을 직접 만진 사람뿐**이다. 행은 참여를
  켰거나 조건을 저장했을 때만 생기고, 그 화면을 한 번도 안 연 사람에게는 행이 없어
  자동 참여가 그대로 열린다. 즉 여기서 쉬게 되는 사람은 **고른 적이 있을 확률이 가장
  높은 사람들**이다.

  다음부터는 끈 사건이 기록되므로 같은 물음이 다시 서지 않는다.
*/
update public.discovery_profile
set opted_out_at = now()
where opted_in_at is null and opted_out_at is null;

-- ---------------------------------------------------------------------------
-- 요약을 넣는 자리가 참여를 연다
-- ---------------------------------------------------------------------------

/*
  이름이 바뀐다. `refresh_discovery_summary` 는 「이미 참여 중인 사람의 요약을 갱신한다」는
  뜻이었고, 이제 이 함수는 **참여를 열기도 한다.** 하는 일이 바뀌었는데 이름이 그대로면
  부르는 쪽이 옛 뜻으로 읽는다.
*/
drop function if exists public.refresh_discovery_summary(uuid, jsonb);

/**
 * 요약을 지금 판본에 맞추고, **끈 적 없으면 참여를 연다.**
 *
 * 전에는 「참여 중일 때만 움직인다」였다. 그 규칙이 지키던 것은 **켠 적 없는 참여가
 * 생기지 않는 것**이었고, 참여가 명시적 행위이던 동안에는 그것이 맞았다. 기본이 켜짐이
 * 되면 지켜야 할 것이 바뀐다 — 이제는 **끈 적 있는 참여가 되살아나지 않는 것**이다.
 * 규칙을 지우는 것이 아니라 옮기는 것이고, 옮긴 자리가 `opted_out_at` 이다.
 *
 * 그러면 「켠 적 없는 참여」는 무엇이 막는가. 가입 관문의 고지다(`notice-v3`) — 안내가
 * 「내 사주를 저장하시면 자동으로 참여합니다」를 말하고, 그것을 읽지 않은 사람은 `/me`
 * 아래로 못 들어온다. 막는 자리가 함수에서 관문으로 옮겨 간 것이지 없어진 것이 아니다.
 *
 * **거절 셋은 말없이 거짓을 낸다.** 이 함수는 사용자가 누른 버튼이 아니라 화면이 여는
 * 길에서 불린다 — 내 사주가 아닌 사람을 고쳤을 때, 아직 이름이 없을 때, 끈 사람일 때.
 * 그 셋은 잘못이 아니라 **참여가 열릴 자리가 아니라는 사실**이고, 그때 예외를 던지면
 * 홈이 안 열린다.
 */
create or replace function public.ensure_discovery_participation(p_person_id uuid, p_summary jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  current_revision uuid;
  opted_out timestamptz;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  /*
    **여기서는 행을 안 잠근다.** 이 함수는 홈을 열 때마다 도는 자리이고, 잠그면 한 사람의
    두 탭이 서로를 기다린다. 겹쳐 들어와도 마지막 쓰기가 같은 값을 쓴다 — 같은 판본에서
    나온 같은 요약이라, 순서가 뒤바뀌어도 남는 값이 하나다.
  */
  select * into account from public.app_user where id = actor;

  -- 내 사주가 아니면 아무 일도 아니다. 가족·친구를 고쳤다고 내 노출이 바뀌지 않는다.
  if account.self_person_id is null or account.self_person_id is distinct from p_person_id then
    return false;
  end if;

  /*
    **이름 없는 카드가 남의 목록에 서지 않게 하는 마지막 문이 여기다.**

    새 계정은 이름을 짓고 나서야 사주를 저장할 수 있으므로 이 줄이 안 돈다. 이름이
    계정으로 옮겨 오기 전에 사주를 등록한 사람들만 여기 걸리고, 그들은 이름을 짓는
    순간 다음 홈에서 풀에 든다.
  */
  if account.nickname is null then
    return false;
  end if;

  select opted_out_at into opted_out from public.discovery_profile where user_id = actor;
  if opted_out is not null then
    return false;
  end if;

  if not public.is_element_summary(p_summary) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  select current_revision_id into current_revision
  from public.person where id = account.self_person_id;

  if current_revision is null then
    return false;
  end if;

  insert into public.discovery_profile (user_id, opted_in_at, element_summary, element_revision_id)
  values (actor, now(), p_summary, current_revision)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        element_summary = excluded.element_summary,
        element_revision_id = excluded.element_revision_id;

  return true;
end;
$$;

revoke execute on function public.ensure_discovery_participation(uuid, jsonb) from anon, public;
grant execute on function public.ensure_discovery_participation(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 끄고 켜는 문 — **끈 사건을 남긴다**
-- ---------------------------------------------------------------------------

/**
 * 참여를 켜고 끈다 — 달라진 것은 **끈 것을 기록한다**는 하나다.
 *
 * 끄면 `opted_out_at` 이 서고, 그 값이 서 있는 동안 자동 참여는 이 사람을 지나간다.
 * 다시 켜면 지운다 — 그러지 않으면 「켰는데 다음 방문에 또 꺼져 있다」가 된다.
 *
 * 켜는 쪽의 거절은 예외로 남는다. 여기는 사람이 누른 버튼이고, 안 켜졌으면 왜 안
 * 켜졌는지 들어야 한다(`ensure_discovery_participation` 이 말없이 거짓을 내는 것과
 * 갈리는 자리가 이것이다).
 */
create or replace function public.set_discovery_participation(p_on boolean, p_summary jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  current_revision uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if not p_on then
    /*
      **행이 없어도 끈 것은 기록한다.** 자동 참여가 이 사람을 아직 안 지나갔을 수 있고,
      그때 아무것도 안 남기면 다음 홈에서 켜진다 — 방금 끈 사람에게.
    */
    insert into public.discovery_profile (user_id, opted_out_at)
    values (actor, now())
    on conflict (user_id) do update
      set opted_in_at = null,
          opted_out_at = now(),
          element_summary = null,
          element_revision_id = null;
    return false;
  end if;

  -- 사주가 없으면 후보가 될 수 없다. 오행 요약이 나올 데가 없기 때문이다.
  if account.self_person_id is null then
    raise exception '먼저 내 사주를 등록해 주세요.' using errcode = '23502';
  end if;

  if account.nickname is null then
    raise exception '먼저 닉네임을 정해 주세요.' using errcode = '23502';
  end if;

  select current_revision_id into current_revision
  from public.person where id = account.self_person_id;

  if current_revision is null then
    raise exception '저장된 출생정보를 찾지 못했습니다.' using errcode = '23502';
  end if;

  if not public.is_element_summary(p_summary) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  insert into public.discovery_profile (user_id, opted_in_at, element_summary, element_revision_id)
  values (actor, now(), p_summary, current_revision)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        opted_out_at = null,
        element_summary = excluded.element_summary,
        element_revision_id = excluded.element_revision_id;

  return true;
end;
$$;
