-- 카드 점수가 풀이 기준점과 **같은 수로 반올림**하고, 사진을 지우고 옮기는 문이 **그 장**을 판본으로 확인한다
-- (밤 리뷰 2026-09-26 「운영자가 정할 것」 1, 운영자가 2026-09-26 에 받음)
--
-- ## 1. 카드 점수 — TS 와 같은 부동소수로 센다
--
-- `discovery_preview_score_v2` 는 numeric 으로 셌다. numeric 나눗셈은 1/6 · 1/14 를 유한 자리에서 자르므로 참값이
-- 52.5 인 쌍이 52.4999…9990 이 되어 52 로 내려갔고, TS(`previewScoreOf`, 궁합풀이의 기준점)는 53 을 냈다.
--
-- 밤 리뷰의 초안은 합을 소수 아홉째 자리에서 맞췄다. **재 보니 그것도 TS 와 같지 않다** — TS 도 부동소수라 참값
-- x.5 를 x.4999…9 로 내리는 쌍이 있다(무작위 명식 400 명 · 79,800 쌍에서 연인용 1 · 일반 354). 아홉째 자리
-- 맞추기는 SQL 을 참값 쪽으로 옮길 뿐이라 불일치 154 가 1 로 줄고 방향만 바뀐다(SQL 이 1 높다).
-- TS 를 참값 쪽으로 고치면(`toFixed(9)`) 이미 저장된 풀이의 기준점과 궁합 지표가 355 쌍에서 달라진다.
--
-- 그래서 **SQL 이 TS 의 셈을 그대로 따른다.** 세 축 중 둘(필요 보완 · 오행 균형)과 가중 합을 `double precision`
-- 으로, TS 와 **같은 연산 순서로** 센다 — 두 언어 모두 IEEE 754 배정밀도라 같은 순서면 같은 비트가 난다.
-- 일주 축은 정수와 .5 뿐이라 numeric 그대로 두고 옮겨 싣는다. 같은 79,800 쌍에서 불일치 0, 반올림 전 수까지
-- 비트가 같다(`supabase/tests/63_card_score_rounding_and_photo_version.test.sql` 이 붉은 쌍을 든다).
--
-- 돌려주는 형은 numeric 그대로다 — 부르는 자리 셋(`my_discovery_board` · `my_passed_connections` ·
-- `refresh_discovery_snapshot_for`)이 `round(numeric)` 을 한다. 부동소수를 numeric 으로 옮길 때 **가장 짧게
-- 되돌아오는 자리수**로 적는다(`extra_float_digits = 3`). 기본값(15 자리)으로 옮기면 42.49999999999999 가
-- 42.5 가 되어 다시 갈린다. 가장 짧은 표기는 x.5 가 아닌 수를 x.5 로 적지 않는다 — x.5 는 그 자체로 부동소수다.
--
-- 저장된 카드 점수는 없다 — 후보 목록 · 지나친 인연은 부를 때마다 센다. 스냅샷의 줄 세우기는 반올림 전 수를
-- 쓰고 그 차이는 1e-13 아래라 다시 세우지 않는다(스냅샷은 하루면 새로 선다). 옛 셈의 두 축 함수
-- (`discovery_need_complement_v2` · `discovery_count_balance_v1`)는 그대로다 — 노출 기록의 값과 균형 밴드가 읽는다.
--
-- ## 2. 지우기 · 옮기기가 판본을 본다 — 넓힌다
--
-- `remove_my_photo(2)` 를 두 탭 · 재시도가 두 번 보내면 둘째 누름이 **당겨 앉은 다른 장**을 지웠다. 두 문이
-- `p_version`(`my_photos().version` — 화면이 본 그 장)을 받는다. 지우기는 그 장이 그 자리에 없으면 조용히
-- 지나가고(이미 지워졌다), 옮기기는 같은 거절(`사진을 옮기지 못했습니다.`)을 낸다 — 화면이 목록을 다시 받는다.
--
-- 판본은 **한 곳에서 짓는다**(`profile_photo_version`) — `my_photos` 가 주는 수와 두 문이 견주는 수가 같은 식이다.
--
-- **옛 앱(운영의 `f631244`)이 그대로 돈다.** 새 인자는 `default null` 이고, 비면 앞처럼 자리만 본다. 옛 서명은
-- 이 마이그레이션에서 지운다 — PostgREST 는 이름 인자로 부르므로 `{p_position}` 만 보낸 옛 호출이 새 함수에
-- 잡힌다. 옛 서명을 남기면 오히려 같은 호출에 후보가 둘이라 `PGRST203` 으로 선다(runbook 「넓히고, 재고, 좁힌다」
-- 의 창은 인자를 **바꿀** 때의 것이고, 여기는 인자를 **더할** 뿐이다).
--
-- ## 3. 전부 내리기도 계정 행을 잠근다
--
-- `clear_my_photo` 만 잠금 없이 지웠다. 올리기와 겹치면 올리기가 센 다음 자리(4)에 한 장만 남아 대표 칸이 빈다.
-- 정지된 계정도 지울 수 있어야 하므로(앞과 같다) `lock_my_photos` 대신 잠금 한 줄만 든다.

