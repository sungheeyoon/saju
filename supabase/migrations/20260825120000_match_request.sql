-- 요청 · 동의 · Match — 「함께 보자」가 성립하는 자리
--
-- 두 파일이 이 자리를 비워 두고 있었다. `20260824170000_revise_chart.sql` 은
-- 「MatchRequest 표가 생기는 마이그레이션이 이 자리에 무효화 한 줄을 더한다」고 적었고,
-- `20260825090000_discovery.sql` 은 「차단 표가 생기면 제외 목록에 한 줄이 는다」고 적었다.
-- 여기서 그 둘을 채운다.
--
-- 이 단계가 만드는 것은 **접근 근거**이지 결과 화면이 아니다. 상세 궁합과 `match-v0`
-- 공유 결과는 다음 단계다(`prd-archive` 7). Match 가 먼저 있어야 그 화면이 무엇에 기대는지
-- 말할 수 있다.

-- ---------------------------------------------------------------------------
-- 차단 — 「다시 보지 않기」와 다른 말이다
-- ---------------------------------------------------------------------------

/**
 * 접촉을 끊는다. `discovery_hidden`(다시 보지 않기)과 **다른 표이고 다른 뜻**이다.
 *
 * 다시 보지 않기는 내 목록에서 치우는 일이라 한쪽에만 작용하고 **되돌릴 수 있다**.
 * 차단은 양쪽으로 작용하고 **되돌리지 않는다**(용어집) — 상대의 목록에서도 내가
 * 사라지고, 살아 있던 요청이 그 자리에서 거둬진다. 한 표에 담으면 한 낱말이 두 뜻을 갖는다.
 *
 * 그래서 이 표에는 **지우는 문이 없다.** 「푸는 길이 없다」를 화면 문구로만 두면
 * 언젠가 그 문구를 지나가는 경로가 하나 생긴다.
 */
create table public.block (
  user_id uuid not null references public.app_user (id) on delete cascade,
  blocked_user_id uuid not null references public.app_user (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (user_id, blocked_user_id),
  constraint cannot_block_self check (user_id <> blocked_user_id)
);

-- ---------------------------------------------------------------------------
-- MatchRequest — 「그때 그 사주」에 대한 요청
-- ---------------------------------------------------------------------------

/**
 * 한쪽이 「상세 궁합을 함께 보자」고 청한 사건.
 *
 * **판본 둘을 잡는다.** 동의는 사람에 대한 것이 아니라 그 시점의 계산 입력에 대한
 * 것이다(ADR 0004). 어느 한쪽의 Evidence 가 바뀌면 이 요청은 무효가 된다 — 동의한
 * 대상과 실제 계산 대상이 갈리기 때문이다.
 *
 * **추천 이유도 함께 잡는다.** 「왜 이 사람인가」를 나중에 되짚으려면 그때 무엇을
 * 보고 눌렀는지가 남아 있어야 한다. 그 값은 앱이 실어 보내지 않는다 — `request_match`
 * 가 노출 기록과 지금 요약에서 그 자리에서 만든다(`discovery_impression` 과 같은 규율).
 */
create table public.match_request (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.app_user (id) on delete cascade,
  addressee_user_id uuid not null references public.app_user (id) on delete cascade,

  /**
   * 다섯이 최소 집합이다(`prd-archive`).
   *
   * `invalidated` 와 `cancelled` 는 둘 다 「성립하지 않았다」지만 **누가 거뒀는지가
   * 다르다** — 앞은 입력이 바뀌어서고 뒤는 요청자가 스스로다. 한 값으로 합치면
   * 사용자에게 「왜 사라졌는지」를 말해 줄 수 없다(US 43).
   */
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'invalidated', 'cancelled')),

  -- 요청이 잡은 두 판본. 수락 순간 다시 확인한다(US 44).
  requester_revision_id uuid not null references public.person_chart_revision (id),
  addressee_revision_id uuid not null references public.person_chart_revision (id),

  /**
   * 무엇을 보고 눌렀는가 — 노출 기록에 매인다.
   *
   * 노출→요청→수락을 한 줄로 이을 수 있어야 `discovery-v0` 를 평가할 수 있다(US 64).
   * 기록이 지워져도 요청은 남아야 하므로 `set null` 이다.
   */
  impression_id uuid references public.discovery_impression (id) on delete set null,
  policy_version text not null,

  /**
   * 채우는 오행 **양쪽 방향**.
   *
   * 후보 카드는 한 방향뿐이다(내게 없는 것 중 상대가 가진 것). 동의 화면은 받는 쪽이
   * 읽으므로 그 사람 방향의 값이 있어야 한다 — 없으면 화면이 요청자의 이유를 대신
   * 읽어 주게 되고, 그건 받는 쪽에게 아무 뜻이 없다.
   *
   * 새로 열리는 것은 없다. 참여를 켤 때 「상대의 카드에도 같은 방식으로 내 오행이
   * 몇 글자 나타납니다」라고 이미 적었다(`DISCOVERY_DISCLOSURE`).
   */
  supplied_to_requester text[] not null,
  supplied_to_addressee text[] not null,
  balance_band text not null,

  created_at timestamptz not null default now(),
  decided_at timestamptz,

  /**
   * 두 사람을 **차례와 무관하게** 한 쌍으로 부르는 값.
   *
   * 「A→B 와 B→A 가 동시에 살아 있지 않다」를 인덱스로 걸려면 방향을 지운 키가 필요하다.
   * 앱이 계산해 넣으면 잊을 수 있는 자리가 생기므로 DB 가 만든다.
   */
  pair_low uuid generated always as (
    case when requester_user_id < addressee_user_id then requester_user_id else addressee_user_id end
  ) stored,
  pair_high uuid generated always as (
    case when requester_user_id < addressee_user_id then addressee_user_id else requester_user_id end
  ) stored,

  constraint cannot_request_self check (requester_user_id <> addressee_user_id),
  -- 정해졌으면 정해진 시각이 있다. 둘이 갈리면 상태가 언제 바뀌었는지 못 말한다.
  constraint decided_when_not_pending check ((status = 'pending') = (decided_at is null))
);

