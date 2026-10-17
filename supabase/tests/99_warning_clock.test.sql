-- 경고의 12개월은 처음 경고한 날부터 센다 (`20261219090000`, G-111 R-6, ADR 0191)
--
--   1. **고쳐도 그날 그대로** — 같은 대상의 경고를 갈래만 바꿔 다시 적거나 그대로 다시 적어도 `warned_at` 은 안 바뀐다(검토 시각은 바뀐다)
--   2. **옮기면 그날이 새 날** — 경고의 대상을 다른 사람으로 바꾸면 옮긴 때가 그 사람의 경고한 때다
--   3. **경고에서 나가면 비고, 다시 들어오면 새 날**
--   4. **셈이 이것을 읽는다** — 처분 이력 · 대상 요약 · 옛 경고 이력 문의 12개월 셈과 이용자 안내의 「경고한 날」
--   5. **표가 막는다** — 경고면 경고한 때가 있고, 경고가 아니면 없다. 떠난 사람의 신고로 옮겨도 그대로 간다
begin;
select plan(16);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select
  tests.signup('wc-reporter@example.com') as reporter,
  tests.signup('wc-reported@example.com') as reported,
  tests.signup('wc-leaver@example.com') as leaver,
  tests.signup('wc-operator@example.com') as operator;
grant select on folks to authenticated, service_role, anon;

insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 경고한 때');

create or replace function pg_temp.report(who uuid, whom uuid, reason text)
returns uuid language sql as $$
  insert into public.report (reporter_user_id, reported_user_id, reason) values (who, whom, reason) returning id
$$;

create temporary table cases (label text primary key, id uuid);
insert into cases
select 'warned', pg_temp.report(reporter, reported, 'other') from folks
union all
select 'moving', pg_temp.report(leaver, reported, 'harassment') from folks;
grant select on cases to authenticated, service_role, anon;

create or replace function pg_temp.case_id(label text) returns uuid language sql as $$
  select id from cases where cases.label = $1
$$;

create or replace function pg_temp.review(report uuid, outcome text, target uuid, seen integer, category text default null)
returns integer language sql as $$
  select r.review_version from public.operator_review_report(report, outcome, '판단 근거', target, category, seen, gen_random_uuid()) r
$$;

create or replace function pg_temp.warned_at(report uuid) returns timestamptz language sql security definer as $$
  select r.warned_at from public.report r where r.id = report
$$;
grant execute on function pg_temp.warned_at(uuid) to authenticated;

-- ── 1. 고쳐도 그날 그대로 ────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select operator from folks));
select pg_temp.review(pg_temp.case_id('warned'), 'warning', (select reported from folks), 0);
reset role;

select is(pg_temp.warned_at(pg_temp.case_id('warned')), now(), '경고로 들어오면 그때가 경고한 때다');

-- 13개월 전의 경고로 민다 — 트랜잭션 안의 now() 는 하나라 이렇게 갈라 본다
update public.report set warned_at = now() - interval '13 months', reviewed_at = now() - interval '13 months'
where id = pg_temp.case_id('warned');

set local role authenticated;
select pg_temp.acting((select operator from folks));
select pg_temp.review(pg_temp.case_id('warned'), 'warning', (select reported from folks), 1, 'harassment');
reset role;

select is(pg_temp.warned_at(pg_temp.case_id('warned')), now() - interval '13 months',
  '갈래만 고쳐 다시 적어도 경고한 때는 그대로다');
select is((select reviewed_at from public.report where id = pg_temp.case_id('warned')), now(),
  '검토 시각은 지금이 된다 — 셈은 그것을 읽지 않는다');

set local role authenticated;
select pg_temp.acting((select operator from folks));
select pg_temp.review(pg_temp.case_id('warned'), 'warning', (select reported from folks), 2, 'harassment');

