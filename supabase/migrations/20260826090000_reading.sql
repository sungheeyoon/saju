-- 현재 AI 결과 — **대상마다 한 벌, 요청이 성공할 때만 통째로 교체**
--
-- `prd-archive` 9단계다. 앞의 파일들이 여기까지 오는 길을 놓았다 — 판본(0004)·접근(0008)·
-- 공유 결과(0010)·판본 보존(0011). 이 파일이 그 위에 **결과**를 얹는다.
--
-- 세 가지가 이 표의 모양을 정한다.
--
-- 1. **이력이 아니다.** 대상마다 현재 결과 하나뿐이고, 결과 생성 요청이 성공하면
--    점수·해석·근거·프롬프트·모델 설정을 **한 벌로** 교체한다. 이전 결과는 보존하지도
--    참조하지도 않는다(ADR 0001·0011). 그래서 행이 쌓이지 않고 `on conflict` 로 덮인다.
-- 2. **판본을 든다.** `revision_a`·`revision_b` 가 FK 로 서므로 `revisions_in_use()` 가
--    이 표를 **자동으로** 본다 — ADR 0011 이 표 이름 대신 FK 에 정책을 적어 둔 이유가
--    오늘 실현된다. 결과가 교체되면 옛 판본은 그 자리에서 놓인다.
-- 3. **화면 조회는 AI 를 부르지 않는다.** 읽는 함수와 쓰는 함수가 갈려 있고, 쓰는 쪽은
--    사용자가 누른 요청에서만 돈다.

-- ---------------------------------------------------------------------------
-- 현재 결과
-- ---------------------------------------------------------------------------

create table public.reading (
  id uuid primary key default gen_random_uuid(),

  /**
   * 무엇에 대한 결과인가 — `self`(내 명식) · `private`(내가 접근 가능한 두 사람) ·
   * `match`(성립한 Match 의 공유 궁합).
   *
   * 셋은 같은 파이프라인을 쓰되 **근거 범위와 접근 판정이 다르다.** 한 kind 의 권한
   * 판정이 다른 kind 를 열지 않는다(용어집).
   */
  kind text not null check (kind in ('self', 'private', 'match')),

  /** `self`·`private` 의 주인. `match` 는 주인이 없다 — 양쪽이 같은 것을 본다 */
  owner_user_id uuid references public.app_user (id) on delete cascade,
  match_id uuid references public.match (id) on delete cascade,

  person_a uuid not null references public.person (id) on delete cascade,
  /** 한 사람짜리면 `null` */
  person_b uuid references public.person (id) on delete cascade,

  /**
   * 이 결과를 만든 판본.
   *
   * **FK 인 것이 정책이다.** `revisions_in_use()` 는 표 이름을 적어 둔 목록이 아니라
   * `person_chart_revision` 을 가리키는 FK 에서 참조를 읽으므로(ADR 0011), 이 두 열이
   * 생기는 것만으로 지금 결과가 선 판본이 정리 대상에서 빠진다.
   */
  revision_a uuid not null references public.person_chart_revision (id),
  revision_b uuid references public.person_chart_revision (id),

  -- 사용자에게 보이는 것 --------------------------------------------------

  /** 원문 Markdown. 화면은 이 글의 절 구조를 알지 않는다 */
  output text not null check (length(output) between 1 and 60000),
  /** 궁합만. 자기 풀이에는 궁합 점수를 억지로 붙이지 않는다 */
  score smallint check (score between 0 and 100),

  -- 무엇으로 만들었나 — 되짚기 위한 것이지 사용자에게 보이는 값이 아니다 ------

  /** 실제로 모델에 보낸 자료 그대로. 출생 원문은 여기 없다(ADR 0008) */
  evidence text not null,
  /** 실제로 보낸 프롬프트 그대로 */
  prompt text not null,
  prompt_version text not null,
  model text not null,
  /** provider·temperature 등 그때의 생성 설정 */
  generation jsonb not null default '{}'::jsonb,

  /** 운을 짚은 기준 시각 — 이 값도 결과를 만든 **입력**이다(ADR 0001) */
  viewed_at timestamptz not null,
  created_at timestamptz not null default now(),

  /**
   * 대상 하나 — **키를 값으로 만든다.**
   *
   * kind 마다 다른 부분 인덱스를 셋 두는 대신 대상을 한 값으로 지어 유일성을 하나로
   * 건다. 「대상별 현재 결과 하나」가 세 자리가 아니라 **한 자리**에서 지켜진다 —
   * 세는 자리가 여럿이면 하나를 잊는다.
   */
  target_key text generated always as (
    case kind
      when 'self' then 'self:' || owner_user_id::text || ':' || person_a::text
      when 'private' then
        'private:' || owner_user_id::text || ':' || person_a::text || ':' || person_b::text
      else 'match:' || match_id::text
    end
  ) stored,

  /**
   * kind 마다 **채워야 하는 자리와 비어야 하는 자리**가 다르다.
   *
   * 검사식으로 적어 두지 않으면 「주인 없는 private」이나 「Match 없는 match」가
   * 실재할 수 있고, 그때 `target_key` 가 `null` 이 되어 유일성이 통째로 풀린다.
   */
  constraint self_is_one_person check (
    kind <> 'self' or (
      owner_user_id is not null and match_id is null
      and person_b is null and revision_b is null and score is null)
  ),
  constraint private_is_two_people check (
    kind <> 'private' or (
      owner_user_id is not null and match_id is null
      and person_b is not null and revision_b is not null and person_a < person_b)
  ),
  constraint match_is_a_consent check (
    kind <> 'match' or (
      owner_user_id is null and match_id is not null
      and person_b is not null and revision_b is not null)
  )
);

