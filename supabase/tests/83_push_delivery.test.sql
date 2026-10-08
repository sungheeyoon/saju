-- 웹 푸시 — **내 기기의 구독만 만지고, 방 하나에 대기 줄 하나, 읽었거나 닫힌 방은 안 보낸다** (ADR 0156)
--
--   1. 브라우저 문 셋 — 저장 · 지우기 · 물어보기. 남의 구독은 못 지우고, 같은 endpoint 는 새 계정으로 옮긴다
--   2. 메시지가 받는 사람의 구독마다 대기 줄 하나를 세운다 — 보낸 사람 몫은 없고, 겹치지 않는다
--   3. 배달 문 둘(열쇠만) — 잡기 · 적기. 읽은 방 · 닫힌 방은 skipped, 실패는 1분 · 5분 · 30분 · 2시간 뒤 다섯 번째에 gave_up,
--      gone 은 구독을 지운다, 설정 안 됨은 시도 수를 안 올린다
--   4. 깨우기 — Vault 에 값이 없으면 아무 요청도 안 나가고, 있으면 그 문장에서 한 번 나간다
--   5. 보존 7일 · 크론 둘 · 탈퇴 처분이 구독을 데려간다
--   그리고 받는 푸시 서비스만 — 알려진 호스트 넷과 Vault 의 시험용 호스트(이 파일은 `push.example.com` 을 연다)
--
-- 같은 트랜잭션 안에서 `now()` 는 멈춰 있다 — 기한을 넘기는 자리는 `due_at` · `claimed_at` 을 손으로 당긴다.
begin;
select plan(85);

-- 이 파일의 endpoint 는 `push.example.com` 이다 — 시험용 호스트로 연다. 트랜잭션과 함께 걷힌다
delete from vault.secrets where name = 'push_extra_hosts';
select vault.create_secret('push.example.com', 'push_extra_hosts');

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select tests.signup('kim-push@example.com') as kim,
       tests.signup('lee-push@example.com') as lee,
       tests.signup('park-push@example.com') as park;
grant select on folks to authenticated, service_role;

insert into public.match (user_low, user_high)
select least(kim, lee), greatest(kim, lee) from folks;
insert into public.match (user_low, user_high)
select least(kim, park), greatest(kim, park) from folks;

create temporary table rooms as
select
  (select m.id from public.match m, folks f where m.user_low = least(f.kim, f.lee) and m.user_high = greatest(f.kim, f.lee)) as kim_lee,
  (select m.id from public.match m, folks f where m.user_low = least(f.kim, f.park) and m.user_high = greatest(f.kim, f.park)) as kim_park;
grant select on rooms to authenticated, service_role;

/** 이 파일이 만든 구독의 배달 줄만 */
create or replace function pg_temp.lines(p_endpoint text)
returns table (status text, attempts integer, due_in interval, match_id uuid)
language sql
as $$
  select d.status, d.attempts, d.due_at - now(), r.match_id
  from public.push_delivery d
  join public.push_subscription s on s.id = d.subscription_id
  join public.chat_room r on r.id = d.room_id
  where s.endpoint = p_endpoint
  order by d.created_at, d.id;
$$;

/** 기다리는 줄의 기한을 지금으로 당긴다 */
create or replace function pg_temp.due_now()
returns void
language sql
as $$
  update public.push_delivery d set due_at = now() - interval '1 second'
  where d.status = 'pending'
    and d.subscription_id in (select s.id from public.push_subscription s where s.endpoint like 'https://push.example.com/%');
$$;

/** 열쇠로 잡는다 — 이 파일의 endpoint 만 센다(다른 시험의 줄이 섞이지 않게 잡은 것 가운데서) */
create or replace function pg_temp.claim()
returns table (delivery_id uuid, endpoint text, match_id uuid, attempts integer)
language plpgsql
as $$
begin
  set local role service_role;
  return query
  select c.delivery_id, c.endpoint, c.match_id, c.attempts
  from public.claim_push_deliveries(500) c
  where c.endpoint like 'https://push.example.com/%';
  reset role;
