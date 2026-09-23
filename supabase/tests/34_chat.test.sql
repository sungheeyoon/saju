-- 채팅 — **방은 Match 를 따라 서고, 닫힘은 이유가 정한 쪽만 열며, 한도는 함수가 센다.**
--
-- 채팅 안전 베타의 완료 조건 여섯(G-10)을 DB 층에서 한 번씩 밟는다.
--
--   1. 매칭된 두 계정이 주고받는다
--   2. 차단이 방을 닫고, 닫힌 뒤 **둘 다** 본다
--   3. 계정 중지가 방을 닫고, 중지되지 않은 쪽만 본다
--   4. 계정 삭제 요청이 방을 닫고, 요청하지 않은 쪽만 본다
--   5. 신고 한 건이 고른 메시지와 앞뒤 문맥의 스냅샷과 함께 남는다 — 메시지가 지워져도
--   6. 전송 한도 — 30건은 되고 31번째는 거절된다 **양쪽**
--
-- 역할을 갈아입는다. `postgres` 로 재면 표 소유자라 RLS 를 그냥 지나가고, 그러면 「막힌다」를
-- 한 번도 못 잰 채 전부 통과한다. 세는 것은 **이 파일이 만든 행**뿐이다 — 로컬 DB 에는 흐름·e2e
-- 검사가 남긴 계정이 있다.
begin;
select plan(102);

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
  perform public.set_discovery_participation(true, summary);
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
  pg_temp.participant('kim-chat@example.com', '김채', pg_temp.summary(4, 4, 0, 0, 0), '丙') as kim,
  pg_temp.participant('lee-chat@example.com', '이채', pg_temp.summary(0, 0, 4, 4, 0), '戊') as lee,
  pg_temp.participant('park-chat@example.com', '박채', pg_temp.summary(0, 0, 0, 0, 8), '庚') as park,
  pg_temp.participant('choi-chat@example.com', '최채', pg_temp.summary(2, 2, 2, 2, 0), '壬') as choi;
grant select on folks to authenticated;

reset role;

-- 다른 검사가 남긴 참여자는 이 시험의 관심 밖이다(`32_test_isolation` 의 그 문장).
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select uid from (
  select kim as uid from folks union all select lee from folks
  union all select park from folks union all select choi from folks) ours);

-- ---------------------------------------------------------------------------
-- 세 쌍을 세운다 — 김·이, 김·박, 이·최
-- ---------------------------------------------------------------------------
set local role authenticated;

select pg_temp.acting((select kim from folks));
select lives_ok($$select count(*) from public.my_discovery_board()$$, '김이 후보 목록을 연다');

create temporary table asked as
select public.request_match((select lee from folks)) as to_lee,
       public.request_match((select park from folks)) as to_park;
grant select on asked to authenticated;

select pg_temp.acting((select lee from folks));
select is(public.respond_to_match_request((select to_lee from asked), true), 'accepted', '이가 수락한다');

select pg_temp.acting((select park from folks));
select is(public.respond_to_match_request((select to_park from asked), true), 'accepted', '박이 수락한다');

select pg_temp.acting((select lee from folks));
select lives_ok($$select count(*) from public.my_discovery_board()$$, '이가 후보 목록을 연다');

create temporary table asked_more as
select public.request_match((select choi from folks)) as to_choi;
grant select on asked_more to authenticated;

select pg_temp.acting((select choi from folks));
select is(public.respond_to_match_request((select to_choi from asked_more), true), 'accepted', '최가 수락한다');

reset role;

create temporary table rooms as
select
  (select m.id from public.match m where m.request_id = (select to_lee from asked)) as kim_lee,
  (select m.id from public.match m where m.request_id = (select to_park from asked)) as kim_park,
  (select m.id from public.match m where m.request_id = (select to_choi from asked_more)) as lee_choi;
grant select on rooms to authenticated;

-- ---------------------------------------------------------------------------
-- 방은 Match 를 따라 선다 — 1:1
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.chat_room r
   where r.match_id in (select kim_lee from rooms union all select kim_park from rooms
                        union all select lee_choi from rooms)),
  3,
  '성립한 Match 셋에 방이 셋 선다 — 트리거가 세운다');

