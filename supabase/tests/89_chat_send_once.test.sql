-- 보낸 말은 보낸 사람이 지은 id 로 한 번만 남는다 — **응답을 잃고 다시 보내도 두 번 서지 않는다** (ADR 0155 덧)
--
--   a. 같은 id 로 두 번 보내면 둘 다 `sent` 이고 줄은 하나다 — 다시 보낸 것은 한도도 안 센다
--   b. 그 사이 방이 닫혔어도 이미 받은 id 는 `sent`, 새 id 는 `closed`
--   c. 상대가 우연히 같은 id 를 써도 서로 막지 않는다
--   d. `my_chat_messages` 는 id 를 내 말에만 싣는다
--   e. id 없이는 안 받는다 · 로그인 안 한 사람에게 닫혀 있다 · 옛 두 칸 서명은 아직 돈다(넓히기, G-96)
begin;
select plan(14);

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select tests.signup('kim-once@example.com') as kim,
       tests.signup('lee-once@example.com') as lee;
grant select on folks to authenticated;

insert into public.match (user_low, user_high)
select least(kim, lee), greatest(kim, lee) from folks;

create temporary table rooms as
select m.id as kim_lee, r.id as room
from public.match m join public.chat_room r on r.match_id = m.id
where m.user_low = (select least(kim, lee) from folks) and m.user_high = (select greatest(kim, lee) from folks);
grant select on rooms to authenticated;

create temporary table ids as
select gen_random_uuid() as first, gen_random_uuid() as late, gen_random_uuid() as shut;
grant select on ids to authenticated;

-- ---------------------------------------------------------------------------
-- a. 같은 id 두 번 — 줄은 하나
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.acting((select kim from folks));

select is(public.send_chat_message((select kim_lee from rooms), '안녕', (select first from ids)), 'sent', '김이 보낸다');
select is(
  public.send_chat_message((select kim_lee from rooms), '안녕', (select first from ids)),
  'sent',
  '응답을 잃고 같은 id 로 다시 보내도 sent 다');

reset role;
select is(
  (select count(*)::int from public.chat_message where room_id = (select room from rooms)),
  1,
  '같은 id 의 두 전송은 줄 하나로 남는다');

-- 한도를 채운다 — 이미 받은 id 는 한도에 걸리지 않고, 새 id 는 걸린다
insert into public.chat_message (room_id, sender_user_id, body)
select (select room from rooms), (select kim from folks), '채움 ' || g from generate_series(1, 29) g;

set local role authenticated;
select pg_temp.acting((select kim from folks));
select is(
  public.send_chat_message((select kim_lee from rooms), '안녕', (select first from ids)),
  'sent',
  '한도가 찬 뒤에도 이미 받은 id 는 sent 다 — 새 전송이 아니다');
select is(
  public.send_chat_message((select kim_lee from rooms), '늦은 말', (select late from ids)),
  'rate_limited',
  '새 id 는 한도에 걸린다');

reset role;
select is(
  (select count(*)::int from public.chat_rate_limit_hit where user_id = (select kim from folks)),
  1,
  '거절 기록은 새 id 의 한 건뿐이다');
delete from public.chat_message where room_id = (select room from rooms) and client_id is null;

-- ---------------------------------------------------------------------------
-- c. 상대가 같은 id 를 써도 서로 막지 않는다
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.acting((select lee from folks));
select is(
  public.send_chat_message((select kim_lee from rooms), '반가워요', (select first from ids)),
  'sent',
  '이가 같은 id 로 보내도 제 말로 남는다');

-- ---------------------------------------------------------------------------
-- d. id 는 내 말에만 실린다
-- ---------------------------------------------------------------------------
select pg_temp.acting((select kim from folks));
select results_eq(
  $$select body, client_id from public.my_chat_messages((select kim_lee from rooms)) order by seq$$,
  $$values ('안녕'::text, (select first from ids)), ('반가워요'::text, null::uuid)$$,
  '김에게는 제 말의 id 만 실리고 이의 말은 비어 있다');

-- ---------------------------------------------------------------------------
-- b. 닫힌 방
-- ---------------------------------------------------------------------------
reset role;
update public.chat_room set closed_at = now(), closed_reason = 'block' where id = (select room from rooms);

set local role authenticated;
select pg_temp.acting((select kim from folks));
select is(
  public.send_chat_message((select kim_lee from rooms), '안녕', (select first from ids)),
  'sent',
  '방이 닫힌 뒤에도 이미 받은 id 는 sent 다 — 그 말은 남아 있다');
select is(
  public.send_chat_message((select kim_lee from rooms), '닫힌 뒤', (select shut from ids)),
  'closed',
  '새 id 는 closed 다');

-- ---------------------------------------------------------------------------
-- e. 모양
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.send_chat_message((select kim_lee from rooms), '아이디 없음', null)$$,
  '22023',
  'chat: the client id is missing',
  'id 없이는 안 받는다');

reset role;
update public.chat_room set closed_at = null, closed_reason = null where id = (select room from rooms);
set local role authenticated;
select pg_temp.acting((select kim from folks));
select is(public.send_chat_message((select kim_lee from rooms), '옛 앱'), 'sent', '옛 두 칸 서명은 아직 돈다 — 떠 있는 옛 앱(G-96)');

reset role;
select is(
  (select client_id from public.chat_message where body = '옛 앱' and room_id = (select room from rooms)),
  null,
  '옛 서명으로 보낸 말은 id 가 비어 있다');

select ok(
  not has_function_privilege('anon', 'public.send_chat_message(uuid, text, uuid)', 'EXECUTE'),
  '로그인 안 한 사람은 새 서명을 못 부른다');

select * from finish();
rollback;