create unique index reading_one_per_target on public.reading (target_key);
create index reading_by_owner on public.reading (owner_user_id, kind);
create index reading_by_match on public.reading (match_id);

-- ---------------------------------------------------------------------------
-- 생성 기록 — **결과가 아니라 시도의 기록이다**
-- ---------------------------------------------------------------------------

/**
 * 언제 누가 무엇을 만들려 했고 어떻게 됐는가.
 *
 * 세 가지를 이 표 하나가 맡는다: **한도**(같은 사람이 얼마나 자주 부를 수 있나) ·
 * **같은 요청 한 번**(재시도가 현재 결과를 여러 번 갈아치우지 않게) · **실패 상태**
 * (생성이 실패했을 때 화면이 그 사실을 말할 수 있게).
 *
 * **판본 FK 를 들지 않는다.** 들면 `revisions_in_use()` 가 이 기록까지 참조로 세고,
 * 실패한 시도 하나 때문에 과거 출생 입력이 영구 보존된다(ADR 0011). 여기 남는 것은
 * 사건과 시각과 실패 코드뿐이다.
 *
 * **본문도 근거도 남기지 않는다.** 교체된 이전 결과를 이 표에 숨겨 두면 「이전 결과는
 * 보존하지 않는다」가 글자로만 참이 된다.
 */
create table public.reading_run (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user (id) on delete cascade,
  kind text not null check (kind in ('self', 'private', 'match')),

  /**
   * 무엇에 대한 시도였나 — **`reading` 과 같은 열로 든다.**
   *
   * 대상을 문자열로 지어 넣으면 그 문자열을 짓는 자리가 둘이 되고, 둘은 갈린다.
   * 판본은 들지 않는다 — 위에 적은 이유다.
   */
  person_a uuid references public.person (id) on delete cascade,
  person_b uuid references public.person (id) on delete cascade,
  match_id uuid references public.match (id) on delete cascade,

  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  /** 실패 코드 — `READING_FAILURES` 의 이름 또는 호출 실패다 */
  failure_code text,
  /** 무엇이 걸렸는지. **출생 원문은 여기 적지 않는다**(`prd-archive`: 로그 규율) */
  failure_detail text check (length(failure_detail) <= 500),

  model text,
  prompt_version text,

  /**
   * 이 시도의 열쇠 — 사용자마다 유일하다.
   *
   * **이것만으로는 두 번 교체를 막지 못한다.** 지금 부르는 쪽(서버 액션)은 누를 때마다
   * 새 값을 짓기 때문이다. 같은 대상을 두 번 갈아치우는 것을 실제로 막는 것은 아래의
   * **도는 시도 잠금**이고, 이 열쇠는 나중에 큐나 재시도기가 **안정된 값**을 들고 올 때
   * 그 자리를 비워 두는 것이다. 무엇이 무엇을 막는지 갈라 적어 두지 않으면, 이 열쇠가
   * 지키고 있다고 믿는 채로 지켜지지 않는다.
   */
  idempotency_key text not null check (length(idempotency_key) between 8 and 100),

  /**
   * **`clock_timestamp()` 다.**
   *
   * 이 값이 판정에 쓰인다 — 「더 나중에 열린 시도가 있는가」가 늦게 돌아온 저장을
   * 거절하는 근거다. `now()` 는 트랜잭션이 열린 시각이라 한 트랜잭션 안에서 쌓인 둘에게
   * 같은 값을 주고, 그러면 그 판정이 아무것도 가르지 못한다. 판본이 같은 이유로 이미
   * 한 번 이 자리를 옮겼다(ADR 0011).
   */
  created_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,

  unique (user_id, idempotency_key)
);

create index reading_run_recent on public.reading_run (user_id, created_at desc);
create index reading_run_by_target on public.reading_run (user_id, kind, person_a, created_at desc);

-- ---------------------------------------------------------------------------
-- 알림 — **일어나는 사건만 적는다**
-- ---------------------------------------------------------------------------