end;
$$;

create or replace function pg_temp.settle(p_endpoint text, p_result text)
returns text
language plpgsql
as $$
declare
  answer text;
  target uuid;
begin
  select d.id into target
  from public.push_delivery d join public.push_subscription s on s.id = d.subscription_id
  where s.endpoint = p_endpoint and d.status = 'sending';
  set local role service_role;
  answer := public.settle_push_delivery(target, p_result);
  reset role;
  return answer;
end;
$$;

create or replace function pg_temp.send(sender uuid, p_match uuid, body text)
returns text
language plpgsql
as $$
declare
  answer text;
begin
  perform pg_temp.acting(sender);
  set local role authenticated;
  answer := public.send_chat_message(p_match, body);
  reset role;
  return answer;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. 브라우저 문 셋
-- ---------------------------------------------------------------------------

set local role authenticated;

select pg_temp.acting((select kim from folks));
select lives_ok(
  $$select public.save_push_subscription('https://push.example.com/kim', 'BKimKey_-1', 'kimAuth')$$,
  '김이 이 기기의 구독을 남긴다');
select lives_ok(
  $$select public.save_push_subscription('https://push.example.com/kim', 'BKimKey_-2', 'kimAuth2')$$,
  '같은 endpoint 를 다시 남기면 열쇠만 바뀐다');
select ok(public.push_subscription_registered('https://push.example.com/kim'), '김은 이 기기가 구독돼 있다고 듣는다');

select throws_ok(
  $$select public.save_push_subscription('http://push.example.com/plain', 'BKey', 'auth')$$,
  '22023', null, 'https 가 아닌 endpoint 는 거절한다');
select throws_ok(
  $$select public.save_push_subscription('https://push.example.com/bad', 'not base64!', 'auth')$$,
  '22023', null, 'base64url 이 아닌 열쇠는 거절한다');

select pg_temp.acting((select lee from folks));
select lives_ok(
  $$select public.save_push_subscription('https://push.example.com/lee', 'BLeeKey', 'leeAuth')$$,
  '이도 남긴다');
select ok(not public.push_subscription_registered('https://push.example.com/kim'), '이는 김의 endpoint 를 제 것이라고 듣지 않는다');
select is(public.remove_push_subscription('https://push.example.com/kim'), false, '이는 김의 구독을 못 지운다');

reset role;
select is(
  (select user_id from public.push_subscription where endpoint = 'https://push.example.com/kim'),
  (select kim from folks),
  '김의 구독은 그대로다');
select is(
  (select p256dh || ' ' || auth from public.push_subscription where endpoint = 'https://push.example.com/kim'),
  'BKimKey_-2 kimAuth2',
  '열쇠는 마지막 것이다');

-- 받는 푸시 서비스만 — 배달 문이 남이 고른 주소로 POST 하지 않게
select ok(public.push_endpoint_allowed('https://fcm.googleapis.com/fcm/send/abc'), 'Chrome(FCM)은 받는다');
select ok(public.push_endpoint_allowed('https://updates.push.services.mozilla.com/wpush/v2/abc'), 'Firefox 는 받는다');
select ok(public.push_endpoint_allowed('https://wns2-par02p.notify.windows.com/w/?token=abc'), 'Edge(WNS)는 받는다');
select ok(public.push_endpoint_allowed('https://web.push.apple.com/QKabc'), 'Safari 는 받는다');
select ok(not public.push_endpoint_allowed('https://evil.example/push'), '모르는 호스트는 안 받는다');
select ok(not public.push_endpoint_allowed('https://fcm.googleapis.com.evil.example/x'), '알려진 이름을 앞에 단 남의 호스트는 안 받는다');
select ok(not public.push_endpoint_allowed('https://evil.example@fcm.googleapis.com/x'), '사용자 칸을 끼운 주소는 안 받는다');
select ok(not public.push_endpoint_allowed('https://fcm.googleapis.com:8443/x'), '포트를 적은 주소는 안 받는다');
select ok(not public.push_endpoint_allowed('https://169.254.169.254/latest/meta-data'), '내부 주소는 안 받는다');
select ok(not public.push_endpoint_allowed('http://fcm.googleapis.com/x'), 'https 가 아니면 안 받는다');

