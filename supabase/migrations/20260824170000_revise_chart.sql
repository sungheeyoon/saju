-- 판본 수정 — 덮어쓰지 않고 쌓는다
--
-- 등록 화면이 이미 「고칠 수 있고 고친 기록은 덮어쓰지 않고 쌓입니다」라고 약속해
-- 놓았다. DB 는 처음부터 쌓게 돼 있었고 부르는 자리가 없었을 뿐이다.

-- ---------------------------------------------------------------------------
-- 지문을 함수로 꺼낸다 — 쌓기 전에 물어봐야 하므로
-- ---------------------------------------------------------------------------

/**
 * 판본 한 벌의 지문.
 *
 * 트리거 안에만 있었다. 이제 **쌓기 전에** 물어야 한다 — 아무것도 안 바꾸고 저장을
 * 누른 사람에게 똑같은 판본을 하나 더 쌓아 주면, 판본 이력이 「무엇이 달라졌는가」가
 * 아니라 「몇 번 눌렀는가」를 기록하게 된다.
 *
 * 트리거도 이 함수를 부른다. 두 자리에서 따로 계산하면 「쌓기 전에 잰 지문」과
 * 「쌓고 나서 붙은 지문」이 달라질 수 있고, 그러면 비교가 언제나 거짓이 된다.
 */
create or replace function public.revision_fingerprint(
  calendar text,
  original_date date,
  solar_date date,
  birth_time time,
  gender text,
  city text,
  late_night_rule text,
  time_basis text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    sha256(convert_to(concat_ws(
      '|',
      calendar,
      to_char(original_date, 'YYYY-MM-DD'),
      to_char(solar_date, 'YYYY-MM-DD'),
      coalesce(to_char(birth_time, 'HH24:MI'), 'unknown'),
      gender,
      city,
      late_night_rule,
      time_basis
    ), 'UTF8')),
    'hex'
  );
$$;

create or replace function public.set_revision_fingerprint()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.fingerprint := public.revision_fingerprint(
    new.calendar, new.original_date, new.solar_date, new.birth_time,
    new.gender, new.city, new.late_night_rule, new.time_basis
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 「이 사람이 저 Person 의 출생정보를 쌓아도 되는가」 — 한 자리
-- ---------------------------------------------------------------------------

/**
 * 규칙은 하나인데 묻는 자리가 둘이다.
 *
 * RLS 정책이 묻고, RPC 도 묻는다. **`security definer` 함수는 RLS 를 지나가기
 * 때문이다** — 표 소유자로 돌므로 정책이 안 걸린다. 그래서 정책에만 적어 두면
 * RPC 로 들어오는 길은 아무 검사 없이 열린다.
 *
 * 규칙을 두 곳에 적는 대신 함수 하나를 두고 둘 다 부른다. 두 곳에 적으면 언젠가
 * 한쪽만 고쳐지고, 그때 열려 있는 쪽은 언제나 더 바깥이다.
 *
 * 규칙: claim 된 Person 은 claim 한 사람만. 아직 아무도 claim 하지 않았으면
 * `editor` 이상이면 된다(ADR 0004).
 */
create or replace function public.may_add_revision(target_person uuid, actor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.claimed_by(target_person), actor) = actor
     and exists (
       select 1 from public.user_person_access a
       where a.person_id = target_person
         and a.user_id = actor
         and a.role in ('owner', 'editor')
     );
$$;

grant execute on function public.may_add_revision(uuid, uuid) to authenticated;

drop policy "claim 한 사람만, 아니면 편집 권한이 있는 사람만 판본을 쌓는다"
  on public.person_chart_revision;

create policy "claim 한 사람만, 아니면 편집 권한이 있는 사람만 판본을 쌓는다"
on public.person_chart_revision for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.may_add_revision(person_id, (select auth.uid()))
);

-- ---------------------------------------------------------------------------
-- 판본을 쌓고 현재를 옮긴다 — 한 트랜잭션
-- ---------------------------------------------------------------------------

/**
 * 고친 출생정보를 새 판본으로 쌓는다.
 *
 * 쌓는 것과 현재를 옮기는 것이 나뉘면 「새 판본은 있는데 아무도 안 가리키는」 상태가
 * 실재한다. 그 상태의 화면은 고치기 전 사주를 보여주면서 저장은 됐다고 말한다.
 *
 * **아무것도 안 바뀌었으면 쌓지 않고 지금 것을 돌려준다.** 판본 이력은 무엇이
 * 달라졌는가의 기록이지 저장 버튼을 몇 번 눌렀는가의 기록이 아니다.
 *
 * 부를 이름은 여기 없다. 이름은 판본이 아니라 엣지가 들고, **여덟 글자를 바꾸지
 * 않으므로 고쳐도 새 판본이 되지 않는다.**
 */
create or replace function public.add_person_revision(
  p_person_id uuid,
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
  current_fingerprint text;
  next_fingerprint text;
  new_revision uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if (select status from public.app_user where id = actor) <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  -- 정책이 묻는 것과 **같은 함수**에 묻는다.
  if not public.may_add_revision(p_person_id, actor) then
    raise exception '이 사람의 출생정보를 고칠 수 없습니다.' using errcode = '42501';
  end if;

  if p_calendar <> 'solar' then
    raise exception '음력 입력은 아직 지원하지 않습니다.' using errcode = '0A000';
  end if;

  next_fingerprint := public.revision_fingerprint(
    p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis);

  select r.fingerprint into current_fingerprint
  from public.person p join public.person_chart_revision r on r.id = p.current_revision_id
  where p.id = p_person_id;

  if current_fingerprint = next_fingerprint then
    return (select current_revision_id from public.person where id = p_person_id);
  end if;

  insert into public.person_chart_revision (
    person_id, calendar, original_date, solar_date, birth_time,
    gender, city, late_night_rule, time_basis, created_by
  )
  values (
    p_person_id, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, actor
  )
  returning id into new_revision;

  update public.person set current_revision_id = new_revision where id = p_person_id;

  /**
   * ADR 0004 는 「Evidence 를 바꾸는 수정이 pending 요청을 무효화한다」고 정했다.
   * 아직 MatchRequest 가 없어서 무효화할 것이 없다. 그 표가 생기는 마이그레이션이
   * 이 자리에 그 한 줄을 더한다 — 같은 트랜잭션 안이어야 그 사이에 낀 수락이 없다.
   */

  return new_revision;
end;
$$;

revoke execute on function public.add_person_revision(
  uuid, text, date, date, time, text, text, text, text) from anon, public;
grant execute on function public.add_person_revision(
  uuid, text, date, date, time, text, text, text, text) to authenticated;
