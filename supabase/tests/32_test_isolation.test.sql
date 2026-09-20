-- 시험 격리는 **그 사람이 화면을 다시 열어도 유지된다**
--
-- 시험 파일들은 「다른 검사가 남긴 참여자」를 후보에서 빼 두고 시작한다. 안 빼면 목록이
-- 열 자리뿐이라 그 파일들이 「DB 가 비어 있는가」를 재게 된다.
--
-- 그 격리는 **구성에 의해** 유지돼야 한다. 제외된 사람이 스스로 홈을 열면
-- `ensure_discovery_participation` 이 도는데, 그 문이 격리를 되돌리면 격리는 보장이 아니라
-- **우연**이 된다 — 그리고 그때 시험은 빨개지지 않고 **조용히 아무것도 안 재게 된다.**
--
-- 그래서 격리 방식 자체를 여기서 잠근다. 격리를 쓰는 파일은 열다섯이고, 그 열다섯이
-- 여기 적힌 것과 같은 문장을 쓴다.

begin;
select no_plan();

create temporary table two as
select tests.signup('isolation-keeper@example.com') as keeper,
       tests.signup('isolation-outsider@example.com') as outsider;
grant select on two to authenticated;

do $$
declare u uuid;
begin
  for u in select keeper from two union all select outsider from two loop
    perform set_config('request.jwt.claims', tests.claims(u), true);
    perform public.create_self_person(
      '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
      tests.chart(), 'chart-for-tests');
    perform public.set_discovery_participation(true,
      '{"glyphCount":8,"counts":{"木":4,"火":4,"土":0,"金":0,"水":0},"ratios":{"木":0.5,"火":0.5,"土":0,"金":0,"水":0}}'::jsonb);
  end loop;
end;
$$;

reset role;

select ok(
  public.discovery_pair_eligible((select keeper from two), (select outsider from two)),
  '격리 전에는 서로 후보 자격이 있다');

-- ── 격리 — 시험 파일 열다섯이 쓰는 그 문장이다 ───────────────────────────────

update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select keeper from two);

select ok(
  not public.discovery_pair_eligible((select keeper from two), (select outsider from two)),
  '제외한 사람은 후보 자격을 잃는다');

/**
 * **그 사람이 홈을 열어도 안 돌아온다.**
 *
 * `ensure_discovery_participation` 은 홈과 매칭이 열릴 때마다 그 사용자 이름으로 돈다.
 * `opted_in_at` 만 비우면 그 문의 `coalesce(opted_in_at, now())` 가 값을 도로 채워 —
 * 제외된 사람이 화면을 한 번 여는 것만으로 후보 풀에 되돌아온다. `opted_out_at` 이 서 있어야
 * 그 문이 일찍 돌아선다.
 */
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select outsider from two)), true);

select is(
  public.ensure_discovery_participation(
    (select self_person_id from public.app_user where id = (select outsider from two)),
    '{"glyphCount":8,"counts":{"木":4,"火":4,"土":0,"金":0,"水":0},"ratios":{"木":0.5,"火":0.5,"土":0,"金":0,"水":0}}'::jsonb),
  false,
  '제외된 사람이 홈을 열어도 참여가 다시 열리지 않는다');

reset role;

select ok(
  not public.discovery_pair_eligible((select keeper from two), (select outsider from two)),
  '홈을 다시 열어도 후보 풀로 돌아오지 않는다');

/** 되살릴 때는 두 칸을 함께 되돌린다 — `set_discovery_participation(true)` 와 같은 모양 */
update public.discovery_profile set opted_in_at = now(), opted_out_at = null
where user_id in (select outsider from two);

select ok(
  public.discovery_pair_eligible((select keeper from two), (select outsider from two)),
  '되살리면 다시 후보가 된다');

select * from finish();
rollback;
