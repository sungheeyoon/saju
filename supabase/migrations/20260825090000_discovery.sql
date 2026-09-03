-- discovery — 후보 노출
--
-- ADR 0003 이 정한 것: `discovery-v0` 는 오행 두 축으로 **정렬만** 하고, 하드 제외는
-- 사주와 무관하고 근거가 또렷한 것뿐이다. 여기서 거는 것은 그 하드 제외와, 두 축이
-- 기대는 자료다. 축·가중치·섞기·기록은 `discovery_board()` 가 한 번에 하고,
-- `src/lib/discovery` 는 같은 정책의 선언과 사용자에게 보일 문장을 든다.

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
 * 든다. 지금 판본의 것이 아니면 후보가 아니다(아래 `discovery_board`).
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
 * **차단 표가 생기면 `discovery_board` 의 제외 목록에 한 줄이 는다.**
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
 * 무엇을, 어떤 정책으로, 몇 번째 자리에, 탐색으로 보여줬는가(`prd-archive`).
 *
 * **사용자는 이 표를 읽지 못한다.** 후보의 오행 요약이 여기 함께 남는데, 그것을
 * 읽게 열어 주면 후보 카드가 말하지 않는 전체 오행 개수표가 통째로 새어 나간다.
 * 쓰기와 읽기 모두 닫고, `discovery_board()` 와 운영자 SQL 만 이 표를 다룬다.
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
   * 했나」가 된다. 후보·자리·탐색 여부까지 `discovery_board()` 가 정한 값을 그대로 남긴다.
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
  /**
   * **순서를 문자열 정렬에 맡기지 않는다.**
   *
   * `order by e` 는 데이터베이스의 collation 이 정하는 차례라 서버마다 다르게 나온다
   * (실제로 土→木→水→火→金 으로 나오는 자리가 있다). 오행에는 정해진 차례가 있고
   * (木→火→土→金→水) 화면이 그 차례로 읽으므로, `with ordinality` 로 **적어 둔 차례**
   * 를 그대로 붙들어 정렬한다.
   */
  select coalesce(array_agg(e order by ord), array[]::text[])
  from unnest(array['木', '火', '土', '金', '水']) with ordinality as t(e, ord)
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
using (user_id = (select auth.uid()) and public.is_active_account());

create policy "내 프로필만 만든다"
on public.discovery_profile for insert to authenticated
with check (user_id = (select auth.uid()) and public.is_active_account());

create policy "내 프로필만 고친다"
on public.discovery_profile for update to authenticated
using (user_id = (select auth.uid()) and public.is_active_account())
with check (user_id = (select auth.uid()));

create policy "내가 감춘 사람만 보인다"
on public.discovery_hidden for select to authenticated
using (user_id = (select auth.uid()) and public.is_active_account());

create policy "내 목록에만 감춘다"
on public.discovery_hidden for insert to authenticated
with check (user_id = (select auth.uid()) and public.is_active_account());

create policy "내가 감춘 것만 되돌린다"
on public.discovery_hidden for delete to authenticated
using (user_id = (select auth.uid()) and public.is_active_account());

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

  if not public.is_active_account() then
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
-- 후보 — **고르는 일과 남기는 일이 한 함수 안에서 끝난다**
-- ---------------------------------------------------------------------------

