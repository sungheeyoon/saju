-- 계정마다 비공개 채널 하나 — **제 주제만 듣고, 트리거가 맞는 주제에 맞는 갈래를 내용 없이 보낸다** (ADR 0155)
--
--   a. `realtime.messages` 의 정책 — 남의 `user:` 주제는 못 읽고 제 것은 읽는다, 보내기(`insert`)는 안 된다
--   b. 메시지 · 읽음 · 방 닫힘 · 요청 상태 · 소식 · 풀이권 · 인연 궁합이 맞는 주제에 맞는 area 로 줄을 남기고 본문을 안 싣는다
--   c. `mark_chat_read(p_match_id, p_up_to_seq)` — 있는 seq 까지만 · 뒤로 안 간다 · 남의 방 거절. 옛 한 칸 서명은
--      좁히기(G-77)가 걷었다
--
-- 채널이 실제로 거절하는지 · 2초 안에 오는지는 소켓을 붙여야 안다 — `scripts/check-live-channel.mjs`.
--
-- `realtime.messages` 는 날마다 파티션이고 파티션은 Realtime 서버가 만든다. 오늘 것이 없으면 `realtime.send` 가 경고만
-- 남기고 지나가 이 파일이 아무것도 못 잰다 — 그래서 없을 때만 오늘 몫을 세운다(트랜잭션이 되돌린다).
begin;
select plan(55);

do $$
begin
  execute format(
    'create table realtime.messages_pgtap_today partition of realtime.messages for values from (%L) to (%L)',
    localtimestamp::date, localtimestamp::date + 1);
exception when others then
  null; -- 이미 오늘 몫이 있다
end;
$$;

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select tests.signup('kim-live@example.com') as kim,
       tests.signup('lee-live@example.com') as lee,
       tests.signup('park-live@example.com') as park;
grant select on folks to authenticated;

/** 이 사람의 주제에 남은 `changed` 를 차례대로 — area · match_id · seq 와 실린 열쇠 전부 */
create or replace function pg_temp.heard(uid uuid)
returns table (area text, match_id uuid, seq bigint, keys text)
language sql
as $$
  select m.payload ->> 'area', (m.payload ->> 'match_id')::uuid, (m.payload ->> 'seq')::bigint,
         (select string_agg(k, ',' order by k) from jsonb_object_keys(m.payload) k)
  from realtime.messages m
  where m.topic = 'user:' || uid::text and m.event = 'changed'
  order by m.inserted_at, m.id;
$$;

create or replace function pg_temp.forget()
returns void
language sql
as $$
  delete from realtime.messages m
  where m.topic in (select 'user:' || u::text from folks f, lateral (values (f.kim), (f.lee), (f.park)) v(u));
$$;

/** 김 · 이의 Match 와 방 — 문을 안 거치고 세운다(이 파일이 재는 것은 트리거다) */
insert into public.match (user_low, user_high)
select least(kim, lee), greatest(kim, lee) from folks;

create temporary table rooms as
select m.id as kim_lee, r.id as room
from public.match m join public.chat_room r on r.match_id = m.id
where m.user_low = (select least(kim, lee) from folks) and m.user_high = (select greatest(kim, lee) from folks);
grant select on rooms to authenticated;

-- ---------------------------------------------------------------------------
-- b. 방이 서면 — 둘에게 chat · requests
-- ---------------------------------------------------------------------------

select set_eq(
  $$select area, match_id from pg_temp.heard((select kim from folks))$$,
  $$values ('chat', (select kim_lee from rooms)), ('requests', (select kim_lee from rooms))$$,
  'Match 가 서면 김은 방(chat)과 인연(requests)을 match_id 와 함께 듣는다');

select set_eq(
  $$select area, match_id from pg_temp.heard((select lee from folks))$$,
  $$values ('chat', (select kim_lee from rooms)), ('requests', (select kim_lee from rooms))$$,
  '이도 같다');

select is_empty($$select * from pg_temp.heard((select park from folks))$$, '박은 아무것도 안 듣는다');

