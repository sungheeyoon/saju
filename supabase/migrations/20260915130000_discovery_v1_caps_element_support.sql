-- discovery-v1: 상대가 한 오행을 과다 보유해도 보완 가점이 계속 커지지 않게 한다.
-- 상대 비율 20%에서 그 오행의 지원은 포화한다.

create or replace function public.discovery_deficit_complement_one_way_v1(mine jsonb, partner jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select sum(
    greatest(0, 0.2 - (mine -> 'counts' ->> e)::numeric / (mine ->> 'glyphCount')::numeric)
    * least(1, (
      (partner -> 'counts' ->> e)::numeric / (partner ->> 'glyphCount')::numeric
    ) / 0.2)
  )
  from unnest(array['木', '火', '土', '金', '水']) as e;
$$;

create or replace function public.discovery_deficit_complement_v1(a jsonb, b jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select greatest(0, least(100, (
    public.discovery_deficit_complement_one_way_v1(a, b)
    + public.discovery_deficit_complement_one_way_v1(b, a)
  ) * 100));
$$;

revoke all on function public.discovery_deficit_complement_one_way_v1(jsonb, jsonb)
  from anon, authenticated, public;
revoke all on function public.discovery_deficit_complement_v1(jsonb, jsonb)
  from anon, authenticated, public;