/**
 * **두 사람 사이에 살아 있는 결정은 하나다.**
 *
 * `prd-archive` 는 pending 하나를 요구한다. 여기서 `accepted` 와 `rejected` 까지 묶는 것은
 * 제품 결정이다 — 수락된 쌍에 또 요청할 이유가 없고, **거절한 사람에게 다시 두드리는
 * 길을 우리가 열지 않는다.** 거절은 되돌리지 않는다.
 *
 * `invalidated` 와 `cancelled` 는 묶지 않는다. 입력이 바뀌어 무효가 된 요청은 새 입력으로
 * 다시 청할 수 있어야 하고, 스스로 거둔 요청도 그렇다.
 */
create unique index one_live_request_between_two
  on public.match_request (pair_low, pair_high)
  where status in ('pending', 'accepted', 'rejected');

create index match_request_by_addressee on public.match_request (addressee_user_id, created_at desc);
create index match_request_by_requester on public.match_request (requester_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Match — 합의로 생긴 접근 근거
-- ---------------------------------------------------------------------------

/**
 * 양쪽이 궁합을 함께 보기로 합의해 성립한 관계.
 *
 * **`UserPersonAccess` 와 다른 갈래다**(용어집). 「내가 등록했다」와 「우리가 합의했다」를
 * 값으로 갈라 두지 않으면 나중에 「이 사람이 왜 내 목록에 있지」를 되짚을 수 없다.
 * 그래서 Match 는 `user_person_access` 에 아무 행도 만들지 않는다(US 46) — 스무 명
 * 한도가 세는 것도 저쪽이다.
 *
 * **Match 가 주는 것은 범위가 정해진 접근이다**(ADR 0008). 이 행은 상대 Person 을
 * 통째로 여는 열쇠가 아니다. 무엇이 나가는지는 여는 함수가 정한다.
 *
 * 판본 둘을 든다. 나중에 어느 입력에 대한 합의였는지 되짚어야 하고, 그 뒤에 입력이
 * 바뀌어도 이 Match 와 과거 Reading 은 지우지 않는다(`prd-archive`).
 */
create table public.match (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.match_request (id) on delete cascade,

  -- 한 쌍에 하나. 차례를 고정해 두 방향이 두 행이 되지 않게 한다.
  user_low uuid not null references public.app_user (id) on delete cascade,
  user_high uuid not null references public.app_user (id) on delete cascade,
  low_revision_id uuid not null references public.person_chart_revision (id),
  high_revision_id uuid not null references public.person_chart_revision (id),

  created_at timestamptz not null default now(),

  constraint pair_is_ordered check (user_low < user_high),
  unique (user_low, user_high)
);

-- ---------------------------------------------------------------------------
-- 앱 내 알림 — 사건이 일어났다는 통보
-- ---------------------------------------------------------------------------

/**
 * 로그인해서 앱을 열었을 때만 보이는 통보(용어집). 외부 통보는 공개 매칭과 함께 온다.
 *
 * **문구는 여기 없다.** 사건의 종류와 무엇에 대한 것인지만 든다 — 문장은 `src/lib/consent`
 * 가 짓는다. 여기에 완성된 문장을 저장하면 말을 고칠 때 과거 알림이 옛 문장으로 남고,
 * 상대의 별명이 바뀌면 알림이 옛 이름을 부른다.
 *
 * `reading_ready` · `reading_failed` 는 아직 없다(`prd-archive` 8단계). 지금 일어나지 않는 사건을
 * 검사식에 미리 적어 두면, 그 값이 실제로 쓰이는 날 아무도 여기를 다시 보지 않는다.
 */
create table public.notification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user (id) on delete cascade,

  kind text not null check (kind in (
    'request_received', 'request_accepted', 'request_rejected', 'request_invalidated'
  )),

  request_id uuid references public.match_request (id) on delete cascade,
  match_id uuid references public.match (id) on delete cascade,

  created_at timestamptz not null default now(),
  /** 읽은 **시각**. 사용자가 적지 않는다 — 읽음은 사건이다 */
  read_at timestamptz
);