-- ---------------------------------------------------------------------------
-- a. 정책 — 제 주제만 읽고, 보내지 못한다
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.acting((select kim from folks));

select set_config('realtime.topic', 'user:' || (select kim from folks)::text, true);
select ok(
  (select count(*) from realtime.messages where extension = 'broadcast') >= 2,
  '김은 제 주제(user:김)의 broadcast 를 읽는다');

select set_config('realtime.topic', 'user:' || (select lee from folks)::text, true);
select is(
  (select count(*)::int from realtime.messages),
  0,
  '김이 이의 주제(user:이)로 들어서면 한 줄도 안 보인다 — 채널이 거절된다');

select set_config('realtime.topic', 'room:' || (select kim_lee from rooms)::text, true);
select is((select count(*)::int from realtime.messages), 0, '다른 모양의 주제도 안 보인다');

select set_config('realtime.topic', 'user:' || (select kim from folks)::text, true);
select throws_ok(
  $$insert into realtime.messages (topic, extension, event, payload, private)
    values ('user:' || (select kim from folks)::text, 'broadcast', 'changed', '{}', true)$$,
  '42501',
  null,
  '제 주제라도 보내지(insert) 못한다 — 보내는 것은 트리거뿐이다');

select throws_ok(
  $$select public.tell_changed((select lee from folks), 'chat')$$,
  '42501',
  null,
  '보내는 손(tell_changed)은 로그인한 사람에게 닫혀 있다');

reset role;
select set_config('realtime.topic', 'user:' || (select kim from folks)::text, true);
set local role anon;
select is((select count(*)::int from realtime.messages), 0, '로그인 안 한 사람은 아무 주제도 못 읽는다');
reset role;
select set_config('realtime.topic', '', true);

-- ---------------------------------------------------------------------------
-- b. 메시지 — 둘 다 듣고, seq 를 싣고, 본문은 없다
-- ---------------------------------------------------------------------------

select pg_temp.forget();

set local role authenticated;
select pg_temp.acting((select kim from folks));
select is(public.send_chat_message((select kim_lee from rooms), '비밀스러운 본문'), 'sent', '김이 보낸다');
reset role;

create temporary table first_seq as
select max(seq) as s from public.chat_message where room_id = (select room from rooms);

select results_eq(
  $$select area, match_id, seq from pg_temp.heard((select lee from folks))$$,
  $$values ('chat', (select kim_lee from rooms), (select s from first_seq))$$,
  '받는 이는 chat · match_id · seq 하나를 듣는다');

select results_eq(
  $$select area, match_id, seq from pg_temp.heard((select kim from folks))$$,
  $$values ('chat', (select kim_lee from rooms), (select s from first_seq))$$,
  '보낸 김도 듣는다 — 다른 탭');

select is(
  (select distinct keys from pg_temp.heard((select lee from folks))),
  'area,id,match_id,seq',
  '실린 열쇠는 area · match_id · seq 와 realtime.send 가 붙이는 id 뿐이다');

select is(
  (select count(*)::int from realtime.messages
   where topic like 'user:%' and payload::text like '%비밀스러운%'),
  0,
  '본문은 어느 주제에도 안 실린다');

select is(
  (select count(*)::int from realtime.messages
   where topic = 'user:' || (select lee from folks)::text
     and (payload::text like '%' || (select kim from folks)::text || '%'
          or payload::text like '%kim-live%')),
  0,
  '상대의 id · 닉네임도 안 실린다');

select is_empty($$select * from pg_temp.heard((select park from folks))$$, '방 밖의 박은 못 듣는다');

-- 한 문장에 여러 줄 — 사람마다 한 번
select pg_temp.forget();
insert into public.chat_message (room_id, sender_user_id, body)
select (select room from rooms), (select kim from folks), '묶음 ' || g from generate_series(1, 3) g;

select is(
  (select count(*)::int from pg_temp.heard((select lee from folks))),
  1,
  '한 문장에 세 줄이 서도 이는 한 번만 듣는다');

select is(
  (select seq from pg_temp.heard((select lee from folks))),
  (select max(seq) from public.chat_message where room_id = (select room from rooms)),
  '그 한 번은 가장 큰 seq 를 싣는다');