delete from vault.secrets where name = 'push_extra_hosts';
select ok(not public.push_endpoint_allowed('https://push.example.com/x'), 'Vault 에 시험용 호스트가 없으면 닫혀 있다');
select vault.create_secret('push.example.com', 'push_extra_hosts');

set local role authenticated;
select pg_temp.acting((select kim from folks));
select throws_ok(
  $$select public.save_push_subscription('https://evil.example/push/kim', 'BKey', 'auth')$$,
  '22023', null, '모르는 푸시 서비스의 구독은 남기지 않는다');
reset role;

-- endpoint 옮김 — 한 브라우저에서 다른 계정이 켠다
set local role authenticated;
select pg_temp.acting((select lee from folks));
select lives_ok(
  $$select public.save_push_subscription('https://push.example.com/shared', 'BShared', 'sharedAuth')$$,
  '이가 공용 기기에서 켠다');
select pg_temp.acting((select park from folks));
select lives_ok(
  $$select public.save_push_subscription('https://push.example.com/shared', 'BShared2', 'sharedAuth2')$$,
  '같은 기기에서 박이 켠다');
select ok(public.push_subscription_registered('https://push.example.com/shared'), '그 기기는 이제 박의 것이다');
select pg_temp.acting((select lee from folks));
select ok(not public.push_subscription_registered('https://push.example.com/shared'), '이에게서는 빠졌다 — 앞 사람의 통보를 안 받는다');
reset role;

select is(
  (select count(*)::int from public.push_subscription where endpoint = 'https://push.example.com/shared'),
  1,
  'endpoint 는 하나다');

set local role anon;
select throws_ok(
  $$select public.save_push_subscription('https://push.example.com/anon', 'BKey', 'auth')$$,
  '42501', null, '로그인 안 한 사람은 못 부른다');
reset role;

-- 계정마다 열 개 — 넘치면 가장 오래 안 쓰인 것이 빠진다
update public.push_subscription set updated_at = now() - interval '1 day'
where endpoint = 'https://push.example.com/lee';

set local role authenticated;
select pg_temp.acting((select lee from folks));
select public.save_push_subscription('https://push.example.com/lee-' || g, 'BLeeKey', 'leeAuth')
from generate_series(1, 10) g;
reset role;

select is(
  (select count(*)::int from public.push_subscription where user_id = (select lee from folks)),
  10,
  '열한 번째가 서면 열 개만 남는다');
select is(
  (select count(*)::int from public.push_subscription where endpoint = 'https://push.example.com/lee'),
  0,
  '빠진 것은 가장 오래 안 쓰인 것이다');

delete from public.push_subscription where endpoint like 'https://push.example.com/lee-%';
insert into public.push_subscription (user_id, endpoint, p256dh, auth)
select lee, 'https://push.example.com/lee', 'BLeeKey', 'leeAuth' from folks;

-- ---------------------------------------------------------------------------
-- 2. 메시지가 대기 줄을 세운다
-- ---------------------------------------------------------------------------

select is(pg_temp.send((select lee from folks), (select kim_lee from rooms), '첫 메시지'), 'sent', '이가 김에게 보낸다');

select results_eq(
  $$select status, attempts, match_id from pg_temp.lines('https://push.example.com/kim')$$,
  $$values ('pending'::text, 0, (select kim_lee from rooms))$$,
  '받는 김의 구독에 대기 줄 하나가 선다');
select is_empty($$select * from pg_temp.lines('https://push.example.com/lee')$$, '보낸 이의 구독에는 안 선다');
select is(
  (select due_in from pg_temp.lines('https://push.example.com/kim')),
  interval '0',
  '처음 것은 바로 보낼 기한이다');