-- ---------------------------------------------------------------------------
-- 1. 카드 점수 — TS 의 부동소수 셈을 그대로
-- ---------------------------------------------------------------------------

/**
 * 한 방향(받는 쪽 ← 주는 쪽)의 필요 보완, 0~100, **부동소수** — `needComplementDirectional` 의 연산 순서 그대로.
 *
 * `visibleShare` = 개수 / 글자 수, `supply` = min(1, 몫 / 0.2), `counter` = 같은 식, `100 * (supply - 0.3 * counter)` 를
 * 0 ~ 100 에 묶는다. 요약이 없으면 `null`.
 */
create function public.discovery_need_direction_v2_float(receiver_need jsonb, provider_summary jsonb)
returns double precision
language sql
immutable
set search_path = ''
as $$
  with share as (
    select
      case when (provider_summary ->> 'glyphCount')::double precision > 0
        then (provider_summary -> 'counts' ->> (receiver_need ->> 'primary'))::double precision
             / (provider_summary ->> 'glyphCount')::double precision
        else 0::double precision end as primary_share,
      case when (provider_summary ->> 'glyphCount')::double precision > 0
        then (provider_summary -> 'counts' ->> (receiver_need ->> 'heaviest'))::double precision
             / (provider_summary ->> 'glyphCount')::double precision
        else 0::double precision end as heaviest_share
  )
  select case
    when receiver_need is null or provider_summary is null then null
    else greatest(0::double precision, least(100::double precision,
      100::double precision * (
        least(1::double precision, share.primary_share / 0.2::double precision)
        - 0.3::double precision * least(1::double precision, share.heaviest_share / 0.2::double precision))))
  end
  from share;
$$;

/**
 * 두 사람의 오행 균형, 0~100, **부동소수** — `combinedCountBalanceOf` 의 연산 순서 그대로.
 *
 * 편차를 木 → 火 → 土 → 金 → 水 차례로 왼쪽부터 더한다(`ELEMENTS.reduce`). `sum()` 은 차례를 약속하지 않으므로
 * 풀어 적는다.
 */
create function public.discovery_count_balance_v2_float(a jsonb, b jsonb)
returns double precision
language sql
immutable
set search_path = ''
as $$
  with total as (
    select (a ->> 'glyphCount')::double precision + (b ->> 'glyphCount')::double precision as n
  ),
  gap as (
    select
      abs(((a -> 'counts' ->> '木')::double precision + (b -> 'counts' ->> '木')::double precision) / total.n - 0.2::double precision) as e1,
      abs(((a -> 'counts' ->> '火')::double precision + (b -> 'counts' ->> '火')::double precision) / total.n - 0.2::double precision) as e2,
      abs(((a -> 'counts' ->> '土')::double precision + (b -> 'counts' ->> '土')::double precision) / total.n - 0.2::double precision) as e3,
      abs(((a -> 'counts' ->> '金')::double precision + (b -> 'counts' ->> '金')::double precision) / total.n - 0.2::double precision) as e4,
      abs(((a -> 'counts' ->> '水')::double precision + (b -> 'counts' ->> '水')::double precision) / total.n - 0.2::double precision) as e5
    from total
    where total.n > 0
  )
  select case
    when a is null or b is null then null
    when (select n from total) <= 0 then 0::double precision
    else (
      select greatest(0::double precision, least(100::double precision,
        (1::double precision - ((((gap.e1 + gap.e2) + gap.e3) + gap.e4) + gap.e5) / 1.6::double precision)
        * 100::double precision))
      from gap)
  end;
$$;

revoke execute on function public.discovery_need_direction_v2_float(jsonb, jsonb) from anon, authenticated, public;
revoke execute on function public.discovery_count_balance_v2_float(jsonb, jsonb) from anon, authenticated, public;

/**
 * 후보 카드의 예측 궁합 점수, 반올림 전 — ADR 0113 의 **연인용** 정책. **TS `previewScoreOf` 와 같은 비트다.**
 *
 * 가중 합도 TS 의 차례(`dayPillar` → `needComplement` → `combinedBalance`, 왼쪽부터)로 더한다. 부동소수를 가장 짧게
 * 되돌아오는 자리수로 numeric 에 옮긴다 — 부르는 자리의 `round(numeric)` 이 `Math.round` 와 같은 쪽으로 간다(머리말).
 *
 * 입력 하나라도 비면 `null` 이다 — 앞과 같다.
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
  select (
    0.4::double precision * public.discovery_day_pillar_axis_v2(a_chart, b_chart)::double precision
    + 0.4::double precision * (
        (public.discovery_need_direction_v2_float(a_need, b_summary)
         + public.discovery_need_direction_v2_float(b_need, a_summary)) / 2::double precision)
    + 0.2::double precision * public.discovery_count_balance_v2_float(a_summary, b_summary)
  )::text::numeric;
$$;

revoke execute on function public.discovery_preview_score_v2(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 2. 사진의 판본 — 한 곳에서 짓는다
-- ---------------------------------------------------------------------------

/**
 * 사진 한 장의 판본 — 그 장을 올린(바꾼) 시각의 마이크로초. 옮겨도 안 바뀐다.
 *
 * `my_photos` 가 화면에 주는 수와 지우기 · 옮기기가 견주는 수가 이 한 식이다. 아무에게도 안 연다.
 */