-- ---------------------------------------------------------------------------
-- c. mark_chat_read — 있는 seq 까지만, 앞으로만, 남의 방 거절
-- ---------------------------------------------------------------------------

create temporary table seqs as
select array_agg(seq order by seq) as s from public.chat_message where room_id = (select room from rooms);
grant select on seqs to authenticated;

select pg_temp.forget();

set local role authenticated;
select pg_temp.acting((select lee from folks));

select is(
  public.mark_chat_read((select kim_lee from rooms), (select s[2] from seqs)),
  (select s[2] from seqs),
  '본 데까지(둘째 메시지) 적는다');

select is(
  (select unread_count from public.my_chat_rooms() where match_id = (select kim_lee from rooms)),
  2,
  '그 뒤의 둘은 아직 안 읽은 채다');

select is(
  public.mark_chat_read((select kim_lee from rooms), (select s[1] from seqs)),
  (select s[2] from seqs),
  '늦게 온 작은 seq 는 읽은 자리를 뒤로 물리지 않는다');

select is(
  public.mark_chat_read((select kim_lee from rooms), (select s[4] from seqs) + 1000000),
  (select s[4] from seqs),
  '없는 큰 seq 를 주어도 방에 실제로 있는 마지막 seq 까지만 간다');

select is(
  public.mark_chat_read((select kim_lee from rooms), 0),
  (select s[4] from seqs),
  '0 은 아무것도 안 움직인다');

select throws_ok(
  format($$select public.mark_chat_read(%L, null)$$, (select kim_lee from rooms)),
  '22023',
  null,
  'seq 없이 부르면 거절한다');

select pg_temp.acting((select park from folks));
select throws_ok(
  format($$select public.mark_chat_read(%L, 1)$$, (select kim_lee from rooms)),
  '42501',
  'chat: no such room',
  '남의 방은 없는 방과 같은 답이다');

reset role;

select results_eq(
  $$select area, match_id, seq from pg_temp.heard((select lee from folks))$$,
  $$values ('chat', (select kim_lee from rooms), null::bigint), ('chat', (select kim_lee from rooms), null::bigint)$$,
  '읽은 자리가 움직인 두 번만 읽은 이가 듣는다 — 안 움직인 부름은 조용하다');

select is_empty($$select * from pg_temp.heard((select kim from folks))$$, '상대 김은 읽음을 안 듣는다 — 읽음 표시는 범위 밖이다');

-- ---------------------------------------------------------------------------
-- b. 방이 닫힌다 — 차단, 그리고 떠남
-- ---------------------------------------------------------------------------

select pg_temp.forget();
insert into public.block (user_id, blocked_user_id) select kim, lee from folks;

select ok(
  ('chat', (select kim_lee from rooms)) in (select area, match_id from pg_temp.heard((select lee from folks))),
  '차단으로 방이 닫히면 이도 chat 을 듣는다 — 화면이 방 상태를 다시 읽는다');

select ok(
  ('chat', (select kim_lee from rooms)) in (select area, match_id from pg_temp.heard((select kim from folks))),
  '김도 듣는다');

select is(
  (select count(*)::int from realtime.messages
   where topic like 'user:%' and payload::text ~ '(block|closed|reason)'),
  0,
  '닫힌 까닭은 안 실린다');

-- 떠남 — 참여자 칸이 빈다(`set null`). 남은 사람만 듣는다
insert into public.match (user_low, user_high)
select least(kim, park), greatest(kim, park) from folks;

create temporary table room_park as
select m.id as kim_park from public.match m
where m.user_low = (select least(kim, park) from folks) and m.user_high = (select greatest(kim, park) from folks);

select pg_temp.forget();
delete from auth.users where id = (select park from folks);

select ok(
  ('chat', (select kim_park from room_park)) in (select area, match_id from pg_temp.heard((select kim from folks))),
  '상대가 떠나 방이 닫히면 남은 김이 듣는다');