select is(
  (select count(*)::int from public.chat_read k
   join public.chat_room r on r.id = k.room_id
   where r.match_id = (select kim_lee from rooms)),
  2,
  '방마다 읽은 자리가 참여자 둘 몫으로 선다');

select is(
  (select closed_reason from public.chat_room where match_id = (select kim_lee from rooms)),
  null,
  '방은 열린 채 선다');

set local role authenticated;
select pg_temp.acting((select kim from folks));

select is((select count(*)::int from public.my_chat_rooms()), 2, '김의 목록에 방이 둘 선다');
select is(public.unread_chat_count(), 0, '아직 안 읽은 것이 없다');

select is(
  (select partner_nickname from public.my_chat_rooms() where match_id = (select kim_lee from rooms)),
  '이채',
  '방 목록은 상대를 닉네임으로 부른다');

-- ---------------------------------------------------------------------------
-- 1. 주고받는다
-- ---------------------------------------------------------------------------

select is(
  public.send_chat_message((select kim_lee from rooms), '안녕하세요'),
  'sent',
  '김이 보낸다');

select pg_temp.acting((select lee from folks));

select is(
  (select count(*)::int from public.my_chat_messages((select kim_lee from rooms))),
  1,
  '이가 그 메시지를 본다');

select is(
  (select mine from public.my_chat_messages((select kim_lee from rooms))),
  false,
  '남의 메시지는 내 것이 아니라고 말한다');

select is(public.unread_chat_count(), 1, '이에게 안 읽은 것이 하나다');

select is(
  (select unread_count from public.my_chat_rooms() where match_id = (select kim_lee from rooms)),
  1,
  '방 목록도 같은 수를 든다');

select is(
  (select last_message_body from public.my_chat_rooms() where match_id = (select kim_lee from rooms)),
  '안녕하세요',
  '방 목록이 마지막 메시지를 든다');

select ok(public.mark_chat_read((select kim_lee from rooms)) > 0, '여기까지 읽었다고 적는다');
select is(public.unread_chat_count(), 0, '적고 나면 0이다');

select is(
  public.send_chat_message((select kim_lee from rooms), '반갑습니다'),
  'sent',
  '이가 답한다');

select pg_temp.acting((select kim from folks));

select is(
  (select count(*)::int from public.my_chat_messages((select kim_lee from rooms))),
  2,
  '김이 둘을 본다');

select is(public.unread_chat_count(), 1, '김에게 안 읽은 것이 하나다 — 내가 보낸 것은 안 센다');

select is(
  (select array_agg(mine order by seq) from public.my_chat_messages((select kim_lee from rooms))),
  array[true, false],
  '차례와 내 것 여부가 함께 나간다');

-- 정책이 여는 것과 읽는 문이 여는 것은 같은 술어다. 정책 한 줄을 빼면 이 둘이 빨개진다.
select is(
  (select count(*)::int from public.chat_room where match_id = (select kim_lee from rooms)),
  1,
  '참여자는 표를 직접 읽어도 방을 본다 — 정책이 연다');

select is(
  (select count(*)::int from public.chat_message m
   join public.chat_room r on r.id = m.room_id
   where r.match_id = (select kim_lee from rooms)),
  2,
  '참여자는 표를 직접 읽어도 메시지를 본다 — 정책이 연다');

-- ── 표에 직접 쓰지 못하고, 남은 못 본다 ─────────────────────────────────────
select throws_ok(
  format($$insert into public.chat_message (room_id, sender_user_id, body)
           select r.id, %L, '몰래' from public.chat_room r where r.match_id = %L$$,
         (select kim from folks), (select kim_lee from rooms)),
  '42501', null,
  '표에 직접 넣지 못한다 — 문은 RPC 하나다');

select pg_temp.acting((select choi from folks));

select is(
  (select count(*)::int from public.my_chat_messages((select kim_lee from rooms))),
  0,
  '참여자가 아니면 메시지가 0행이다');

select is(
  (select count(*)::int from public.chat_message m
   join public.chat_room r on r.id = m.room_id
   where r.match_id = (select kim_lee from rooms)),
  0,
  '표를 직접 읽어도 0행이다 — 정책이 막는다');

select throws_ok(
  format($$select public.send_chat_message(%L, '끼어들기')$$, (select kim_lee from rooms)),
  '42501', null,
  '남의 방에는 보내지 못한다 — 없는 방과 같은 답이다');

