-- 사진 청소는 매시간 — 임대 · 다음 시간에 다시 · 첫 실패 알림 · 깨우기 · 감시 둘 (`20261229090000`, ADR 0204)
--
-- 여기서 재는 것.
--
-- 1. **겹치면 하나만** — 임대를 쥔 실행만 놓고, 죽은 실행의 임대는 만료되면 풀린다. 끝까지 돈 실행은 시각과 수를 남긴다
-- 2. **못 지우면 다음 시간에 다시, 첫 실패부터 알린다** — 같은 실패를 두 번 적어도(겹친 실행) 시도 수는 한 번 는다
-- 3. **꺼진 동안 감시는 조용하다** — Vault 의 주소가 없으면 멈춘 청소 · 남은 줄이 있어도 알리지 않는다
-- 4. **깨우기는 Vault 의 주소(`photo_sweep_url`)와 비밀(복구기와 같은 `reading_recovery_secret`)이 둘 다 있어야 GET 하나** —
--    DB 반영만으로 청소 호출이 시작되지 않는다
-- 5. **감시 둘** — 켠 직후는 멈춤으로 안 센다, 3시간 · 12시간 문턱, 하루 한 번, 알림에 열쇠(계정 id)가 안 실린다
-- 6. 잡 둘과 문의 권한
begin;
select plan(28);

/** 배선된 DB · 다른 시험이 남긴 것과 섞이지 않게 — 트랜잭션 안이라 되돌아간다 */
delete from vault.secrets where name in ('photo_sweep_url', 'reading_recovery_secret');
delete from public.photo_object_trash;
delete from public.ops_alert where kind in ('photo-trash-failed', 'photo-trash-lingering', 'photo-sweep-stale', 'photo-trash-stuck');
update public.photo_sweep_state
set holder = null, held_until = null, last_finished_at = null, last_deleted = null, last_failed = null;

create temporary table runs (k text primary key, v uuid);
grant select, insert on runs to service_role;

-- ── 1. 겹치면 하나만 ─────────────────────────────────────────────────────────

set local role service_role;
insert into runs values ('first', public.photo_sweep_begin());
select ok((select v from runs where k = 'first') is not null, '1. 비었으면 임대를 잡는다');
select ok(public.photo_sweep_begin() is null, '1. 살아 있는 임대가 있으면 뒤 실행은 빈손이다 — pg_cron 과 Vercel 이 겹쳐도 하나만');
select ok(not public.photo_sweep_finish(gen_random_uuid(), 3, 0), '1. 쥐지 않은 실행은 놓지 못한다');
select ok(public.photo_sweep_finish((select v from runs where k = 'first'), 3, 1), '1. 쥔 실행이 놓는다');
reset role;

select results_eq(
  $$select holder is null, last_finished_at = now(), last_deleted, last_failed from public.photo_sweep_state$$,
  $$values (true, true, 3, 1)$$,
  '1. 끝까지 돈 실행의 시각과 수가 남는다 — 못 지운 것이 있어도 끝까지 돈 실행이다');

set local role service_role;
insert into runs values ('second', public.photo_sweep_begin());
reset role;
/** 둘째 실행이 죽었다고 친다 — 임대가 지났다 */
update public.photo_sweep_state set held_until = now() - interval '1 second';
set local role service_role;
insert into runs values ('third', public.photo_sweep_begin());
select ok((select v from runs where k = 'third') is not null
          and (select v from runs where k = 'third') <> (select v from runs where k = 'second'),
  '1. 죽은 실행의 임대는 만료되면 다음 실행이 잡는다');
select ok(not public.photo_sweep_finish((select v from runs where k = 'second'), 0, 0),
  '1. 임대를 잃은 실행은 끝을 적지 못한다');
reset role;

-- ── 2. 못 지우면 다음 시간에 다시, 첫 실패부터 알린다 ──────────────────────────

/** 시험은 한 트랜잭션이라 `now()` 가 멈춰 있다 — 줄의 차례를 그보다 앞으로 당겨야 차례가 온 줄이다 */
insert into public.photo_object_trash (object_key, queued_at, next_try_at)
values ('photos/0f8b2f6e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/00000000-0000-4000-8000-000000000001', now(), now() - interval '1 minute');

set local role service_role;
select ok(public.photo_trash_settle(null, array['photos/0f8b2f6e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/00000000-0000-4000-8000-000000000001'], 'delete:accessdenied'),
  '2. 첫 실패에 운영 알림을 낸다');
reset role;

select results_eq(
  $$select attempts, next_try_at = now() + interval '30 minutes', last_error from public.photo_object_trash$$,
  $$values (1, true, 'delete:accessdenied'::text)$$,
  '2. 못 지운 줄은 30분 뒤에 차례가 온다 — 다음 매시 실행(한 시간 뒤)이 줍는다');

set local role service_role;
select ok(not public.photo_trash_settle(null, array['photos/0f8b2f6e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/00000000-0000-4000-8000-000000000001'], 'delete:accessdenied'),
  '2. 같은 실패를 다시 적어도(겹친 실행) 알림을 또 내지 않는다');
reset role;
select is((select attempts from public.photo_object_trash), 1,
  '2. 같은 실패를 다시 적어도 시도 수는 한 번 는다 — 차례가 온 줄만 다시 둔다');

/** 한 시간 뒤 — 차례가 왔다 */
update public.photo_object_trash set next_try_at = now() - interval '1 minute';
set local role service_role;
select public.photo_trash_settle(null, array['photos/0f8b2f6e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/00000000-0000-4000-8000-000000000001'], 'delete:accessdenied');
reset role;

select results_eq(
  $$select attempts, next_try_at = now() + interval '30 minutes' from public.photo_object_trash$$,
  $$values (2, true)$$,
  '2. 다음 실패도 같은 간격이다 — 늘리지 않는다');
