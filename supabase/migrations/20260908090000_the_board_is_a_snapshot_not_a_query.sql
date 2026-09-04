-- 추천은 질의가 아니라 스냅샷이다 (ADR 0037)
--
-- 계산과 보기를 뗀다. `discovery_board()` 는 화면을 열 때마다 풀 전체를 줄 세우고
-- 섞고 노출을 기록했다. 같은 목록이 계속 보인 것은 씨앗이 `나 + 오늘 날짜`라서인데
-- 그것은 **섞기만** 고정한다 — 누가 참여를 켜거나 요약을 고치면 순위가 그날 안에도
-- 움직였다. 그리고 추천이 홈에 서면(PRD §2.0) 방문마다 이 셈이 돈다.
--
-- 이제 **만드는 함수**가 열 명을 뽑아 적어 두고, **읽는 함수**는 그것을 읽는다.
--
-- 여기서 하지 **않는** 것: 참여 기본 켜짐. 그것은 동의 범위의 변경이라 온보딩과
-- 가입 관문(ADR 0024)이 함께 움직여야 한다 — 별도 티켓이다. 그때까지 참여는
-- 지금처럼 명시적 행위다.

-- ---------------------------------------------------------------------------
-- 스냅샷 — 머리 하나와 자리 열
-- ---------------------------------------------------------------------------

/**
 * 한 번 뽑은 목록.
 *
 * **그때의 내 판본을 든다.** 내 요약이 바뀌면 이 스냅샷은 남의 눈으로 뽑은 목록이다 —
 * 보완은 두 사람의 값으로 나는 것이라, 내 쪽이 바뀌면 열 명이 왜 그 열 명인지 아무도
 * 설명하지 못한다. 읽는 함수가 그 자리에서 새로 만든다.
 *
 * **두 세대를 남긴다.** 새로 뽑을 때 「직전 스냅샷에 있던 사람」을 빼려면 직전이 남아
 * 있어야 한다. 셋째 세대부터는 만드는 함수가 그 자리에서 지운다 — 청소를 따로 도는
 * 잡에 맡기면 그 잡이 멈춘 동안 표가 조용히 자란다.
 */
create table public.discovery_snapshot (
  id uuid primary key default gen_random_uuid(),

  /**
   * **세대의 차례는 순번이 정한다 — 시각이 아니라.**
   *
   * `generated_at` 으로 세대를 가르려다 재어 봤다: 한 트랜잭션 안에서 두 번 뽑으면
   * `now()` 가 안 움직여 두 줄이 **같은 시각**을 들고, 「직전」과 「지금」이 uuid 순으로
   * 갈렸다. 그러면 갈아 끼우는 자리도 지우는 자리도 아무 줄이나 고른다.
   *
   * `generated_at` 은 남는다 — 낡음(24시간)과 쿨다운(5분)을 재는 값이고, 그것은
   * 차례가 아니라 시간이다.
   */
  seq bigint generated always as identity,
  -- 기본값을 두지 않는다. 이 표에 쓰는 것은 `definer` 함수뿐이고, 그 함수는 누구의
  -- 목록을 만드는지 인자로 받는다.
  user_id uuid not null references public.app_user (id) on delete cascade,
  policy_version text not null,
  /**
   * 그때의 **내 요약** — 이것이 바뀌면 이 목록은 낡은 것이 아니라 남의 눈으로 뽑은 것이다.
   *
   * 판본 id 를 들지 않는 이유가 둘이다. 하나, 참조를 걸면 판본 정리가 이 표에 막혀
   * 하루짜리 목록이 사람의 저장 자리를 잡아먹는다. 둘, **판본이 그대로라도 요약은 바뀐다** —
   * 엔진이 바뀌면 같은 출생정보에서 다른 개수표가 나오고, 그때 이 목록이 기댄 값은
   * 이미 없는 값이다. 요청이 견주는 것도 요약이다(`request_match` 는 요약 두 벌이 지금과
   * 같은 노출 기록만 받는다) — 같은 것을 견줘야 화면과 문이 갈리지 않는다.
   */
  viewer_summary jsonb not null,
  generated_at timestamptz not null default now()
);

create index discovery_snapshot_by_user
  on public.discovery_snapshot (user_id, seq desc);