/**
 * `reading_ready` 하나만 는다.
 *
 * 앞 파일이 「지금 일어나지 않는 사건을 검사식에 미리 적어 두면, 그 값이 실제로 쓰이는
 * 날 아무도 여기를 다시 보지 않는다」고 적었다. 그 규율을 그대로 지킨다 —
 * **`reading_failed` 는 넣지 않는다.** 생성이 요청과 같은 왕복 안에서 끝나므로 실패는
 * 누른 사람 화면에 그 자리에서 서고, 시도 기록(`reading_run`)이 그 사실을 든다.
 * 알림함에 한 번 더 세우면 같은 말을 두 자리에서 하게 된다. 생성이 비동기가 되는 날
 * 이 값이 필요해지고, 그날 이 자리를 다시 본다.
 *
 * 준비 완료는 **Match 상대에게만** 간다. 누른 사람은 결과를 그 자리에서 보므로 알릴
 * 것이 없고, 상대는 자기가 보던 공유 결과가 **바뀐 것**을 알아야 한다.
 */
alter table public.notification drop constraint notification_kind_check;
alter table public.notification add constraint notification_kind_check check (kind in (
  'request_received', 'request_accepted', 'request_rejected', 'request_invalidated',
  'reading_ready'
));

-- ---------------------------------------------------------------------------
-- 권한 — 두 표 다 한 줄도 직접 안 보인다
-- ---------------------------------------------------------------------------

revoke all on public.reading, public.reading_run from anon, authenticated;

alter table public.reading enable row level security;
alter table public.reading_run enable row level security;

/**
 * 정책이 없는 표는 `authenticated` 에게 닫혀 있다.
 *
 * 근거와 프롬프트가 이 표에 있다. 열어 주면 `Reading.evidence` 를 클라이언트가 직접
 * select 할 수 있게 되고, 그것은 `prd-archive` 가 명시적으로 막은 것이다. 닿는 길은 아래
 * `definer` 함수뿐이고 — **그 함수가 내주는 것이 곧 브라우저가 볼 수 있는 것이다.**
 */

-- ---------------------------------------------------------------------------
-- 「이 결과를 누가, 어떤 판본으로 볼 수 있는가」 — **한 자리**
-- ---------------------------------------------------------------------------

/**
 * 대상 하나를 풀어 준다 — 접근 판정과 판본 결정을 **함께** 한다.
 *
 * 읽는 함수도, 시작하는 함수도, 저장하는 함수도 전부 이것 위에 선다. 좁힘을 여러
 * 자리에 적으면 언젠가 한쪽만 고쳐지고, 그때 열려 있는 쪽은 언제나 더 바깥이다
 * (`visible_matches` 와 같은 규율).
 *
 * **0행이 곧 거절이다.** 없는 대상과 못 보는 대상을 가르지 않는다 — 가르면 응답
 * 차이만으로 그 Person 이나 Match 가 실재하는지 알아낼 수 있다.
 *
 * **판본을 여기서 정한다.** `self`·`private` 는 지금 판본, `match` 는 **매인 판본**
 * 이다(ADR 0010: 동의한 대상이 그 판본이라 결과도 그것으로 난다). 앱이 판본 id 를
 * 손으로 고를 자리를 남기지 않는다.
 *
 * 이 함수는 **내부의 한 자리**다. 브라우저에서 온 호출은 아래 `reading_scope` 가
 * `auth.uid()` 를 넣고, 저장은 시도 행의 `user_id` 를 넣는다. 저장을 열쇠로 바꿨다고
 * 시작 때의 자격을 십 분짜리 임대권으로 만들지 않는다 — 만드는 동안 차단되거나 계정이
 * 중지됐으면 저장도 멈춘다.
 */
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

/**
 * 사용자 JWT 로 묻는 바깥 문. 내부 함수에 actor 를 손으로 댈 수 있게 열면 남의 자격으로
 * 대상을 풀 수 있으므로, 이 함수만 `auth.uid()` 를 넣는다.
 */
