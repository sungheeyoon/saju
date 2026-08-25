-- 공유 결과 — 「함께 보자」가 열어 준 것을 실제로 여는 자리
--
-- 앞 파일이 여기를 비워 두고 있었다. `20260825120000_match_request.sql` 은 「상세 궁합과
-- `match-v0` 공유 결과는 다음 단계다. Match 가 먼저 있어야 그 화면이 무엇에 기대는지
-- 말할 수 있다」고 적었다. 이제 말할 수 있다.
--
-- 이 파일이 여는 문은 **둘**이고, 둘의 성격이 다르다(ADR 0010).
--
-- 1. `my_match_scope` — **누가 볼 수 있는가.** 사용자 JWT 로 돌고 `auth.uid()` 로
--    판정한다. 나가는 것은 별명·소개·두 축의 말·그리고 **매인 판본 id 둘**뿐이다.
-- 2. `match_calculation_inputs` — **무엇으로 계산하는가.** 출생 원문이 나가므로
--    `authenticated` 에게 닫혀 있고 `service_role` 만 부른다. 그 값은 서버 안에서
--    명식이 되고 잘린 결과만 브라우저로 간다.
--
-- 열쇠를 쓰는 자리를 왜 여기 하나 두는지는 ADR 0010 이 든다 — DB 는 명식을 계산할 수
-- 없고, 형충회합 구백 줄을 SQL 에 다시 적으면 판정하는 자리가 둘이 된다.

-- ---------------------------------------------------------------------------
-- 「내가 볼 수 있는 Match」 — 한 자리
-- ---------------------------------------------------------------------------

/**
 * **좁힘을 한 벌만 둔다**(`visible_notifications` 와 같은 규율).
 *
 * 목록과 결과 화면이 서로 다른 조건을 쓰면 「목록에는 있는데 열면 없는」 Match 가
 * 실재한다. 조건을 여기 한 벌 두고 두 함수가 이것 위에 선다 — 「좁힘」을 두 자리에
 * 적으면 바깥쪽 문이 언젠가 하나를 빠뜨린다.
 *
 * 서지 않는 것 둘. **중지된 계정과의 Match** — 제재는 새 접근과 접촉을 함께 멈춘다.
 * **차단이 걸린 Match** — 어느 쪽이 걸었든 내려간다. **행은 지우지 않는다**(PRD:
 * 과거 공유 결과의 보존은 계정 삭제 정책과 함께 정한다).
 */
create or replace function public.visible_matches()
returns setof public.match
language sql
stable
security definer
set search_path = ''
as $$
  select m.*
  from public.match m
  join public.app_user partner
    on partner.id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  where (m.user_low = (select auth.uid()) or m.user_high = (select auth.uid()))
    and partner.status = 'active'
    and public.is_active_account()
    and not exists (
      select 1 from public.block b
      where (b.user_id = (select auth.uid()) and b.blocked_user_id = partner.id)
         or (b.user_id = partner.id and b.blocked_user_id = (select auth.uid()))
    );
$$;

revoke execute on function public.visible_matches() from anon, public, authenticated;

/**
 * 성립한 Match — **좁힘이 위로 옮겨 갔다.**
 *
 * 반환형도 조건도 그대로다. 달라진 것은 조건이 이제 `visible_matches()` 안에 있다는
 * 것뿐이다. 결과 화면이 같은 질문을 하게 됐으므로, 두 번째 자리가 생기기 전에 옮긴다.
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
  from public.visible_matches() m
  join public.match_request r on r.id = m.request_id
  join public.discovery_profile partner
    on partner.user_id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  order by m.created_at desc;
$$;

/**
 * Match 한 건이 여는 범위 — **결과 화면이 서기 전에 답이 나온다.**
 *
 * `uuid` 를 받지만 남의 것을 묻는 문이 되지 않는다. 무엇을 묻든 `visible_matches()`
 * 안에서만 찾으므로, 당사자가 아니면 **없는 것과 같은 답**(0행)이다 — 없는 Match 와
 * 못 보는 Match 를 가르면 그 차이만으로 실재를 알아낼 수 있다.
 *
 * **판본 id 둘이 나간다.** 불투명 식별자이고, 그 판본을 읽는 길은 이 사용자에게 닫혀
 * 있다(`user_person_access` 엣지가 없으므로 정책이 막는다 — Match 는 엣지를 만들지
 * 않는다, US 46). 이 값이 있어야 서버가 **매인 판본**으로 계산할 수 있다.
 *
 * 두 축의 말은 요청이 잡아 둔 그때의 것이다(`match_request`). 지금 다시 세지 않는 것은
 * 요약이 지금 판본의 것이라 매인 판본과 갈릴 수 있기 때문이다.
 */