select is(pg_temp.warned_at(pg_temp.case_id('warned')), now() - interval '13 months',
  '같은 경고를 그대로 다시 적어도 그대로다');

-- ── 4. 셈이 경고한 때를 읽는다 ───────────────────────────────────────────────

select is((select warnings_12m from public.operator_member_sanctions((select reported from folks))), 0,
  '처분 이력의 12개월 셈은 경고한 때로 센다 — 다시 적은 검토 시각이 아니다');
select is(
  (select (l ->> 'counted')::boolean from public.operator_member_sanctions((select reported from folks)) s,
          jsonb_array_elements(s.lines) l where l ->> 'report_id' = pg_temp.case_id('warned')::text),
  false, '처분 이력의 그 줄도 셈에 안 든다');
select is(
  (select (l ->> 'at')::timestamptz from public.operator_member_sanctions((select reported from folks)) s,
          jsonb_array_elements(s.lines) l where l ->> 'report_id' = pg_temp.case_id('warned')::text),
  now() - interval '13 months', '처분 이력의 경고 줄 시각은 경고한 때다');
select is(
  (select array[t.warnings_12m::text, t.warned_here::text]
   from public.operator_report_target(pg_temp.case_id('warned')) t where t.side = 'reported'),
  array['0', 'false'], '신고 상세의 대상 요약도 경고한 때로 센다');
select is(
  (select w.counted from public.operator_member_warnings((select reported from folks)) w
   where w.report_id = pg_temp.case_id('warned')),
  false, '옛 경고 이력 문도 경고한 때로 센다');

select pg_temp.acting((select reported from folks));
select is((select warned_on from public.my_warning_notice()),
  ((now() - interval '13 months') at time zone 'Asia/Seoul')::date,
  '이용자 안내의 「경고한 날」은 처음 경고한 날이다 — 갈래를 고쳐 안내가 다시 서도');

-- ── 2. 옮기면 그날이 새 날 ───────────────────────────────────────────────────

select pg_temp.acting((select operator from folks));
select pg_temp.review(pg_temp.case_id('warned'), 'warning', (select reporter from folks), 3);

select is(pg_temp.warned_at(pg_temp.case_id('warned')), now(), '대상을 옮기면 옮긴 때가 그 사람의 경고한 때다');
select is(
  (select array_agg(t.warnings_12m order by t.side)
   from public.operator_report_target(pg_temp.case_id('warned')) t),
  array[0, 1], '셈은 옮겨 간 사람에게 1, 앞 사람에게 0 이다(reported · reporter 차례)');

-- ── 3. 경고에서 나가면 비고, 다시 들어오면 새 날 ─────────────────────────────

select pg_temp.review(pg_temp.case_id('warned'), 'no_action', null, 4);
select is(pg_temp.warned_at(pg_temp.case_id('warned')), null, '경고에서 나가면 경고한 때가 빈다');

reset role;

-- ── 5. 표가 막는다 · 옮겨도 그대로 ───────────────────────────────────────────

select throws_ok(
  format($$update public.report set warned_at = now() where id = %L$$, pg_temp.case_id('warned')),
  '23514', null, '경고가 아닌 신고에 경고한 때를 적지 못한다');

set local role authenticated;
select pg_temp.acting((select operator from folks));
select pg_temp.review(pg_temp.case_id('moving'), 'warning', (select reported from folks), 0);
reset role;
update public.report set warned_at = now() - interval '2 months' where id = pg_temp.case_id('moving');

select public.forget_user((select leaver from folks));

select is((select k.warned_at from retention.report k where k.report_id = pg_temp.case_id('moving')),
  now() - interval '2 months', '떠난 사람의 신고로 옮겨도 경고한 때가 그대로 간다');
select throws_ok(
  format($$update retention.report set warned_at = null where report_id = %L$$, pg_temp.case_id('moving')),
  '23514', null, '보관 표의 경고도 경고한 때가 있어야 한다');

select * from finish();
rollback;
