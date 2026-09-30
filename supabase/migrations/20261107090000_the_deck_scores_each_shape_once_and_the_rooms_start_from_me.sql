-- 덱 채우기는 모양마다 한 번 채점하고, 대화방 목록은 나에게서 출발한다 — 규모 (밤샘 감사 DB 1 · 2 · 7, 2026-09-28)
--
-- 감사 문장은 추정이었다. **로컬 스택에 참여자 1만 명을 심고 쟀다**(2026-09-30): 참여자 1만(요약 · 필요한 기운 ·
-- 일간을 사람마다 다르게), 요청 이력 10만(사람마다 열, 대부분 끝난 것), 대화방 5,005 · 메시지 100,100.
--
-- | 자리 | 전 | 후 |
-- | --- | --- | --- |
-- | `my_discovery_board()` 첫 덱(여섯 세우기) | 7.1 초 | 1.4 초 |
-- | 한 명 넘긴 뒤 다시 읽기(한 자리 채우기) | 6.6 초 | 1.5 초 |
-- | `my_chat_rooms()` — 헤더가 화면마다 부른다 | 0.35 초(방 5천) | 5 ms |
-- | `discovery_unavailable` 1만 번 | 93 ms | 38 ms |
--
-- ## 1. 덱 채우기 — 점수를 모양마다 한 번 (ADR 0115 의 뽑는 규칙은 그대로)
--
-- `fill_discovery_deck` 은 한 자리를 채울 때도 **자격 있는 풀 전체**를 채점한다 — 상위 20% 컷을 세려면 모두의 점수가
-- 있어야 하니 그 자체는 맞다. 느린 것은 채점의 모양이었다. 1만 명을 따로 재면:
--
--   `discovery_preview_score_v2` 1만 번 4.7 초 · 그 안의 일주 축(`discovery_day_pillar_axis_v2`) 만 1.6 초 ·
--   필요한 기운 둘 0.1 초 · 오행 균형 0.1 초 · 자격(`discovery_eligible`) 0.8 초 ·
--   카드에 적을 보완 · 균형 · 채워 주는 오행을 **모두에게** 셈 1.0 초
--
-- 모든 함수에 `search_path` 가 걸려 있어(lint 0011, pgTAP 44) SQL 함수가 인라인되지 않는다 — 한 번 부를 때마다
-- 실행기 하나가 선다. 그래서 **부르는 수를 줄인다.** 점수의 네 항은 저마다 상대의 한 조각에만 기댄다:
--
--   일주 축 ← 상대의 일주(60갑자, 많아야 120) · 상대가 채워 주는 필요한 기운 · 오행 균형 ← 상대의 오행 요약(여덟 글자의
--   개수 조합, 수백) · 내가 채워 주는 필요한 기운 ← 상대의 필요한 기운(다섯 × 다섯)
--
-- 그러니 각 항을 **그 조각의 서로 다른 값마다 한 번** 셈하고, 사람마다는 네 수를 더하기만 한다. 더하는 식은
-- `discovery_preview_score_v2_of` 한 곳에 두고 `discovery_preview_score_v2` 도 그것을 부른다 — 식이 두 벌이 되지 않는다.
-- 같은 비트다: 같은 함수를 같은 인자로 부르고, 합과 옮김(`extra_float_digits = 3` 의 `::text::numeric`)도 같은 식이다.
-- 1만 명의 점수 합이 전후 `448381.4375` 로 같았다(로컬). 카드에 적는 보완 · 균형 · 채워 주는 오행은 **자리에 앉는 사람**
-- (많아야 여섯)에게만 셈한다.
--
-- 자격은 그대로 사람마다 묻는다 — 누가 풀에 서는가는 `discovery_pair_eligible` 한 곳이 답하고, 그것을 집합으로 다시
-- 적으면 경계가 두 벌이 된다(결정 점검표의 첫 줄). 그 대신 자격이 부르는 `discovery_unavailable` 을 아래 3 으로 줄였다.
-- **남은 1.4 초는 거의 다 이 자격이다**(1만 번에 0.8~1.4 초, 기계의 짐에 따라) — 줄이려면 자격을 집합으로 적고 두 벌이
-- 같다는 것을 pgTAP 이 드는 길뿐이라 이 걸음에 넣지 않았다.
--
-- 뽑는 규칙(컷 · 자리마다 동전 · 가중 무작위 · 모자라면 채우기)과 씨앗 · 노출 기록은 한 글자도 안 바뀐다.
--
-- ## 2. 대화방 목록 — 내 방에서 출발한다
--
-- `my_chat_rooms()` 는 **모든 방**을 훑으며 방마다 `chat_room_readable(id)` 를 불렀다(`Seq Scan on chat_room`,
-- `Rows Removed by Filter: 4999`). 헤더의 방 수가 화면마다 부르므로 방이 늘수록 모든 화면이 느려진다. 그 함수가 묻는
-- 첫 조건이 「내가 두 사람 중 하나인가」이므로, 그 조건을 **먼저** 질의에 적어 `chat_room_by_user_low` ·
-- `chat_room_by_user_high` 로 내 방만 집는다. 읽을 수 있는가(정지 · 닫힌 까닭)는 그대로 그 함수가 묻는다 — 경계는 한 곳이다.
--
-- ## 3. 짝을 가리는 조건은 짝 색인으로
--
-- `discovery_unavailable` 은 「살아 있는 요청이 오갔나」를 (요청자 = 나 · 받는이 = 그) 또는 (반대)로 물어 색인 넷을
-- 비트맵으로 겹쳤다. 표에는 바로 그 질문의 색인이 있다 — `one_live_request_between_two (pair_low, pair_high) where status in
-- ('pending', 'accepted', 'rejected')`. 같은 세 상태다. `pair_low` · `pair_high` 는 `requester < addressee` 로 가른
-- 생성 열이라 `least` · `greatest`(같은 uuid 비교)로 짚으면 같은 줄을 가리킨다. 색인만 읽는 한 번으로 준다.
--
-- 재는 자리: **같은 답**은 `09_discovery_board` · `60_card_score_v2` · `63_card_score_rounding…` · `34_chat` 이 행동으로,
-- 조각마다 센 점수 · 네 항을 더하는 한 식 · 짝 조건의 여섯 상태 × 두 방향은 `73_scale_shapes` 가 잰다. **계획(색인을
-- 타는가)은 시험이 안 잰다** — 계획은 표의 크기와 통계를 따라 바뀌어 작은 시험 데이터로는 흔들린다. 위의 전후 수와
-- 계획은 1만 명을 심은 로컬에서 `EXPLAIN ANALYZE` 로 잰 값이다(PR 본문).
--
-- **닿지 않는 차이 하나**(독립 검토, 2026-09-30): 새 판은 일주 · 오행 요약 · 필요한 기운 중 하나가 `null` 인 사람을
-- 조각과 잇는 `join` 에서 뺀다. 옛 판은 그 사람을 점수 `null` 로 풀에 남겼다(가중 무작위에서 거의 안 뽑힌다). 지금은
-- 드러날 길이 없다 — `discovery_pair_eligible` 이 두 요약과 여덟 글자가 모두 있는 사람만 들이고(`need_summary is not
-- null` · `current_chart is not null`), `reject_bad_chart` 가 일주 없는 여덟 글자를 받지 않는다.