create index notification_by_user on public.notification (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 권한 — 열어 주는 것만 연다
-- ---------------------------------------------------------------------------

revoke all on public.block, public.match_request, public.match, public.notification
  from anon, authenticated;

/**
 * 차단 목록은 **읽기만** 열린다.
 *
 * 거는 일은 표에 한 줄 넣는 것으로 끝나지 않는다 — 살아 있던 요청을 함께 거둬야 하고,
 * 그 둘이 갈리면 「차단했는데 상대의 요청은 그대로 떠 있는」 상태가 실재한다. 그래서
 * 넣는 길은 RPC 하나뿐이다. **푸는 길은 아예 없다**(용어집: 차단은 되돌리지 않는다).
 *
 * 읽기를 여는 것은 화면이 「몇 명을 차단했는지」를 말하기 위해서다. 누구인지는 말하지
 * 않는다 — 차단한 뒤에는 그 사람의 프로필을 읽을 이유가 없다.
 */
grant select on public.block to authenticated;

/**
 * 요청·Match·알림은 **한 줄도 직접 안 보인다.**
 *
 * 화면이 필요로 하는 것에는 언제나 상대의 별명이 붙는데, `discovery_profile` 의 정책은
 * 자기 행만 연다. 표를 열어 주려면 그 정책부터 넓혀야 하고, 그러면 참여자 전원의 프로필이
 * 서로에게 열린다. 그래서 읽기도 `definer` 함수로만 나간다 — **그 함수가 내주는 것이
 * 곧 브라우저가 볼 수 있는 것이다.**
 */

alter table public.block enable row level security;
alter table public.match_request enable row level security;
alter table public.match enable row level security;
alter table public.notification enable row level security;

create policy "내가 차단한 사람만 보인다"
on public.block for select to authenticated
using (user_id = (select auth.uid()) and public.is_active_account());

-- `match_request` · `match` · `notification` 에는 정책이 없다. 정책이 없는 표는
-- `authenticated` 에게 닫혀 있다 — 위의 `revoke` 와 함께, 이 표들에 닿는 길은 아래
-- 함수들뿐이라는 뜻이다.

-- ---------------------------------------------------------------------------
-- 「지금 이 두 사람은 서로 후보가 아니다」 — 한 자리
-- ---------------------------------------------------------------------------

/**
 * 사주와 **무관한** 하드 제외를 한 함수가 든다(ADR 0003).
 *
 * 세 곳이 같은 질문을 한다: 후보 목록, 요청 만들기, 그리고 앞으로 생길 자리. 조건을
 * 세 곳에 적으면 언젠가 한쪽만 고쳐지고, 그때 열려 있는 쪽은 언제나 더 바깥이다
 * (`may_add_revision` 과 같은 규율).
 *
 * 여기 있는 것은 전부 **근거가 또렷한 것**이다 — 내가 치웠거나, 어느 쪽이 차단했거나,
 * 이미 살아 있는 결정이 둘 사이에 있거나. 사주 값으로 자르는 조건은 하나도 없다.
 */
create or replace function public.discovery_unavailable(actor uuid, other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.discovery_hidden h
      where h.user_id = actor and h.hidden_user_id = other
    )
    or exists (
      select 1 from public.block b
      where (b.user_id = actor and b.blocked_user_id = other)
         or (b.user_id = other and b.blocked_user_id = actor)
    )
    or exists (
      select 1 from public.match_request r
      where r.status in ('pending', 'accepted', 'rejected')
        and ((r.requester_user_id = actor and r.addressee_user_id = other)
          or (r.requester_user_id = other and r.addressee_user_id = actor))
    );
$$;

-- 밖에서 부를 자리가 없다. 두 사람의 uuid 를 받아 참·거짓을 내주는 문을 열어 두면
-- 「저 둘 사이에 요청이 있나」를 남이 물을 수 있게 된다.
revoke execute on function public.discovery_unavailable(uuid, uuid) from anon, public, authenticated;

/**
 * **「지금 이 둘은 서로 후보인가」 — 한 함수가 답한다.**
 *
 * `discovery_unavailable` 은 쌍에 걸린 것(감춤·차단·살아 있는 결정)만 들었고, 나머지
 * 자격 — 참여 중인가, 계정이 살아 있는가, 요약이 지금 판본인가, **양쪽이 직접 설정한
 * 성별 조건에 서로 맞는가** — 는 후보 질의의 `where` 절에만 있었다.
 *
 * 그래서 요청 쪽이 그 조건을 빠뜨렸다. 상대가 성별 조건을 바꿔 내 목록에서 사라진
 * 뒤에도 **어제 남은 노출 기록으로 청할 수 있었다**(재어 봤다 — 변경 전 후보 1명,
 * 변경 후 0명인데 요청은 성공했다). US 29 가 무너지는 자리이고, 「좁힘을 통과하지 않은
 * 요청이 들어올 수 있으면 좁힘이 아무 뜻이 없다」는 이 ADR 자신의 말이 거짓이 된다.
 *
 * 규칙을 두 곳에 적는 대신 함수 하나를 두고 둘 다 부른다(`may_add_revision` 과 같은
 * 규율). 두 곳에 적으면 언젠가 한쪽만 고쳐지고, 열려 있는 쪽은 언제나 더 바깥이다.
 *
 * 여기 있는 것은 **전부 사주와 무관한 것**이다(ADR 0003). 사주 값으로 자르는 조건은
 * 하나도 없다.
 */
create or replace function public.discovery_eligible(viewer uuid, other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer is not null
     and other is not null
     and viewer <> other
     and not public.discovery_unavailable(viewer, other)
     and exists (
       select 1
       from public.discovery_profile mine
       join public.app_user mu on mu.id = mine.user_id
       join public.person mp on mp.id = mu.self_person_id
       join public.person_chart_revision mr on mr.id = mine.element_revision_id
       join public.discovery_profile theirs on theirs.user_id = other
       join public.app_user tu on tu.id = theirs.user_id
       join public.person tp on tp.id = tu.self_person_id
       join public.person_chart_revision tr on tr.id = theirs.element_revision_id
       where mine.user_id = viewer
         -- 둘 다 참여 중이어야 한다. 내놓지 않고 보기만 하는 길은 없다.
         and mine.opted_in_at is not null
         and theirs.opted_in_at is not null
         -- 둘 다 살아 있는 계정이어야 한다.
         and mu.status = 'active'
         and tu.status = 'active'
         -- 둘 다 요약이 지금 판본의 것이어야 한다. 낡은 값으로 줄 세우지 않는다.
         and mine.element_revision_id = mp.current_revision_id
         and theirs.element_revision_id = tp.current_revision_id
         -- 양쪽이 직접 설정한 조건을 **둘 다** 본다. 내 조건 밖의 사람을 안 보는 것과
         -- 나를 조건 밖으로 둔 사람에게 안 보이는 것은 같은 규칙의 두 얼굴이다.
         and (mine.prefer_gender = 'any' or tr.gender = mine.prefer_gender)
         and (theirs.prefer_gender = 'any' or mr.gender = theirs.prefer_gender)
     );
$$;

revoke execute on function public.discovery_eligible(uuid, uuid) from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 한 쌍을 잠근다 — **검사와 쓰기 사이에 아무도 끼어들지 못하게**
-- ---------------------------------------------------------------------------

/**
 * 두 사람의 계정 행을 **차례를 고정해** 잠근다.
 *
 * 자격을 묻고 나서 쓰는 함수가 셋이다(`request_match` · `block_user` ·
 * `invalidate_pending_requests`). 잠그지 않으면 그 사이가 열려 있다 — 차단이 살아 있던
 * 요청을 다 거둔 **직후에** 요청 하나가 들어오면, 차단된 쌍에 pending 이 남는다.
 * 재어 봤다: 검사와 insert 사이에 차단을 끼워 넣으니 그대로 재현됐다. 판본 수정이
 * pending 을 무효로 만드는 자리도 같은 종류의 틈이 있었다.
 *
 * **차례를 고정하는 것이 핵심이다.** 두 자리에서 반대 차례로 잠그면 서로를 기다린다.
 * 언제나 작은 id 를 먼저 잡는다. 두 손잡이를 잡은 뒤에야 `match_request` 행을 만지므로,
 * 잠그는 차례가 어디서나 같다.
 *
 * 계정 행을 쓰는 것은 그 행이 **이미 있는 것**이고(`create_self_person` 도 자기 행을
 * 이렇게 잠근다), 없는 사람을 잠그려 해도 아무 일도 일어나지 않기 때문이다 — 존재를
 * 묻는 문이 되지 않는다.
 */
create or replace function public.lock_users(a uuid, b uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.app_user u where u.id = least(a, b) for update;
  perform 1 from public.app_user u where u.id = greatest(a, b) for update;
end;
$$;

revoke execute on function public.lock_users(uuid, uuid) from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 요청을 만든다 — **후보로 본 적 있는 사람에게만**
-- ---------------------------------------------------------------------------

/**
 * 상세 궁합을 함께 보자고 청한다.
 *
 * **인자는 상대 하나뿐이다.** 판본도 추천 이유도 정책 버전도 이 함수가 그 자리에서
 * 읽는다 — 앱이 실어 보내면 그 값은 손으로 적은 값이 되고, 이 RPC 는 로그인한 사람이
 * 브라우저에서 그대로 부를 수 있다(`discovery_board` 와 같은 규율).
 *
 * **노출 기록에 매인다.** 후보로 한 번도 뜨지 않은 사람에게는 청할 수 없다. 그래야
 * 「후보 카드만 본 것은 궁합 동의가 아니다」의 반대편 — 요청은 후보를 본 데서 나온다 —
 * 이 값으로 성립하고, 남의 uuid 를 주워 아무에게나 두드리는 길이 닫힌다.
 *
 * **거절의 말이 하나다.** 없는 사람, 참여하지 않는 사람, 차단한 사람, 이미 결정이 있는
 * 사람, 후보로 본 적 없는 사람이 **모두 같은 문장**을 받는다. 갈라서 말하면 이 함수가
 * 「저 사람이 이 서비스를 쓰나」를 묻는 문이 된다.
 */
create or replace function public.request_match(p_candidate_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_revision uuid;
  their_summary jsonb;
  their_revision uuid;
  shown public.discovery_impression;
  new_request uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if p_candidate_user_id is null or p_candidate_user_id = actor then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  /**
   * **묻기 전에 잠근다.**
   *
   * 자격을 다 확인하고 나서 insert 하는 사이에 차단이나 판본 수정이 끝나면, 그 둘이
   * 이미 훑고 지나간 뒤에 pending 하나가 새로 생긴다. 그 요청은 아무도 거두지 않는다.
   */
  perform public.lock_users(actor, p_candidate_user_id);

  /**
   * **잠근 뒤에 나를 다시 본다.**
   *
   * 위의 `is_active_account()` 는 잠그기 **전에** 물은 것이라, 그 사이에 운영자의 제재가
   * 커밋되면 중지된 계정이 요청을 만든다. 잠금을 얻은 뒤의 이 질문은 새 스냅숏으로
   * 도므로 방금 커밋된 상태를 본다.
   */
  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  -- 내 쪽 자격은 갈라서 말한다. 내가 고칠 수 있는 것이고, 이유를 모르면 못 고친다.
  select p.element_summary, p.element_revision_id into my_summary, my_revision
  from public.discovery_profile p
  where p.user_id = actor and p.opted_in_at is not null;

  if my_summary is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if my_revision is distinct from (
    select pe.current_revision_id from public.app_user u
    join public.person pe on pe.id = u.self_person_id
    where u.id = actor
  ) then
    raise exception '내 오행 요약이 지금 판본의 것이 아닙니다.' using errcode = '55000';
  end if;

  /**
   * 상대 쪽은 **한 문장으로만** 거절하고, 자격은 후보 목록과 **같은 함수**에 묻는다.
   *
   * 여기에 조건을 다시 적으면 그 목록이 좁힌 것과 이 문이 좁히는 것이 갈린다 —
   * 실제로 성별 조건 하나가 그렇게 빠져 있었다.
   */
  if not public.discovery_eligible(actor, p_candidate_user_id) then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  select p.element_summary, p.element_revision_id into their_summary, their_revision
  from public.discovery_profile p
  where p.user_id = p_candidate_user_id;

  /**
   * **내가 본 그 카드**를 찾는다 — 그 사람이 아니라.
   *
   * 노출 기록만 있으면 된다고 두면, 어제 본 카드로 오늘의 요청을 만들 수 있다. 그 사이
   * 어느 쪽 요약이 바뀌었으면 **화면에서 읽은 이유와 요청에 남는 이유가 갈린다** — 재어
   * 봤다: 후보 요약을 바꾼 뒤 청하니 기록의 이유는 `{木}`, 요청의 이유는 `{}` 였고
   * 둘이 같은 기록을 가리키고 있었다. ADR 0009 의 「그때 무엇을 보고 눌렀나」가 그
   * 자리에서 깨진다.
   *
   * 그래서 **요약 두 벌이 지금과 같은 기록**만 고른다. 없으면 청할 수 없다 — 후보
   * 목록을 다시 열면 새 기록이 남고, 그때 청하면 된다. 요약이 낡은 사람은 애초에 목록에
   * 서지 않으므로, 다시 열어서 보이면 그 사람은 지금의 그 사람이다.
   */
  select i.* into shown
  from public.discovery_impression i
  where i.viewer_user_id = actor
    and i.candidate_user_id = p_candidate_user_id
    and i.viewer_summary = my_summary
    and i.candidate_summary = their_summary
  order by i.shown_at desc
  limit 1;

  if their_summary is null or shown.id is null then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  /**
   * 추천 이유는 **기록에서 그대로 꺼낸다.**
   *
   * 지금 요약으로 다시 셈해도 값은 같다(요약이 같은 기록만 골랐으므로). 그래도 기록에서
   * 꺼내는 것은, 「화면이 보여준 값」과 「요청이 든 값」이 **같은 한 벌에서 나왔다**는 것을
   * 코드가 스스로 말하게 하려는 것이다. 반대 방향만 같은 두 요약에서 새로 센다.
   */
  insert into public.match_request (
    requester_user_id, addressee_user_id,
    requester_revision_id, addressee_revision_id,
    impression_id, policy_version,
    supplied_to_requester, supplied_to_addressee, balance_band
  )
  values (
    actor, p_candidate_user_id,
    my_revision, their_revision,
    shown.id, shown.policy_version,
    shown.supplied_elements,
    public.discovery_supplied_elements(shown.candidate_summary, shown.viewer_summary),
    public.discovery_balance_band(shown.combined_balance)
  )
  returning id into new_request;

  insert into public.notification (user_id, kind, request_id)
  values (p_candidate_user_id, 'request_received', new_request);

  return new_request;

exception
  -- 같은 쌍에 살아 있는 결정이 이미 있다. 잠금이 이 자리를 좁혔지만, 남겨 둔다 —
  -- 유일 인덱스가 마지막 방어선이고 그때도 **같은 문장**이어야 한다.
  when unique_violation then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
end;
$$;

-- ---------------------------------------------------------------------------
-- 답한다 — 수락·거절·무효가 한 트랜잭션에서 갈린다
-- ---------------------------------------------------------------------------

/**
 * 받은 요청에 답한다.
 *
 * **수락 순간 판본을 다시 본다**(US 44). 요청이 잡아 둔 판본과 지금 판본이 다르면
 * 수락이 아니라 무효다 — 무효화와 수락이 동시에 일어나면 동의한 대상과 계산 대상이
 * 갈린 Match 가 남는다. 확인·전이·Match 생성·알림이 한 트랜잭션인 이유다.
 *
 * **이미 정해진 요청은 다시 정하지 않는다.** 두 번 눌렸거나 재전송된 요청은 지금 상태를
 * 그대로 돌려준다 — 중복 수락이 Match 를 둘로 만들지 않는다(`match.request_id` 가
 * `unique` 인 것과 함께 두 겹이다).
 */
create or replace function public.respond_to_match_request(p_request_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  req public.match_request;
  requester_now uuid;
  addressee_now uuid;
  new_match uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  /**
   * **`null` 은 답이 아니다.**
   *
   * `if not p_accept` 는 `null` 일 때 참이 아니므로 거절 갈래를 지나 **수락으로
   * 떨어졌다**(재어 봤다 — `null` 을 넘겨 Match 가 만들어졌다). 명시적 동의 경계에서
   * 「모름」이 「예」로 읽히면 안 된다. 답을 안 정한 호출은 여기서 멈춘다.
   */
  if p_accept is null then
    raise exception '수락인지 거절인지 정해 주세요.' using errcode = '22004';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  /**
   * **읽고 → 잠그고 → 다시 읽는다.**
   *
   * 잠그는 차례를 고정하려면 상대가 누구인지 먼저 알아야 하는데, 그것을 알려면 요청을
   * 읽어야 한다. 그래서 한 번 읽어 상대를 알아낸 뒤 두 계정을 정해진 차례로 잠그고,
   * 요청을 **다시** 읽는다 — 그 사이에 상태가 바뀌었을 수 있기 때문이다.
   *
   * 계정을 먼저, 요청을 나중에 잠근다. `block_user` 도 같은 차례라 서로 기다리지 않는다.
   */
  select * into req from public.match_request where id = p_request_id;

  -- 없는 요청과 남의 요청의 답이 **같다.**
  if not found or req.addressee_user_id <> actor then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  perform public.lock_users(req.requester_user_id, actor);

  select * into req from public.match_request where id = p_request_id for update;

  if not found or req.addressee_user_id <> actor then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  if req.status <> 'pending' then
    return req.status;
  end if;

  /**
   * **양쪽 계정이 살아 있어야 한다.**
   *
   * 내 상태만 물었더니 **제재된 사람의 Match 가 만들어졌다**(재어 봤다). 「계정 제재는
   * 새 접근과 접촉을 중단한다」(`prd-archive`)는 받는 쪽에만 거는 규칙이 아니다. 상대가 중지됐다는
   * 것은 알리지 않는다 — 없는 요청과 같은 문장을 낸다.
   */
  if exists (
    select 1 from public.app_user u
    where u.id in (req.requester_user_id, req.addressee_user_id) and u.status <> 'active'
  ) then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  select pe.current_revision_id into requester_now
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = req.requester_user_id;

  select pe.current_revision_id into addressee_now
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = req.addressee_user_id;

  if requester_now is distinct from req.requester_revision_id
     or addressee_now is distinct from req.addressee_revision_id
  then
    update public.match_request
    set status = 'invalidated', decided_at = now()
    where id = req.id;

    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_invalidated', req.id),
           (req.addressee_user_id, 'request_invalidated', req.id);

    return 'invalidated';
  end if;

  if p_accept is not true then
    update public.match_request
    set status = 'rejected', decided_at = now()
    where id = req.id;

    -- 거절은 요청한 쪽에만 알린다. 내가 거절했다는 것은 내가 안다.
    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_rejected', req.id);

    return 'rejected';
  end if;

  update public.match_request
  set status = 'accepted', decided_at = now()
  where id = req.id;

  insert into public.match (
    request_id, user_low, user_high, low_revision_id, high_revision_id
  )
  values (
    req.id,
    least(req.requester_user_id, req.addressee_user_id),
    greatest(req.requester_user_id, req.addressee_user_id),
    case when req.requester_user_id < req.addressee_user_id
      then req.requester_revision_id else req.addressee_revision_id end,
    case when req.requester_user_id < req.addressee_user_id
      then req.addressee_revision_id else req.requester_revision_id end
  )
  returning id into new_match;

  -- 성립은 **양쪽 다** 알아야 하는 사건이다.
  insert into public.notification (user_id, kind, request_id, match_id)
  values (req.requester_user_id, 'request_accepted', req.id, new_match),
         (req.addressee_user_id, 'request_accepted', req.id, new_match);

  return 'accepted';
end;
$$;

/**
 * 보낸 요청을 거둔다.
 *
 * **알리지 않는다.** 요청자가 스스로 거둔 것이라 상대가 할 일이 없고, 알림으로 다시
 * 두드리면 「보냈다 거뒀다」로 상대를 부를 수 있게 된다. 받은 쪽 목록에서는 그냥 사라진다.
 */
create or replace function public.cancel_match_request(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  req public.match_request;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into req from public.match_request where id = p_request_id for update;

  if not found or req.requester_user_id <> actor then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  if req.status <> 'pending' then
    return req.status;
  end if;

  update public.match_request
  set status = 'cancelled', decided_at = now()
  where id = req.id;

  return 'cancelled';
end;
$$;

-- ---------------------------------------------------------------------------
-- 입력이 바뀌면 pending 이 무효가 된다
-- ---------------------------------------------------------------------------

/**
 * ADR 0004 가 정한 것의 이행 — **Evidence 를 바꾸는 수정만** 요청을 무효화한다.
 *
 * 이 함수는 판본이 실제로 쌓였을 때만 불린다(`add_person_revision` 은 지문이 같으면
 * 아무것도 쌓지 않는다). 그래서 이름·메모를 고치는 것은 여기까지 오지 않는다 —
 * 「이름을 고쳤더니 요청이 사라졌다」는 일이 구조적으로 생기지 않는다(`prd-archive`).
 *
 * **판본을 쌓는 그 트랜잭션 안에서 돈다.** 나누면 그 사이에 낀 수락이 옛 판본으로
 * Match 를 만든다.
 */
create or replace function public.invalidate_pending_requests(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ended integer;
begin
  if p_user_id is null then
    return 0;
  end if;

  /**
   * **그 사람을 잠그고 훑는다.**
   *
   * 잠그지 않으면 이 update 가 지나간 **직후에** 그 사람에게 온 요청 하나가 새로 생길 수
   * 있고, 그 요청은 옛 판본을 가리킨 채 살아남는다. `request_match` 가 같은 손잡이를
   * 잡으므로 둘은 줄을 선다.
   */
  perform 1 from public.app_user u where u.id = p_user_id for update;

  with invalidated as (
    update public.match_request
    set status = 'invalidated', decided_at = now()
    where status = 'pending'
      and (requester_user_id = p_user_id or addressee_user_id = p_user_id)
    returning id, requester_user_id, addressee_user_id
  ),
  -- 양쪽 다 알아야 한다. 요청이 사라진 이유를 모르면 상대가 무시했다고 읽힌다(US 43).
  told as (
    insert into public.notification (user_id, kind, request_id)
    select side.user_id, 'request_invalidated', invalidated.id
    from invalidated,
      lateral (values (invalidated.requester_user_id), (invalidated.addressee_user_id))
        as side(user_id)
    returning 1
  )
  select count(*) into ended from invalidated;

  return ended;
end;
$$;

revoke execute on function public.invalidate_pending_requests(uuid) from anon, public, authenticated;

/**
 * `add_person_revision` 을 다시 쓴다 — **달라진 것은 마지막 한 줄뿐**이다.
 *
 * 되쓰는 바탕은 이 함수가 **마지막에 서 있던 판본**이지 그것을 처음 만든 파일이 아니다.
 * 처음 것을 베끼면 그 뒤에 다른 층에서 푼 것이 조용히 되감긴다(음력 입력이 그랬다 —
 * 재어 보고 알았다).
 *
 * 그 자리에 「MatchRequest 표가 생기면 여기 한 줄을 더한다」고 적어 두었다
 * (`20260824170000_revise_chart.sql`). 이제 그 표가 있다.
 *
 * 무효화되는 것은 **그 Person 을 자기 자신이라고 claim 한 User** 의 요청이다. 가족·친구
 * 판본을 고치는 것은 아무 요청과도 상관이 없다 — 후보가 되는 것은 selfPerson 뿐이다.
 */
create or replace function public.add_person_revision(
  p_person_id uuid,
  p_calendar text,
  p_original_date date,
  p_solar_date date,
  p_birth_time time,
  p_gender text,
  p_city text,
  p_late_night_rule text,
  p_time_basis text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_fingerprint text;
  next_fingerprint text;
  new_revision uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if (select status from public.app_user where id = actor) <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  -- 정책이 묻는 것과 **같은 함수**에 묻는다.
  if not public.may_add_revision(p_person_id, actor) then
    raise exception '이 사람의 출생정보를 고칠 수 없습니다.' using errcode = '42501';
  end if;

  -- 음력을 막던 줄은 여기 없다. `20260824210000_accept_lunar_input.sql` 이 변환표를
  -- KASI 자료와 대조한 뒤 걷어냈다 — **되쓰는 것은 마지막에 서 있던 판본**이다.
  next_fingerprint := public.revision_fingerprint(
    p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis);

  select r.fingerprint into current_fingerprint
  from public.person p join public.person_chart_revision r on r.id = p.current_revision_id
  where p.id = p_person_id;

  -- 아무것도 안 바뀌었으면 쌓지 않는다. **요청도 그대로 산다** — 판본 이력이 「몇 번
  -- 눌렀는가」가 아닌 것과 같은 이유로, 무효화도 「저장을 눌렀는가」가 아니다.
  if current_fingerprint = next_fingerprint then
    return (select current_revision_id from public.person where id = p_person_id);
  end if;

  insert into public.person_chart_revision (
    person_id, calendar, original_date, solar_date, birth_time,
    gender, city, late_night_rule, time_basis, created_by
  )
  values (
    p_person_id, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, actor
  )
  returning id into new_revision;

  update public.person set current_revision_id = new_revision where id = p_person_id;

  -- ADR 0004 — Evidence 를 바꾸는 수정이 pending 요청을 무효화한다. 같은 트랜잭션이라
  -- 그 사이에 낀 수락이 없다.
  perform public.invalidate_pending_requests(public.claimed_by(p_person_id));

  return new_revision;
end;
$$;

-- ---------------------------------------------------------------------------
-- 차단 — 걸면 살아 있던 요청도 거둔다
-- ---------------------------------------------------------------------------

/**
 * 이 사람과의 접촉을 끊는다.
 *
 * 표에 한 줄 넣는 것으로 끝나지 않는다. 살아 있던 요청을 **같은 트랜잭션에서** 거둔다 —
 * 갈리면 「차단했는데 그 사람의 요청은 그대로 떠 있는」 상태가 실재한다.
 *
 * 거두는 이름이 방향에 따라 다르다. 내가 요청자면 `cancelled`(내가 거뒀다), 내가 받는
 * 쪽이면 `rejected`(내가 거절했다)다. 그리고 **차단했다는 사실은 알리지 않는다** —
 * 상대가 받는 것은 평범한 거절 알림이고, 그것이 상대가 알아야 할 전부다.
 *
 * **없는 사람을 차단해도 참을 돌려준다.** 참·거짓이 갈리면 이 함수가 「저 uuid 가
 * 이 서비스에 있나」를 묻는 문이 된다.
 */
create or replace function public.block_user(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = actor then
    raise exception '자기 자신은 차단할 수 없습니다.' using errcode = '22023';
  end if;

  -- 넣는 것과 거두는 것 사이에 요청 하나가 끼면 차단된 쌍에 pending 이 남는다.
  perform public.lock_users(actor, p_user_id);

  -- 잠그기 전에 물은 것은 그 사이에 커밋된 제재를 못 본다(`request_match` 와 같은 이유).
  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  insert into public.block (user_id, blocked_user_id)
  select actor, p_user_id
  where exists (select 1 from public.app_user u where u.id = p_user_id)
  on conflict do nothing;

  with ended as (
    update public.match_request
    set status = case when requester_user_id = actor then 'cancelled' else 'rejected' end,
        decided_at = now()
    where status = 'pending'
      and ((requester_user_id = actor and addressee_user_id = p_user_id)
        or (requester_user_id = p_user_id and addressee_user_id = actor))
    returning id, requester_user_id, status
  )
  insert into public.notification (user_id, kind, request_id)
  select ended.requester_user_id, 'request_rejected', ended.id
  from ended
  where ended.status = 'rejected';

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 읽는 문 — **이 함수들이 내주는 것이 곧 브라우저가 볼 수 있는 것이다**
-- ---------------------------------------------------------------------------

/**
 * 내가 주고받은 요청.
 *
 * **방향은 값으로 낸다.** 요청자 칸과 수신자 칸을 그대로 내주면 화면이 「내가 어느
 * 쪽인가」를 다시 계산하게 되고, 두 축의 오행도 화면에서 뒤집어야 한다. 여기서
 * 뒤집어 내보내면 화면은 자기 자리에서 읽기만 한다.
 *
 * `cancelled` 는 나가지 않는다. 요청자에게는 스스로 거둔 기록이라 할 일이 없고, 받는
 * 쪽에게는 애초에 없던 일로 두는 것이 맞다.
 *
 * 나가는 것은 **후보 카드가 이미 말한 것**뿐이다 — 별명·소개·채우는 오행·균형 구간.
 * 여덟 글자도 생년월일시도 점수도 여기 없다.
 */
create or replace function public.my_match_requests()
returns table (
  request_id uuid,
  direction text,
  /**
   * 상대의 식별자.
   *
   * 후보 목록이 이미 내주는 값과 같은 것이다(`discovery_board.candidate_user_id`).
   * 차단하는 문을 하나로 두려면 이 값이 있어야 한다 — 요청마다 따로 차단 함수를 두면
   * 차단이 무엇을 하는지가 문마다 갈린다. 이 값을 받는 문은 저마다 자기 근거를 다시
   * 묻는다(`request_match` 는 노출 기록을, `block_user` 는 아무것도 묻지 않는다 —
   * 차단은 언제나 참을 돌려주므로 존재를 묻는 문이 되지 않는다).
   */
  counterpart_user_id uuid,
  counterpart_nickname text,
  counterpart_intro text,
  status text,
  supplied_to_me text[],
  supplied_to_them text[],
  balance_band text,
  created_at timestamptz,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    case when r.requester_user_id = (select auth.uid()) then 'sent' else 'received' end,
    other.user_id,
    other.nickname,
    other.intro,
    r.status,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_requester else r.supplied_to_addressee end,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_addressee else r.supplied_to_requester end,
    r.balance_band,
    r.created_at,
    r.decided_at
  from public.match_request r
  join public.discovery_profile other
    on other.user_id = case
      when r.requester_user_id = (select auth.uid()) then r.addressee_user_id
      else r.requester_user_id end
  -- **중지된 계정과의 요청은 서지 않는다.** 제재는 새 접근과 접촉을 함께 멈춘다(`prd-archive`).
  -- 답할 수 없는 요청이 목록에 남아 있으면, 누를 때마다 「찾지 못했습니다」만 나온다.
  join public.app_user counterpart
    on counterpart.id = other.user_id and counterpart.status = 'active'
  where (r.requester_user_id = (select auth.uid()) or r.addressee_user_id = (select auth.uid()))
    and r.status <> 'cancelled'
    and public.is_active_account()
  order by r.created_at desc
  limit 50;
$$;

/**
 * 성립한 Match.
 *
 * **여기서 나가는 것이 지금 Match 가 주는 접근의 전부다.** 상세 궁합과 `match-v0`
 * 공유 결과는 다음 단계에 열린다(`prd-archive` 7) — 그때도 자르는 것은 서버가 하고, 정확한
 * 생년월일시·출생지·전체 명식은 열리지 않는다(ADR 0008).
 *
 * 차단했거나 차단당한 Match 는 나가지 않는다. **행은 지우지 않는다** — 무엇이 있었는지는
 * 남기고 새 접근만 멈춘다(`prd-archive`: 과거 공유 결과의 보존·삭제는 계정 삭제 정책과 함께 정한다).
 */
create or replace function public.my_matches()
returns table (
  match_id uuid,
  partner_user_id uuid,
  partner_nickname text,
  partner_intro text,
  supplied_to_me text[],
  balance_band text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    partner.user_id,
    partner.nickname,
    partner.intro,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_requester else r.supplied_to_addressee end,
    r.balance_band,
    m.created_at
  from public.match m
  join public.match_request r on r.id = m.request_id
  join public.discovery_profile partner
    on partner.user_id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  join public.app_user u on u.id = partner.user_id
  where (m.user_low = (select auth.uid()) or m.user_high = (select auth.uid()))
    and u.status = 'active'
    and public.is_active_account()
    and not exists (
      select 1 from public.block b
      where (b.user_id = (select auth.uid()) and b.blocked_user_id = partner.user_id)
         or (b.user_id = partner.user_id and b.blocked_user_id = (select auth.uid()))
    )
  order by m.created_at desc;
$$;

/**
 * **내가 볼 수 있는 알림 — 한 자리에서 정한다.**
 *
 * 목록과 배지가 서로 다른 조건을 쓰면 「목록엔 아무것도 없는데 수는 는다」가 실재한다
 * (재어 봤다 — 요청을 즉시 거두니 목록은 0인데 배지가 1이었다). 조건을 여기 한 벌 두고
 * 두 함수가 이것 위에 선다.
 *
 * 서지 않는 것 둘. **거둬진 요청의 통보** — 눌러도 아무것도 없는 알림은 두지 않는다.
 * **중지된 계정과의 일** — 새 접근과 접촉이 멈춘다는 것의 한 얼굴이다. 행은 둘 다
 * 지우지 않는다. 무엇이 있었는지는 운영자가 본다.
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
    and (counterpart.id is null or counterpart.status = 'active');
$$;

revoke execute on function public.visible_notifications() from anon, public, authenticated;

/**
 * 알림함.
 *
 * **문장은 여기서 나가지 않는다** — 사건의 종류와 상대의 별명뿐이고, 말은 화면 쪽
 * 정책 모듈이 짓는다(`src/lib/consent`). 별명이 바뀌면 지난 알림도 새 이름을 부른다.
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
    other.nickname,
    n.request_id,
    n.match_id,
    n.created_at,
    n.read_at
  from public.visible_notifications() n
  left join public.match_request r on r.id = n.request_id
  left join public.discovery_profile other
    on other.user_id = case
      when r.requester_user_id = (select auth.uid()) then r.addressee_user_id
      else r.requester_user_id end
  order by n.created_at desc
  limit 50;
$$;

/**
 * 아직 읽지 않은 알림 수 — 다른 화면이 배지 하나를 세우려고 부른다.
 *
 * **목록과 같은 자리에서 센다.** 여기서 조건을 다시 적으면 두 벌이 되고, 두 벌은 갈린다.
 */
create or replace function public.unread_notifications()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.visible_notifications() n where n.read_at is null;
$$;

/**
 * 읽음으로 바꾼다 — **시각은 DB 가 적는다.**
 *
 * 열어 준 칸을 함수로 감싸지 않는다는 규율의 반대편이다(`discovery_profile` 의 별명은
 * 정책이 열어 준다). 읽은 시각은 **사건**이라 사용자가 적을 값이 아니다 — 참여를 켠
 * 시각을 사용자가 적지 않는 것과 같다.
 */
create or replace function public.mark_notifications_read()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with read as (
    update public.notification
    set read_at = now()
    -- **보이는 것만 읽음이 된다.** 안 보이는 통보까지 읽음으로 바꾸면, 그 계정의 제재가
    -- 풀렸을 때 이미 읽은 것으로 뜬다 — 사용자는 그 알림을 본 적이 없다.
    where id in (select n.id from public.visible_notifications() n where n.read_at is null)
    returning 1
  )
  select count(*)::int from read;
$$;

-- ---------------------------------------------------------------------------

revoke execute on function public.request_match(uuid) from anon, public;
grant execute on function public.request_match(uuid) to authenticated;

revoke execute on function public.respond_to_match_request(uuid, boolean) from anon, public;
grant execute on function public.respond_to_match_request(uuid, boolean) to authenticated;

revoke execute on function public.cancel_match_request(uuid) from anon, public;
grant execute on function public.cancel_match_request(uuid) to authenticated;

revoke execute on function public.block_user(uuid) from anon, public;
grant execute on function public.block_user(uuid) to authenticated;

revoke execute on function public.my_match_requests() from anon, public;
grant execute on function public.my_match_requests() to authenticated;

revoke execute on function public.my_matches() from anon, public;
grant execute on function public.my_matches() to authenticated;

revoke execute on function public.my_notifications() from anon, public;
grant execute on function public.my_notifications() to authenticated;

revoke execute on function public.unread_notifications() from anon, public;
grant execute on function public.unread_notifications() to authenticated;

revoke execute on function public.mark_notifications_read() from anon, public;
grant execute on function public.mark_notifications_read() to authenticated;

-- ---------------------------------------------------------------------------
-- 후보 목록 — **제외 목록에 한 줄이 는다**
-- ---------------------------------------------------------------------------

/**
 * `discovery_board` 을 다시 쓴다 — **달라진 것은 `pool` 의 한 줄뿐**이다.
 *
 * 「차단 표가 생기면 여기 한 줄이 는다(6단계)」고 적어 두었다(`20260825090000_discovery.sql`).
 * 그 줄이 지금 셋을 한꺼번에 든다: 다시 보지 않기, 차단, 그리고 이미 살아 있는 결정.
 * 셋을 여기 늘어놓는 대신 `discovery_unavailable` 하나에 묻는 것은, 같은 질문을 하는
 * 자리가 여기 말고 `request_match` 에도 있기 때문이다.
 *
 * 나머지는 그대로다. 왜 이렇게 생겼는지는 원래 파일의 주석이 든다 — 여기서 되풀이하면
 * 두 벌이 되고, 두 벌은 갈린다.
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
  my_revision uuid;
  opted timestamptz;
  seed_text text;
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

  if my_revision is distinct from (
    select p.current_revision_id from public.app_user u
    join public.person p on p.id = u.self_person_id
    where u.id = actor
  ) then
    raise exception '내 오행 요약이 지금 판본의 것이 아닙니다.' using errcode = '55000';
  end if;

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
    -- **자격은 한 함수가 답한다**(`discovery_eligible`). 참여·계정·판본·양쪽 성별 조건과
    -- 쌍에 걸린 하드 제외가 전부 그 안에 있고, 요청을 만드는 문도 같은 것에 묻는다.
    where public.discovery_eligible(actor, other.user_id)
  ),
  ranked as (
    select
      pool.*,
      complement * 0.54 + balance * 0.46 as score,
      row_number() over (
        order by complement * 0.54 + balance * 0.46 desc, pool.user_id
      ) as rank
    from pool
  ),
  sizes as (
    select
      least(count(*), 10)::int as wanted,
      floor(least(count(*), 10)::int * 0.2)::int as explorers,
      least(count(*), 10)::int - floor(least(count(*), 10)::int * 0.2)::int as tops
    from ranked
  ),
  explorers as (
    select ranked.*, row_number() over (
      order by md5(seed_text || ranked.user_id::text), ranked.user_id
    ) as ei
    from ranked, sizes
    where ranked.rank > sizes.tops
    order by md5(seed_text || ranked.user_id::text), ranked.user_id
    limit (select explorers from sizes)
  ),
  slots as (
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