/**
 * 스냅샷의 한 자리 — **카드가 말하는 것까지 든다.**
 *
 * 채우는 오행과 균형 칸을 안 들면 읽을 때 두 축을 다시 셈해야 하고, 그러면 뗀 것이
 * 안 뗀 것이 된다.
 *
 * **두 축의 숫자는 여기 없다.** `complement`·`combined_balance` 는 `discovery-v0` 가
 * 감추기로 한 값이고(ADR 0003), 이 표는 사용자가 자기 것을 읽는 표다. 분석용 숫자는
 * 지금처럼 닫힌 `discovery_impression` 에만 남는다.
 */
create table public.discovery_snapshot_slot (
  snapshot_id uuid not null references public.discovery_snapshot (id) on delete cascade,
  /** 0부터 — 화면의 차례이자 노출 기록이 든 자리 */
  position integer not null check (position >= 0),
  candidate_user_id uuid not null references public.app_user (id) on delete cascade,
  /**
   * **그때 그 사람의 요약.**
   *
   * 카드가 말하는 채우는 오행은 이 값에서 났다. 상대의 요약이 바뀌면 이 카드는 낡은
   * 것이 아니라 **다른 값을 가리키는 카드**가 된다 — 읽을 때 뺀다. 그래서 화면에 선
   * 카드는 언제나 청할 수 있다: 요청을 만드는 문이 견주는 것도 바로 이 두 요약이다.
   * 여기서 판본으로 견주면 「보이는데 안 눌리는 카드」가 남는다 — 재어 봤다.
   */
  candidate_summary jsonb not null,
  exploration boolean not null,
  supplied_elements text[] not null,
  balance_band text not null,
  primary key (snapshot_id, position),
  -- 한 목록에 같은 사람이 두 번 서면 그것은 뽑기가 깨진 것이다. 시험이 아니라 표가 막는다.
  unique (snapshot_id, candidate_user_id)
);

/**
 * **두 표 모두 닫는다.**
 *
 * 자리 표는 사용자가 읽는 값을 들지만, 남의 자리도 이 표에 있다. 정책으로 「내 것만」을
 * 여는 대신 `definer` 함수 하나로 내주는 것은 `discovery_profile` 과 같은 이유다 —
 * RPC 가 내주는 것이 곧 브라우저가 볼 수 있는 것이고, 표를 열면 별명·소개가 아니라
 * **누가 누구의 목록에 섰는가**가 통째로 새어 나간다.
 */
alter table public.discovery_snapshot enable row level security;
alter table public.discovery_snapshot_slot enable row level security;

/**
 * `discovery_impression` 은 **뜻만 바뀐다** — 「화면에 그렸다」에서 「스냅샷에 실렸다」로.
 *
 * 열 구성은 그대로다. 요청이 노출에 매여 있으므로(`match_request.impression_id`)
 * 그 사슬은 끊기지 않는다. 다만 기록이 나는 **때**가 바뀐다: 화면을 열 때가 아니라
 * 스냅샷을 만들 때다. 그래서 목록을 백 번 열어도 기록은 한 벌이다.
 */
comment on table public.discovery_impression is
  '스냅샷에 실린 후보와 그때의 두 축 — 운영자만 읽는다 (ADR 0037)';

-- ---------------------------------------------------------------------------
-- 씨앗 한 방울 — **가중 무작위가 기댈 유일한 난수**
-- ---------------------------------------------------------------------------

/**
 * 씨앗과 사람에서 0과 1 사이 한 값을 뽑는다.
 *
 * `random()` 을 쓰지 않는 것은 **같은 씨앗이면 같은 목록이어야** 시험이 「가중치대로
 * 뽑혔는가」를 잴 수 있기 때문이다. 씨앗은 만드는 함수가 받고, 그 문은 닫혀 있다.
 */
create or replace function public.discovery_seeded_unit(seed text, id uuid)
returns double precision
language sql
immutable
set search_path = ''
as $$
  -- md5 앞 여덟 자리는 32비트다. `bit(32)::bigint` 는 부호 없이 0..2^32-1 로 편다.
  select (('x' || substr(md5(seed || id::text), 1, 8))::bit(32)::bigint::double precision + 0.5)
       / 4294967296.0;
$$;

/** 새로고침 사이의 최소 간격 — **한 자리에만 적는다** */
create or replace function public.discovery_refresh_cooldown()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '5 minutes';
$$;

-- ---------------------------------------------------------------------------
-- 만드는 함수 — **씨앗을 받는 닫힌 문**
-- ---------------------------------------------------------------------------

