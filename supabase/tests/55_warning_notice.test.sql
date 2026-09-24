-- 경고가 갈래 · 안내번호를 들고 경고받은 사람에게 선다 (ADR 0108, G-57)
--
--   1. **검토 문이 경고에 갈래와 안내번호를 붙인다** — 갈래는 운영자가 고르고 없으면 신고 사유. 경고가 아닌데 갈래를 주면 거절
--   2. **표의 제약** — 경고에만 갈래가 있고, 경고에는 안내번호가 있다. 안내번호는 모양이 정해져 있고 겹치지 않는다
--   3. **이용자의 문은 안내번호 · 갈래 · 날짜만 낸다** — 판단 근거 · 신고한 사람 · 신고 id · 경고 수가 반환형에 없다
--   4. **내 것 · 확인 전 · 가장 오래된 하나** — 남의 경고는 안 보이고, 확인하면 다음 것이 선다
--   5. **정지된 계정에는 안 선다**
--   6. **이의 제기 인정(조치 없음으로 다시 적기)이면 안내가 사라지고 안내번호는 남는다**
--   7. **운영자는 안내번호로 찾는다** — 소문자 · 앞뒤 빈칸도
--   8. **떠난 사람의 신고로 옮겨도 칸이 따라간다** — 이용자에게는 안 선다
--   9. **앱 역할은 제 경고의 확인 시각만 적는다** — 표를 직접 고치지 못하고 안 열린 칸은 못 읽는다
begin;
select plan(36);

create temporary table folks as
select
  tests.signup('wn-reporter@example.com') as reporter,
  tests.signup('wn-warned@example.com') as warned,
  tests.signup('wn-other@example.com') as other,
  tests.signup('wn-suspended@example.com') as suspended,
  tests.signup('wn-leaving@example.com') as leaving,
  tests.signup('wn-operator@example.com') as operator;
grant select on folks to authenticated, service_role, anon;

insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 경고 안내');

create or replace function pg_temp.report(who uuid, whom uuid, reason text)
returns uuid language sql as $$
  insert into public.report (reporter_user_id, reported_user_id, reason) values (who, whom, reason) returning id
$$;

create temporary table cases as
select
  pg_temp.report(reporter, warned, 'harassment') as first,
  pg_temp.report(reporter, warned, 'impersonation') as second,
  pg_temp.report(reporter, warned, 'other') as appealed,
  pg_temp.report(reporter, other, 'inappropriate') as others,
  pg_temp.report(reporter, suspended, 'harassment') as halted,
  pg_temp.report(leaving, warned, 'other') as moved,
  pg_temp.report(reporter, warned, 'harassment') as calm
from folks;
grant select on cases to authenticated, service_role, anon;

create or replace function pg_temp.review(report uuid, outcome text, target uuid default null, category text default null)
returns text language sql as $$
  select public.review_report(report, (select operator from folks), outcome, null, target, category)
$$;

create or replace function pg_temp.notice_as(actor uuid)
returns table (warning_ref text, category text, warned_on date) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(actor), true);
  set local role authenticated;
  return query select n.warning_ref, n.category, n.warned_on from public.my_warning_notice() n;
  reset role;
end;
$$;

-- ── 1. 검토 문이 갈래와 안내번호를 붙인다 ─────────────────────────────────────

select throws_ok(
  format($$select pg_temp.review(%L, 'no_action', null, 'harassment')$$, (select calm from cases)),
  '22023', null, '경고가 아닌데 갈래를 주면 거절한다');

select pg_temp.review((select first from cases), 'warning', (select warned from folks));
select pg_temp.review((select second from cases), 'warning', (select warned from folks), 'inappropriate');

select is((select warning_category from public.report where id = (select first from cases)), 'harassment',
  '갈래를 안 고르면 신고 사유가 기본값이다');
select is((select warning_category from public.report where id = (select second from cases)), 'inappropriate',
  '운영자가 고른 갈래가 신고 사유보다 앞선다');
select ok((select warning_ref ~ '^W-[2-9A-HJKMNP-TV-Z]{4}$' from public.report where id = (select first from cases)),
  '경고에는 헷갈리는 글자 없는 네 글자 안내번호가 붙는다');