-- ---------------------------------------------------------------------------
-- 1. 점수를 더하는 식 — 한 곳
-- ---------------------------------------------------------------------------

/**
 * 네 항을 연인용 가중치로 더한다 — ADR 0113. **TS `previewScoreOf` 와 같은 비트다**(`20261027090000` 머리말).
 *
 * 가중 합은 TS 의 차례(일주 → 필요한 기운 → 오행 균형, 왼쪽부터)로 더하고, 부동소수를 가장 짧게 되돌아오는 자리수로
 * numeric 에 옮긴다. 항 하나라도 비면 `null` 이다.
 *
 * @param day_axis 일주 축(`discovery_day_pillar_axis_v2`)
 * @param need_to_a 상대가 나의 필요한 기운을 채워 주는 정도(`discovery_need_direction_v2_float(a_need, b_summary)`)
 * @param need_to_b 내가 상대의 필요한 기운을 채워 주는 정도(`discovery_need_direction_v2_float(b_need, a_summary)`)
 * @param balance 두 사람을 합친 오행 균형(`discovery_count_balance_v2_float(a_summary, b_summary)`)
 */
create function public.discovery_preview_score_v2_of(
  day_axis numeric, need_to_a double precision, need_to_b double precision, balance double precision)
returns numeric
language sql
immutable
set search_path = ''
set extra_float_digits = 3
as $$
  select (
    0.4::double precision * day_axis::double precision
    + 0.4::double precision * ((need_to_a + need_to_b) / 2::double precision)
    + 0.2::double precision * balance
  )::text::numeric;
