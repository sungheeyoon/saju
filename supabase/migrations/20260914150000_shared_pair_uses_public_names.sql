/**
 * 공유 궁합 풀이도 일반 궁합과 같이 두 사람의 이름을 사용한다.
 *
 * 이름은 판본과 함께 내보내 매김을 한 자리에서 정한다. 앱이 revision id의 차례를 보고
 * 이름을 다시 추측하면 두 사람을 뒤바꿔 부를 수 있다. 이 함수는 service_role에만 열려
 * 있고, 정확한 출생 입력과 마찬가지로 브라우저에는 노출되지 않는다.
 */
drop function if exists public.match_calculation_inputs(uuid);

create function public.match_calculation_inputs(p_match_id uuid)
returns table (
  revision_id uuid,
  nickname text,
  calendar text,
  original_date date,
  solar_date date,
  birth_time time,
  gender text,
  city text,
  late_night_rule text,
  time_basis text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.id,
    case when v.id = m.low_revision_id then low.nickname else high.nickname end,
    v.calendar,
    v.original_date,
    v.solar_date,
    v.birth_time,
    v.gender,
    v.city,
    v.late_night_rule,
    v.time_basis
  from public.match m
  join public.app_user low on low.id = m.user_low
  join public.app_user high on high.id = m.user_high
  join public.person_chart_revision v
    on v.id in (m.low_revision_id, m.high_revision_id)
  where m.id = p_match_id
    and low.status = 'active'
    and high.status = 'active'
    and not exists (
      select 1 from public.block b
      where (b.user_id = m.user_low and b.blocked_user_id = m.user_high)
         or (b.user_id = m.user_high and b.blocked_user_id = m.user_low)
    );
$$;

revoke execute on function public.match_calculation_inputs(uuid)
  from anon, public, authenticated;
grant execute on function public.match_calculation_inputs(uuid) to service_role;