select throws_ok(
  $$select public.send_chat_message('00000000-0000-0000-0000-000000000000', '허공')$$,
  '42501', null,
  '없는 방도 같은 답이다');

-- ── 본문의 모양 ─────────────────────────────────────────────────────────────
select pg_temp.acting((select kim from folks));

select throws_ok(
  format($$select public.send_chat_message(%L, '   ')$$, (select kim_lee from rooms)),
  '22023', null,
  '빈 본문은 받지 않는다');

select throws_ok(
  format($$select public.send_chat_message(%L, repeat('가', 1001))$$, (select kim_lee from rooms)),
  '22023', '적어 주신 내용이 너무 깁니다.',
  '1,001자는 거절한다 — 신고의 덧붙이는 말과 같은 문장이다');

select is(
  public.send_chat_message((select kim_lee from rooms), repeat('가', 1000)),
  'sent',
  '1,000자는 된다');

-- ── 나가는 모양 — 상대의 출생 원문 · 이메일 · 계정 상태는 없다 ─────────────────
select set_eq(
  $$select a.name from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral unnest(p.proargnames, p.proargmodes) as a(name, mode)
    where n.nspname = 'public' and p.proname = 'my_chat_rooms' and a.mode = 't'$$,
  $$values ('match_id'), ('partner_user_id'), ('partner_nickname'), ('partner_has_photo'),
           ('opened_at'), ('closed_reason'), ('closed_at'),
           ('last_message_at'), ('last_message_body'), ('unread_count'),
           ('partner_activity'), ('partner_left')$$,
  '방 목록이 내주는 칸은 이 열둘뿐이다 — 상대의 접속 상태는 구간 하나로, 떠났는지는 참 · 거짓 하나로 나간다(ADR 0092 · 0094)');

select set_eq(
  $$select a.name from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral unnest(p.proargnames, p.proargmodes) as a(name, mode)
    where n.nspname = 'public' and p.proname = 'my_chat_messages' and a.mode = 't'$$,
  $$values ('message_id'), ('seq'), ('sender_user_id'), ('mine'), ('body'), ('created_at')$$,
  '메시지가 내주는 칸은 이 여섯뿐이다');

select results_eq(
  $$select rate_limit, rate_window_seconds, max_length, snapshot_context, retention_days
    from public.chat_policy()$$,
  $$values (30, 60, 1000, 5, 90)$$,
  '정책의 수 다섯을 앱이 물어볼 수 있다 — 아래가 그 수로 실제로 막는지 잰다');

-- ---------------------------------------------------------------------------
-- 6. 전송 한도 — 30건은 되고 31번째는 거절된다
-- ---------------------------------------------------------------------------
select pg_temp.acting((select park from folks));

create temporary table burst as
select public.send_chat_message((select kim_park from rooms), '도배 ' || g) as outcome
from generate_series(1, 30) g;

select is((select count(*)::int from burst where outcome = 'sent'), 30, '1분에 30건은 전부 간다');

select is(
  public.send_chat_message((select kim_park from rooms), '서른한 번째'),
  'rate_limited',
  '31번째는 거절된다 — 값으로 돌아온다');

select is(
  public.send_chat_message((select kim_park from rooms), '서른두 번째'),
  'rate_limited',
  '그 뒤도 창이 지날 때까지 거절이다');

reset role;
select is(
  (select count(*)::int from public.chat_rate_limit_hit where user_id = (select park from folks)),
  2,
  '거절 두 건이 한 줄씩 남는다 — 값으로 돌려줘야 트랜잭션이 남는다');

set local role authenticated;
select pg_temp.acting((select kim from folks));
select is(
  public.send_chat_message((select kim_park from rooms), '나는 아직 된다'),
  'sent',
  '한도는 계정 단위다 — 상대는 같은 방에서 그대로 보낸다');

-- 창이 지나면 다시 된다. 1분을 기다리지 않고 내 메시지를 2분 전으로 민다.
reset role;
update public.chat_message set created_at = created_at - interval '2 minutes'
where sender_user_id = (select park from folks);

set local role authenticated;
select pg_temp.acting((select park from folks));
select is(
  public.send_chat_message((select kim_park from rooms), '창이 지났다'),
  'sent',
  '창이 지나면 다시 보낸다');

