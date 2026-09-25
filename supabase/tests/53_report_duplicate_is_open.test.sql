-- 같은 신고를 거듭 막는 판단은 처리 필요 정의 하나를 쓴다 (ADR 0107 정정, G-23 ⑤)
--
--   1. **추가 확인 필요로 보류한 신고는 아직 열려 있다** — 같은 사람 · 같은 사유(`report_user`)도, 같은 메시지 ·
--      같은 사유(`report_chat_message`)도 「이미 접수」로 거절한다
--   2. **다른 결과로 처리가 끝나면 다시 낼 수 있다** — 조치 없음 · 경고 · 이용 정지 결정. 보류했다가 조치 없음으로
--      끝낸 것도 된다
--   3. **판단이 목록과 같은 정의를 부른다** — 두 문의 몸에 `report_is_open` 이 있다
--
-- 아직 안 본 신고의 중복과 옛 검토(시각만 있고 결과 없음)는 `43_save_and_report_brakes` · `34_chat` 이 잰다.
begin;
select plan(12);

/** 다섯 오행 개수만 주면 요약 한 벌이 된다 */
create or replace function pg_temp.summary(w int, f int, e int, g int, s int)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'glyphCount', w + f + e + g + s,
    'counts', jsonb_build_object('木', w, '火', f, '土', e, '金', g, '水', s),
    'ratios', jsonb_build_object(
      '木', w / 8.0, '火', f / 8.0, '土', e / 8.0, '金', g / 8.0, '水', s / 8.0));
$$;

/** 참여자 하나 — 여덟 글자까지 넣어야 수락이 지나간다(ADR 0071) */
create or replace function pg_temp.participant(
  mail text, who text, summary jsonb, day_stem text default '丙')
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart(day_stem), 'chart-for-tests');
  perform public.save_my_profile(who, null);
  perform public.set_discovery_participation(true, summary, tests.need());
  return uid;
end;
$$;

/** 그 사람인 척한다 */
create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('dup-kim@example.com', '김중', pg_temp.summary(4, 4, 0, 0, 0), '丙') as kim,
  pg_temp.participant('dup-lee@example.com', '이중', pg_temp.summary(0, 0, 4, 4, 0), '戊') as lee;
grant select on folks to authenticated;

reset role;

-- 다른 검사가 남긴 참여자는 이 시험의 관심 밖이다(`32_test_isolation` 의 그 문장).
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select kim from folks union all select lee from folks);

create temporary table operators as
select tests.signup('dup-operator@example.com') as operator;
insert into public.operator (user_id, note) values ((select operator from operators), '시험 — 거듭 신고');

/** 그 사유로 낸 김의 신고 중 처리 필요인 것 하나를 검토한다 — 한 사유에 처리 필요는 하나뿐이어야 한다 */
create or replace function pg_temp.review(reason text, outcome text, target uuid default null)
returns text language sql as $$
  select public.review_report(
    (select r.id from public.report r
     where r.reporter_user_id = (select kim from folks) and r.reason = review.reason
       and public.report_is_open(r.reviewed_at, r.review_outcome)
     order by r.created_at limit 1),
    (select operator from operators), outcome, null, target)
$$;

-- 김과 이가 이어지고 이가 메시지 하나를 보낸다
set local role authenticated;
select pg_temp.acting((select kim from folks));
select count(*) from public.my_discovery_board();

create temporary table asked as
select public.request_match((select lee from folks)) as to_lee;
grant select on asked to authenticated;

select pg_temp.acting((select lee from folks));
select public.respond_to_match_request((select to_lee from asked), true);

reset role;
create temporary table rooms as
select m.id as kim_lee from public.match m where m.request_id = (select to_lee from asked);
grant select on rooms to authenticated;

set local role authenticated;
select pg_temp.acting((select lee from folks));
select public.send_chat_message((select kim_lee from rooms), '거듭 신고할 메시지');