select is(pg_temp.send((select lee from folks), (select kim_lee from rooms), '둘째 메시지'), 'sent', '이가 한 번 더 보낸다');
select is(
  (select count(*)::int from pg_temp.lines('https://push.example.com/kim')),
  1,
  '같은 방의 다음 메시지는 대기 줄을 새로 만들지 않는다');

select is(
  (select count(*)::int from public.push_delivery d
   where d.room_id = (select r.id from public.chat_room r where r.match_id = (select kim_lee from rooms))
     and (to_jsonb(d)::text like '%메시지%')),
  0,
  '배달 줄에는 본문이 없다');

-- ---------------------------------------------------------------------------
-- 3. 잡고 적는다
-- ---------------------------------------------------------------------------

create temporary table first_claim as select * from pg_temp.claim();

select results_eq(
  $$select endpoint, match_id, attempts from first_claim$$,
  $$values ('https://push.example.com/kim'::text, (select kim_lee from rooms), 0)$$,
  '열쇠가 잡으면 endpoint · match_id · 시도 수가 온다');
select is((select status from pg_temp.lines('https://push.example.com/kim')), 'sending', '잡힌 줄은 sending 이다');
select is_empty($$select * from pg_temp.claim()$$, '한 번 잡힌 줄은 다시 안 잡힌다');

select is(pg_temp.settle('https://push.example.com/kim', 'sent'), 'sent', '보냈다고 적는다');
select ok(
  (select last_success_at is not null from public.push_subscription where endpoint = 'https://push.example.com/kim'),
  '구독에 마지막 성공 시각이 선다');

-- 60초 — 보낸 뒤의 다음 메시지는 그만큼 기다린다
select pg_temp.send((select lee from folks), (select kim_lee from rooms), '셋째 메시지');
select is(
  (select due_in from pg_temp.lines('https://push.example.com/kim') where status = 'pending'),
  interval '60 seconds',
  '보낸 뒤 60초 안의 메시지는 그 뒤가 기한이다');
select is_empty($$select * from pg_temp.claim()$$, '기한 전에는 안 잡힌다');

-- 60초는 **보낸 시각**부터다 — 보내는 중에 선 대기 줄은 그 보냄이 닫힐 때 보낸 시각 + 60초로 밀린다.
-- 잡고 10초 뒤에 보냈다고 흉내 낸다(같은 트랜잭션의 now() 는 멈춰 있으니 잡은 시각을 10초 앞으로 민다). 앞의 보냄은
-- 5분 전 일로 민다 — 그대로면 그 보낸 시각(멈춘 now())이 새 줄의 기한을 대신 정해 이 자리를 못 잰다.
update public.push_delivery set sent_at = now() - interval '5 minutes', settled_at = now() - interval '5 minutes'
where status = 'sent' and subscription_id = (select id from public.push_subscription where endpoint = 'https://push.example.com/kim');
select pg_temp.due_now();
select is((select count(*)::int from pg_temp.claim()), 1, '셋째 메시지의 줄을 잡는다');
update public.push_delivery set claimed_at = now() - interval '10 seconds'
where status = 'sending' and subscription_id = (select id from public.push_subscription where endpoint = 'https://push.example.com/kim');
select pg_temp.send((select lee from folks), (select kim_lee from rooms), '보내는 중에 온 메시지');
select is(pg_temp.settle('https://push.example.com/kim', 'sent'), 'sent', '잡은 지 10초 뒤에 보냈다');
select ok(
  (select due_in from pg_temp.lines('https://push.example.com/kim') where status = 'pending') >= interval '60 seconds',
  '보내는 중에 선 대기 줄의 기한은 보낸 시각 + 60초 뒤다 — 잡은 시각 + 60초(50초 뒤)가 아니다');

-- 기한이 틀려 있어도(닫는 문이 민 것을 놓친 경쟁 — `scripts/check-push-race.mjs`) 60초는 잡는 문이 지킨다
select pg_temp.due_now();
select is_empty($$select * from pg_temp.claim()$$, '기한을 당겨도 마지막 보냄 + 60초 전에는 잡지 않는다');
select is(
  (select due_in from pg_temp.lines('https://push.example.com/kim') where status = 'pending'),
  interval '60 seconds',
  '잡지 않은 줄의 기한은 마지막 보냄 + 60초로 다시 선다');