/**
 * 열 명을 뽑아 스냅샷에 적고, 같은 목록을 노출 기록에도 남긴다.
 *
 * ## 뽑는 규칙 (PRD §4.1)
 *
 * 1. 자격은 `discovery_eligible` 이 답한다 — 참여·계정·판본·양쪽 성별 조건·다시 보지
 *    않기·차단·살아 있는 결정. **여기서 새로 드는 제외는 「직전 스냅샷에 있던 사람」
 *    하나다.**
 * 2. 점수 상위 20% 를 남긴다. 스무 명이 안 되면 전부 남긴다.
 * 3. **여덟은 그 안에서 점수가 높을수록 잘 뽑히는 무작위, 둘은 잘라 낸 아래에서 무작위.**
 * 4. 열 자리가 안 차면 채운다 — 남은 사람부터, 그래도 모자라면 직전 스냅샷에 있던
 *    사람으로. 「제외를 풀어서 채운다」는 **모자랄 때만** 도는 규칙이라, 스위치가
 *    아니라 뒷자리로 적는다. 열 명이 신선하게 차는 날에는 직전 스냅샷 사람이 한 명도
 *    안 선다.
 *
 * 가중 무작위는 Efraimidis–Spirakis 다 — 사람마다 `u^(1/점수)` 를 짓고 큰 쪽을 뽑으면
 * 뽑힐 확률이 점수에 비례한다. 정렬 한 번으로 끝나고 중복이 안 난다.
 *
 * ## 왜 인자를 받는가 — **닫아 두고 시험만 부른다**
 *
 * 씨앗을 밖에서 받으면 사용자가 씨앗을 바꿔 가며 다시 뽑을 수 있고, 그때 노출 기록이
 * 무엇을 잰 것인지 말할 수 없게 된다. 그래서 이 문은 `authenticated` 에게 닫혀 있고,
 * 여는 문(`refresh_discovery_snapshot`)이 씨앗을 스스로 짓는다.
 * `reading_scope_for` / `reading_scope` 가 이미 이 모양이다.
 */
