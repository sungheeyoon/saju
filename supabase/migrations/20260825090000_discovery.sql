-- discovery — 후보 노출
--
-- ADR 0003 이 정한 것: `discovery-v0` 는 오행 두 축으로 **정렬만** 하고, 하드 제외는
-- 사주와 무관하고 근거가 또렷한 것뿐이다. 여기서 거는 것은 그 하드 제외와, 두 축이
-- 기대는 자료다. 가중치·섞기·문장은 `src/lib/discovery` 가 든다.

-- ---------------------------------------------------------------------------
-- 오행 요약 — **참여할 때 매칭 풀에 내놓는 것**
-- ---------------------------------------------------------------------------

/**
 * 왜 요약을 저장하는가 — 세 가지가 한꺼번에 참이라 다른 길이 없다.
 *
 * 1. 후보의 **출생 원문은 브라우저로 나가면 안 된다**(ADR 0008). 그런데 Supabase
 *    RPC 는 로그인한 사람이 직접 부를 수 있으므로, 「서버만 부른다」는 약속은 코드에
 *    적을 수 있을 뿐 지켜지지 않는다. RPC 가 내주는 것이 곧 브라우저가 볼 수 있는 것이다.
 * 2. **DB 는 명식을 계산할 수 없다.** 절기·자시·경도 판정이 TypeScript 엔진에 있다.
 * 3. `service_role` 은 사용자 경로에 쓰지 않는다(ADR 0006). 그 키로 읽기 시작하면
 *    「무엇을 볼 수 있는가」의 답이 정책이 아니라 앱 코드로 옮겨 간다.
 *
 * 그래서 **참여자가 자기 요약을 풀에 내놓는다.** 명식을 저장하는 것이 아니다
 * (ADR 0001) — 다섯 오행의 개수와 비중뿐이고, **어느 판본에서 나온 것인지**를 함께
 * 든다. 지금 판본의 것이 아니면 후보가 아니다(아래 `discovery_candidates`).
 * 그래서 이 값은 조용히 낡을 수 없다.
 *
 * 참여를 끄면 요약도 거둔다. 「참여 중단」과 「자료 보관」이 갈리면 사용자가 무엇을
 * 껐는지 알 수 없다.
 */
