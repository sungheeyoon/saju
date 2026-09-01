-- 지우는 일 — **FK 가 순서를 정하고, 안 매인 것만 손으로 적는다**
--
-- 「계정과 저장 데이터의 삭제를 요청할 수 있다」(US 61)는 아직 화면이 없다. 그런데
-- 화면만 없는 것이 아니었다 — **스키마가 삭제를 거절하고 있었다.**
--
--   delete from auth.users where id = …
--   ERROR: update or delete on table "app_user" violates foreign key constraint
--          "person_chart_revision_created_by_fkey"
--
-- 베타 종료일을 날짜로 약속하려면 그날 실행할 절차가 실제로 돌아야 한다. 안 도는
-- 절차를 적어 두는 것은 약속이 아니라 계획이다.
--
-- ## 여기서 고치는 것 둘
--
-- 1. **판본을 만든 사람이 떠날 수 있게 한다.** `created_by` 가 `not null` · `no action`
--    이라 그 사람을 지우는 문이 잠겨 있었다.
-- 2. **아무에게도 안 매인 Person 을 지우는 규칙을 값으로 만든다.** Person 은 사용자에게
--    매여 있지 않아서(ADR 0005 — 생일은 신원이 아니고 Person 은 claim 된다) FK 가
--    데려가지 못한다. 그것만 손으로 적는다.

-- ---------------------------------------------------------------------------
-- 판본을 만든 사람은 떠날 수 있다
-- ---------------------------------------------------------------------------

/**
 * **`cascade` 가 아니라 `set null` 이다.**
 *
 * `cascade` 로 두면 떠나는 사람이 **남이 관리하는 Person 의 판본까지** 데려간다. A 가
 * 등록해 준 「엄마」를 B 도 관리하고 있는데, A 가 나가면서 그 명식이 사라지는 것이다.
 * 판본은 Person 의 것이지 그것을 적어 넣은 사람의 것이 아니다.
 *
 * 그러면 「누가 만들었나」를 잃는다. 그것이 맞다 — 그 사람이 떠났으므로, 떠난 사람을
 * 계속 가리키고 있는 것이 오히려 남기지 않기로 한 것을 남기는 일이다.
 *
 * `not null` 을 푸는 것이 이 변경의 값이다. 「모른다」가 표현 가능해야 「떠났다」를 적을
 * 수 있다.
 */
alter table public.person_chart_revision alter column created_by drop not null;

