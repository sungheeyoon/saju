-- 저장한 사람 하나도 풀이를 받는다 — **`self` 는 계속 나만 뜻한다**
--
-- `/me/people/[personId]` 에는 명식 표만 서 있고 만드는 버튼이 없었다. 엄마의 풀이를
-- 보려면 엄마 × 다른 한 사람 궁합으로 가야 했다 — 한 명짜리 길이 없었다.
--
-- ## `self` 를 넓히지 않는다
--
-- `reading_scope_for` 의 `self` 갈래는 `p_person_a` 를 **안 본다.** 부른 사람의
-- selfPerson 을 스스로 찾아 내주는 것이 그 함수의 일이기 때문이다. 그래서 `p_person_a`
-- 를 받게 고치면 코드는 제일 적게 드는데, `self` 라는 낱말이 「나」를 안 뜻하게 된다.
--
-- 낱말을 지키면 하나가 더 따라온다. **누구 것을 모델에 넘겼는가**가 kind 로 갈린다 —
-- 내 명식을 넘긴 것과 남의 명식을 넘긴 것은 동의 범위가 다른 일이고, 한 낱말로 묶어
-- 두면 그 둘이 기록에서 같아진다. 나중에 「남의 명식을 몇 번 넘겼나」를 물을 수 없다.
--
-- ## 갈리는 것은 접근 판정 하나뿐이다
--
-- 자료도 프롬프트도 검사도 `self` 와 같은 계열이다. 점수를 안 낸다는 것도 같다. 파이프라인·
-- 풀이권·설문·실패 복구·중복 잠금은 손대지 않는다 — kind 마다 파이프라인을 따로 만들면
-- 출력 검사가 한 갈래에서만 도는 일이 생긴다(`prd-archive`).

-- ---------------------------------------------------------------------------
-- kind 가 넷이 된다
-- ---------------------------------------------------------------------------

alter table public.reading drop constraint reading_kind_check;
alter table public.reading add constraint reading_kind_check
  check (kind in ('self', 'person', 'private', 'match'));

alter table public.reading_run drop constraint reading_run_kind_check;
alter table public.reading_run add constraint reading_run_kind_check
  check (kind in ('self', 'person', 'private', 'match'));

/**
 * 대상 하나 — **`person` 은 사용자와 Person 을 함께 든다.**
 *
 * 「사용자별·Person별 현재 결과 하나」가 이 열에서 지켜진다. `owner_user_id` 를 빼면
 * 두 사람이 같은 엄마를 관리할 때 한 결과를 나눠 갖게 되고, 그러면 한 사람이 다시
 * 만들 때 남이 읽던 글이 갈린다.
 *
 * `self` 와 같은 모양이지만 **접두사가 다르다.** 접근 판정이 내 selfPerson 을 이미
 * `person` 에서 빼므로 두 키가 부딪힐 일은 없지만, 부딪히지 않는 것이 **규칙 하나에만**
 * 기대고 있으면 그 규칙이 흔들리는 날 두 결과가 한 자리를 다툰다. 키는 스스로 갈라 둔다.
 */
alter table public.reading alter column target_key set expression as (
  case kind
    when 'self' then 'self:' || owner_user_id::text || ':' || person_a::text
    when 'person' then 'person:' || owner_user_id::text || ':' || person_a::text
    when 'private' then
      'private:' || owner_user_id::text || ':' || person_a::text || ':' || person_b::text
    else 'match:' || match_id::text
  end
);

/**
 * 채워야 하는 자리와 비어야 하는 자리 — **`self` 와 같다.**
 *
 * 검사식을 안 적으면 「두 사람이 실린 person 결과」가 실재할 수 있고, 그때 궁합 점수가
 * 한 사람짜리 결과에 붙는다.
 */
alter table public.reading add constraint person_is_one_person check (
  kind <> 'person' or (
    owner_user_id is not null and match_id is null
    and person_b is null and revision_b is null and score is null)
);

-- ---------------------------------------------------------------------------
-- 접근 판정 — 갈리는 것은 여기 하나뿐이다
-- ---------------------------------------------------------------------------

