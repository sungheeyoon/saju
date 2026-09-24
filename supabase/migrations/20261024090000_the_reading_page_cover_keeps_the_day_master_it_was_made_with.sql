-- 풀이 글 화면의 표지도 **그 풀이를 만들 때의** 일간을 입는다 (ADR 0109 추기)
--
-- 앞(`20261023090000`)에서 책장 표지를 풀이의 사본으로 칠했다. 글 화면(`/me/readings/[subject]`)의 표지는
-- 아직 그 사람의 지금 명식으로 칠해, 「수정 전」 글에서 책장과 글 화면의 색이 갈렸다. 운영자 결정(2026-09-25):
-- 표지 색은 풀이를 만들 당시 정보의 색이다.
--
-- `my_reading` 이 끝에 두 칸을 더한다 — `reading.chart_a` · `chart_b` 사본의 일간 한 글자씩. `match` 는 `null` 이다
-- (결과 화면이 동의 당시 사본 전체를 이미 들고 칠한다 — 여기서 또 내면 칠하는 자리가 둘이 된다). 새로 열리는 값은
-- 없다 — 내가 주인인 글의 사본은 내가 만든 글의 재료다. 다른 칸 · 좁힘 · 권한은 그대로 옮겼다. 반환형이 바뀌므로
-- 지우고 다시 세운다.
--
-- **배포 순서는 어느 쪽이든 된다.** 칸을 끝에 더하기만 한다. 새 앱은 칸이 없으면 부르는 화면의 색으로 선다.
-- 재는 자리는 `supabase/tests/58_readings_cover.test.sql`.

drop function if exists public.my_reading(text, uuid, uuid, uuid);

create function public.my_reading(
  p_kind text, p_person_a uuid default null, p_person_b uuid default null,
  p_match_id uuid default null)
returns table(
  id uuid, kind text, score smallint, metaphor text, output text, model text,
  viewed_at timestamptz, created_at timestamptz, viewer_is_first boolean,
  from_current_chart boolean, source_run_id uuid, my_feedback jsonb,
  day_master_a text, day_master_b text)
language sql
stable security definer
set search_path = ''
as $$
  select
    r.id, r.kind, r.score, r.metaphor,
    case when s.kind = 'match' then public.reading_user_body(r.output) else r.output end,
    r.model, r.viewed_at, r.created_at,
    s.viewer_is_first,
    case
      /**
       * 공유 결과는 동의 당시 여덟 글자로 나고 그 값이 곧 동의한 대상이라, 「그 뒤에
       * 고친 입력으로 다시 봐야 한다」는 말이 성립하지 않는다(ADR 0010·0012).
       */
      when s.kind = 'match' then true
      else coalesce(
        r.chart_a = pa.current_chart and r.chart_b is not distinct from pb.current_chart,
        false)
    end,
    r.source_run_id,
    (
      select jsonb_build_object(
        'usefulness', f.usefulness,
        'perceivedFit', f.perceived_fit,
        'feltLength', f.felt_length,
        'issueTags', to_jsonb(f.issue_tags),
        'comment', f.comment)
      from public.reading_feedback f
      where f.reading_run_id = r.source_run_id
        and f.respondent_user_id = (select auth.uid())
    ),
    /* 표지의 일간 — 그 글을 만들 때의 사본. 공유 궁합은 결과 화면이 동의 당시 사본으로 따로 칠한다 */
    case when s.kind = 'match' then null else r.chart_a ->> 'dayMaster' end,
    case when s.kind = 'match' then null else r.chart_b ->> 'dayMaster' end
  from public.reading_scope(p_kind, p_person_a, p_person_b, p_match_id) s
  join public.reading r
    on r.kind = s.kind
   and r.owner_user_id is not distinct from s.owner_user_id
   and r.person_a = s.person_a
   and r.person_b is not distinct from s.person_b
   and r.match_id is not distinct from s.match_id
  left join public.person pa on pa.id = r.person_a
  left join public.person pb on pb.id = r.person_b;
$$;

revoke execute on function public.my_reading(text, uuid, uuid, uuid) from anon, public;
grant execute on function public.my_reading(text, uuid, uuid, uuid) to authenticated;