alter table public.person_chart_revision drop constraint person_chart_revision_created_by_fkey;
alter table public.person_chart_revision add constraint person_chart_revision_created_by_fkey
  foreign key (created_by) references public.app_user (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 아무에게도 안 매인 Person
-- ---------------------------------------------------------------------------

/**
 * 엣지가 하나도 안 남은 Person 을 지운다.
 *
 * **왜 FK 가 못 하는가.** Person 은 사용자의 소유물이 아니다(ADR 0004·0005) — 사람의
 * 안정적인 식별자이고 여럿이 같은 Person 을 관리할 수 있으며 나중에 claim 된다. 그래서
 * `person` 에는 `app_user` 를 가리키는 열이 없고, 지우는 규칙을 FK 에 적을 수가 없다.
 * 이 저장소는 지우는 규칙을 표 이름이 아니라 FK 에 적어 왔는데, 여기가 그럴 수 없는
 * 자리다. 그러면 **규칙을 값으로** 만든다 — 목록이 아니라 조건 하나로.
 *
 * 조건은 「관리하는 사람이 하나도 없다」이다. 그 Person 의 명식을 볼 수 있는 사람이
 * 아무도 없다는 뜻이고, 그때 남아 있는 것은 주인 없는 출생정보다.
 *
 * **판본은 따라 지워진다** — `person_chart_revision.person_id` 가 cascade 다. 여기가
 * 이 함수가 표 이름을 안 적어도 되는 까닭이다.
 */
create or replace function public.forget_orphan_people()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.person p
    where not exists (
      select 1 from public.user_person_access e where e.person_id = p.id
    )
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function public.forget_orphan_people()
  from anon, public, authenticated, service_role;

/**
 * 사람 하나를 잊는다 — **운영자만 부른다.**
 *
 * 화면은 아직 없다(US 61 은 공개 전환 단계다). 그래도 **절차는 지금 있어야 한다** —
 * 안내에 「종료 후 30일 이내 파기」라고 적으려면 그날 실행할 것이 실재해야 한다.
 *
 * ## 두 걸음뿐이다
 *
 * 첫 걸음이 거의 전부다. `auth.users` 하나를 지우면 `app_user` 가 따라가고, 거기서
 * 열여덟 갈래가 cascade 로 따라간다 — Person 엣지·판본 소유·discovery·요청·Match·
 * 결과·시도·설문·알림·차단·신고. 지우는 규칙이 FK 에 적혀 있으므로 **여기에 표 이름을
 * 한 줄도 안 적는다.** 표가 늘어도 이 함수는 안 고친다.
 *
 * 둘째 걸음이 FK 가 못 하는 하나다(위). **이 사람이 놓고 간 것만** 본다 — 전체를
 * 쓸어 내면 한 사람을 지우는 일이 남과 무관한 행까지 데려간다. 전체 쓸기는 종료 파기의
 * 일이고 `forget_orphan_people()` 이 그 자리에 따로 서 있다.
 *
 * ## 여기서 **안** 하는 것 — 초대
 *
 * `invite` 는 그대로 둔다. **삭제는 접근 회수가 아니다**(runbook 이 이미 그 둘을 갈라
 * 적었다). 같은 사람을 다시 초대하지 않으려면 초대도 따로 지운다 — 두 일을 합쳐 두면
 * 「데이터만 지우고 다시 들어오게 두는」 선택지가 사라진다.
 *
 * ## Match 는 양쪽에서 사라진다
 *
 * `match.user_low`·`user_high` 가 cascade 라, 한쪽이 나가면 Match 가 없어지고 그 Match
 * 의 공유 결과와 알림도 따라간다. **상대 화면에서도 사라진다.** 고를 수 있는 다른 답이
 * 없다 — 공유 결과는 서버가 두 판본을 읽어 자르는 것이라(ADR 0010) 한쪽 판본이 사라지면
 * 그 화면은 설 수 없다. 이 사실은 삭제를 누르기 **전에** 화면이 말해야 한다.
 */
create or replace function public.forget_user(p_user_id uuid)
returns table (people_forgotten integer, revisions_forgotten integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  /** 이 사람이 관리하던 Person 들 — **지우기 전에** 잡아 둔다. 지운 뒤에는 알 길이 없다 */
  touched uuid[];
  gone integer;
  had integer;
begin
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception '그런 계정이 없습니다.' using errcode = 'no_data_found';
  end if;

  select coalesce(array_agg(e.person_id), array[]::uuid[]) into touched
  from public.user_person_access e where e.user_id = p_user_id;

  -- 남이 아무도 안 보게 될 Person 들의 판본 수. 이것도 지우기 전에 센다.
  select count(*) into had
  from public.person_chart_revision r
  where r.person_id = any(touched)
    and not exists (
      select 1 from public.user_person_access e
      where e.person_id = r.person_id and e.user_id <> p_user_id
    );

  delete from auth.users u where u.id = p_user_id;

  /**
   * **이 사람이 놓고 간 것만 지운다.**
   *
   * 처음에는 `forget_orphan_people()` 을 그대로 불렀다. 그 함수는 **DB 전체**의 고아를
   * 쓸어 내므로 한 사람을 지우는 일이 남과 무관한 행까지 데려갔고, 답한 숫자도 「이
   * 사람 때문에 사라진 수」가 아니었다. 그때 그 숫자를 근거로 「무엇이 지워졌나」를
   * 말하게 된다.
   *
   * 전체 쓸기는 종료 파기의 일이고 그 함수는 그 자리에 그대로 있다.
   */
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