-- 읽었으면 skipped
set local role authenticated;
select pg_temp.acting((select kim from folks));
select public.mark_chat_read((select kim_lee from rooms), 9223372036854775807);
reset role;
select pg_temp.due_now();
select is_empty($$select * from pg_temp.claim()$$, '김이 이미 다 읽었으면 내주지 않는다');
select is(
  (select status from pg_temp.lines('https://push.example.com/kim') order by 1 desc limit 1),
  'skipped',
  '그 줄은 skipped 로 접힌다');

-- 다시 보내기 — 1분 · 5분 · 30분 · 2시간, 다섯 번째에 gave_up
-- 앞의 보냄은 5분 전 일로 민다 — 같은 트랜잭션의 now() 는 멈춰 있어 그대로면 잡는 문이 60초로 막는다
update public.push_delivery set sent_at = now() - interval '5 minutes', settled_at = now() - interval '5 minutes'
where status = 'sent' and subscription_id = (select id from public.push_subscription where endpoint = 'https://push.example.com/kim');
select pg_temp.send((select lee from folks), (select kim_lee from rooms), '넷째 메시지');
select pg_temp.due_now();

create temporary table backoff (n integer, answer text, due_in interval, attempts integer);
do $$
declare
  i integer;
begin
  for i in 1..5 loop
    perform pg_temp.claim();
    insert into backoff
    select i, pg_temp.settle('https://push.example.com/kim', 'retry'), null, null;
    update backoff b set due_in = l.due_in, attempts = l.attempts
    from (select * from pg_temp.lines('https://push.example.com/kim') l
          where l.status in ('pending', 'gave_up') order by l.status = 'pending' desc limit 1) l
    where b.n = i;
    perform pg_temp.due_now();
  end loop;
end;
$$;

select results_eq(
  $$select answer, due_in, attempts from backoff where n < 5 order by n$$,
  $$values ('pending'::text, interval '1 minute', 1), ('pending', interval '5 minutes', 2),
           ('pending', interval '30 minutes', 3), ('pending', interval '2 hours', 4)$$,
  '실패는 1분 · 5분 · 30분 · 2시간 뒤로 미룬다');
select is((select answer from backoff where n = 5), 'gave_up', '다섯 번째 실패에 접는다');
select is(
  (select count(*)::int from pg_temp.lines('https://push.example.com/kim') where status = 'pending'),
  0,
  '접힌 뒤에는 기다리는 줄이 없다');

-- 설정 안 됨 — 시도 수를 안 올린다
select pg_temp.send((select lee from folks), (select kim_lee from rooms), '다섯째 메시지');
select pg_temp.due_now();
select pg_temp.claim();
select is(pg_temp.settle('https://push.example.com/kim', 'unconfigured'), 'pending', '설정 안 됨은 기다리는 줄로 되돌린다');
select results_eq(
  $$select attempts, due_in from pg_temp.lines('https://push.example.com/kim') where status = 'pending'$$,
  $$values (0, interval '5 minutes')$$,
  '시도 수 그대로 5분 뒤다');

-- 묶음 마감에 놓아준 줄 — 시도 수를 안 올리고 지금이 기한이다
select pg_temp.due_now();
select pg_temp.claim();
select is(pg_temp.settle('https://push.example.com/kim', 'release'), 'pending', '놓아준 줄은 기다리는 줄로 되돌린다');
select results_eq(
  $$select attempts, due_in from pg_temp.lines('https://push.example.com/kim') where status = 'pending'$$,
  $$values (0, interval '0')$$,
  '시도 수 그대로 지금이 기한이다 — 다음 깨움에 잡힌다');

-- 보내는 중에 멈춘 줄 — 5분이 지나면 다시 잡히고 실패 한 번으로 센다
select pg_temp.due_now();
select pg_temp.claim();
update public.push_delivery set claimed_at = now() - interval '6 minutes' where status = 'sending'
  and subscription_id = (select id from public.push_subscription where endpoint = 'https://push.example.com/kim');