select isnt((select warning_ref from public.report where id = (select first from cases)),
  (select warning_ref from public.report where id = (select second from cases)),
  '두 경고의 안내번호가 다르다');

create temporary table refs as
select
  (select warning_ref from public.report where id = c.first) as first,
  (select warning_ref from public.report where id = c.second) as second
from cases c;
grant select on refs to authenticated, service_role, anon;

select throws_ok(
  format($$select pg_temp.review(%L, 'warning', %L, 'rude')$$, (select calm from cases), (select warned from folks)),
  '23514', null, '갈래는 신고 사유와 같은 넷뿐이다');

select pg_temp.review((select first from cases), 'warning', (select warned from folks), 'other');
select is(
  (select array[warning_category, warning_ref] from public.report where id = (select first from cases)),
  array['other', (select first from refs)],
  '경고를 경고로 다시 적으면 갈래가 바뀌고 안내번호는 그대로다');
select pg_temp.review((select first from cases), 'warning', (select warned from folks));

-- ── 2. 표의 제약 ─────────────────────────────────────────────────────────────

select throws_ok(
  format($$update public.report set warning_category = null where id = %L$$, (select first from cases)),
  '23514', null, '경고에는 갈래가 있어야 한다');
select throws_ok(
  format($$update public.report set warning_ref = null where id = %L$$, (select first from cases)),
  '23514', null, '경고에는 안내번호가 있어야 한다');
select throws_ok(
  format($$update public.report set warning_ref = 'W-0OIL' where id = %L$$, (select first from cases)),
  '23514', null, '헷갈리는 글자는 안내번호에 못 든다');
select throws_ok(
  format($$update public.report set warning_ref = %L where id = %L$$, (select second from refs), (select first from cases)),
  '23505', null, '안내번호는 겹치지 않는다');
select throws_ok(
  format($$update public.report set warning_category = 'other' where id = %L$$, (select calm from cases)),
  '23514', null, '경고가 아닌 신고에는 갈래가 없다');
select throws_ok(
  format($$update public.report set warning_emailed_at = now() where id = %L$$, (select first from cases)),
  '23514', null, '발송 시각에는 결과가 짝으로 선다');

-- ── 3. 이용자의 문 — 반환형 ───────────────────────────────────────────────────

select is(
  pg_get_function_result('public.my_warning_notice()'::regprocedure),
  'TABLE(warning_ref text, category text, warned_on date)',
  '이용자의 문은 안내번호 · 갈래 · 날짜 셋만 낸다 — 판단 근거 · 신고한 사람 · 신고 id · 경고 수가 없다');

-- ── 4. 내 것 · 확인 전 · 가장 오래된 하나 ─────────────────────────────────────

update public.report set reviewed_at = reviewed_at - interval '1 day' where id = (select first from cases);

select is((select array[warning_ref, category] from pg_temp.notice_as((select warned from folks))),
  array[(select first from refs), 'harassment'],
  '가장 오래된 안 읽은 경고 하나가 선다');
select is((select warned_on from pg_temp.notice_as((select warned from folks))),
  (select (reviewed_at at time zone 'Asia/Seoul')::date from public.report where id = (select first from cases)),
  '날은 경고를 적은 날(한국 날짜)이다');
select is((select count(*)::integer from pg_temp.notice_as((select warned from folks))), 1,
  '여럿이어도 한 번에 하나다');
select is((select count(*)::integer from pg_temp.notice_as((select reporter from folks))), 0,
  '신고한 사람에게는 안 선다');

select pg_temp.review((select others from cases), 'warning', (select other from folks));
select is((select count(*)::integer from pg_temp.notice_as((select warned from folks))
           where warning_ref = (select warning_ref from public.report where id = (select others from cases))), 0,
  '남의 경고는 안 보인다');

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select other from folks)), true);
select is(public.acknowledge_warning((select first from refs)), false, '남의 안내번호로는 확인을 못 적는다');

select set_config('request.jwt.claims', tests.claims((select warned from folks)), true);
select is(public.acknowledge_warning(' ' || (select first from refs)), false, '없는 번호는 조용히 거짓이다');
select is(public.acknowledge_warning((select first from refs)), true, '내 경고를 확인한다');
select is(public.acknowledge_warning((select first from refs)), false, '두 번째 확인은 아무것도 안 바꾼다');
reset role;