select is(
  (select count(*)::int from realtime.messages where topic = 'user:' || (select park from folks)::text),
  0,
  '떠난 자리에는 아무것도 안 보낸다');

-- ---------------------------------------------------------------------------
-- b. 요청 — 생김 · 상태 · 만료
-- ---------------------------------------------------------------------------

create temporary table more as
select tests.signup('choi-live@example.com') as choi, tests.signup('jung-live@example.com') as jung;

select pg_temp.forget();
delete from realtime.messages where topic in (select 'user:' || choi::text from more union all select 'user:' || jung::text from more);

insert into public.match_request (
  requester_user_id, addressee_user_id, policy_version, supplied_to_requester, supplied_to_addressee, balance_band)
select choi, jung, 'policy-for-tests', '{}', '{}', 'balanced' from more;

select results_eq(
  $$select area, match_id from pg_temp.heard((select jung from more))$$,
  $$values ('requests', null::uuid)$$,
  '요청이 오면 받는 사람이 requests 를 듣는다');

select set_eq(
  $$select area, match_id from pg_temp.heard((select choi from more))$$,
  $$values ('requests', null::uuid), ('credits', null::uuid)$$,
  '보낸 사람도 requests 를 듣고, 요청이 풀이권 하나를 잡아 credits 도 듣는다');

delete from realtime.messages where topic like 'user:%' and topic in (
  select 'user:' || choi::text from more union all select 'user:' || jung::text from more);

update public.match_request set expires_at = now() - interval '1 minute'
where requester_user_id = (select choi from more);

select ok(public.expire_match_requests() >= 1, '만료 크론이 요청을 접는다');

select ok(
  ('requests') in (select area from pg_temp.heard((select jung from more))),
  '만료(크론의 쓰기)도 받는 사람에게 requests 로 선다');

select ok(
  ('notifications') in (select area from pg_temp.heard((select choi from more))),
  '만료 소식이 선 보낸 사람은 notifications 도 듣는다');

select is(
  (select count(*)::int from pg_temp.heard((select choi from more)) where area = 'requests'),
  1,
  '한 문장의 만료는 사람마다 requests 한 번이다');

-- 크론은 1분마다 돈다(ADR 0155) — 접을 것이 없는 분에는 쓰기도 이벤트도 없어야 매분 빈 소리가 안 난다.
-- 남은 것을 먼저 다 접고, 그다음 한 번이 아무 줄도 안 남기는지 본다(남의 행과 무관하게 전체를 센다).
select public.expire_match_requests();
create temporary table quiet_before as
select (select count(*) from realtime.messages) as sent,
       (select count(*) from public.notification) as told,
       (select string_agg(ctid::text, ',' order by id) from public.match_request) as last_write; -- 한 트랜잭션 안이라 xmin 은 못 가른다 — 고쳐 쓰면 ctid 가 옮는다

select is(public.expire_match_requests(), 0, '접을 것이 없으면 크론은 0 을 낸다');

select is(
  (select count(*) from realtime.messages) - (select sent from quiet_before),
  0::bigint,
  '접을 것이 없는 분에는 realtime.messages 에 줄이 안 생긴다');

select is(
  (select count(*) from public.notification) - (select told from quiet_before),
  0::bigint,
  '접을 것이 없는 분에는 소식도 안 선다');

select is(
  (select string_agg(ctid::text, ',' order by id) from public.match_request),
  (select last_write from quiet_before),
  '접을 것이 없는 분에는 요청 행을 고쳐 쓰지 않는다');

select is(
  (select schedule || ' ' || command from cron.job where jobname = 'match-request-expiry' and active),
  '* * * * * select public.expire_match_requests()',
  '만료 크론은 1분마다 돈다 — 요청 만료가 상대 화면에 1분 안에 선다');

select is(
  (select count(*)::int from cron.job where jobname = 'match-request-expiry'),
  1,
  '만료 크론은 하나다 — 다시 걸어도 둘이 되지 않는다');

-- ---------------------------------------------------------------------------
-- b. 소식 · 풀이권
-- ---------------------------------------------------------------------------