select results_eq(
  $$select attempts from pg_temp.claim()$$,
  $$values (1)$$,
  '5분 넘게 sending 인 줄은 다시 잡히고 시도 하나가 는다');

select throws_ok(
  $$select public.settle_push_delivery(gen_random_uuid(), 'maybe')$$,
  '22023', null, '모르는 결과는 거절한다');

select is(pg_temp.settle('https://push.example.com/kim', 'sent'), 'sent', '그 줄을 보냈다고 적는다');

-- 이미 적힌 줄은 다시 안 고친다
select is(
  (select public.settle_push_delivery(d.id, 'retry') from public.push_delivery d
   join public.push_subscription s on s.id = d.subscription_id
   where s.endpoint = 'https://push.example.com/kim' and d.status = 'sent' order by d.sent_at desc limit 1),
  'sent',
  'sending 이 아닌 줄은 건드리지 않고 지금 상태를 돌려준다');

-- 닫힌 방은 skipped
select pg_temp.send((select lee from folks), (select kim_lee from rooms), '여섯째 메시지');
select pg_temp.due_now();
insert into public.block (user_id, blocked_user_id) select kim, lee from folks;
select is_empty($$select * from pg_temp.claim()$$, '닫힌 방의 줄은 내주지 않는다');
select is(
  (select count(*)::int from pg_temp.lines('https://push.example.com/kim') where status = 'pending'),
  0,
  '닫힌 방의 줄은 skipped 로 접힌다');

-- gone — 구독을 지운다
select is(pg_temp.send((select park from folks), (select kim_park from rooms), '박의 메시지'), 'sent', '박이 김에게 보낸다');
select pg_temp.due_now();
select results_eq(
  $$select match_id from pg_temp.claim()$$,
  $$values ((select kim_park from rooms))$$,
  '다른 방의 줄은 잡힌다');
select is(pg_temp.settle('https://push.example.com/kim', 'gone'), 'gone', '404/410 이면 gone');
select is(
  (select count(*)::int from public.push_subscription where endpoint = 'https://push.example.com/kim'),
  0,
  'gone 은 구독을 지운다');

-- 받는 푸시 서비스가 아닌 구독(시험용 호스트를 걷은 뒤 남은 줄)은 잡혀도 내주지 않는다
insert into public.push_subscription (user_id, endpoint, p256dh, auth)
select kim, 'https://push.example.com/kim-3', 'BKimKey', 'kimAuth' from folks;
select pg_temp.send((select park from folks), (select kim_park from rooms), '닫힌 호스트');
select pg_temp.due_now();
delete from vault.secrets where name = 'push_extra_hosts';
select is_empty($$select * from pg_temp.claim()$$, '받는 푸시 서비스가 아닌 endpoint 는 내주지 않는다');
select is(
  (select status from pg_temp.lines('https://push.example.com/kim-3')),
  'skipped',
  '그 줄은 skipped 로 접힌다');
select vault.create_secret('push.example.com', 'push_extra_hosts');
delete from public.push_subscription where endpoint = 'https://push.example.com/kim-3';

-- 열쇠 말고는 못 부른다
set local role authenticated;
select pg_temp.acting((select kim from folks));
select throws_ok($$select * from public.claim_push_deliveries(10)$$, '42501', null, '로그인한 사람은 배달 줄을 못 잡는다');
select throws_ok($$select public.settle_push_delivery(gen_random_uuid(), 'sent')$$, '42501', null, '로그인한 사람은 결과를 못 적는다');
select throws_ok($$select count(*) from public.push_subscription$$, '42501', null, '구독 표는 직접 안 보인다');
reset role;
set local role anon;
select throws_ok($$select * from public.claim_push_deliveries(10)$$, '42501', null, '로그인 안 한 사람도 못 잡는다');
select throws_ok($$select public.settle_push_delivery(gen_random_uuid(), 'sent')$$, '42501', null, '로그인 안 한 사람도 못 적는다');
reset role;