select results_eq(
  $$select kind from public.ops_alert where kind like 'photo-%' order by kind$$,
  $$values ('photo-trash-failed'::text)$$,
  '2. 알림은 종류마다 하루 한 줄이고, 옛 종류(photo-trash-stuck)는 안 낸다');

-- ── 3. 꺼진 동안 감시는 조용하다 ─────────────────────────────────────────────

update public.photo_sweep_state set last_finished_at = now() - interval '1 day';

select is(public.watch_photo_sweep(now() + interval '13 hours'), 0,
  '3. Vault 주소가 없으면 감시는 조용하다 — 멈춘 지 하루 · 13시간 남은 줄이 있어도');
select is((select count(*)::int from public.ops_alert where kind in ('photo-sweep-stale', 'photo-trash-lingering')), 0,
  '3. 꺼진 동안 거짓 알림이 없다');

-- ── 4. 깨우기 ────────────────────────────────────────────────────────────────

create temporary table queued_before as select count(*)::int as n from net.http_request_queue;

select vault.create_secret('cron-secret-for-tests', 'reading_recovery_secret');
select public.wake_photo_sweep();
select is((select count(*)::int from net.http_request_queue) - (select n from queued_before), 0,
  '4. Vault 에 청소 주소가 없으면 아무 요청도 안 나간다 — 비밀(복구기의 것)이 운영에 이미 있어도. DB 반영만으로 청소가 불리지 않는다');

delete from vault.secrets where name = 'reading_recovery_secret';
select vault.create_secret('https://sweep.example.com/api/cron/photo-sweep', 'photo_sweep_url');
select public.wake_photo_sweep();
select is((select count(*)::int from net.http_request_queue) - (select n from queued_before), 0,
  '4. 주소만 있고 비밀이 없어도 안 나간다');

select vault.create_secret('cron-secret-for-tests', 'reading_recovery_secret');
select public.wake_photo_sweep();
select results_eq(
  $$select method::text, headers ->> 'Authorization', timeout_milliseconds from net.http_request_queue
    where url = 'https://sweep.example.com/api/cron/photo-sweep'$$,
  $$values ('GET'::text, 'Bearer cron-secret-for-tests'::text, 70000)$$,
  '4. 둘 다 있으면 청소 주소를 비밀 머리글과 함께 한 번 GET 한다 — 라우트의 60초보다 넉넉한 문턱');

-- ── 5. 감시 둘 — 켠 뒤 ───────────────────────────────────────────────────────

/** 켜기 전의 마지막 실행은 하루 전이다(3 에서). 주소는 방금 넣었다 */
select is(public.watch_photo_sweep(now() + interval '2 hours'), 0,
  '5. 켠 직후는 멈춤으로 안 센다 — 켜기 전의 마지막 실행이 오래됐어도 켠 때부터 센다');

update public.photo_sweep_state set last_finished_at = now() + interval '9 hours';
select is(public.watch_photo_sweep(now() + interval '11 hours'), 0,
  '5. 문턱 아래는 조용하다 — 끝난 지 2시간 · 줄이 선 지 11시간');

select is(public.watch_photo_sweep(now() + interval '12 hours 1 minute'), 2,
  '5. 끝난 지 3시간 · 줄이 선 지 12시간을 넘으면 둘 다 알린다');
select is(public.watch_photo_sweep(now() + interval '12 hours 1 minute'), 0,
  '5. 같은 날 다시 보면 새로 알리는 것이 없다');

select ok(
  (select detail like '%3시간%' and detail like '%KST%' from public.ops_alert where kind = 'photo-sweep-stale'),
  '5. 멈춘 청소 알림은 몇 시간째인지와 마지막 실행 시각을 싣는다');
select ok(
  (select detail like '%1개%' and detail like '%delete:accessdenied%' and detail not like '%photos/%'
   from public.ops_alert where kind = 'photo-trash-lingering'),
  '5. 남은 줄 알림은 개수와 분류만 싣는다 — 열쇠(계정 id)는 안 싣는다');

-- ── 6. 잡 둘과 문의 권한 ─────────────────────────────────────────────────────

select results_eq(
  $$select jobname::text, schedule::text from cron.job
    where jobname in ('photo-sweep-wake', 'photo-sweep-watch') order by jobname$$,
  $$values ('photo-sweep-wake'::text, '33 * * * *'::text), ('photo-sweep-watch'::text, '53 * * * *'::text)$$,
  '6. 매시 33분에 깨우고 53분에 본다');

select ok(
  has_function_privilege('service_role', 'public.photo_sweep_begin()', 'execute')
  and has_function_privilege('service_role', 'public.photo_sweep_finish(uuid, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.photo_sweep_begin()', 'execute')
  and not has_function_privilege('authenticated', 'public.photo_sweep_finish(uuid, integer, integer)', 'execute')
  and not has_function_privilege('anon', 'public.photo_sweep_begin()', 'execute'),
  '6. 임대 문 둘은 열쇠에만 열린다');

select ok(
  not has_function_privilege('service_role', 'public.wake_photo_sweep()', 'execute')
  and not has_function_privilege('authenticated', 'public.wake_photo_sweep()', 'execute')
  and not has_function_privilege('service_role', 'public.watch_photo_sweep(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.watch_photo_sweep(timestamptz)', 'execute'),
  '6. 깨우기 · 감시는 아무에게도 안 열린다 — 크론만 부른다(열면 Vault 의 비밀을 싣는 요청을 아무나 만든다)');

set local role authenticated;
select throws_ok($$select * from public.photo_sweep_state$$, '42501', null,
  '6. 임대 줄은 로그인한 사람이 못 읽는다');
reset role;

select * from finish();
rollback;