create table public.discovery_profile (
  -- 기본값이 `auth.uid()` 라 남의 이름으로 행을 만들 수 없다. 정책도 같은 것을 묻는다.
  user_id uuid primary key default auth.uid() references public.app_user (id) on delete cascade,

  /**
   * 공개용 별명 — **부를 이름(`local_label`)도 Person 입력도 아니다.**
   *
   * 「엄마」는 내가 그 사람을 부르는 말이고 후보 카드에 설 이름이 아니다(US 28).
   */
  nickname text not null check (length(btrim(nickname)) between 1 and 12),
  intro text check (intro is null or length(btrim(intro)) between 1 and 300),

  /**
   * 사주와 무관한 명시적 조건(US 29).
   *
   * MVP 에는 성별 하나다. **나이는 여기 없다** — 연령 자격은 `Person.birthDate` 가
   * 아니라 별개의 본인확인을 근거로 한다(ADR 0005). 거리도 없다(범위 밖).
   */
  prefer_gender text not null default 'any' check (prefer_gender in ('female', 'male', 'any')),

  /** 참여는 **사건**이다 — 켠 시각을 든다. `null` 이면 참여하지 않는다 */
  opted_in_at timestamptz,

  /** 매칭 풀에 내놓은 오행 요약과, 그것이 나온 판본 */
  element_summary jsonb,
  element_revision_id uuid references public.person_chart_revision (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 참여 중인데 요약이 없는 상태를 만들지 않는다. 그런 참여자는 후보 질의에서
  -- 조용히 사라지고, 사용자는 참여 중이라고 알고 있다.
  constraint opted_in_needs_summary
    check (opted_in_at is null or (element_summary is not null and element_revision_id is not null))
);

/**
 * 요약의 **모양**을 DB 가 본다.
 *
 * 값을 앱이 계산해 넣으므로 손으로 지어낸 값이 들어올 수 있다. 막을 수 있는 것은
 * 「그럴듯한 모양」까지다 — 다섯 오행이 다 있고, 개수는 음이 아닌 정수이고, 합이 글자
 * 수(여덟, 시간 미상이면 여섯)와 같고, 비중의 합이 1이다. 이 조건을 다 만족하는 거짓
 * 요약은 **생년월일시를 거짓으로 넣어도 만들 수 있는 것**이라, 여기서 새로 열리는
 * 거짓말은 없다.
 */
create or replace function public.is_element_summary(summary jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select summary is not null
     and jsonb_typeof(summary -> 'counts') = 'object'
     and jsonb_typeof(summary -> 'ratios') = 'object'
     and jsonb_typeof(summary -> 'glyphCount') = 'number'
     and (summary ->> 'glyphCount')::int in (6, 8)
     and (
       select bool_and(coalesce(jsonb_typeof(summary -> 'counts' -> e), 'missing') = 'number')
          and bool_and(coalesce((summary -> 'counts' ->> e)::numeric, -1) >= 0)
          and bool_and((summary -> 'counts' ->> e)::numeric = floor((summary -> 'counts' ->> e)::numeric))
          and sum((summary -> 'counts' ->> e)::numeric) = (summary ->> 'glyphCount')::int
       from unnest(array['木', '火', '土', '金', '水']) as e
     )
     and (
       select bool_and(coalesce(jsonb_typeof(summary -> 'ratios' -> e), 'missing') = 'number')
          and bool_and(coalesce((summary -> 'ratios' ->> e)::numeric, -1) >= 0)
          and abs(sum((summary -> 'ratios' ->> e)::numeric) - 1) < 0.001
       from unnest(array['木', '火', '土', '金', '水']) as e
     );
$$;

alter table public.discovery_profile
  add constraint element_summary_has_shape
  check (element_summary is null or public.is_element_summary(element_summary));

create or replace function public.touch_discovery_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger discovery_profile_touched
before update on public.discovery_profile
for each row execute function public.touch_discovery_profile();

-- ---------------------------------------------------------------------------
-- 다시 보지 않기 — 하드 제외 하나
-- ---------------------------------------------------------------------------

/**
 * 이 사람은 그만 보겠다는 표시. **차단이 아니다.**
 *
 * 차단은 양방향으로 접촉을 막는 별개의 일이고(용어집), 막을 접촉이 아직 없다 —
 * 요청도 Match 도 6단계에 온다. 두 말을 한 표에 담으면 한 낱말이 두 뜻을 갖는다.
 * **차단 표가 생기면 `discovery_candidates` 의 제외 목록에 한 줄이 는다.**
 */
create table public.discovery_hidden (
  user_id uuid not null default auth.uid() references public.app_user (id) on delete cascade,
  hidden_user_id uuid not null references public.app_user (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (user_id, hidden_user_id),
  constraint cannot_hide_self check (user_id <> hidden_user_id)
);

-- ---------------------------------------------------------------------------
-- 노출 기록 — 운영자가 정책을 평가하는 자리
-- ---------------------------------------------------------------------------

/**
 * 무엇을, 어떤 정책으로, 몇 번째 자리에, 탐색으로 보여줬는가(PRD).
 *
 * **사용자는 이 표를 읽지 못한다.** 후보의 오행 요약이 여기 함께 남는데, 그것을
 * 읽게 열어 주면 후보 카드에서 개수로만 말한 것이 이 표로 통째로 새어 나간다.
 * 쓰기만 열고(자기 것만), 읽기는 운영자가 SQL 로 한다.
 *
 * 요약 두 벌은 **DB 가 채운다** — 앱이 실어 보내면 그 값은 손으로 적은 값이 되고,
 * 노출 기록이 「그때 무엇이었나」가 아니라 「앱이 무엇이라고 했나」의 기록이 된다.
 */
create table public.discovery_impression (
  id uuid primary key default gen_random_uuid(),
  viewer_user_id uuid not null references public.app_user (id) on delete cascade,
  candidate_user_id uuid not null references public.app_user (id) on delete cascade,

  policy_version text not null,
  /** 0부터 — 화면의 차례 그대로 */
  position integer not null check (position >= 0),
  exploration boolean not null,

  /** 그때의 오행 요약 — 나중에 노출 쏠림을 되짚는 유일한 근거다 */
  viewer_summary jsonb not null,
  candidate_summary jsonb not null,

  /**
   * 그때의 추천 이유와 두 축 — **전부 DB 가 그 자리에서 계산한다.**
   *
   * 앱이 만든 문장을 실어 보내면 기록이 「그때 무엇이었나」가 아니라 「앱이 무엇이라고
   * 했나」가 된다. 자리와 탐색 여부만 앱이 정한 것이라 앱이 준다.
   */
  supplied_elements text[] not null,
  complement numeric not null,
  combined_balance numeric not null,

  shown_at timestamptz not null default now()
);

create index discovery_impression_by_candidate
  on public.discovery_impression (candidate_user_id, shown_at desc);

-- ---------------------------------------------------------------------------
-- 두 축 — **DB 안에서 난다**
-- ---------------------------------------------------------------------------

/**
 * 축을 왜 SQL 에 두는가.
 *
 * 후보의 오행 요약이 브라우저로 나가지 않으려면, RPC 가 내주는 것이 이미 잘린 값이어야
 * 한다. 벡터를 내주고 화면에서 접는 것은 접은 척일 뿐이다(ADR 0008).
 *
 * **셈은 `match-v0` 의 같은 축과 같아야 한다**(`src/lib/matching/index.ts` 의
 * `coverageOf` · `combinedBalanceOf`). 두 언어에 하나씩 적혀 있으므로 갈릴 수 있다 —
 * 그래서 양쪽 시험이 **같은 입력에 같은 기대값**을 든다. 한쪽만 고치면 다른 쪽이 깨진다.
 */
create or replace function public.discovery_complement_one_way(mine jsonb, partner jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  with missing as (
    select e from unnest(array['木', '火', '土', '金', '水']) as e
    where (mine -> 'counts' ->> e)::numeric = 0
  )
  select case
    -- 빠진 오행이 없다는 것은 상대가 채울 몫도 없다는 뜻이다. 완벽한 궁합으로 올리지
    -- 않고 중립값에 둔다. `match-v0` 의 제품 선택이며 명리 규칙이 아니다.
    when (select count(*) from missing) = 0 then 70
    else (
      select count(*) filter (where (partner -> 'counts' ->> e)::numeric > 0) * 100.0 / count(*)
      from missing
    )
  end;
$$;

/** 자리 대칭 — 어느 쪽을 먼저 넣든 같은 값이 나온다 */
create or replace function public.discovery_complement(a jsonb, b jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select (public.discovery_complement_one_way(a, b) + public.discovery_complement_one_way(b, a)) / 2;
$$;

/** 두 분포를 합쳐 다섯 축이 얼마나 고른가 — 각 20% 로부터의 거리 합을 1.6 으로 정규화 */
create or replace function public.discovery_combined_balance(a jsonb, b jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select (1 - sum(abs(((a -> 'ratios' ->> e)::numeric + (b -> 'ratios' ->> e)::numeric) / 2 - 0.2)) / 1.6) * 100
  from unnest(array['木', '火', '土', '金', '水']) as e;
$$;

/**
 * 내게 없는 오행 중 **상대가 가진 것** — 후보 카드가 이름을 부르고 뜻을 붙인다.
 *
 * 개수만 내면 카드가 「무엇을 채우는지」를 말하지 못한다. 그 이름은 추천에 직접 필요한
 * 값이라 공개하고, 상대의 **전체 구성(개수표)** 은 여전히 내주지 않는다(ADR 0003).
 */
create or replace function public.discovery_supplied_elements(mine jsonb, partner jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(e order by e), array[]::text[])
  from unnest(array['木', '火', '土', '金', '水']) as e
  where (mine -> 'counts' ->> e)::numeric = 0
    and (partner -> 'counts' ->> e)::numeric > 0;
$$;

-- ---------------------------------------------------------------------------
-- 권한 — 열어 주는 것만 연다
-- ---------------------------------------------------------------------------

revoke all on public.discovery_profile, public.discovery_hidden, public.discovery_impression
  from anon, authenticated;

-- 자기 프로필은 읽고, **별명·소개·선호만** 고친다. 참여 상태와 요약은 RPC 가 옮긴다 —
-- 참여한 시각을 사용자가 적으면 그것은 사건의 기록이 아니다.
grant select on public.discovery_profile to authenticated;
grant insert (nickname, intro, prefer_gender) on public.discovery_profile to authenticated;
grant update (nickname, intro, prefer_gender) on public.discovery_profile to authenticated;

grant select, insert, delete on public.discovery_hidden to authenticated;

-- 노출 기록은 **아무에게도 열지 않는다.** 쓰기도 definer RPC 안에서만 일어난다.

alter table public.discovery_profile enable row level security;
alter table public.discovery_hidden enable row level security;
alter table public.discovery_impression enable row level security;

create policy "내 프로필만 보인다"
on public.discovery_profile for select to authenticated
using (user_id = (select auth.uid()));

create policy "내 프로필만 만든다"
on public.discovery_profile for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "내 프로필만 고친다"
on public.discovery_profile for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "내가 감춘 사람만 보인다"
on public.discovery_hidden for select to authenticated
using (user_id = (select auth.uid()));

create policy "내 목록에만 감춘다"
on public.discovery_hidden for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "내가 감춘 것만 되돌린다"
on public.discovery_hidden for delete to authenticated
using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 참여를 켜고 끈다
-- ---------------------------------------------------------------------------

/**
 * 매칭 참여 — **켜는 것과 요약을 내놓는 것이 한 사건이다.**
 *
 * 나눠 두면 「참여 중인데 풀에 아무것도 없는」 상태가 실재하고, 그 사용자는 참여했다고
 * 알고 있는데 아무에게도 안 보인다.
 *
 * 끄면 요약을 거둔다. 참여 중단과 자료 보관이 갈리면 사용자가 무엇을 껐는지 모른다.
 * 자기 Person 과 판본은 그대로다(US 59) — 거두는 것은 풀에 내놓은 요약뿐이다.
 */
create or replace function public.set_discovery_participation(p_on boolean, p_summary jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  current_revision uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if not p_on then
    update public.discovery_profile
    set opted_in_at = null, element_summary = null, element_revision_id = null
    where user_id = actor;
    return false;
  end if;

  -- 사주가 없으면 후보가 될 수 없다. 오행 요약이 나올 데가 없기 때문이다.
  if account.self_person_id is null then
    raise exception '먼저 내 사주를 등록해 주세요.' using errcode = '23502';
  end if;

  if not exists (select 1 from public.discovery_profile where user_id = actor) then
    raise exception '먼저 공개용 별명을 정해 주세요.' using errcode = '23502';
  end if;

  select current_revision_id into current_revision
  from public.person where id = account.self_person_id;

  if current_revision is null then
    raise exception '저장된 출생정보를 찾지 못했습니다.' using errcode = '23502';
  end if;

  if not public.is_element_summary(p_summary) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  update public.discovery_profile
  set opted_in_at = coalesce(opted_in_at, now()),
      element_summary = p_summary,
      element_revision_id = current_revision
  where user_id = actor;

  return true;
end;
$$;

/**
 * 판본이 바뀌면 요약도 따라간다.
 *
 * **참여 중일 때만 움직인다.** 참여하지 않는 사람의 출생정보 수정이 조용히 풀에
 * 요약을 올려 두면, 켠 적 없는 참여가 생긴다. 참여 중이 아니면 아무 일도 하지 않는다.
 *
 * 낡은 요약은 후보 질의가 이미 걸러낸다. 그래도 여기서 따라가게 하는 것은, 걸러지는
 * 것이 **조용한 탈락**이기 때문이다 — 사용자는 참여 중이라고 알고 있는데 아무에게도
 * 안 보이게 된다.
 */
create or replace function public.refresh_discovery_summary(p_person_id uuid, p_summary jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  self_person uuid;
  current_revision uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if (select status from public.app_user where id = actor) <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  select self_person_id into self_person from public.app_user where id = actor;

  -- 내 사주가 아니면 아무 일도 아니다. 가족·친구를 고쳤다고 내 노출이 바뀌지 않는다.
  if self_person is null or self_person is distinct from p_person_id then
    return false;
  end if;

  if not exists (
    select 1 from public.discovery_profile where user_id = actor and opted_in_at is not null
  ) then
    return false;
  end if;

  if not public.is_element_summary(p_summary) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  select current_revision_id into current_revision from public.person where id = self_person;

  update public.discovery_profile
  set element_summary = p_summary, element_revision_id = current_revision
  where user_id = actor;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 후보 — 하드 제외는 여기서 끝난다
-- ---------------------------------------------------------------------------

/**
 * 내가 볼 수 있는 후보와, 두 축의 값.
 *
 * **참여하지 않으면 아무도 못 본다.** 풀은 서로 내놓은 사람들의 자리다 — 내놓지 않고
 * 보기만 하는 길을 열면, 참여가 뜻하는 것이 사람마다 달라진다.
 *
 * 하드 제외는 **사주와 무관한 것뿐**이다(ADR 0003): 자기 자신, 미참여, 중지된 계정,
 * 낡은 요약, 다시 보지 않기로 한 상대, 양쪽이 직접 설정한 성별 조건.
 * **차단 표가 생기면 여기 한 줄이 는다**(6단계).
 *
 * 점수로 자르는 자리는 없다. `p_limit` 은 정렬이 아니라 **한 번에 읽을 양의 상한**이고
 * 200 을 넘기지 못한다(아래).
 */
create or replace function public.discovery_candidates(p_limit integer default 200)
returns table (
  candidate_user_id uuid,
  nickname text,
  intro text,
  complement numeric,
  combined_balance numeric,
  supplied_for_viewer text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  me public.discovery_profile;
  my_gender text;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if (select status from public.app_user where id = actor) <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  select * into me from public.discovery_profile where user_id = actor;

  if me.opted_in_at is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  -- 낡은 요약으로는 남을 줄 세우지 않는다. 내 쪽이 낡았으면 내 목록도 성립하지 않는다.
  if me.element_revision_id is distinct from (
    select p.current_revision_id from public.app_user u
    join public.person p on p.id = u.self_person_id
    where u.id = actor
  ) then
    raise exception '내 오행 요약이 지금 판본의 것이 아닙니다.' using errcode = '55000';
  end if;

  select r.gender into my_gender
  from public.person_chart_revision r where r.id = me.element_revision_id;

  return query
  select
    other.user_id,
    other.nickname,
    other.intro,
    public.discovery_complement(me.element_summary, other.element_summary),
    public.discovery_combined_balance(me.element_summary, other.element_summary),
    public.discovery_supplied_elements(me.element_summary, other.element_summary)
  from public.discovery_profile other
  join public.app_user u on u.id = other.user_id
  join public.person p on p.id = u.self_person_id
  join public.person_chart_revision r on r.id = other.element_revision_id
  where other.user_id <> actor
    and other.opted_in_at is not null
    and u.status = 'active'
    -- 요약이 지금 판본의 것인가. 아니면 후보가 아니다 — 조용히 낡은 값으로 세우지 않는다.
    and other.element_revision_id = p.current_revision_id
    and not exists (
      select 1 from public.discovery_hidden h
      where h.user_id = actor and h.hidden_user_id = other.user_id
    )
    -- 양쪽이 직접 설정한 조건을 **둘 다** 본다. 내 조건 밖의 사람을 안 보는 것과,
    -- 나를 조건 밖으로 둔 사람에게 안 보이는 것은 같은 규칙의 두 얼굴이다.
    and (me.prefer_gender = 'any' or r.gender = me.prefer_gender)
    and (other.prefer_gender = 'any' or other.prefer_gender = my_gender)
  /**
   * **상한은 부르는 쪽이 못 늘린다.**
   *
   * `p_limit` 은 정렬이 아니라 한 번에 읽을 양의 상한이다. 클라이언트가 그대로 부를 수
   * 있으므로 위를 잠근다 — 안 잠그면 한 번의 호출로 풀 전체를 긁어 갈 수 있다.
   * 풀이 이 수에 닿기 시작하면 그때는 줄 세우기를 SQL 로 내리거나 재현 가능한 쪽수를
   * 만들어야 한다. 지금 잘리는 차례는 아무 뜻이 없기 때문이다.
   */
  limit least(greatest(p_limit, 1), 200);
end;
$$;

/**
 * 무엇을 보여줬는지 남긴다.
 *
 * 앱이 주는 것은 **자리와 탐색 여부 둘**뿐이다. 그 둘은 정렬이 앱에서 일어나므로 앱만
 * 아는 값이고, 나머지(오행 요약 두 벌·채우는 오행·두 축)는 **DB 가 그 자리에서
 * 계산한다.** 앱이 실어 보내면 기록이 「그때 무엇이었나」가 아니라 「앱이 무엇이라고
 * 했나」가 되고, 애초에 앱은 후보의 요약을 받지도 않는다.
 *
 * **후보 id 를 그대로 믿지 않는다.** 이 함수는 로그인한 사람이 직접 부를 수 있으므로,
 * 아무 사람이나 적어 넣으면 남의 노출 기록이 지어진다. 그래서 `discovery_candidates` —
 * 화면에 무엇이 설 수 있는지를 정하는 **같은 함수** — 에 다시 물어서, 지금 내 후보인
 * 사람만 남긴다. 자격을 두 곳에 적으면 언젠가 한쪽만 고쳐진다.
 */
create or replace function public.log_discovery_impressions(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  written integer;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if (select status from public.app_user where id = actor) <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.discovery_profile where user_id = actor and opted_in_at is not null
  ) then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception '노출 기록의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  with shown as (
    select
      (row ->> 'candidateUserId')::uuid as candidate_user_id,
      (row ->> 'position')::int as position,
      (row ->> 'exploration')::boolean as exploration
    from jsonb_array_elements(p_rows) as row
    -- 한 번에 남길 수 있는 양의 상한. 한 화면이 이보다 길 수 없다.
    limit 100
  ),
  eligible as (
    -- **화면이 묻는 것과 같은 함수에 묻는다.** 지금 내 후보가 아닌 사람은 안 남는다.
    select candidate_user_id from public.discovery_candidates(200)
  )
  insert into public.discovery_impression (
    viewer_user_id, candidate_user_id, policy_version, position, exploration,
    viewer_summary, candidate_summary, supplied_elements, complement, combined_balance
  )
  select
    actor,
    shown.candidate_user_id,
    'discovery-v0',
    shown.position,
    shown.exploration,
    mine.element_summary,
    theirs.element_summary,
    public.discovery_supplied_elements(mine.element_summary, theirs.element_summary),
    public.discovery_complement(mine.element_summary, theirs.element_summary),
    public.discovery_combined_balance(mine.element_summary, theirs.element_summary)
  from shown
  join eligible on eligible.candidate_user_id = shown.candidate_user_id
  join public.discovery_profile mine on mine.user_id = actor
  join public.discovery_profile theirs on theirs.user_id = shown.candidate_user_id
  where shown.position between 0 and 999
    and shown.exploration is not null;

  get diagnostics written = row_count;
  return written;
end;
$$;

revoke execute on function public.set_discovery_participation(boolean, jsonb) from anon, public;
grant execute on function public.set_discovery_participation(boolean, jsonb) to authenticated;

revoke execute on function public.refresh_discovery_summary(uuid, jsonb) from anon, public;
grant execute on function public.refresh_discovery_summary(uuid, jsonb) to authenticated;

revoke execute on function public.discovery_candidates(integer) from anon, public;
grant execute on function public.discovery_candidates(integer) to authenticated;

revoke execute on function public.log_discovery_impressions(jsonb) from anon, public;
grant execute on function public.log_discovery_impressions(jsonb) to authenticated;

grant execute on function public.is_element_summary(jsonb) to authenticated;