-- ---------------------------------------------------------------------------
-- 4. 깨우기 — Vault 에 값이 있을 때만, 문장에서 한 번
-- ---------------------------------------------------------------------------

create temporary table queued_before as select count(*)::int as n from net.http_request_queue;

insert into public.push_subscription (user_id, endpoint, p256dh, auth)
select kim, 'https://push.example.com/kim-2', 'BKimKey', 'kimAuth' from folks;
select pg_temp.send((select park from folks), (select kim_park from rooms), '값 없을 때');

select is(
  (select count(*)::int from net.http_request_queue) - (select n from queued_before),
  0,
  'Vault 에 주소 · 비밀이 없으면 아무 요청도 안 나간다');

select vault.create_secret('https://dispatch.example.com/api/push/dispatch', 'push_dispatch_url');
select vault.create_secret('push-secret-for-tests', 'push_dispatch_secret');

update public.push_delivery set status = 'skipped', settled_at = now()
where status = 'pending'
  and subscription_id = (select id from public.push_subscription where endpoint = 'https://push.example.com/kim-2');

delete from net.http_request_queue where url = 'https://dispatch.example.com/api/push/dispatch';
select pg_temp.send((select park from folks), (select kim_park from rooms), '값 있을 때');

select results_eq(
  $$select method::text, headers ->> 'Authorization' from net.http_request_queue
    where url = 'https://dispatch.example.com/api/push/dispatch'$$,
  $$values ('POST'::text, 'Bearer push-secret-for-tests'::text)$$,
  '대기 줄이 서면 배달 문을 비밀 머리글과 함께 한 번 POST 한다');

select pg_temp.send((select park from folks), (select kim_park from rooms), '또 보냄');
select is(
  (select count(*)::int from net.http_request_queue where url = 'https://dispatch.example.com/api/push/dispatch'),
  1,
  '대기 줄이 안 서면(이미 기다린다) 다시 안 깨운다');

select is(public.wake_push_dispatch_when_due(), true, '크론의 손은 기한이 된 줄이 있으면 깨운다');
update public.push_delivery set due_at = now() + interval '1 hour' where status = 'pending';
update public.push_delivery set status = 'skipped', claimed_at = null, settled_at = now() where status = 'sending';
select is(public.wake_push_dispatch_when_due(), false, '기한이 된 줄이 없으면 안 깨운다');

-- ---------------------------------------------------------------------------
-- 5. 보존 · 크론 · 탈퇴
-- ---------------------------------------------------------------------------

update public.push_delivery set settled_at = now() - interval '8 days'
where status = 'skipped'
  and subscription_id = (select id from public.push_subscription where endpoint = 'https://push.example.com/kim-2');
insert into public.push_delivery (subscription_id, room_id, status, settled_at)
select s.id, r.id, 'skipped', now() - interval '6 days'
from public.push_subscription s, public.chat_room r
where s.endpoint = 'https://push.example.com/kim-2' and r.match_id = (select kim_lee from rooms);

select ok(retention.purge_settled_push_deliveries() >= 1, '접힌 지 7일 넘은 줄을 걷는다');
select is(
  (select count(*)::int from pg_temp.lines('https://push.example.com/kim-2') where status = 'skipped'),
  1,
  '6일 된 줄은 남는다');

select is(
  (select schedule || ' ' || command from cron.job where jobname = 'push-dispatch' and active),
  '* * * * * select public.wake_push_dispatch_when_due()',
  '크론 push-dispatch 가 1분마다 돈다');
select is(
  (select schedule || ' ' || command from cron.job where jobname = 'push-delivery-retention-purge' and active),
  '43 4 * * * select retention.purge_settled_push_deliveries()',
  '보존 크론이 하루 한 번 돈다');

delete from auth.users where id = (select park from folks);
select is(
  (select count(*)::int from public.push_subscription where endpoint = 'https://push.example.com/shared'),
  0,
  '탈퇴 처분(계정 삭제)이 구독을 데려간다');

select * from finish();
rollback;