create or replace function public.my_match_scope(p_match_id uuid)
returns table (
  match_id uuid,
  partner_user_id uuid,
  partner_nickname text,
  partner_intro text,
  /** 내 쪽이 동의한 판본 */
  my_revision_id uuid,
  /** 상대가 동의한 판본 */
  partner_revision_id uuid,
  supplied_to_me text[],
  supplied_to_them text[],
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
    case when m.user_low = (select auth.uid()) then m.low_revision_id else m.high_revision_id end,
    case when m.user_low = (select auth.uid()) then m.high_revision_id else m.low_revision_id end,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_requester else r.supplied_to_addressee end,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_addressee else r.supplied_to_requester end,
    r.balance_band,
    m.created_at
  from public.visible_matches() m
  join public.match_request r on r.id = m.request_id
  join public.discovery_profile partner
    on partner.user_id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  where m.id = p_match_id;
$$;

-- ---------------------------------------------------------------------------
-- 계산 입력 — **열쇠 하나만 부른다**
-- ---------------------------------------------------------------------------

/**
 * 그 Match 가 매어 둔 두 판본의 계산 입력.
 *
 * **`authenticated` 에게 닫혀 있다.** 출생 원문이 그대로 나가므로, 열어 두면 로그인한
 * 사람이 브라우저에서 그대로 불러 상대의 생년월일시를 읽는다 — definer 함수가 내주는
 * 것이 곧 브라우저가 볼 수 있는 것이다(ADR 0003 「이행」).
 *
 * **`match_id` 하나만 받는다.** 판본 id 를 받으면 앱이 손으로 댈 자리가 생기고, 그때
 * 이 문은 「아무 판본이나 묻는 문」이 된다. 여기서 나올 수 있는 것은 **어떤 Match 가
 * 실제로 매어 둔 판본**뿐이다.
 *
 * **사용자 id 는 받지 않는다.** 「이 사람입니다」를 앱이 대는 모양은 ADR 0004 가 거부한
 * 것이다. 볼 자격은 이 문에 오기 전에 `my_match_scope` 가 `auth.uid()` 로 답한다.
 *
 * 그래도 제재와 차단은 여기서 한 번 더 묻는다. 자격을 묻는 자리와 읽는 자리가 갈려
 * 있으므로, 그 사이에 걸린 차단이 이 문을 그냥 지나가지 않게 한다.
 */
create or replace function public.match_calculation_inputs(p_match_id uuid)
returns table (
  revision_id uuid,
  calendar text,
  original_date date,
  solar_date date,
  birth_time time,
  gender text,
  city text,
  late_night_rule text,
  time_basis text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.id,
    v.calendar,
    v.original_date,
    v.solar_date,
    v.birth_time,
    v.gender,
    v.city,
    v.late_night_rule,
    v.time_basis
  from public.match m
  join public.app_user low on low.id = m.user_low
  join public.app_user high on high.id = m.user_high
  join public.person_chart_revision v
    on v.id in (m.low_revision_id, m.high_revision_id)
  where m.id = p_match_id
    and low.status = 'active'
    and high.status = 'active'
    and not exists (
      select 1 from public.block b
      where (b.user_id = m.user_low and b.blocked_user_id = m.user_high)
         or (b.user_id = m.user_high and b.blocked_user_id = m.user_low)
    );
$$;

-- ---------------------------------------------------------------------------

revoke execute on function public.my_match_scope(uuid) from anon, public;
grant execute on function public.my_match_scope(uuid) to authenticated;

/**
 * **열쇠 말고는 아무도 못 부른다.**
 *
 * `service_role` 은 이 스키마의 표에 권한이 하나도 없다(`20260824090200_access_policies.sql`).
 * 그 키가 이 프로젝트에서 할 수 있는 일은 지금부터 **이 함수 하나**이고, 그 함수가
 * 내주는 것은 Match 가 매어 둔 판본뿐이다. 구멍의 크기를 여기서 잰다.
 */
revoke execute on function public.match_calculation_inputs(uuid) from anon, public, authenticated;
grant execute on function public.match_calculation_inputs(uuid) to service_role;