-- ---------------------------------------------------------------------------
-- 2. 차단 — 방이 닫히고, 닫힌 뒤 **둘 다** 본다
-- ---------------------------------------------------------------------------
select pg_temp.acting((select kim from folks));
select ok(public.block_user((select lee from folks)), '김이 이를 차단한다');

reset role;
select is(
  (select closed_reason from public.chat_room where match_id = (select kim_lee from rooms)),
  'block',
  '방이 차단으로 닫힌다');

select is(
  (select r.closed_at = b.created_at
   from public.chat_room r
   join public.block b on b.user_id = (select kim from folks) and b.blocked_user_id = (select lee from folks)
   where r.match_id = (select kim_lee from rooms)),
  true,
  '닫힌 시각은 차단 행의 시각이다');

select is(
  (select closed_by_user_id from public.chat_room where match_id = (select kim_lee from rooms)),
  (select kim from folks),
  '누가 닫았는지는 표가 든다');

set local role authenticated;
select pg_temp.acting((select kim from folks));

select is(
  (select closed_reason from public.my_chat_rooms() where match_id = (select kim_lee from rooms)),
  'block',
  '차단한 쪽의 목록에 방이 닫힌 채 남는다');

select is(
  (select count(*)::int from public.my_chat_messages((select kim_lee from rooms))),
  3,
  '차단한 쪽이 이전 대화를 본다');

select is(
  (select count(*)::int from public.my_matches() where match_id = (select kim_lee from rooms)),
  0,
  '그래도 Match 는 목록에서 내려간다(`visible_matches`) — 방과 Match 목록은 다른 문이다');

select is(
  public.send_chat_message((select kim_lee from rooms), '더 하고 싶은 말'),
  'closed',
  '닫힌 방에는 못 보낸다');

select pg_temp.acting((select lee from folks));

select is(
  (select closed_reason from public.my_chat_rooms() where match_id = (select kim_lee from rooms)),
  'block',
  '차단당한 쪽의 목록에도 방이 닫힌 채 남는다');

select is(
  (select count(*)::int from public.my_chat_messages((select kim_lee from rooms))),
  3,
  '차단당한 쪽도 이전 대화를 본다 — 「둘 다 본다」');

select is(
  public.send_chat_message((select kim_lee from rooms), '왜요'),
  'closed',
  '양쪽 다 입력이 안 된다');

-- ---------------------------------------------------------------------------
-- 3. 계정 중지 — 중지되지 않은 쪽만 본다
-- ---------------------------------------------------------------------------
reset role;
update public.app_user set status = 'suspended' where id = (select park from folks);

select is(
  (select closed_reason from public.chat_room where match_id = (select kim_park from rooms)),
  'suspension',
  '운영자의 SQL 한 줄이 방을 닫는다 — 트리거라 함수를 안 지나도 잡힌다');

select is(
  (select closed_by_user_id from public.chat_room where match_id = (select kim_park from rooms)),
  (select park from folks),
  '닫은 사람은 중지된 쪽이다');

select isnt(
  (select closed_at from public.chat_room where match_id = (select kim_park from rooms)),
  null,
  '중지에는 시각 칸이 없다 — 방의 닫힌 시각이 그 출처가 된다');

set local role authenticated;
select pg_temp.acting((select park from folks));

select is((select count(*)::int from public.my_chat_rooms()), 0, '중지된 쪽에는 방이 안 보인다');
select is(
  (select count(*)::int from public.my_chat_messages((select kim_park from rooms))),
  0,
  '메시지도 0행이다');
select is(
  (select count(*)::int from public.chat_message),
  0,
  '표를 직접 읽어도 0행이다 — 닫은 사람이 그 사람이라 술어가 닫는다');
select is(public.unread_chat_count(), 0, '안 읽은 수도 0이다');

select throws_ok(
  format($$select public.send_chat_message(%L, '아직 되나')$$, (select kim_park from rooms)),
  '42501', '이용이 정지된 계정입니다.',
  '이용이 정지된 쪽은 보내지 못한다');

select pg_temp.acting((select kim from folks));

select is(
  (select closed_reason from public.my_chat_rooms() where match_id = (select kim_park from rooms)),
  'suspension',
  '중지되지 않은 쪽은 방이 닫힌 것을 본다');