create function public.profile_photo_version(p_updated_at timestamptz)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select (extract(epoch from p_updated_at) * 1000000)::bigint;
$$;

revoke execute on function public.profile_photo_version(timestamptz) from anon, authenticated, public;

/** 내 사진들의 자리와 판본 — 앞과 같다. 판본을 `profile_photo_version` 으로 짓는다 */
create or replace function public.my_photos()
returns table ("position" integer, version bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.position::integer, public.profile_photo_version(p.updated_at)
  from public.profile_photo p
  where p.user_id = (select auth.uid())
  order by p.position;
$$;

-- ---------------------------------------------------------------------------
-- 3. 지우기 · 옮기기 — 판본을 받는다 (옛 서명을 지우고 기본값을 든 새 서명)
-- ---------------------------------------------------------------------------

drop function public.remove_my_photo(integer);

/**
 * 한 장을 내린다 — **뒤의 장이 한 칸씩 당겨 앉는다.** 대표를 지우면 둘째 장이 대표가 된다.
 *
 * `p_version` 은 화면이 본 그 장(`my_photos().version`)이다. 그 자리에 다른 장이 앉아 있거나 자리가 비었으면
 * **조용히 지나간다** — 두 탭 · 재시도의 둘째 누름이다. 비면 옛 앱이다 — 자리만 본다.
 */
create function public.remove_my_photo(p_position integer, p_version bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
begin
  delete from public.profile_photo p
  where p.user_id = actor
    and p.position = p_position
    and (p_version is null or public.profile_photo_version(p.updated_at) = p_version);
  if not found then
    return;
  end if;

  update public.profile_photo
  set position = position - 1
  where user_id = actor and position > p_position;
end;
$$;

drop function public.move_my_photo(integer, integer);

/**
 * 한 장을 다른 자리로 옮긴다 — **사이의 장이 한 칸씩 밀린다**(끌어다 놓기의 뜻). 맞바꾸기가 아니다.
 *
 * `p_version` 이 있으면 `p_from` 에 **그 장**이 있어야 한다 — 없으면 없는 자리와 같은 거절이다(화면이 목록을
 * 다시 받는다). 비면 옛 앱이다 — 자리만 본다.
 */
create function public.move_my_photo(p_from integer, p_to integer, p_version bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
  held integer;
begin
  select count(*)::integer into held from public.profile_photo where user_id = actor;

  if p_from is null or p_to is null
     or p_from < 1 or p_from > held or p_to < 1 or p_to > held then
    raise exception '사진을 옮기지 못했습니다.' using errcode = '22023';
  end if;

  if p_version is not null and not exists (
    select 1 from public.profile_photo p
    where p.user_id = actor
      and p.position = p_from
      and public.profile_photo_version(p.updated_at) = p_version
  ) then
    raise exception '사진을 옮기지 못했습니다.' using errcode = '22023';
  end if;

  if p_from = p_to then
    return;
  end if;

  update public.profile_photo
  set position = case
    when position = p_from then p_to
    when p_from < p_to then position - 1
    else position + 1
  end
  where user_id = actor
    and position between least(p_from, p_to) and greatest(p_from, p_to);
end;
$$;

revoke execute on function public.remove_my_photo(integer, bigint) from anon, public;
revoke execute on function public.move_my_photo(integer, integer, bigint) from anon, public;
grant execute on function public.remove_my_photo(integer, bigint) to authenticated;
grant execute on function public.move_my_photo(integer, integer, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 전부 내리기 — 계정 행을 잠근다
-- ---------------------------------------------------------------------------

/**
 * 내 사진을 **전부** 내린다 — 옛 앱의 「사진 지우기」.
 *
 * 올리기 · 지우기 · 옮기기와 같은 계정 행 잠금을 쥔다 — 겹친 올리기가 센 다음 자리에 한 장만 남지 않는다.
 * 정지된 계정도 지울 수 있다 — 앞과 같다. 그래서 `lock_my_photos` 대신 잠금만 한 줄로 든다.
 */
create or replace function public.clear_my_photo()
returns void
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

  perform 1 from public.app_user where id = actor for update;

  delete from public.profile_photo where user_id = actor;
end;
$$;