delete from realtime.messages where topic in (select 'user:' || choi::text from more union all select 'user:' || jung::text from more);

insert into public.notification (user_id, kind)
select jung, k from more, (values ('request_received'), ('reading_ready')) v(k);

select results_eq(
  $$select area from pg_temp.heard((select jung from more))$$,
  $$values ('notifications')$$,
  '소식 둘이 한 문장에 서면 주인은 notifications 를 한 번 듣는다');

delete from realtime.messages where topic = 'user:' || (select jung from more)::text;
update public.notification set read_at = now() where user_id = (select jung from more);

select results_eq(
  $$select area from pg_temp.heard((select jung from more))$$,
  $$values ('notifications')$$,
  '읽음으로 바뀌어도 듣는다');

select is_empty($$select * from pg_temp.heard((select choi from more))$$, '남의 소식은 안 듣는다');

delete from realtime.messages where topic = 'user:' || (select jung from more)::text;
insert into public.reading_credit_grant (user_id, extra, note) select jung, 2, 'live-test' from more;

select results_eq(
  $$select area, match_id from pg_temp.heard((select jung from more))$$,
  $$values ('credits', null::uuid)$$,
  '풀이권이 부여되면 그 계정이 credits 를 듣는다');

-- ---------------------------------------------------------------------------
-- b. 인연 궁합 — 끝나면 두 사람
-- ---------------------------------------------------------------------------

insert into public.match (user_low, user_high)
select least(choi, jung), greatest(choi, jung) from more;

create temporary table pair_run as
select m.id as match_id from public.match m
where m.user_low = (select least(choi, jung) from more) and m.user_high = (select greatest(choi, jung) from more);

insert into public.reading_run (user_id, kind, match_id, idempotency_key)
select choi, 'match', (select match_id from pair_run), 'live-test-run-1' from more;

delete from realtime.messages where topic in (select 'user:' || choi::text from more union all select 'user:' || jung::text from more);

update public.reading_run set status = 'failed', failure_code = 'provider_error', finished_at = now()
where idempotency_key = 'live-test-run-1';

select ok(
  ('requests', (select match_id from pair_run)) in (select area, match_id from pg_temp.heard((select jung from more))),
  '인연 궁합이 실패하면 누르지 않은 상대도 requests · match_id 를 듣는다');

select ok(
  ('requests', (select match_id from pair_run)) in (select area, match_id from pg_temp.heard((select choi from more))),
  '누른 사람도 듣는다');

-- ---------------------------------------------------------------------------
-- 문의 모양
-- ---------------------------------------------------------------------------

-- 좁혔다(G-77) — 옛 한 칸 서명 `mark_chat_read(p_match_id)` 는 걷혔고 새 두 칸 서명 하나만 선다.
select set_eq(
  $$select pg_get_function_identity_arguments(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'mark_chat_read'$$,
  $$values ('p_match_id uuid, p_up_to_seq bigint')$$,
  '읽음 문은 새 두 칸 서명 하나뿐이다 — 옛 한 칸 서명은 걷혔다(G-77)');

select ok(
  has_function_privilege('authenticated', 'public.mark_chat_read(uuid, bigint)', 'execute')
  and not has_function_privilege('anon', 'public.mark_chat_read(uuid, bigint)', 'execute'),
  '새 서명은 로그인한 사람에게만 열린다');

select is(
  (select count(*)::int from pg_policies where schemaname = 'realtime' and tablename = 'messages' and cmd <> 'SELECT'),
  0,
  'realtime.messages 에 보내기 · 고치기 정책은 없다');

select ok(
  not has_function_privilege('service_role', 'public.tell_changed(uuid, text, uuid, bigint)', 'execute')
  and not has_function_privilege('anon', 'public.tell_changed(uuid, text, uuid, bigint)', 'execute'),
  '보내는 손은 어느 역할에도 안 열린다');

select is(
  (select count(*)::int from realtime.messages where topic = 'user:' || (select kim from folks)::text and private = false),
  0,
  '트리거가 보낸 것은 전부 비공개(private) 다');

select * from finish();
rollback;
