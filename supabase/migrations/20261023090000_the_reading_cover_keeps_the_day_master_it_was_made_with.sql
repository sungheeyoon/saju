-- 풀이 책장의 표지는 **그 풀이를 만들 때의** 일간을 입는다 (G-59, ADR 0109 추기)
--
-- 앞(`20261022090000`)은 내가 주인인 셋의 표지를 그 사람의 **지금 명식**으로 칠했다. 출생 정보를 고친 뒤에는
-- 「수정 전」 딱지가 선 글이 고친 뒤의 색을 입어, 딱지와 표지가 서로 다른 때를 말했다. 운영자 결정(2026-09-25):
-- 표지 색은 **풀이를 만들 당시 정보의 색**이다.
--
-- 값은 이미 행에 있다 — `reading.chart_a` · `chart_b` 는 그때 보여 준 여덟 글자의 사본이고(ADR 0071, `not null`
-- 은 `chart_a` 만. `chart_b` 는 두 사람 궁합에만 있다), 「수정 전」 판정도 이 사본으로 한다. 두 칸이 사람의 지금
-- 명식 대신 그 사본에서 일간 한 글자를 낸다. 고치지 않은 사람의 글은 사본과 지금 명식이 같으므로 색이 안 바뀐다.
--
-- `match` 갈래는 앞과 같다 — 동의 당시 사본이다. 다른 판정 · 반환형 · 권한은 한 글자도 안 바꾼다. 반환형이 같아
-- `create or replace` 로도 되지만 앞 파일과 같은 모양으로 지우고 다시 세운다.
--
-- 재는 자리는 `supabase/tests/58_readings_cover.test.sql` 「고쳐도 표지는 그때의 일간」.

drop function if exists public.my_readings();

create function public.my_readings()
returns table(
  kind text, person_a uuid, person_b uuid, match_id uuid, label_a text, label_b text,
  score smallint, metaphor text, created_at timestamptz, from_current_chart boolean,
  day_master_a text, day_master_b text)
language sql
stable security definer
set search_path = ''
as $$
  select
    l.kind, l.person_a, l.person_b, l.match_id,
    l.label_a, l.label_b, l.score, l.metaphor, l.created_at, l.from_current_chart,
    l.day_master_a, l.day_master_b
  from (
    /**
     * 내가 주인인 셋 — `self` · `person` · `private`.
     *
     * **이름이 붙는 근거가 곧 좁힘이다.** 엣지가 없으면 그 줄이 안 선다. 결과가 남아
     * 있어도 내가 그 사람을 목록에서 빼면 이 목록에서 사라진다.
     */
    select
      r.kind,
      r.person_a,
      r.person_b,
      null::uuid as match_id,
      case when r.kind = 'self' then null else (
        select e.local_label from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_a
      ) end as label_a,
      (
        select e.local_label from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_b
      ) as label_b,
      r.score,
      r.metaphor,
      r.created_at,
      coalesce(
        r.chart_a = pa.current_chart and r.chart_b is not distinct from pb.current_chart,
        false) as from_current_chart,
      r.chart_a ->> 'dayMaster' as day_master_a,
      r.chart_b ->> 'dayMaster' as day_master_b
    from public.reading r
    join public.person pa on pa.id = r.person_a
    left join public.person pb on pb.id = r.person_b
    where public.is_active_account()
      and r.owner_user_id = (select auth.uid())
      and exists (
        select 1 from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_a
      )
      and (
        r.person_b is null
        or exists (
          select 1 from public.user_person_access e
          where e.user_id = (select auth.uid()) and e.person_id = r.person_b
        )
      )

    union all

    /**
     * 함께 본 궁합 — **좁힘은 `visible_matches()` 가 이미 든다.**
     *
     * **「이전 입력」이 없다.** 공유 결과는 동의 당시 여덟 글자로 나고 그 값이 곧 동의한
     * 대상이라, 「그 뒤에 고친 입력으로 다시 봐야 한다」는 말이 성립하지 않는다.
     *
     * 두 일간도 그 동의 당시 사본에서 난다 — 앞자리가 나, 뒷자리가 상대다.
     */
    select
      r.kind,
      null::uuid,
      null::uuid,
      r.match_id,
      partner.nickname,
      null::text,
      r.score,
      r.metaphor,
      r.created_at,
      true,
      case when m.user_low = (select auth.uid()) then m.chart_low else m.chart_high end ->> 'dayMaster',
      case when m.user_low = (select auth.uid()) then m.chart_high else m.chart_low end ->> 'dayMaster'
    from public.reading r
    join public.visible_matches() m on m.id = r.match_id
    join public.app_user partner
      on partner.id = case
        when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
    where r.kind = 'match'
  ) l (
    kind, person_a, person_b, match_id,
    label_a, label_b, score, metaphor, created_at, from_current_chart,
    day_master_a, day_master_b
  )
  order by l.created_at desc;
$$;

revoke execute on function public.my_readings() from anon, public;
grant execute on function public.my_readings() to authenticated;