create or replace function public.reading_scope_for(
  p_actor uuid,
  p_kind text,
  p_person_a uuid default null,
  p_person_b uuid default null,
  p_match_id uuid default null
)
returns table (
  kind text,
  owner_user_id uuid,
  person_a uuid,
  person_b uuid,
  match_id uuid,
  revision_a uuid,
  revision_b uuid,
  /**
   * 보는 사람이 `a` 인가 — **공유 결과의 글이 「첫 번째 분」이라고 부르는 그 자리.**
   *
   * `match` 는 양쪽이 같은 글을 읽으므로 순서를 보는 사람마다 뒤집을 수 없다. 그래서
   * 차례를 Match 가 정하고(`user_low` 가 앞), 화면이 「첫 번째 분이 나인가」를 이
   * 값으로 안다. 뒤집어 그리면 두 사람이 서로 다른 글을 읽게 된다.
   */
  viewer_is_first boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  -- 자기 풀이 — 대상을 인자로 받지 않는다. 내 selfPerson 하나뿐이다.
  select
    'self', u.id, u.self_person_id, null::uuid, null::uuid,
    p.current_revision_id, null::uuid, true
  from public.app_user u
  join public.person p on p.id = u.self_person_id
  where p_kind = 'self'
    and u.id = p_actor
    and u.status = 'active'
    and p.current_revision_id is not null

  union all

  /**
   * 저장한 사람 하나 — **내 엣지에 있는 Person 이면 된다.**
   *
   * `self` 와 갈라 두는 것이 요점이다. 저 갈래는 `p_person_a` 를 **안 본다** — 부른
   * 사람의 selfPerson 을 스스로 찾아 내주는 것이 그 일이기 때문이다. 그래서 `self` 로
   * 남을 물을 수는 없고, 물을 수 있게 넓히면 `self` 라는 낱말이 「나」를 안 뜻하게 된다.
   *
   * 낱말을 지키면 하나가 더 따라온다 — **누구 것을 모델에 넘겼는가**가 kind 로 갈린다.
   * 한 낱말로 묶어 두면 내 명식을 넘긴 것과 엄마 명식을 넘긴 것이 기록에서 같아진다.
   *
   * **내 selfPerson 은 이 갈래가 아니다.**
   *
   * 내 selfPerson 도 내 엣지에 있으므로 안 막으면 `person` 으로도 물어진다. 그러면 같은
   * 명식에 결과가 둘 생긴다 — `/me` 와 `/me/people/{내 id}` 에서 서로 다른 글이 서고,
   * 같은 자료로 풀이권이 두 번 나간다.
   *
   * 화면은 이미 그렇게 전제하고 있었다. `/me/people` 목록이 selfPerson 을 걸러 내며
   * 「나는 `/me` 에 있다」고 적어 두었는데, 그 판정이 앱에만 있어서 **주소로는 열렸다.**
   * 자격은 화면이 아니라 여기서 정한다.
   *
   * 엣지가 없으면 0행이다. **없는 것과 못 보는 것을 가르지 않는다** — 가르면 남의
   * Person id 를 넣어 그 사람이 있는지 확인하는 문이 된다. 내 selfPerson 도 같은 0행으로
   * 답한다: 「그건 `self` 로 물어라」를 여기서 말하면 화면이 그 문장을 또 적게 된다.
   */
  select
    'person', p_actor, p.id, null::uuid, null::uuid,
    p.current_revision_id, null::uuid, true
  from public.person p
  where p_kind = 'person'
    and p_person_a is not null
    and p.id = p_person_a
    and p.current_revision_id is not null
    and exists (
      select 1 from public.app_user u where u.id = p_actor and u.status = 'active'
    )
    -- definer 라 RLS 가 안 걸린다. 좁히는 조건을 손으로 적는다.
    and exists (
      select 1 from public.user_person_access e
      where e.user_id = p_actor and e.person_id = p.id
    )
    and not exists (
      select 1 from public.app_user me
      where me.id = p_actor and me.self_person_id = p.id
    )

  union all

  -- 비공개 궁합 — 두 사람 다 **내 엣지**에 있어야 한다. Match 상대는 엣지가 없다.
  select
    'private', p_actor,
    lo.id, hi.id, null::uuid,
    lo.current_revision_id, hi.current_revision_id, true
  from public.person lo
  join public.person hi on hi.id = greatest(p_person_a, p_person_b)
  where p_kind = 'private'
    and p_person_a is not null and p_person_b is not null and p_person_a <> p_person_b
    and lo.id = least(p_person_a, p_person_b)
    and exists (
      select 1 from public.app_user u where u.id = p_actor and u.status = 'active'
    )
    and lo.current_revision_id is not null and hi.current_revision_id is not null
    -- definer 라 RLS 가 안 걸린다. 좁히는 조건을 손으로 적는다.
    and exists (
      select 1 from public.user_person_access e
      where e.user_id = p_actor and e.person_id = lo.id
    )
    and exists (
      select 1 from public.user_person_access e
      where e.user_id = p_actor and e.person_id = hi.id
    )

  union all

  -- 공유 궁합 — **매인 판본**으로만 난다. 차례는 Match 가 정한다.
  select
    'match', null::uuid, ra.person_id, rb.person_id, m.id,
    m.low_revision_id, m.high_revision_id,
    m.user_low = p_actor
  from public.match m
  join public.app_user low on low.id = m.user_low
  join public.app_user high on high.id = m.user_high
  join public.person_chart_revision ra on ra.id = m.low_revision_id
  join public.person_chart_revision rb on rb.id = m.high_revision_id
  where p_kind = 'match' and m.id = p_match_id
    and p_actor in (m.user_low, m.user_high)
    and low.status = 'active' and high.status = 'active'
    and not exists (
      select 1 from public.block b
      where (b.user_id = m.user_low and b.blocked_user_id = m.user_high)
         or (b.user_id = m.user_high and b.blocked_user_id = m.user_low)
    );
$$;

revoke execute on function public.reading_scope_for(uuid, text, uuid, uuid, uuid)
  from anon, public, authenticated, service_role;
