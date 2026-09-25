-- 초안 — 사람이 고르기 전에는 마이그레이션이 아니다.
-- 1) 카드 점수가 .5 에서 TS 와 갈리지 않게 반올림 전 수를 소수 아홉째 자리에서 맞춘다
-- 2) 전부 내리기도 계정 행을 잠근다 — 올리기와 겹쳐 자리가 4 하나만 남는 길을 닫는다
-- 3) 지우기 · 옮기기가 「그 장」을 판본으로 확인한다 — 낡은 화면의 둘째 누름이 다른 장을 건드리지 않는다

create or replace function public.discovery_preview_score_v2(
  a_chart jsonb, a_summary jsonb, a_need jsonb,
  b_chart jsonb, b_summary jsonb, b_need jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  /*
    numeric 나눗셈은 1/6 · 1/14 를 유한 자리에서 자른다 — 52.5 여야 할 수가 52.4999…9990 이 되어 TS(부동소수 52.5 →
    Math.round 53)와 1점 갈렸다(여덟 글자 × 여섯 글자 쌍의 0.33%). 아홉째 자리에서 맞추면 둘이 같은 수를 낸다.
  */
  select round(
    0.4 * public.discovery_day_pillar_axis_v2(a_chart, b_chart)
    + 0.4 * public.discovery_need_complement_v2(a_need, a_summary, b_need, b_summary)
    + 0.2 * public.discovery_count_balance_v1(a_summary, b_summary), 9);
$$;

revoke execute on function public.discovery_preview_score_v2(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  from anon, authenticated, public;

create or replace function public.clear_my_photo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  -- 정지된 계정도 지울 수 있다(앞과 같다) — 그래서 `lock_my_photos` 대신 잠금만 한 줄로 든다
  perform 1 from public.app_user where id = actor for update;

  delete from public.profile_photo where user_id = actor;
end;
$$;

drop function public.remove_my_photo(integer);

create function public.remove_my_photo(p_position integer, p_version bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
begin
  /*
    `p_version` 은 `my_photos().version` — 화면이 본 그 장이다. 그 자리에 다른 장이 앉아 있으면(다른 탭이 먼저
    지웠다) 조용히 지나간다. 비면 옛 앱이다 — 자리만 본다.
  */
  delete from public.profile_photo p
  where p.user_id = actor and p.position = p_position
    and (p_version is null
         or (extract(epoch from p.updated_at) * 1000000)::bigint = p_version);
  if not found then
    return;
  end if;

  update public.profile_photo
  set position = position - 1
  where user_id = actor and position > p_position;
end;
$$;

revoke execute on function public.remove_my_photo(integer, bigint) from anon, public;
grant execute on function public.remove_my_photo(integer, bigint) to authenticated;

drop function public.move_my_photo(integer, integer);

create function public.move_my_photo(p_from integer, p_to integer, p_version bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
  held integer;
begin
  select count(*)::integer into held from public.profile_photo where user_id = actor;

  if p_from is null or p_to is null
     or p_from < 1 or p_from > held or p_to < 1 or p_to > held then
    raise exception '사진을 옮기지 못했습니다.' using errcode = '22023';
  end if;

  -- 화면이 본 장이 그 자리에 없으면 옮기지 않는다 — 같은 거절(화면이 목록을 다시 받는다)
  if p_version is not null and not exists (
    select 1 from public.profile_photo p
    where p.user_id = actor and p.position = p_from
      and (extract(epoch from p.updated_at) * 1000000)::bigint = p_version) then
    raise exception '사진을 옮기지 못했습니다.' using errcode = '22023';
  end if;

  if p_from = p_to then
    return;
  end if;

  update public.profile_photo
  set position = case
    when position = p_from then p_to
    when p_from < p_to then position - 1
    else position + 1
  end
  where user_id = actor
    and position between least(p_from, p_to) and greatest(p_from, p_to);
end;
$$;

revoke execute on function public.move_my_photo(integer, integer, bigint) from anon, public;
grant execute on function public.move_my_photo(integer, integer, bigint) to authenticated;