select is(
  (select count(*)::int from public.my_chat_messages((select kim_park from rooms), null, 200)),
  32,
  '중지되지 않은 쪽은 이전 대화를 본다 — 30 + 1 + 1');

select is(
  public.send_chat_message((select kim_park from rooms), '거기 있어요?'),
  'closed',
  '그래도 보내지는 못한다');

-- 중지를 풀어도 방은 닫힌 채다 — 닫힘은 되돌리지 않는다(ADR 0091, 뒤집을 수 있는 기본값).
reset role;
update public.app_user set status = 'active' where id = (select park from folks);

select is(
  (select closed_reason from public.chat_room where match_id = (select kim_park from rooms)),
  'suspension',
  '중지를 풀어도 방은 닫힌 채다');

set local role authenticated;
select pg_temp.acting((select park from folks));
select is(
  (select count(*)::int from public.my_chat_rooms()),
  0,
  '풀린 뒤에도 그 방은 중지됐던 쪽에게 안 보인다 — 닫힌 이유가 정한 쪽이 그대로다');

-- ---------------------------------------------------------------------------
-- 4. 계정 삭제 요청 — 요청하지 않은 쪽만 본다
-- ---------------------------------------------------------------------------
select pg_temp.acting((select lee from folks));
select is(
  public.send_chat_message((select lee_choi from rooms), '잘 지내요?'),
  'sent',
  '이가 최에게 보낸다');

select pg_temp.acting((select choi from folks));
select ok(public.request_account_deletion(), '최가 삭제를 요청한다');

reset role;
select is(
  (select closed_reason from public.chat_room where match_id = (select lee_choi from rooms)),
  'deletion_request',
  '삭제 요청이 방을 닫는다 — 함수를 다시 적지 않고 같은 트리거가 받는다');

select is(
  (select r.closed_at = u.deletion_requested_at
   from public.chat_room r join public.app_user u on u.id = (select choi from folks)
   where r.match_id = (select lee_choi from rooms)),
  true,
  '닫힌 시각은 요청한 시각이다');

set local role authenticated;
select pg_temp.acting((select choi from folks));
select is((select count(*)::int from public.my_chat_rooms()), 0, '요청한 쪽에는 방이 안 보인다');
select is(
  (select count(*)::int from public.my_chat_messages((select lee_choi from rooms))),
  0,
  '메시지도 0행이다');

select pg_temp.acting((select lee from folks));
select is(
  (select closed_reason from public.my_chat_rooms() where match_id = (select lee_choi from rooms)),
  'deletion_request',
  '요청하지 않은 쪽은 방이 닫힌 것을 본다');
select is(
  (select count(*)::int from public.my_chat_messages((select lee_choi from rooms))),
  1,
  '요청하지 않은 쪽은 이전 대화를 본다 — 대화는 두 사람의 것이다');
select is(
  public.send_chat_message((select lee_choi from rooms), '가지 마요'),
  'closed',
  '그래도 보내지는 못한다');

-- ---------------------------------------------------------------------------
-- 5. 신고 — 고른 메시지와 앞뒤 다섯의 스냅샷이 남고, 메시지가 지워져도 남는다
-- ---------------------------------------------------------------------------
select pg_temp.acting((select kim from folks));

-- 박의 열 번째 도배를 고른다. 앞에 아홉, 뒤에 스물 남짓이 있다.
create temporary table chosen as
select m.message_id, m.seq
from public.my_chat_messages((select kim_park from rooms), null, 200) m
where m.body = '도배 10';
grant select on chosen to authenticated;

select isnt((select message_id from chosen), null, '고를 메시지가 있다');

create temporary table filed as
select public.report_chat_message((select message_id from chosen), 'harassment', '  겪은 일  ') as report_id;
grant select on filed to authenticated;

select is(
  (select count(*)::int from public.report where id = (select report_id from filed)),
  1,
  '신고한 사람은 자기 신고를 본다');

reset role;

select is(
  (select r.reporter_user_id = (select kim from folks) and r.reported_user_id = (select park from folks)
      and r.reason = 'harassment' and r.detail = '겪은 일'
   from public.report r where r.id = (select report_id from filed)),
  true,
  '신고당하는 사람은 그 메시지를 보낸 사람이고, 사유와 말은 `report_user` 와 같은 모양이다');