$$;

revoke execute on function public.discovery_preview_score_v2_of(numeric, double precision, double precision, double precision)
  from anon, authenticated, public;

/**
 * 후보 카드의 예측 궁합 점수, 반올림 전 — 네 항을 셈해 위의 식에 넘긴다. 서명 · 깃발 · 권한 그대로다.
 */
create or replace function public.discovery_preview_score_v2(
  a_chart jsonb, a_summary jsonb, a_need jsonb,
  b_chart jsonb, b_summary jsonb, b_need jsonb)
returns numeric
language sql
immutable
set search_path = ''
set extra_float_digits = 3
as $$
  select public.discovery_preview_score_v2_of(
    public.discovery_day_pillar_axis_v2(a_chart, b_chart),
    public.discovery_need_direction_v2_float(a_need, b_summary),
    public.discovery_need_direction_v2_float(b_need, a_summary),
    public.discovery_count_balance_v2_float(a_summary, b_summary));
$$;

-- ---------------------------------------------------------------------------
-- 2. 채우는 문 — 모양마다 한 번 채점한다 (서명 · 뽑는 규칙 그대로)
-- ---------------------------------------------------------------------------

create or replace function public.fill_discovery_deck(p_actor uuid, p_deck uuid, p_seed text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  my_summary jsonb;
  my_need jsonb;
  my_chart jsonb;
  live integer;
  next_at integer;
  wanted integer;
  written integer;
begin
  select p.element_summary, p.need_summary into my_summary, my_need
  from public.discovery_profile p where p.user_id = p_actor;

  select pe.current_chart into my_chart
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = p_actor;

  /*
    **떠난 자리를 걷는다.** 넘긴 사람 · 요청이 오간 사람 · 참여를 끈 사람 · 차단 · 요약이 바뀐 사람. 걷지 않고 두면
    그 사람이 자격을 되찾는 날 옛 자리로 되살아나 덱이 여섯을 넘는다. 요약이 바뀐 사람은 풀에 남아 있으면 지금
    요약으로 다시 뽑힐 수 있다.
  */
  delete from public.discovery_candidate_slot s
  where s.snapshot_id = p_deck
    and not exists (
      select 1 from public.discovery_profile theirs
      where theirs.user_id = s.candidate_user_id
        and theirs.element_summary = s.candidate_summary
        and public.discovery_eligible(p_actor, s.candidate_user_id)
    );

  select count(*)::int, coalesce(max(s.position) + 1, 0)
    into live, next_at
  from public.discovery_candidate_slot s where s.snapshot_id = p_deck;

  wanted := greatest(0, public.discovery_deck_size() - live);
  if wanted = 0 then
    return 0;
  end if;

  with eligible as materialized (
    select
      other.user_id,
      other.element_summary as summary,
      other.need_summary as need,
      tp.current_chart as chart
    from public.discovery_profile other
    join public.app_user tu on tu.id = other.user_id
    join public.person tp on tp.id = tu.self_person_id
    where public.discovery_eligible(p_actor, other.user_id)
      -- 지금 덱에 선 사람은 다시 뽑지 않는다
      and not exists (
        select 1 from public.discovery_candidate_slot s
        where s.snapshot_id = p_deck and s.candidate_user_id = other.user_id
      )
  ),
  /*
    **점수의 항은 상대의 한 조각에만 기댄다** — 조각의 서로 다른 값마다 한 번 셈한다(머리말 1). `materialized` 가
    그 「한 번」을 지킨다 — 풀어 놓으면 플래너가 함수를 사람마다 다시 부를 수 있다.
  */
  by_day as materialized (
    select d.day, public.discovery_day_pillar_axis_v2(my_chart, d.chart) as axis
    from (
      select distinct on (e.chart -> 'day') e.chart -> 'day' as day, e.chart
      from eligible e
      order by e.chart -> 'day'
    ) d
  ),
  by_summary as materialized (
    select d.summary,
      public.discovery_need_direction_v2_float(my_need, d.summary) as need_to_me,
      public.discovery_count_balance_v2_float(my_summary, d.summary) as balance
    from (select distinct e.summary from eligible e) d
  ),
  by_need as materialized (
    select d.need, public.discovery_need_direction_v2_float(d.need, my_summary) as need_to_them
    from (select distinct e.need from eligible e) d
  ),
  scored as (
    select e.user_id, e.summary, e.need,
      public.discovery_preview_score_v2_of(by_day.axis, by_summary.need_to_me, by_need.need_to_them, by_summary.balance)
        as score,
      public.discovery_seeded_unit(p_seed, e.user_id) as u
    from eligible e
    join by_day on by_day.day = e.chart -> 'day'
    join by_summary on by_summary.summary = e.summary
    join by_need on by_need.need = e.need
  ),
  sizes as (
    select count(*)::int as n from scored
  ),
  keep as (
    select case when sizes.n < 20 then sizes.n else ceil(sizes.n * 0.2)::int end as k
    from sizes
  ),
  ranked as (
    select s.*, row_number() over (order by s.score desc, s.user_id) as rnk from scored s
  ),
  /*
    **자리마다 동전 하나** — 20% 면 그 자리는 잘라 낸 아래에서 온다. 옛 「열에 둘」이 한 자리씩 뽑는 모양으로
    옮겨 온 것이다. 동전도 씨앗에서 나온다 — 같은 씨앗이면 같은 덱이다.
  */
  coins as (
    select count(*) filter (
      where (('x' || substr(md5(p_seed || ':seat:' || j), 1, 8))::bit(32)::bigint::double precision + 0.5)
            / 4294967296.0 < 0.2
    )::int as wander
    from generate_series(1, wanted) as j
  ),
  tops as (
    select r.*, false as exploration
    from ranked r, keep
    where r.rnk <= keep.k
    order by power(r.u, 1.0 / greatest(r.score, 0.0001)) desc, r.user_id
    limit (wanted - (select wander from coins))
  ),
  explorers as (
    select r.*, true as exploration
    from ranked r, keep
    where r.rnk > keep.k
    order by r.u, r.user_id
    limit (select wander from coins)
  ),
  picked as (
    select user_id, summary, need, score, u, exploration from tops
    union all
    select user_id, summary, need, score, u, exploration from explorers
  ),
  -- 한 층이 모자라면 다른 층에서 가중 무작위로 채운다 — 모자랄 때만 도는 뒷자리다
  filler as (
    select s.user_id, s.summary, s.need, s.score, s.u,
      false as exploration
    from scored s
    where not exists (select 1 from picked p where p.user_id = s.user_id)
    order by power(s.u, 1.0 / greatest(s.score, 0.0001)) desc, s.user_id
    limit (select greatest(0, wanted - (select count(*)::int from picked)))
  ),
  chosen as (
    select * from picked
    union all
    select * from filler
  ),
  counts as (
    select count(*)::int as total,
      count(*) filter (where exploration)::int as explorers
    from chosen
  ),
  sorted as (
    select c.*, row_number() over (
      order by power(c.u, 1.0 / greatest(c.score, 0.0001)) desc, c.user_id
    ) as ti
    from chosen c where not c.exploration
  ),
  wandering as (
    select c.*, row_number() over (order by c.u, c.user_id) as ei
    from chosen c where c.exploration
  ),
  -- 탐색 자리는 새로 채우는 자리들 사이에 고르게 선다 — 앞뒤에 몰리지 않게
  slots as (
    select i as ei,
      floor((i * counts.total)::numeric / (counts.explorers + 1))::int as at
    from counts, generate_series(1, counts.explorers) as i
  ),
  seats as (
    select s.idx, slots.ei, (slots.ei is not null) as is_exploration,
      sum(case when slots.ei is null then 1 else 0 end)
        over (order by s.idx rows between unbounded preceding and current row) as top_index
    from counts, generate_series(0, counts.total - 1) as s(idx)
    left join slots on slots.at = s.idx
  ),
  -- 카드에 적는 셋(채워 주는 오행 · 균형 · 보완)은 **자리에 앉는 사람에게만** 셈한다 — 많아야 여섯
  placed as materialized (
    select next_at + seats.idx as position, seats.is_exploration,
      coalesce(w.user_id, t.user_id) as user_id,
      coalesce(w.summary, t.summary) as summary,
      public.discovery_supplied_elements_v1(my_summary, coalesce(w.summary, t.summary)) as supplied,
      public.discovery_need_complement_v2(my_need, my_summary, coalesce(w.need, t.need), coalesce(w.summary, t.summary))
        as complement,
      public.discovery_count_balance_v1(my_summary, coalesce(w.summary, t.summary)) as balance
    from seats
    left join wandering w on seats.is_exploration and w.ei = seats.ei
    left join sorted t on not seats.is_exploration and t.ti = seats.top_index
  ),
  kept as (
    insert into public.discovery_candidate_slot (
      snapshot_id, position, candidate_user_id, candidate_summary,
      exploration, supplied_elements, balance_band
    )
    select p_deck, placed.position, placed.user_id, placed.summary, placed.is_exploration,
      placed.supplied, public.discovery_balance_band(placed.balance)
    from placed
    returning 1
  ),
  -- 노출 기록은 **덱에 실린 때** 난다 — 새로 붙은 사람만 적힌다(ADR 0037 의 뜻 그대로)
  logged as (
    insert into public.discovery_impression (
      viewer_user_id, candidate_user_id, policy_version, position, exploration,
      viewer_summary, candidate_summary, supplied_elements, complement, combined_balance
    )
    select p_actor, placed.user_id, 'v2-beta', placed.position, placed.is_exploration,
      my_summary, placed.summary, placed.supplied, placed.complement, placed.balance
    from placed
    returning 1
  )
  select count(*) into written from kept;

  return written;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. 대화방 목록 — 내 방에서 출발한다 (반환형 그대로)
-- ---------------------------------------------------------------------------

create or replace function public.my_chat_rooms()
returns table (
  match_id uuid,
  partner_user_id uuid,
  partner_nickname text,
  partner_has_photo boolean,
  opened_at timestamptz,
  closed_reason text,
  closed_at timestamptz,
  last_message_at timestamptz,
  last_message_body text,
  unread_count integer,
  partner_activity text,
  partner_left boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.match_id,
    partner.id,
    partner.nickname,
    exists (select 1 from public.profile_photo f where f.user_id = partner.id),
    r.opened_at,
    r.closed_reason,
    r.closed_at,
    last.created_at,
    last.body,
    coalesce(unread.n, 0),
    case when r.closed_reason is null then public.activity_band_of(partner.id) end,
    partner.id is null
  from public.chat_room r
  left join public.app_user partner
    on partner.id = case
      when r.user_low = (select auth.uid()) then r.user_high else r.user_low end
  left join lateral (
    select m.created_at, m.body from public.chat_message m
    where m.room_id = r.id order by m.seq desc limit 1
  ) last on true
  left join lateral (
    select count(*)::integer as n
    from public.chat_message m
    join public.chat_read k on k.room_id = m.room_id and k.user_id = (select auth.uid())
    where m.room_id = r.id
      and m.sender_user_id is distinct from (select auth.uid())
      and m.seq > k.last_read_seq
  ) unread on true
  -- 내 방에서 출발한다 — 두 색인으로 내 방만 집고, 읽을 수 있는가는 그 함수가 묻는다(머리말 2)
  where (r.user_low = (select auth.uid()) or r.user_high = (select auth.uid()))
    and public.chat_room_readable(r.id)
  order by coalesce(last.created_at, r.opened_at) desc;
$$;

-- ---------------------------------------------------------------------------
-- 4. 짝을 가리는 조건 — 짝 색인으로 (서명 그대로)
-- ---------------------------------------------------------------------------

create or replace function public.discovery_unavailable(actor uuid, other uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.block b
      where (b.user_id = actor and b.blocked_user_id = other)
         or (b.user_id = other and b.blocked_user_id = actor)
    )
    or exists (
      -- `one_live_request_between_two` 와 같은 세 상태 · 같은 짝이다(머리말 3)
      select 1 from public.match_request r
      where r.pair_low = least(actor, other)
        and r.pair_high = greatest(actor, other)
        and r.status in ('pending', 'accepted', 'rejected')
    );
$$;