create or replace function public.refresh_discovery_snapshot_for(p_actor uuid, p_seed text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  my_summary jsonb;
  my_revision uuid;
  opted timestamptz;
  current_revision uuid;
  previous uuid;
  made uuid;
  written integer;
begin
  if p_actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  -- 계정을 인자로 묻는다. `is_active_account()` 는 `auth.uid()` 를 보는데, 이 함수는
  -- 누구의 목록을 만드는지 인자로 받으므로 그 둘이 같다고 가정할 수 없다.
  if not exists (
    select 1 from public.app_user u where u.id = p_actor and u.status = 'active'
  ) then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.element_revision_id, p.opted_in_at
    into my_summary, my_revision, opted
  from public.discovery_profile p where p.user_id = p_actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  select pe.current_revision_id into current_revision
  from public.app_user u
  join public.person pe on pe.id = u.self_person_id
  where u.id = p_actor;

  -- 낡은 요약으로는 남을 줄 세우지 않는다. 내 쪽이 낡았으면 내 목록도 성립하지 않는다.
  if my_revision is null or my_revision is distinct from current_revision then
    raise exception '내 오행 요약이 지금 판본의 것이 아닙니다.' using errcode = '55000';
  end if;

  select s.id into previous
  from public.discovery_snapshot s
  where s.user_id = p_actor
  order by s.seq desc
  limit 1;

  insert into public.discovery_snapshot (user_id, policy_version, viewer_summary)
  values (p_actor, 'discovery-v0', my_summary)
  returning id into made;

  /**
   * **자리와 기록을 한 문장이 쓴다.**
   *
   * 갈라 쓰면 「보여줄 목록」과 「보여줬다고 적을 목록」이 두 번 계산되고, 그 사이에
   * 남의 요약이 바뀌면 둘이 갈린다. 자료를 바꾸는 CTE 는 바깥 질의가 읽지 않아도
   * 언제나 끝까지 실행된다.
   */
  with eligible as (
    select
      other.user_id,
      public.discovery_complement(my_summary, other.element_summary) as complement,
      public.discovery_combined_balance(my_summary, other.element_summary) as balance,
      public.discovery_supplied_elements(my_summary, other.element_summary) as supplied,
      other.element_summary as summary,
      exists (
        select 1 from public.discovery_snapshot_slot s
        where s.snapshot_id = previous and s.candidate_user_id = other.user_id
      ) as shown_before
    from public.discovery_profile other
    -- 자격은 한 함수가 답한다. 여기 조건을 다시 적으면 요청을 만드는 문이 좁히는 것과 갈린다.
    where public.discovery_eligible(p_actor, other.user_id)
  ),
  scored as (
    select
      e.*,
      e.complement * 0.54 + e.balance * 0.46 as score,
      public.discovery_seeded_unit(p_seed, e.user_id) as u
    from eligible e
  ),
  fresh as (
    select s.* from scored s where not s.shown_before
  ),
  sizes as (
    select count(*)::int as n from fresh
  ),
  keep as (
    -- 상위 20%. 스무 명이 안 되면 자를 것이 없다 — 넷 중 하나를 남기는 것은 자르기가
    -- 아니라 목록을 없애는 일이다.
    select case when sizes.n < 20 then sizes.n else ceil(sizes.n * 0.2)::int end as k
    from sizes
  ),
  ranked as (
    select f.*, row_number() over (order by f.score desc, f.user_id) as rnk from fresh f
  ),
  tops as (
    select r.*, false as exploration
    from ranked r, keep
    where r.rnk <= keep.k
    order by power(r.u, 1.0 / greatest(r.score, 0.0001)) desc, r.user_id
    limit 8
  ),
  explorers as (
    -- 잘라 낸 **아래**에서만 뽑는다. 위에서 뽑으면 어차피 보일 사람을 탐색이라 부르는 것이라
    -- 아무것도 탐색하지 않는다.
    select r.*, true as exploration
    from ranked r, keep
    where r.rnk > keep.k
    order by r.u, r.user_id
    limit 2
  ),
  picked as (
    select user_id, supplied, summary, complement, balance, score, u, exploration from tops
    union all
    select user_id, supplied, summary, complement, balance, score, u, exploration from explorers
  ),
  filler as (
    -- 모자란 자리만 채운다. `shown_before` 를 정렬 앞에 두어 **직전 스냅샷 사람이 맨 뒤**로 간다.
    select s.user_id, s.supplied, s.summary, s.complement, s.balance, s.score, s.u,
           false as exploration
    from scored s
    where not exists (select 1 from picked p where p.user_id = s.user_id)
    order by s.shown_before, power(s.u, 1.0 / greatest(s.score, 0.0001)) desc, s.user_id
    limit (select greatest(0, 10 - (select count(*)::int from picked)))
  ),
  chosen as (
    select * from picked
    union all
    select * from filler
  ),
  counts as (
    select
      count(*)::int as wanted,
      count(*) filter (where exploration)::int as explorers
    from chosen
  ),
  sorted as (
    -- 위쪽 자리의 차례도 뽑기가 정한다. 점수 순으로 다시 세우면 가중 무작위가 **뽑기에만**
    -- 걸리고 화면은 여전히 순위표가 된다.
    select c.*, row_number() over (
      order by power(c.u, 1.0 / greatest(c.score, 0.0001)) desc, c.user_id
    ) as ti
    from chosen c where not c.exploration
  ),
  wandering as (
    select c.*, row_number() over (order by c.u, c.user_id) as ei
    from chosen c where c.exploration
  ),
  slots as (
    -- 섞는 자리는 고르게 벌린다. 뒤에 붙이면 아무도 거기까지 안 내려가고, 앞에 몰면
    -- 목록의 첫인상이 탐색이 된다.
    select
      i as ei,
      (floor((i * counts.wanted)::numeric / (counts.explorers + 1))::int - 1) as at
    from counts, generate_series(1, counts.explorers) as i
  ),
  seats as (
    select
      s.idx,
      slots.ei,
      (slots.ei is not null) as is_exploration,
      sum(case when slots.ei is null then 1 else 0 end)
        over (order by s.idx rows between unbounded preceding and current row) as top_index
    from counts, generate_series(0, counts.wanted - 1) as s(idx)
    left join slots on slots.at = s.idx
  ),
  placed as (
    select
      seats.idx,
      seats.is_exploration,
      coalesce(w.user_id, t.user_id) as user_id,
      coalesce(w.supplied, t.supplied) as supplied,
      coalesce(w.summary, t.summary) as summary,
      coalesce(w.complement, t.complement) as complement,
      coalesce(w.balance, t.balance) as balance
    from seats
    left join wandering w on seats.is_exploration and w.ei = seats.ei
    left join sorted t on not seats.is_exploration and t.ti = seats.top_index
  ),
  kept as (
    insert into public.discovery_snapshot_slot (
      snapshot_id, position, candidate_user_id, candidate_summary,
      exploration, supplied_elements, balance_band
    )
    select
      made, placed.idx, placed.user_id, placed.summary, placed.is_exploration,
      placed.supplied, public.discovery_balance_band(placed.balance)
    from placed
    returning 1
  ),
  logged as (
    insert into public.discovery_impression (
      viewer_user_id, candidate_user_id, policy_version, position, exploration,
      viewer_summary, candidate_summary, supplied_elements, complement, combined_balance
    )
    select
      p_actor, placed.user_id, 'discovery-v0', placed.idx, placed.is_exploration,
      my_summary, placed.summary, placed.supplied, placed.complement, placed.balance
    from placed
    returning 1
  )
  -- 쓴 줄 수를 받는 것은 **문장을 끝맺기 위해서**다. 자료를 바꾸는 CTE 는 바깥 질의가
  -- 읽지 않아도 도는데, plpgsql 에서 `with` 로 시작하는 문장은 결과를 받을 자리가 있어야 한다.
  select count(*) into written from kept;

  /**
   * **셋째 세대부터 지운다 — 쓰는 자리에서.**
   *
   * 직전 하나만 있으면 「직전 스냅샷 제외」가 성립하므로 두 세대면 충분하다. 도는 잡에
   * 맡기지 않는 것은, 잡이 멈춘 동안 이 표가 조용히 자라고 그것을 알아차릴 자리가
   * 없기 때문이다. 지우는 양은 한 사람당 한 줄이라 쓰는 값이 싸다.
   */
  delete from public.discovery_snapshot s
  where s.user_id = p_actor
    and s.id not in (
      select g.id from (
        select d.id, row_number() over (order by d.seq desc) as gen
        from public.discovery_snapshot d
        where d.user_id = p_actor
      ) g
      where g.gen <= 2
    );

  return made;
end;
$$;

-- ---------------------------------------------------------------------------
-- 새로고침 — **여는 문. 씨앗은 여기서 난다**
-- ---------------------------------------------------------------------------

/**
 * 다시 뽑아 갈아 끼운다. 만든 지 5분 안이면 거절한다.
 *
 * 쿨다운이 여기 있고 읽는 함수에는 없는 것은, 24시간 자동 갱신이 이 문을 지나지 않기
 * 때문이다. 사람이 누르는 것만 세면 된다.
 */
create or replace function public.refresh_discovery_snapshot()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  last_at timestamptz;
  made uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  select s.generated_at into last_at
  from public.discovery_snapshot s
  where s.user_id = actor
  order by s.seq desc
  limit 1;

  if last_at is not null and last_at > now() - public.discovery_refresh_cooldown() then
    raise exception '방금 새로 받았습니다. 잠시 뒤에 다시 받아 주세요.' using errcode = '55000';
  end if;

  -- 씨앗은 **DB 가 짓는다.** 밖에서 받으면 씨앗을 바꿔 가며 다시 뽑을 수 있다.
  made := public.refresh_discovery_snapshot_for(actor, gen_random_uuid()::text);

  return (select s.generated_at from public.discovery_snapshot s where s.id = made);
end;
$$;

-- ---------------------------------------------------------------------------
-- 읽는 함수 — **낡음을 판정하는 유일한 자리**
-- ---------------------------------------------------------------------------

/**
 * 지금 내 목록.
 *
 * 반환형은 `discovery_board()` 와 같다 — 화면과 `app/me/candidates.ts` 가 그대로다.
 * 달라진 것은 **어디서 오는가**뿐이다.
 *
 * ## 스스로 새로 만든다
 *
 * 없거나 · 24시간이 지났거나 · 내 요약이 그 사이 바뀌었으면 여기서 만든다. 그래서
 * `stable` 이 아니라 `volatile` 이다. 화면이 「낡았는가」를 판정해 새로고침을 부르게
 * 하면 그 판정이 두 자리가 되고, 두 자리는 언젠가 갈린다.
 *
 * ## 읽을 때 다시 묻는 것은 자격 하나다
 *
 * 그 사이 참여를 끈 사람·차단된 사람·요청이 오간 사람은 목록에서 빠진다. **요약이 바뀐
 * 사람도 빠진다** — 그 카드가 말하는 오행은 바뀌기 전의 것이라, 남겨 두면 화면이 지금의
 * 그 사람이 아닌 것을 말하고 그 카드는 눌러도 요청이 안 난다. 빠진 자리를 메우지 않는
 * 것은 그것이 곧 다시 뽑는 일이기 때문이다 — 다시 뽑는 문은 하나다.
 *
 * **자리 번호는 스냅샷의 것을 그대로 낸다.** 빠진 자리는 번호에 구멍으로 남는다.
 * 다시 매기면 노출 기록이 든 자리와 화면의 자리가 갈리고, 그 둘은 같아야 한다
 * (`match_request.impression_id` 가 그 기록을 가리킨다).
 */
create or replace function public.my_discovery_board()
returns table (
  candidate_user_id uuid,
  nickname text,
  intro text,
  seat integer,
  exploration boolean,
  supplied_elements text[],
  balance_band text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_revision uuid;
  opted timestamptz;
  current_revision uuid;
  snap uuid;
  made_at timestamptz;
  snap_summary jsonb;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.element_revision_id, p.opted_in_at
    into my_summary, my_revision, opted
  from public.discovery_profile p where p.user_id = actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  select pe.current_revision_id into current_revision
  from public.app_user u
  join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  if my_revision is null or my_revision is distinct from current_revision then
    raise exception '내 오행 요약이 지금 판본의 것이 아닙니다.' using errcode = '55000';
  end if;

  select s.id, s.generated_at, s.viewer_summary into snap, made_at, snap_summary
  from public.discovery_snapshot s
  where s.user_id = actor
  order by s.seq desc
  limit 1;

  if snap is null
     or made_at < now() - interval '24 hours'
     or snap_summary is distinct from my_summary then
    snap := public.refresh_discovery_snapshot_for(actor, gen_random_uuid()::text);
  end if;

  return query
  select
    slot.candidate_user_id,
    theirs.nickname,
    theirs.intro,
    slot.position,
    slot.exploration,
    slot.supplied_elements,
    slot.balance_band
  from public.discovery_snapshot_slot slot
  join public.discovery_profile theirs on theirs.user_id = slot.candidate_user_id
  where slot.snapshot_id = snap
    and public.discovery_eligible(actor, slot.candidate_user_id)
    -- 카드가 그때 그 요약을 가리키는가. `discovery_eligible` 은 「지금 판본인가」만 묻는다.
    and theirs.element_summary = slot.candidate_summary
  order by slot.position;
end;
$$;

/**
 * 지금 목록을 언제 받았고, **몇 초 뒤에 다시 받을 수 있나.**
 *
 * 남은 초까지 DB 가 센다. 화면이 5분을 세면 그 수가 두 곳에 적혀 갈리고, 시각만 주면
 * 이번엔 **브라우저 시계와 서버 시계의 차이**가 그 자리에 들어온다 — 시계가 5분 어긋난
 * 사람에게는 버튼이 늘 눌리거나 영영 안 눌린다. 뺄셈을 한 자리에서만 한다.
 *
 * 목록을 먼저 읽고(그때 24시간 갱신이 일어난다) 이것을 읽는다.
 */
create or replace function public.my_discovery_snapshot()
returns table (generated_at timestamptz, wait_seconds integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.generated_at,
    greatest(0, ceil(extract(epoch from
      (s.generated_at + public.discovery_refresh_cooldown()) - now())))::integer
  from public.discovery_snapshot s
  where s.user_id = (select auth.uid())
  order by s.seq desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 문을 여닫는다
-- ---------------------------------------------------------------------------

/** 볼 때마다 계산하던 문은 **닫는다.** 두 문이 서면 어느 목록이 「내 목록」인지 갈린다. */
drop function if exists public.discovery_board();

revoke execute on function public.refresh_discovery_snapshot_for(uuid, text) from anon, public, authenticated;
revoke execute on function public.discovery_seeded_unit(text, uuid) from anon, public, authenticated;
revoke execute on function public.discovery_refresh_cooldown() from anon, public, authenticated;

revoke execute on function public.refresh_discovery_snapshot() from anon, public;
grant execute on function public.refresh_discovery_snapshot() to authenticated;

revoke execute on function public.my_discovery_board() from anon, public;
grant execute on function public.my_discovery_board() to authenticated;

revoke execute on function public.my_discovery_snapshot() from anon, public;
grant execute on function public.my_discovery_snapshot() to authenticated;