select is(
  (select jsonb_array_length(s.messages) from public.chat_report_snapshot s
   where s.report_id = (select report_id from filed)),
  11,
  '스냅샷은 앞 5 · 고른 것 · 뒤 5 — 열한 건이다');

select is(
  (select array_agg((e ->> 'body') order by (e ->> 'seq')::bigint)
   from public.chat_report_snapshot s, jsonb_array_elements(s.messages) e
   where s.report_id = (select report_id from filed)),
  array['도배 5', '도배 6', '도배 7', '도배 8', '도배 9', '도배 10',
        '도배 11', '도배 12', '도배 13', '도배 14', '도배 15'],
  '본문이 그때 그대로 차례대로 베껴진다');

select is(
  (select count(*)::int from public.chat_report_snapshot s, jsonb_array_elements(s.messages) e
   where s.report_id = (select report_id from filed) and (e ->> 'chosen')::boolean),
  1,
  '고른 것 하나에만 표시가 붙는다');

select is(
  (select s.match_id = (select kim_park from rooms) and s.message_id = (select message_id from chosen)
      and s.context_before = 5 and s.context_after = 5
   from public.chat_report_snapshot s where s.report_id = (select report_id from filed)),
  true,
  '되짚을 실마리와 문맥의 수가 함께 남는다');

-- 메시지를 지워도 스냅샷은 남는다 — FK 로 매지 않았다.
delete from public.chat_message where id = (select message_id from chosen);

select is(
  (select jsonb_array_length(s.messages) from public.chat_report_snapshot s
   where s.report_id = (select report_id from filed)),
  11,
  '고른 메시지를 지워도 스냅샷은 그대로다');

select throws_ok(
  format($$update public.chat_report_snapshot set messages = '[]' where report_id = %L$$,
         (select report_id from filed)),
  '55000', null,
  '스냅샷은 소유자도 못 고친다 — 불변이다');

set local role authenticated;
select pg_temp.acting((select kim from folks));

select throws_ok(
  $$select count(*) from public.chat_report_snapshot$$,
  '42501', null,
  '신고한 사람에게도 스냅샷 표는 닫혀 있다 — 읽는 손은 runbook 의 SQL 이다');

select throws_ok(
  format($$select public.report_chat_message(%L, 'other', null)$$,
         (select m.message_id from public.my_chat_messages((select kim_park from rooms), null, 200) m
          where m.body = '나는 아직 된다')),
  '22023', '자기 자신은 신고할 수 없습니다.',
  '내 메시지는 고를 수 없다');

select throws_ok(
  format($$select public.report_chat_message(%L, 'because-i-said-so', null)$$,
         (select m.message_id from public.my_chat_messages((select kim_park from rooms), null, 200) m
          where m.body = '도배 3')),
  '22023', '신고 사유를 골라 주세요.',
  '고른 것 밖의 사유는 받지 않는다');

-- 첫 메시지를 고르면 앞은 비고 뒤만 다섯이다.
select lives_ok(
  format($$select public.report_chat_message(%L, 'inappropriate', null)$$,
         (select m.message_id from public.my_chat_messages((select kim_park from rooms), null, 200) m
          where m.body = '도배 1')),
  '같은 사람을 다시 신고할 수 있다 — 신고는 사건이다');

select throws_ok(
  format($$select public.report_chat_message(%L, 'inappropriate', null)$$,
         (select m.message_id from public.my_chat_messages((select kim_park from rooms), null, 200) m
          where m.body = '도배 1')),
  '23505', '이미 같은 사유로 신고했습니다. 검토가 끝날 때까지 기다려 주세요.',
  '같은 메시지를 같은 사유로 또 신고하지 않는다 — 검토 전까지 (G-23 ⑤)');

reset role;
select is(
  (select jsonb_array_length(s.messages)
   from public.chat_report_snapshot s
   join public.report r on r.id = s.report_id
   where r.reporter_user_id = (select kim from folks) and r.reason = 'inappropriate'),
  6,
  '첫 메시지를 고르면 앞은 비고 뒤만 다섯이다');

set local role authenticated;
select pg_temp.acting((select lee from folks));

select throws_ok(
  format($$select public.report_chat_message(%L, 'other', null)$$,
         (select m.id from public.chat_message m
          join public.chat_room r on r.id = m.room_id
          where r.match_id = (select kim_park from rooms) limit 1)),
  '42501', null,
  '남의 방의 메시지는 고를 수 없다 — 없는 메시지와 같은 답이다');

