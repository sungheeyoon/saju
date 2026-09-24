-- 풀이 목록의 줄마다 **표지의 두 일간**이 함께 난다 (G-59, ADR 0109)
--
-- 풀이 책장(`/me/readings`)은 표지 색 하나를 얻으려고 내 사주와 저장한 사람의 입력을 한 번 더 읽고
-- 엔진을 돌렸다. 사람이 많으면 느려지고, 인연 궁합의 상대 쪽 반은 늘 회색이었다. 이제 문이 준다.
-- 끝에 두 칸을 더한다:
--
--   - `day_master_a` — 표지 앞자리의 일간(천간 한 글자). `self` · `person` 은 그 사람, `private` 은
--     앞 사람, **`match` 는 나**다(행의 `person_a` 는 `match` 에서 비어 있지만 표지의 앞자리는 늘 나다).
--   - `day_master_b` — 뒷자리. `private` 은 뒤 사람, `match` 는 상대, 한 사람짜리는 `null`.
--
-- **어느 명식인가.**
--
--   - 내가 주인인 셋은 그 사람의 **지금 명식**(`person.current_chart`)이다 — 앞서 화면이 입력을 읽어
--     세우던 것과 같은 값이고, 글 화면(`/me/readings/[subject]`)의 표지와 같은 사람을 같은 색으로 칠한다.
--     「이전 명식」인 글도 표지는 지금 일간이다(앞과 같다).
--   - `match` 는 **동의 당시 베껴 둔 사본**(`match.chart_low` · `chart_high`)이다. 함께 보는 궁합의 결과
--     화면과 채팅이 이미 같은 사본을 연다(`my_match_scope` — 두 사람의 여덟 글자 전체). 이 칸은 그중
--     일간 한 글자씩만 내므로 **새로 열리는 것이 없다.** 좁힘도 같은 `visible_matches()` 다 — 차단된 쌍 ·
--     떠난 · 멈춘 상대의 줄은 이 목록에도 원래 안 선다. 상대의 **지금** 명식은 읽지 않는다 — 동의 뒤에
--     고친 입력은 동의한 대상이 아니다.
--
-- 명식이 없거나 사본이 없는 옛 Match 면 `null` — 화면은 회색 표지다. 색을 지어 넣지 않는다.
--
-- 다른 판정(좁힘 · 이름 · 차례 · 점수 · 「이전 명식」)은 한 글자도 안 바꾼다. 정의는
-- `20260925180000_the_revision_store_is_gone.sql` 의 것을 그대로 옮기고 두 칸만 더했다. 반환형이 바뀌므로
-- 지우고 다시 세운다 — 권한은 앞과 같게(`anon` · PUBLIC 닫고 `authenticated` 만).
--
-- **배포 순서는 어느 쪽이든 된다.** 칸을 끝에 더하기만 하므로 옛 앱은 모르는 칸을 흘려보내고, 새 앱은
-- 옛 DB 에서 칸이 없으면 `null`(회색)로 읽는다(`app/me/reading/current.ts`). 그래도 runbook 대로 DB 가 먼저다.
--
-- 재는 자리는 `supabase/tests/22_readings_list.test.sql`(반환형) · `58_readings_cover.test.sql`(누구의 일간인가).

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
      pa.current_chart ->> 'dayMaster' as day_master_a,
      pb.current_chart ->> 'dayMaster' as day_master_b
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