/** 균형 값을 세 칸으로 — 숫자를 내보내지 않으므로 이 경계가 곧 사용자가 보는 차이다 */
create or replace function public.discovery_balance_band(combined_balance numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when combined_balance >= 70 then 'even'
    when combined_balance >= 50 then 'mixed'
    else 'skewed'
  end;
$$;

/**
 * 지금 내 후보와, 그 후보를 보여줬다는 기록.
 *
 * **고르는 일과 남기는 일을 나누지 않는다.** 나눠 두면 「무엇을 보여줄까」와 「무엇을
 * 보여줬다고 적을까」가 서로 다른 신뢰 경계에 놓인다 — 앞의 것은 DB 가 정하는데 뒤의
 * 것은 앱이 적게 되고, 그 앱은 브라우저에서 그대로 부를 수 있다. 자리·탐색 여부·후보
 * 목록을 손으로 적을 자리가 **아예 없어야** 위조가 불가능하다.
 *
 * 그래서 이 함수 하나가 다 한다: 하드 제외 → 두 축 → 줄 세우기 → 탐색 배치 → 기록 →
 * 안전한 카드. 부르는 쪽이 넣을 인자는 **하나도 없다.**
 *
 * **참여하지 않으면 아무도 못 본다.** 풀은 서로 내놓은 사람들의 자리다 — 내놓지 않고
 * 보기만 하는 길을 열면 참여가 뜻하는 것이 사람마다 달라진다.
 *
 * 하드 제외는 **사주와 무관한 것뿐**이다(ADR 0003): 자기 자신, 미참여, 중지된 계정,
 * 낡은 요약, 다시 보지 않기로 한 상대, 양쪽이 직접 설정한 성별 조건.
 * **차단 표가 생기면 여기 한 줄이 는다**(6단계).
 *
 * 나가는 것은 카드에 설 값뿐이다 — 두 축의 숫자도 가중합도 반환형에 없다.
 * 82점과 79점은 절대적인 궁합 차이로 읽히고, 그러면서 「순서는 좋고 나쁨이 아니다」라고
 * 적어 봐야 아무도 안 믿는다.
 */
create or replace function public.discovery_board()
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
  my_prefer text;
  my_revision uuid;
  my_gender text;
  opted timestamptz;
  seed_text text;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.prefer_gender, p.element_revision_id, p.opted_in_at
    into my_summary, my_prefer, my_revision, opted
  from public.discovery_profile p where p.user_id = actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  -- 낡은 요약으로는 남을 줄 세우지 않는다. 내 쪽이 낡았으면 내 목록도 성립하지 않는다.
  if my_revision is distinct from (
    select p.current_revision_id from public.app_user u
    join public.person p on p.id = u.self_person_id
    where u.id = actor
  ) then
    raise exception '내 오행 요약이 지금 판본의 것이 아닙니다.' using errcode = '55000';
  end if;

  select r.gender into my_gender
  from public.person_chart_revision r where r.id = my_revision;

  /**
   * 씨앗은 **나와 오늘**이고, 둘 다 DB 가 정한다.
   *
   * 부르는 쪽에서 받으면 씨앗을 바꿔 가며 탐색 자리를 다시 뽑을 수 있고, 그러면 노출
   * 기록이 무엇을 잰 것인지 말할 수 없게 된다. 날짜가 바뀌면 새로 섞인다.
   */
  seed_text := actor::text || ':' || to_char((now() at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD');

  return query
  with pool as (
    select
      other.user_id,
      other.nickname,
      other.intro,
      public.discovery_complement(my_summary, other.element_summary) as complement,
      public.discovery_combined_balance(my_summary, other.element_summary) as balance,
      public.discovery_supplied_elements(my_summary, other.element_summary) as supplied
    from public.discovery_profile other
    join public.app_user u on u.id = other.user_id
    join public.person p on p.id = u.self_person_id
    join public.person_chart_revision r on r.id = other.element_revision_id
    where other.user_id <> actor
      and other.opted_in_at is not null
      and u.status = 'active'
      -- 요약이 지금 판본의 것인가. 아니면 후보가 아니다 — 낡은 값으로 줄 세우지 않는다.
      and other.element_revision_id = p.current_revision_id
      and not exists (
        select 1 from public.discovery_hidden h
        where h.user_id = actor and h.hidden_user_id = other.user_id
      )
      -- 양쪽이 직접 설정한 조건을 **둘 다** 본다. 내 조건 밖의 사람을 안 보는 것과,
      -- 나를 조건 밖으로 둔 사람에게 안 보이는 것은 같은 규칙의 두 얼굴이다.
      and (my_prefer = 'any' or r.gender = my_prefer)
      and (other.prefer_gender = 'any' or other.prefer_gender = my_gender)
  ),
  ranked as (
    -- 가중치는 `discovery-v0` 의 값이다(`src/lib/discovery` 가 같은 수를 선언하고
    -- 시험이 양쪽을 잰다). 동점이면 id 로 가른다 — 안 그러면 읽어 온 차례가 순위인
    -- 척 따라 나간다.
    select
      pool.*,
      complement * 0.54 + balance * 0.46 as score,
      row_number() over (
        order by complement * 0.54 + balance * 0.46 desc, pool.user_id
      ) as rank
    from pool
  ),
  sizes as (
    -- 한 번에 열 명. 탐색은 **실제로 채워지는 자리**의 20% 다 — `10` 에 걸면 후보가
    -- 둘뿐인 날 목록이 통째로 탐색이 되고, 「정렬했다」는 말이 화면에서 거짓이 된다.
    select
      least(count(*), 10)::int as wanted,
      floor(least(count(*), 10)::int * 0.2)::int as explorers,
      least(count(*), 10)::int - floor(least(count(*), 10)::int * 0.2)::int as tops
    from ranked
  ),
  explorers as (
    -- 상위 밖에서만 뽑는다. 상위 안에서 뽑으면 어차피 보일 사람을 탐색이라 부르는 것이라
    -- 아무것도 탐색하지 않는다. 윈도 함수의 `order by` 는 번호를 매길 뿐 결과 행의
    -- 순서를 보장하지 않으므로, `limit` 앞에도 같은 정렬을 명시한다.
    select ranked.*, row_number() over (
      order by md5(seed_text || ranked.user_id::text), ranked.user_id
    ) as ei
    from ranked, sizes
    where ranked.rank > sizes.tops
    order by md5(seed_text || ranked.user_id::text), ranked.user_id
    limit (select explorers from sizes)
  ),
  slots as (
    -- 섞는 자리는 고르게 벌린다. 뒤에 붙이면 아무도 거기까지 안 내려가고, 앞에 몰면
    -- 목록의 첫인상이 탐색이 된다.
    select
      i as ei,
      (floor((i * sizes.wanted)::numeric / (sizes.explorers + 1))::int - 1) as at
    from sizes, generate_series(1, sizes.explorers) as i
  ),
  seats as (
    select
      s.idx,
      slots.ei,
      (slots.ei is not null) as is_exploration,
      sum(case when slots.ei is null then 1 else 0 end)
        over (order by s.idx rows between unbounded preceding and current row) as top_index
    from sizes, generate_series(0, sizes.wanted - 1) as s(idx)
    left join slots on slots.at = s.idx
  ),
  placed as (
    select
      seats.idx,
      seats.is_exploration,
      case when seats.is_exploration then e.user_id else t.user_id end as user_id,
      case when seats.is_exploration then e.nickname else t.nickname end as nickname,
      case when seats.is_exploration then e.intro else t.intro end as intro,
      case when seats.is_exploration then e.supplied else t.supplied end as supplied,
      case when seats.is_exploration then e.complement else t.complement end as complement,
      case when seats.is_exploration then e.balance else t.balance end as balance
    from seats
    left join explorers e on seats.is_exploration and e.ei = seats.ei
    left join ranked t on not seats.is_exploration and t.rank = seats.top_index
  ),
  /**
   * **보여준 그 목록을 그대로 남긴다.**
   *
   * 자리도 탐색 여부도 위에서 방금 정해진 값이라 손으로 적을 자리가 없다. 오행 요약
   * 두 벌과 추천 이유·두 축도 여기서 계산된 것을 그대로 쓴다. 자료를 바꾸는 CTE 는
   * 바깥 질의가 읽지 않아도 언제나 끝까지 실행된다.
   */
  logged as (
    insert into public.discovery_impression (
      viewer_user_id, candidate_user_id, policy_version, position, exploration,
      viewer_summary, candidate_summary, supplied_elements, complement, combined_balance
    )
    select
      actor, placed.user_id, 'discovery-v0', placed.idx, placed.is_exploration,
      my_summary, theirs.element_summary, placed.supplied, placed.complement, placed.balance
    from placed
    join public.discovery_profile theirs on theirs.user_id = placed.user_id
    returning 1
  )
  select
    placed.user_id,
    placed.nickname,
    placed.intro,
    placed.idx,
    placed.is_exploration,
    placed.supplied,
    public.discovery_balance_band(placed.balance)
  from placed
  order by placed.idx;
end;
$$;

revoke execute on function public.set_discovery_participation(boolean, jsonb) from anon, public;
grant execute on function public.set_discovery_participation(boolean, jsonb) to authenticated;

revoke execute on function public.refresh_discovery_summary(uuid, jsonb) from anon, public;
grant execute on function public.refresh_discovery_summary(uuid, jsonb) to authenticated;

revoke execute on function public.discovery_board() from anon, public;
grant execute on function public.discovery_board() to authenticated;

/**
 * **내부 계산 함수는 아무도 직접 부르지 못한다.**
 *
 * 두 축과 추천 이유는 `discovery_board` 가 자기 안에서 쓰는 셈이다. 밖으로 열어 두면
 * 「반환형에 숫자를 안 넣었다」가 아무 뜻이 없어진다 — 로그인한 사람이 요약 두 벌을
 * 넣어 직접 부르면 되기 때문이다. 요약 자체는 자기 것 말고는 읽을 수 없지만, 열어 둘
 * 이유가 없는 문은 닫는다.
 *
 * `definer` 함수 안에서는 함수 소유자로 돌므로 `discovery_board` 는 이들을 그대로 부른다.
 */
revoke execute on function public.discovery_complement_one_way(jsonb, jsonb) from anon, public, authenticated;
revoke execute on function public.discovery_complement(jsonb, jsonb) from anon, public, authenticated;
revoke execute on function public.discovery_combined_balance(jsonb, jsonb) from anon, public, authenticated;
revoke execute on function public.discovery_supplied_elements(jsonb, jsonb) from anon, public, authenticated;
revoke execute on function public.discovery_balance_band(numeric) from anon, public, authenticated;

/**
 * **`is_element_summary` 만은 예외다** — 계산이 아니라 표가 스스로 거는 검사식이라서다.
 *
 * 검사식 안의 함수는 **넣는 사람의 권한으로** 실행된다. 닫아 두면 프로필을 만드는
 * 평범한 insert 가 「permission denied for function」으로 죽는다(재어 봤다). 여는 것이
 * 새로 드러내는 것도 없다 — 이미 손에 든 값의 모양을 되묻는 함수다.
 */
grant execute on function public.is_element_summary(jsonb) to authenticated;