reset role;
select is(
  (select count(*)::int from public.chat_room where match_id = (select kim_park from rooms)
   and closed_reason = 'suspension'),
  1,
  '신고는 방을 닫지 않는다 — 이유가 그대로다');

-- ---------------------------------------------------------------------------
-- 보존 — 닫힌 지 90일 지난 방의 메시지만 지운다. 손으로 돌린다
-- ---------------------------------------------------------------------------
update public.chat_room set closed_at = now() - interval '89 days'
where match_id = (select kim_park from rooms);

select is(public.purge_closed_chat_messages(), 0, '89일은 아직 안 지운다');

update public.chat_room set closed_at = now() - interval '91 days'
where match_id = (select kim_park from rooms);

select is(public.purge_closed_chat_messages(), 31, '91일이 지난 방의 메시지 서른하나를 지운다');

select is(
  (select count(*)::int from public.chat_message m
   join public.chat_room r on r.id = m.room_id where r.match_id = (select kim_park from rooms)),
  0,
  '그 방의 메시지는 비었다');

select is(
  (select count(*)::int from public.chat_message m
   join public.chat_room r on r.id = m.room_id where r.match_id = (select kim_lee from rooms)),
  3,
  '오늘 닫힌 방의 메시지는 그대로다');

select is(
  (select closed_reason from public.chat_room where match_id = (select kim_park from rooms)),
  'suspension',
  '방은 남아 닫힌 이유를 계속 말한다');

select is(
  (select count(*)::int from public.chat_report_snapshot s
   join public.report r on r.id = s.report_id where r.reporter_user_id = (select kim from folks)),
  2,
  '스냅샷은 메시지와 수명이 다르다 — 지운 뒤에도 둘 다 남는다');

-- ---------------------------------------------------------------------------
-- 중지는 차단으로 닫힌 방까지 거둔다 — 술어가 `is_active_account()` 를 묻는 자리
-- ---------------------------------------------------------------------------
--
-- 위의 중지 · 삭제 요청은 「닫은 사람이 그 사람」이라는 절만으로도 닫힌다. 그래서 그 둘은
-- `is_active_account()` 를 빼도 초록이었다(일부러 빼 보고 알았다). 이 절이 빨개지는 자리는
-- 여기다 — 차단으로 닫힌 방은 「둘 다 본다」인데, 그 뒤에 중지된 쪽은 그것마저 못 본다(ADR 0006).
update public.app_user set status = 'suspended' where id = (select kim from folks);

set local role authenticated;
select pg_temp.acting((select kim from folks));

select is(
  (select count(*)::int from public.my_chat_rooms()),
  0,
  '차단으로 닫힌 방도 중지된 뒤에는 안 보인다 — 열람 술어가 `is_active_account()` 를 묻는다');

select is(
  (select count(*)::int from public.chat_room where match_id = (select kim_lee from rooms)),
  0,
  '표를 직접 읽어도 0행이다');

reset role;

-- ---------------------------------------------------------------------------
-- 지우기 — 계정이 사라져도 방은 남고, 신고 · 스냅샷은 신고를 따라간다
-- ---------------------------------------------------------------------------
--
-- 방이 계정을 따라 사라지던 것은 2026-09-23 까지다. 처분(ADR 0094)은 떠난 쪽의 자리만 비우고 방은
-- 남는 쪽에 남긴다 — 남는 쪽이 보는지는 37 이 잰다(여기서 김은 이미 정지돼 있다).
select public.forget_user((select park from folks));

select is(
  (select count(*)::int from public.chat_room
   where match_id = (select kim_park from rooms)
     and user_low is distinct from (select park from folks)
     and user_high is distinct from (select park from folks)),
  1,
  '계정이 사라져도 방은 남고 그 사람의 자리만 빈다(ADR 0094)');

select is(
  (select count(*)::int from public.chat_report_snapshot s
   join public.report r on r.id = s.report_id where r.reporter_user_id = (select kim from folks)),
  0,
  '신고당한 계정이 사라지면 신고와 스냅샷도 따라간다 — 남길 것은 지우기 전에 적는다(runbook)');

select * from finish();
rollback;