select ok((select warning_acknowledged_at is not null from public.report where id = (select first from cases)),
  '확인한 시각이 경고 곁에 남는다');
select is((select warning_ref from pg_temp.notice_as((select warned from folks))), (select second from refs),
  '확인하면 다음 경고가 선다');

-- ── 5. 정지된 계정 ───────────────────────────────────────────────────────────

select pg_temp.review((select halted from cases), 'warning', (select suspended from folks));
update public.app_user set status = 'suspended' where id = (select suspended from folks);
select is((select count(*)::integer from pg_temp.notice_as((select suspended from folks))), 0,
  '이용이 정지된 계정에는 경고 안내가 안 선다');

-- ── 6. 이의 제기 인정 ────────────────────────────────────────────────────────

select pg_temp.review((select appealed from cases), 'warning', (select warned from folks));
update public.report set reviewed_at = reviewed_at - interval '2 days' where id = (select appealed from cases);
select is((select category from pg_temp.notice_as((select warned from folks))), 'other',
  '나중에 적은 경고라도 경고한 날이 앞서면 먼저 선다');

create temporary table appealed_ref as
select warning_ref from public.report where id = (select appealed from cases);
grant select on appealed_ref to authenticated;

select pg_temp.review((select appealed from cases), 'no_action');
select is(
  (select array[coalesce(warning_category, '없음'), (warning_ref = (select warning_ref from appealed_ref))::text]
   from public.report where id = (select appealed from cases)),
  array['없음', 'true'],
  '조치 없음으로 다시 적으면 갈래는 비고 안내번호는 남는다');
select is((select warning_ref from pg_temp.notice_as((select warned from folks))), (select second from refs),
  '이의 제기를 인정한 경고는 안내에서 사라진다');

-- ── 7. 운영자는 안내번호로 찾는다 ──────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select operator from folks)), true);
select is(
  (select array_agg(l.report_id) from public.operator_reports(p_warning_ref => lower(' ' || (select second from refs) || ' ')) l),
  array[(select second from cases)],
  '안내번호로 찾으면 그 신고 하나가 나온다 — 소문자 · 앞뒤 빈칸도');
select is(
  (select array_agg(l.report_id) from public.operator_reports(p_warning_ref => (select warning_ref from appealed_ref)) l),
  array[(select appealed from cases)],
  '이의 제기를 인정한 뒤에도 그 안내번호로 찾는다');
select is(
  (select array[o.warning_ref, o.warning_category, (o.warning_acknowledged_at is not null)::text]
   from public.operator_report((select first from cases)) o),
  array[(select first from refs), 'harassment', 'true'],
  '상세는 안내번호 · 갈래 · 이용자가 확인했는가를 낸다');

-- ── 9. 앱 역할은 표를 직접 못 고친다 ──────────────────────────────────────────

select set_config('request.jwt.claims', tests.claims((select warned from folks)), true);
select throws_ok(
  $$select warning_ref from public.report limit 1$$,
  '42501', null, '신고한 사람의 칸 일곱 밖(안내번호)은 앱 역할에 안 열린다');
select throws_ok(
  format($$update public.report set warning_acknowledged_at = now() where id = %L$$, (select second from cases)),
  '42501', null, '확인 시각은 문으로만 적는다');
reset role;

-- ── 8. 떠난 사람의 신고 ──────────────────────────────────────────────────────

select pg_temp.review((select moved from cases), 'warning', (select warned from folks), 'impersonation');
create temporary table moved_ref as
select warning_ref from public.report where id = (select moved from cases);
select public.forget_user((select leaving from folks));

select is(
  (select array[k.warning_category, (k.warning_ref = (select warning_ref from moved_ref))::text]
   from retention.report k where k.report_id = (select moved from cases)),
  array['impersonation', 'true'],
  '옮겨진 줄은 갈래와 안내번호를 든다');
select is((select count(*)::integer from pg_temp.notice_as((select warned from folks))
           where warning_ref = (select warning_ref from moved_ref)), 0,
  '떠난 사람의 신고로 옮겨진 경고는 이용자에게 안 선다');

select * from finish();
rollback;