create or replace function public.reading_scope(
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
  viewer_is_first boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.reading_scope_for(
    (select auth.uid()), p_kind, p_person_a, p_person_b, p_match_id);
$$;

revoke execute on function public.reading_scope(text, uuid, uuid, uuid)
  from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 읽기 — **AI 를 부르지 않는다**
-- ---------------------------------------------------------------------------

/**
 * 그 대상의 현재 결과.
 *
 * 화면이 여는 것은 여기까지다. 결과가 없으면 0행이고, 그것은 「아직 안 만들었다」와
 * 「못 본다」를 가르지 않는다.
 *
 * **근거와 프롬프트는 여기서 안 나간다.** 그 둘은 내부 테스트 화면의 것이고 문이
 * 따로 있다(`my_reading_artifacts`).
 */
create or replace function public.my_reading(
  p_kind text,
  p_person_a uuid default null,
  p_person_b uuid default null,
  p_match_id uuid default null
)
returns table (
  id uuid,
  kind text,
  score smallint,
  output text,
  model text,
  viewed_at timestamptz,
  created_at timestamptz,
  viewer_is_first boolean,
  /**
   * 이 결과를 만든 판본이 **아직 지금 판본인가.**
   *
   * `match` 는 언제나 참이다 — 매인 판본으로 났고 그 판본은 움직이지 않는다. 자기
   * 풀이와 비공개 궁합은 입력을 고치면 거짓이 되고, 그때 화면은 「이 글은 이전 입력으로
   * 썼습니다」라고 말할 수 있다. 그 사실을 값으로 내주지 않으면 화면이 판본 id 를
   * 견주게 되고, 판정하는 자리가 둘이 된다.
   */
  from_current_revision boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.kind, r.score, r.output, r.model, r.viewed_at, r.created_at,
    s.viewer_is_first,
    r.revision_a = s.revision_a and r.revision_b is not distinct from s.revision_b
  from public.reading_scope(p_kind, p_person_a, p_person_b, p_match_id) s
  join public.reading r
    on r.kind = s.kind
   and r.owner_user_id is not distinct from s.owner_user_id
   and r.person_a = s.person_a
   and r.person_b is not distinct from s.person_b
   and r.match_id is not distinct from s.match_id;
$$;

revoke execute on function public.my_reading(text, uuid, uuid, uuid) from anon, public;
grant execute on function public.my_reading(text, uuid, uuid, uuid) to authenticated;

/**
 * 근거·프롬프트·생성 설정 — **내부 테스트 화면의 문.**
 *
 * 문을 따로 두는 까닭은 크기가 아니라 성격이다. 사용자가 읽는 자리에서는 이 값들이
 * 한 번도 실려 나가지 않아야, 「결과 화면에 무엇이 나가는가」에 한 문장으로 답할 수
 * 있다(ADR 0008). 여기서 나가는 것도 **자기 대상의 것뿐**이고, 그 자료는 이미 그
 * 사람이 볼 수 있는 범위로 잘려 있다.
 */
create or replace function public.my_reading_artifacts(
  p_kind text,
  p_person_a uuid default null,
  p_person_b uuid default null,
  p_match_id uuid default null
)
returns table (evidence text, prompt text, prompt_version text, generation jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select r.evidence, r.prompt, r.prompt_version, r.generation
  from public.reading_scope(p_kind, p_person_a, p_person_b, p_match_id) s
  join public.reading r
    on r.kind = s.kind
   and r.owner_user_id is not distinct from s.owner_user_id
   and r.person_a = s.person_a
   and r.person_b is not distinct from s.person_b
   and r.match_id is not distinct from s.match_id;
$$;

revoke execute on function public.my_reading_artifacts(text, uuid, uuid, uuid) from anon, public;
grant execute on function public.my_reading_artifacts(text, uuid, uuid, uuid) to authenticated;

/**
 * 마지막 시도가 어떻게 됐나 — 화면이 「지난번에 실패했습니다」라고 말하는 근거.
 *
 * 실패는 알림으로 서지 않는다(위). 대신 이 값이 그 자리를 든다.
 */
create or replace function public.my_last_reading_run(
  p_kind text,
  p_person_a uuid default null,
  p_person_b uuid default null,
  p_match_id uuid default null
)
returns table (status text, failure_code text, failure_detail text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select run.status, run.failure_code, run.failure_detail, run.created_at
  from public.reading_scope(p_kind, p_person_a, p_person_b, p_match_id) s
  join lateral (
    select *
    from public.reading_run r
    where r.user_id = (select auth.uid())
      and r.kind = s.kind
      and r.person_a is not distinct from s.person_a
      and r.person_b is not distinct from s.person_b
      and r.match_id is not distinct from s.match_id
    order by r.created_at desc
    limit 1
  ) run on true;
$$;

revoke execute on function public.my_last_reading_run(text, uuid, uuid, uuid) from anon, public;
grant execute on function public.my_last_reading_run(text, uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 요청을 시작한다 — 한도와 「같은 요청 한 번」이 여기서 걸린다
-- ---------------------------------------------------------------------------

/**
 * 한 시간에 몇 번까지 부를 수 있나.
 *
 * **재어 보고 정한 값이 아니다.** 이 저장소는 문턱을 자료에 맞춰 정해 왔지만
 * (종격 65%), 여기서 잴 자료는 아직 없다 — 첫 테스터가 실제로 얼마나 누르는지 본 뒤에
 * 정한다. 지금 이 값이 하는 일은 품질 판정이 아니라 **비용을 막는 빗장**이고, 그
 * 사실을 이름과 주석에 적어 둔다. 값을 옮길 때 무엇을 근거로 옮기는지 잊지 않게.
 */
create or replace function public.reading_rate_limit()
returns integer
language sql
immutable
as $$ select 20 $$;

/**
 * 한 시도가 도는 것으로 치는 시간.
 *
 * 이보다 오래된 `running` 은 끝나지 못한 것으로 본다 — 서버가 죽으면 그 행을 닫을
 * 사람이 없어서, 재지 않으면 그 대상이 영영 잠긴다.
 */
create or replace function public.reading_run_timeout()
returns interval
language sql
immutable
as $$ select interval '10 minutes' $$;

/**
 * 결과 생성 요청을 시작한다.
 *
 * @returns 새 시도와 **그 시도가 쓸 판본.** 같은 열쇠로 이미 시작했거나 **같은 대상에
 *   아직 도는 시도가 있으면 0행**이다 — 그때 부르는 쪽은 모델을 부르지 말고 현재
 *   결과를 읽어야 한다.
 *
 * **두 번 교체를 막는 것은 뒤의 조건이다.** 두 번 누르거나 두 창에서 함께 눌러도
 * 모델은 한 번만 불리고 현재 결과도 한 번만 바뀐다(ADR 0013). 열쇠는 안정된 값을 들고
 * 오는 쪽이 생길 때를 위해 받아 둔다.
 *
 * **판본을 내주는 것이 요점이다.** 앱이 「어떤 판본으로 만들까」를 스스로 고르면
 * 저장할 때 확인하는 값과 만들 때 쓴 값이 서로 다른 자리에서 정해진다. 여기서 한 번
 * 정하고, 저장할 때 **그대로인지만** 본다.
 *
 * 볼 자격을 **여기서 먼저 묻는다.** 저장할 때 한 번 더 묻지만, 자격이 없는 대상으로
 * 모델을 부르는 일 자체가 없어야 비용과 근거 조립이 헛돌지 않는다.
 */
create or replace function public.start_reading_run(
  p_kind text,
  p_idempotency_key text,
  p_person_a uuid default null,
  p_person_b uuid default null,
  p_match_id uuid default null,
  p_model text default null,
  p_prompt_version text default null
)
returns table (
  run_id uuid,
  person_a uuid,
  person_b uuid,
  match_id uuid,
  revision_a uuid,
  revision_b uuid,
  viewer_is_first boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  scope record;
  existing uuid;
  recent integer;
  started uuid;
begin
  select * into scope
  from public.reading_scope(p_kind, p_person_a, p_person_b, p_match_id);

  -- 0행이 곧 거절이다. 없는 대상과 못 보는 대상을 여기서도 가르지 않는다.
  if not found then
    raise exception '결과를 만들 수 있는 대상이 아닙니다.' using errcode = 'check_violation';
  end if;

  /**
   * **줄을 세운다 — 「보고 나서 넣는」 것은 잠금이 아니다.**
   *
   * 처음에는 도는 시도가 있는지 **읽어 보고** 없으면 넣었다. 두 트랜잭션이 나란히
   * 읽으면 둘 다 「없다」를 보고 둘 다 넣는다 — 모델이 두 번 불리고 뒤의 글이 앞의
   * 글을 덮는다. 판본 저장이 Person 행을 잠그고 줄을 서는 것과 같은 자리다(ADR 0011).
   *
   * 두 자물쇠를 **언제나 같은 차례로** 잡는다(사람 → 대상). 차례가 갈리면 서로를
   * 기다리는 짝이 생긴다.
   */
  perform pg_advisory_xact_lock(hashtext('reading:user:' || (select auth.uid())::text));
  perform pg_advisory_xact_lock(hashtext(
    'reading:target:' || scope.kind
      || ':' || coalesce(scope.owner_user_id::text, '')
      || ':' || coalesce(scope.person_a::text, '')
      || ':' || coalesce(scope.person_b::text, '')
      || ':' || coalesce(scope.match_id::text, '')));

  /**
   * **끝나지 못한 시도를 여기서 닫는다.**
   *
   * 서버가 죽거나 플랫폼이 요청을 끊으면 그 행을 닫을 사람이 없다. 그냥 두면 그 대상이
   * 영영 잠기고, 더 나쁜 것은 **늦게 돌아온 첫 호출이 새 결과를 덮는 것**이다. 여는
   * 자리에서 닫아 두면 저장 쪽이 「이미 실패한 시도」를 거절할 근거를 갖는다.
   */
  update public.reading_run r
  set status = 'failed', failure_code = 'expired', finished_at = now()
  where r.status = 'running'
    and r.created_at <= now() - public.reading_run_timeout()
    and r.kind = scope.kind
    and r.person_a is not distinct from scope.person_a
    and r.person_b is not distinct from scope.person_b
    and r.match_id is not distinct from scope.match_id;

  select r.id into existing
  from public.reading_run r
  where r.user_id = (select auth.uid()) and r.idempotency_key = p_idempotency_key;

  -- 같은 열쇠로 이미 돌았다. 아무것도 시작하지 않고 0행으로 답한다.
  if existing is not null then
    return;
  end if;

  /**
   * **같은 대상에 도는 시도는 하나다 — 사람마다가 아니라 대상마다.**
   *
   * 처음에는 `user_id` 로도 좁혔다. 그러면 공유 궁합에서 **두 당사자가 서로의 시도를
   * 아예 못 본다** — 둘이 동시에 누르면 모델이 두 번 불리고 뒤의 글이 앞의 글을
   * 덮는다. 대상이 하나인데 잠금이 사람별이었던 것이다.
   */
  select r.id into existing
  from public.reading_run r
  where r.status = 'running'
    and r.created_at > now() - public.reading_run_timeout()
    and r.kind = scope.kind
    and r.person_a is not distinct from scope.person_a
    and r.person_b is not distinct from scope.person_b
    and r.match_id is not distinct from scope.match_id;

  if existing is not null then
    return;
  end if;

  select count(*) into recent
  from public.reading_run r
  where r.user_id = (select auth.uid())
    and r.created_at > now() - interval '1 hour';

  if recent >= public.reading_rate_limit() then
    raise exception '한 시간에 만들 수 있는 결과 수를 넘었습니다. 잠시 뒤에 다시 시도해 주세요.'
      using errcode = 'check_violation';
  end if;

  insert into public.reading_run (
    user_id, kind, person_a, person_b, match_id, idempotency_key, model, prompt_version
  )
  values (
    (select auth.uid()), scope.kind, scope.person_a, scope.person_b, scope.match_id,
    p_idempotency_key, p_model, p_prompt_version
  )
  returning id into started;

  return query select
    started, scope.person_a, scope.person_b, scope.match_id,
    scope.revision_a, scope.revision_b, scope.viewer_is_first;
end;
$$;

revoke execute on function public.start_reading_run(text, text, uuid, uuid, uuid, text, text)
  from anon, public;
grant execute on function public.start_reading_run(text, text, uuid, uuid, uuid, text, text)
  to authenticated;

/**
 * 시도가 실패했다 — **현재 결과는 건드리지 않는다.**
 *
 * 직전 성공 결과를 그대로 두는 것이 이 함수가 하는 일의 전부다(ADR 0013·0017). 실패한 요청이
 * 결과를 지우거나 비우면, 한 번 실패한 대상은 예전에 본 글까지 잃는다.
 */
create or replace function public.fail_reading_run(
  p_run_id uuid,
  p_failure_code text,
  p_failure_detail text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reading_run r
  set status = 'failed',
      failure_code = p_failure_code,
      -- 길면 자른다. 실패 이유를 못 적는 것보다 낫고, 어차피 원문은 여기 안 온다.
      failure_detail = left(p_failure_detail, 500),
      finished_at = now()
  where r.id = p_run_id
    and r.user_id = (select auth.uid())
    and r.status = 'running';

  if not found then
    raise exception '기록할 시도를 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.fail_reading_run(uuid, text, text) from anon, public;
grant execute on function public.fail_reading_run(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 저장 — **한 벌 전체를 원자적으로 교체하고, 부를 수 있는 것은 열쇠뿐이다**
-- ---------------------------------------------------------------------------

/**
 * 성공한 결과로 현재 Reading 을 교체한다.
 *
 * ## **열쇠만 부른다** — 이 구멍을 왜 뚫는가
 *
 * 처음에는 이 함수가 `authenticated` 에게 열려 있었다. 파이프라인이 사용자 JWT 로
 * 도니까 자연스러워 보였는데, **그것이 곧 브라우저가 이 문을 그대로 두드릴 수 있다는
 * 뜻**이다(ADR 0003 「이행」이 읽기에 대해 적은 것과 같은 말이 쓰기에도 참이다).
 * 그러면 로그인한 사람이 모델도 redaction 도 출력 검사도 건너뛰고 **임의의 글과 점수**를
 * 저장할 수 있다.
 *
 * 자기 것이면 자기를 속이는 것으로 끝나지만 **Match 는 다르다.** 상대가 그 글을
 * 「중립적인 AI 해석」으로 읽고 알림까지 받는다 — 안전 운영이 검증되기 전에는 열지
 * 않기로 한 대화 통로가 뒷문으로 생기는 것이다(`docs/prd.md` §6.1: 채팅은 다음 단계).
 *
 * 그래서 `service_role` 만 부른다. ADR 0006 이 「사용자 경로에 열쇠를 쓰지 않는다」고
 * 적었고 ADR 0010 이 그 예외를 하나 뚫었다. **이것이 두 번째 구멍이고, 모양은 앞의
 * 것과 같은 방식으로 못박는다.**
 *
 * - **인자가 `p_run_id` 하나로 대상을 정한다.** 앱은 kind 도 Person 도 Match 도 댈 수
 *   없다. 그 값들은 시도를 열 때 **사용자 JWT 로** 자격이 확인된 채 기록된 것이다 —
 *   `start_reading_run` 이 낸 행이 곧 **대상의 증표**다. 다만 자격은 임대하지 않는다 —
 *   저장 직전에 그 행의 `user_id` 로 현재 계정·엣지·차단 상태를 다시 묻는다.
 * - **사용자 id 를 넘기지 않는다.** 「이 사람입니다」를 앱이 대는 모양은 ADR 0004 가
 *   거부한 것이다.
 * - 판본은 받아서 **맞는지 확인만** 한다. 근거를 만든 판본이 무엇인지는 부르는 쪽만
 *   알지만, 그것이 지금도 맞는 판본인지는 여기서 판정한다.
 *
 * ## 늦게 돌아온 호출이 새 결과를 덮지 않는다
 *
 * 시도가 만료됐거나 **더 나중에 열린 시도가 있으면** 거절한다. 이것이 없으면 십 분 넘게
 * 지연된 첫 호출이 그 뒤에 성공한 글을 옛 글로 되돌린다.
 *
 * **거절하면서 그 시도를 닫지는 않는다.** 여기서 닫아 봐야 바로 뒤의 `raise` 가 그
 * `update` 를 되돌린다(한 트랜잭션이다) — 닫은 척만 하고 시도는 `running` 으로 남아
 * 그 대상이 만료까지 잠긴다. 닫는 일은 거절을 받은 쪽이 `fail_reading_run` 으로 한다.
 */
create or replace function public.save_reading(
  p_run_id uuid,
  p_revision_a uuid,
  p_revision_b uuid,
  p_output text,
  p_score smallint,
  p_evidence text,
  p_prompt text,
  p_prompt_version text,
  p_model text,
  p_generation jsonb,
  p_viewed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run record;
  pinned record;
  reading_id uuid;
  partner uuid;
begin
  -- 행을 잠그고 읽는다. 같은 시도로 두 번 저장하려는 길을 여기서 막는다.
  select * into run from public.reading_run r where r.id = p_run_id for update;

  if not found then
    raise exception '기록할 시도를 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if run.status <> 'running' then
    raise exception '이미 끝난 시도입니다.' using errcode = 'check_violation';
  end if;

  /**
   * **만료된 시도로는 저장하지 않는다.**
   *
   * 만료를 지나면 같은 대상에 새 시도가 열릴 수 있고, 그 새 시도가 이미 성공했을 수
   * 있다. 그때 늦게 돌아온 이 호출을 받아 주면 사용자가 방금 읽은 글이 옛 글로 되돌아간다.
   */
  if run.created_at <= now() - public.reading_run_timeout() then
    raise exception '만드는 데 너무 오래 걸려 이 결과는 저장하지 않았습니다.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.reading_run later
    where later.created_at > run.created_at
      and later.kind = run.kind
      and later.person_a is not distinct from run.person_a
      and later.person_b is not distinct from run.person_b
      and later.match_id is not distinct from run.match_id
  ) then
    raise exception '그 사이에 새 시도가 열려 이 결과는 저장하지 않았습니다.'
      using errcode = 'check_violation';
  end if;

  /**
   * **저장 직전에도 자격을 묻는다.** 시작할 때 자격이 있었다고 해서 만드는 동안 생긴
   * 차단·계정 중지를 무시하면 「새 접근과 접촉을 즉시 멈춘다」가 최대 십 분 늦어진다.
   * actor 는 앱이 대지 않고, 사용자 JWT 로 열린 시도 행에서만 읽는다.
   */
  select * into pinned
  from public.reading_scope_for(
    run.user_id, run.kind, run.person_a, run.person_b, run.match_id);

  if not found then
    raise exception '결과를 저장할 대상을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  /**
   * 만든 판본과 지금 판본이 갈렸다.
   *
   * 사용자가 글을 만드는 동안 출생정보를 고친 경우다. 그대로 저장하면 「지금 입력으로
   * 쓴 글」이라고 적힌 옛 글이 남는다. 저장하지 않고 그렇게 말한다 — 다시 누르면
   * 새 입력으로 만들어진다.
   */
  if pinned.revision_a is distinct from p_revision_a
     or pinned.revision_b is distinct from p_revision_b then
    raise exception '만드는 동안 출생정보가 바뀌었습니다. 새 입력으로 다시 만들어 주세요.'
      using errcode = 'check_violation';
  end if;

  update public.reading_run r
  set status = 'succeeded', finished_at = now(), model = p_model, prompt_version = p_prompt_version
  where r.id = p_run_id;

  insert into public.reading (
    kind, owner_user_id, match_id, person_a, person_b, revision_a, revision_b,
    output, score, evidence, prompt, prompt_version, model, generation, viewed_at
  )
  values (
    run.kind,
    -- 공유 결과에는 주인이 없다. 누가 눌렀든 양쪽이 같은 것을 본다.
    case when run.kind = 'match' then null else run.user_id end,
    run.match_id, run.person_a, run.person_b,
    p_revision_a, p_revision_b,
    p_output, p_score, p_evidence, p_prompt, p_prompt_version, p_model,
    coalesce(p_generation, '{}'::jsonb), p_viewed_at
  )
  on conflict (target_key) do update
  set revision_a = excluded.revision_a,
      revision_b = excluded.revision_b,
      output = excluded.output,
      score = excluded.score,
      evidence = excluded.evidence,
      prompt = excluded.prompt,
      prompt_version = excluded.prompt_version,
      model = excluded.model,
      generation = excluded.generation,
      viewed_at = excluded.viewed_at,
      created_at = now()
  returning id into reading_id;

  /**
   * Match 만 알린다 — **상대에게만.**
   *
   * 누른 사람은 결과를 그 자리에서 본다. 상대는 자기가 보던 공유 결과가 바뀐 것을
   * 알아야 하고, 그것이 이 알림이 있는 유일한 이유다.
   */
  if run.kind = 'match' then
    select case when m.user_low = run.user_id then m.user_high else m.user_low end
    into partner
    from public.match m where m.id = run.match_id;

    insert into public.notification (user_id, kind, match_id)
    values (partner, 'reading_ready', run.match_id);
  end if;

  return reading_id;
end;
$$;

/**
 * **열쇠 말고는 아무도 못 부른다** — `match_calculation_inputs` 와 같은 못이다.
 */
revoke execute on function public.save_reading(
  uuid, uuid, uuid, text, smallint, text, text, text, text, jsonb, timestamptz
) from anon, public, authenticated;
grant execute on function public.save_reading(
  uuid, uuid, uuid, text, smallint, text, text, text, text, jsonb, timestamptz
) to service_role;

-- ---------------------------------------------------------------------------
-- 알림함이 새 사건을 부를 수 있게 — **이름은 Match 로도 찾는다**
-- ---------------------------------------------------------------------------

/**
 * `reading_ready` 는 요청이 아니라 **Match** 에 매인다.
 *
 * 지금까지 알림은 전부 `match_request` 를 통해 상대를 찾았다. 새 사건은 요청을 들지
 * 않으므로 그 길로는 이름이 안 나오고, 알림함이 사람을 못 부르는 문장으로 선다.
 * 못 부르는 것과 **못 찾는 것**은 다르다 — 여기서는 찾을 수 있으므로 찾는다.
 *
 * 같은 이유로 좁힘도 넓힌다. 요청으로 매인 알림은 상대의 제재·거둠을 이미 보는데,
 * Match 로 매인 알림은 아무것도 안 봤다. **목록에서 숨긴 것은 알림함에서도 숨긴다** —
 * 차단으로 내려간 Match 의 통보가 알림함에만 남으면 눌러도 아무것도 없는 줄이 된다.
 */
create or replace function public.visible_notifications()
returns setof public.notification
language sql
stable
security definer
set search_path = ''
as $$
  select n.*
  from public.notification n
  left join public.match_request r on r.id = n.request_id
  left join public.app_user counterpart
    on counterpart.id = case
      when r.requester_user_id = (select auth.uid()) then r.addressee_user_id
      else r.requester_user_id end
  where n.user_id = (select auth.uid())
    and public.is_active_account()
    and (r.id is null or r.status <> 'cancelled')
    and (counterpart.id is null or counterpart.status = 'active')
    and (
      n.match_id is null
      or exists (select 1 from public.visible_matches() vm where vm.id = n.match_id)
    );
$$;

revoke execute on function public.visible_notifications() from anon, public, authenticated;

/**
 * 알림함 — **상대를 요청으로도 Match 로도 찾는다.**
 *
 * 문장은 여전히 여기서 나가지 않는다. 나가는 것은 사건의 종류와 별명뿐이다.
 */
create or replace function public.my_notifications()
returns table (
  notification_id uuid,
  kind text,
  counterpart_nickname text,
  request_id uuid,
  match_id uuid,
  created_at timestamptz,
  read_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    n.id,
    n.kind,
    coalesce(by_request.nickname, by_match.nickname),
    n.request_id,
    n.match_id,
    n.created_at,
    n.read_at
  from public.visible_notifications() n
  left join public.match_request r on r.id = n.request_id
  left join public.discovery_profile by_request
    on by_request.user_id = case
      when r.requester_user_id = (select auth.uid()) then r.addressee_user_id
      else r.requester_user_id end
  left join public.match m on m.id = n.match_id
  left join public.discovery_profile by_match
    on by_match.user_id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  order by n.created_at desc
  limit 50;
$$;

revoke execute on function public.my_notifications() from anon, public;
grant execute on function public.my_notifications() to authenticated;

-- ---------------------------------------------------------------------------
-- public 함수의 기본 문을 닫는다 — service_role 의 구멍은 정확히 둘이다
-- ---------------------------------------------------------------------------

/**
 * Postgres 함수는 만들면 `PUBLIC EXECUTE` 가 기본으로 붙는다. 역할에 직접 grant 하지
 * 않았다는 것만으로는 닫힌 것이 아니다 — `service_role` 도 PUBLIC 의 구성원이므로 그
 * 기본 권한을 통해 `claimed_by` 같은 내부 helper 를 부를 수 있었다.
 *
 * 이 마이그레이션까지 생긴 함수는 한 번 전부 닫는다. 앱에서 부르는 문은 앞선 파일들이
 * `anon`·`authenticated` 에 명시적으로 다시 열어 두었고, 열쇠에 직접 연 것은
 * `match_calculation_inputs` 와 `save_reading` 둘뿐이다. 앞으로 생길 함수도 닫힌 채로
 * 시작하게 기본 권한까지 바꾼다 — 새 문은 필요한 역할을 적어야만 열린다.
 */
revoke execute on all functions in schema public from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