select pg_temp.acting((select kim from folks));
create temporary table chosen as
select m.message_id from public.my_chat_messages((select kim_lee from rooms), null, 200) m
where m.body = '거듭 신고할 메시지';

-- ── 1 · 2. 사람 신고 ────────────────────────────────────────────────────────────

select lives_ok(
  format('select public.report_user(%L, %L, null)', (select lee from folks), 'harassment'),
  '처음 신고는 된다');

reset role;
select pg_temp.review('harassment', 'needs_more');
set local role authenticated;
select pg_temp.acting((select kim from folks));

select throws_ok(
  format('select public.report_user(%L, %L, null)', (select lee from folks), 'harassment'),
  '23505', '같은 사유의 신고가 이미 접수되어 검토 중입니다.',
  '추가 확인 필요로 보류한 동안에는 같은 사람 · 같은 사유를 또 쌓지 않는다');

reset role;
select pg_temp.review('harassment', 'no_action');
set local role authenticated;
select pg_temp.acting((select kim from folks));

select lives_ok(
  format('select public.report_user(%L, %L, null)', (select lee from folks), 'harassment'),
  '보류했다가 조치 없음으로 끝내면 다시 낼 수 있다');

select lives_ok(
  format('select public.report_user(%L, %L, null)', (select lee from folks), 'impersonation'),
  '다른 사유는 처음 신고다');

reset role;
select pg_temp.review('impersonation', 'warning', (select lee from folks));
set local role authenticated;
select pg_temp.acting((select kim from folks));

select lives_ok(
  format('select public.report_user(%L, %L, null)', (select lee from folks), 'impersonation'),
  '경고로 끝낸 같은 사유는 다시 낼 수 있다');

-- ── 1 · 2. 메시지 신고 ──────────────────────────────────────────────────────────

select lives_ok(
  format($$select public.report_chat_message(%L, 'other', null)$$, (select message_id from chosen)),
  '메시지를 처음 신고한다');

reset role;
select pg_temp.review('other', 'needs_more');
set local role authenticated;
select pg_temp.acting((select kim from folks));

select throws_ok(
  format($$select public.report_chat_message(%L, 'other', null)$$, (select message_id from chosen)),
  '23505', '같은 사유의 신고가 이미 접수되어 검토 중입니다.',
  '추가 확인 필요로 보류한 동안에는 같은 메시지 · 같은 사유를 또 쌓지 않는다');

reset role;
select pg_temp.review('other', 'no_action');
set local role authenticated;
select pg_temp.acting((select kim from folks));

select lives_ok(
  format($$select public.report_chat_message(%L, 'other', null)$$, (select message_id from chosen)),
  '보류했다가 조치 없음으로 끝낸 메시지는 다시 신고할 수 있다');

-- ── 2. 이용 정지 결정 — 마지막에 둔다(계정이 정지되고 방이 닫힌다) ─────────────────

select lives_ok(
  format('select public.report_user(%L, %L, null)', (select lee from folks), 'inappropriate'),
  '또 다른 사유');

reset role;
select pg_temp.review('inappropriate', 'suspension', (select lee from folks));
set local role authenticated;
select pg_temp.acting((select kim from folks));

select lives_ok(
  format('select public.report_user(%L, %L, null)', (select lee from folks), 'inappropriate'),
  '이용 정지 결정으로 끝낸 같은 사유는 다시 낼 수 있다');

-- ── 3. 같은 정의를 부른다 ───────────────────────────────────────────────────────

reset role;
select ok(
  (select bool_and(pg_get_functiondef(p.oid) like '%public.report_is_open(r.reviewed_at, r.review_outcome)%')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('report_user', 'report_chat_message')),
  '두 신고 문의 중복 판단이 처리 필요 정의(report_is_open)를 부른다');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('report_user', 'report_chat_message')
     and pg_get_functiondef(p.oid) like '%reviewed_at is null%'),
  0,
  '두 신고 문에 「검토 전 = reviewed_at is null」이 따로 남지 않는다');

select * from finish();
rollback;
