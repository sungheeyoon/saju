-- 탈퇴의 처분 — **떠난 사람의 것은 지우고, 대화는 남는 쪽에 남는다** (ADR 0094, G-27)
--
-- 여기서 재는 것 다섯.
--
--   1. **방과 메시지가 남는다.** 떠난 쪽의 자리(참여자 · 닫은 사람 · 보낸 사람)만 빈다
--   2. **남는 쪽이 그 방을 읽는다** — 목록이 `partner_left` 로 떠났다고 말하고, 상대의 칸은 빈다
--   3. **함께 보던 궁합은 남지 않는다** — 떠난 쪽의 여덟 글자와 그 Match 의 궁합풀이가 지워지고,
--      남는 쪽의 Match 목록과 공유 결과에도 없다. 떠난 사람의 Person 을 남이 관리해 Person 이
--      남아도 글은 지워진다
--   4. **열린 채 떠나면 그 순간 닫힌다** — 신청 없이 처분된 계정의 방
--   5. **둘 다 떠나면 Match 째 사라진다** — 방 · 메시지까지
--
-- 세는 것은 이 파일이 만든 행뿐이다(`32_test_isolation`).
begin;
select plan(43);

create or replace function pg_temp.summary(w int, f int, e int, g int, s int)
returns jsonb language sql as $$
  select jsonb_build_object(
    'glyphCount', w + f + e + g + s,
    'counts', jsonb_build_object('木', w, '火', f, '土', e, '金', g, '水', s),
    'ratios', jsonb_build_object(
      '木', w / 8.0, '火', f / 8.0, '土', e / 8.0, '金', g / 8.0, '水', s / 8.0));
$$;

create or replace function pg_temp.participant(
  mail text, who text, summary jsonb, day_stem text default '丙')
returns uuid language plpgsql as $$
declare uid uuid := tests.signup(mail);
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

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** `save_reading` 은 `authenticated` 에게 닫혀 있다 — 서버가 열쇠로 부르는 자리를 흉내낸다(22 와 같다) */
create or replace function pg_temp.save(run uuid)
returns uuid language sql security definer as $$
  select public.save_reading(
    run, '## 함께 보는 궁합', 64::smallint, '두 사람이 같은 속도로 걷는 모양입니다.',
    '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-leave@example.com', '김떠', pg_temp.summary(4, 4, 0, 0, 0), '丙') as kim,
  pg_temp.participant('lee-leave@example.com', '이떠', pg_temp.summary(0, 0, 4, 4, 0), '戊') as lee,
  pg_temp.participant('park-leave@example.com', '박떠', pg_temp.summary(0, 0, 0, 0, 8), '庚') as park;
grant select on folks to authenticated;

reset role;
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select kim from folks union all select lee from folks union all select park from folks);

-- ---------------------------------------------------------------------------
-- 두 쌍 — 김·이(이가 탈퇴를 신청하고 처분된다), 김·박(박은 신청 없이 처분된다)
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

reset role;

create temporary table pairs as
select
  (select m.id from public.match m where m.request_id = (select to_lee from asked)) as kim_lee,
  (select m.id from public.match m where m.request_id = (select to_park from asked)) as kim_park,
  (select self_person_id from public.app_user where id = (select lee from folks)) as lee_self;
grant select on pairs to authenticated;

/** 동의가 연 시도에 궁합풀이를 하나 저장한다 — 처분 뒤에 그것이 남는지 본다 */
select isnt(
  pg_temp.save((select r.id from public.reading_run r
                where r.match_id = (select kim_lee from pairs) and r.status = 'running')),
  null,
  '김·이의 궁합풀이가 저장된다');

/**
 * **이의 selfPerson 을 박도 관리하게 만든다.**
 *
 * 그러면 이가 떠나도 그 Person 은 남고(ADR 0023), `reading.person_*` 의 `cascade` 는 글을 안
 * 데려간다. 글을 지우는 것이 Person 이 아니라 **Match 에서 한 사람이 빠지는 순간**이어야 하는
 * 까닭이 이 줄이다.
 */
insert into public.user_person_access (user_id, person_id, local_label, role)
values ((select park from folks), (select lee_self from pairs), '이 친구', 'viewer');

-- 주고받는다
set local role authenticated;
select pg_temp.acting((select lee from folks));
select is(public.send_chat_message((select kim_lee from pairs), '이가 먼저'), 'sent', '이가 보낸다');
select pg_temp.acting((select kim from folks));
select is(public.send_chat_message((select kim_lee from pairs), '김이 답한다'), 'sent', '김이 보낸다');
select pg_temp.acting((select lee from folks));
select is(public.send_chat_message((select kim_lee from pairs), '이가 마지막'), 'sent', '이가 한 번 더 보낸다');
select pg_temp.acting((select park from folks));
select is(public.send_chat_message((select kim_park from pairs), '박이 보낸다'), 'sent', '박이 보낸다');

-- 이가 탈퇴를 신청한다 — 방이 닫힌다(ADR 0091)
select pg_temp.acting((select lee from folks));
select lives_ok($$select public.request_account_deletion()$$, '이가 탈퇴를 신청한다');

reset role;
create temporary table asked_at as
select deletion_requested_at as at from public.app_user where id = (select lee from folks);
grant select on asked_at to authenticated;

-- ---------------------------------------------------------------------------
-- 처분 — 이
-- ---------------------------------------------------------------------------
select lives_ok(
  format($$select public.forget_user(%L)$$, (select lee from folks)),
  '이를 처분한다');

select is(
  (select count(*)::int from public.app_user where id = (select lee from folks)),
  0,
  '이의 계정은 사라진다');

-- ── 1. 방과 메시지가 남는다 ─────────────────────────────────────────────────

select is(
  (select count(*)::int from public.match where id = (select kim_lee from pairs)),
  1,
  'Match 행은 방의 닻으로 남는다');

select is(
  (select count(*)::int from public.chat_room where match_id = (select kim_lee from pairs)),
  1,
  '방이 남는다');

select ok(
  (select (r.user_low is null) <> (r.user_high is null)
          and (select kim from folks) in (r.user_low, r.user_high)
   from public.chat_room r where r.match_id = (select kim_lee from pairs)),
  '방의 참여자 칸은 떠난 쪽만 빈다');

select ok(
  (select r.closed_reason = 'deletion_request' and r.closed_by_user_id is null
          and r.closed_at = (select at from asked_at)
   from public.chat_room r where r.match_id = (select kim_lee from pairs)),
  '닫힌 이유와 시각은 신청 때 그대로다 — 닫은 사람 칸만 빈다. 보존 90일은 그 시각부터 센다');

select is(
  (select count(*)::int from public.chat_message m
   join public.chat_room r on r.id = m.room_id where r.match_id = (select kim_lee from pairs)),
  3,
  '메시지 셋이 다 남는다');

select is(
  (select count(*)::int from public.chat_message m
   join public.chat_room r on r.id = m.room_id
   where r.match_id = (select kim_lee from pairs) and m.sender_user_id is null),
  2,
  '떠난 쪽이 보낸 둘은 보낸 사람 칸이 빈다');

select is(
  (select count(*)::int from public.chat_read where user_id = (select lee from folks)),
  0,
  '떠난 쪽의 읽은 자리는 따라간다 — 그 사람 혼자의 것이다');

-- ── 3. 함께 보던 궁합은 남지 않는다 ─────────────────────────────────────────

select ok(
  (select case when m.user_low is null
            then m.chart_low is null and m.chart_engine_low is null
                 and m.chart_high is not null and m.chart_engine_high is not null
            else m.chart_high is null and m.chart_engine_high is null
                 and m.chart_low is not null and m.chart_engine_low is not null end
   from public.match m where m.id = (select kim_lee from pairs)),
  '떠난 쪽의 동의 당시 여덟 글자는 비고 남는 쪽의 것은 그대로다');

select is(
  (select request_id from public.match where id = (select kim_lee from pairs)),
  null,
  '요청은 떠난 쪽의 것이라 따라가고 Match 의 요청 칸이 빈다');

select is(
  (select count(*)::int from public.person where id = (select lee_self from pairs)),
  1,
  '남이 관리하던 이의 Person 은 남는다(ADR 0023) — 그래서 글이 Person 을 따라 사라질 수 없다');

select is(
  (select count(*)::int from public.reading where match_id = (select kim_lee from pairs)),
  0,
  '그런데도 그 Match 의 궁합풀이는 지워진다');

select is(
  (select count(*)::int from public.reading_run where match_id = (select kim_lee from pairs)),
  0,
  '그 Match 의 시도도 지워진다');

-- ── 2. 남는 쪽이 그 방을 읽는다 ─────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select kim from folks));

select ok(
  (select partner_left and partner_user_id is null and partner_nickname is null
          and not partner_has_photo and partner_activity is null
          and closed_reason = 'deletion_request'
   from public.my_chat_rooms() where match_id = (select kim_lee from pairs)),
  '방 목록이 떠났다고 말하고 상대의 칸은 빈다');

select ok(
  (select not partner_left from public.my_chat_rooms() where match_id = (select kim_park from pairs)),
  '떠나지 않은 상대의 방은 `partner_left` 가 거짓이다');

select is(
  (select unread_count from public.my_chat_rooms() where match_id = (select kim_lee from pairs)),
  2,
  '떠난 쪽이 보낸 안 읽은 둘도 센다 — 보낸 사람 칸이 비어도');

select is(
  (select count(*)::int from public.my_chat_messages((select kim_lee from pairs))),
  3,
  '남는 쪽이 대화를 다 본다');

select is(
  (select array_agg(mine order by seq) from public.my_chat_messages((select kim_lee from pairs))),
  array[false, true, false],
  '떠난 쪽의 메시지는 「내 것」이 아니다 — 참 · 거짓 둘뿐이다');

select is(
  public.send_chat_message((select kim_lee from pairs), '거기 있어요?'),
  'closed',
  '떠난 사람에게는 보낼 수 없다');

select throws_ok(
  format($$select public.report_chat_message(%L, 'harassment')$$,
    (select m.message_id from public.my_chat_messages((select kim_lee from pairs)) m
     where not m.mine limit 1)),
  '42501', 'chat: no such message',
  '떠난 사람의 메시지는 신고할 수 없다 — 신고당할 계정이 없다');

select is(
  (select count(*)::int from public.my_matches() where match_id = (select kim_lee from pairs)),
  0,
  '남는 쪽의 Match 목록에 그 Match 는 없다');

select is(
  (select count(*)::int from public.my_match_scope((select kim_lee from pairs))),
  0,
  '공유 결과도 열리지 않는다');

-- ── 4. 열린 채 떠나면 그 순간 닫힌다 ────────────────────────────────────────

reset role;
select ok(
  (select closed_reason is null from public.chat_room where match_id = (select kim_park from pairs)),
  '박의 방은 처분 전까지 열려 있다');

select lives_ok(
  format($$select public.forget_user(%L)$$, (select park from folks)),
  '박을 신청 없이 처분한다');

select ok(
  (select r.closed_reason = 'deletion_request' and r.closed_by_user_id is null
          and r.closed_at > now() - interval '1 minute'
   from public.chat_room r where r.match_id = (select kim_park from pairs)),
  '열려 있던 방이 떠나는 순간 닫힌다 — 보존 90일은 지금부터다');

set local role authenticated;
select pg_temp.acting((select kim from folks));
select is(
  (select count(*)::int from public.my_chat_rooms() where partner_left),
  2,
  '남는 쪽은 두 방을 다 본다');

-- ── 보존 — 닫힌 지 90일이 지나면 메시지가 지워지고 방은 남는다 ──────────────

reset role;
update public.chat_room set closed_at = now() - public.chat_retention() - interval '1 day'
where match_id = (select kim_lee from pairs);

select cmp_ok(public.purge_closed_chat_messages(), '>=', 3, '보존 기간이 지난 메시지를 지운다');

select is(
  (select count(*)::int from public.chat_message m
   join public.chat_room r on r.id = m.room_id where r.match_id = (select kim_lee from pairs)),
  0,
  '떠난 쪽 것도 남는 쪽 것도 지워진다');

select is(
  (select count(*)::int from public.chat_room where match_id = (select kim_lee from pairs)),
  1,
  '방은 남아 닫힌 까닭을 계속 말한다');

-- ── 5. 둘 다 떠나면 Match 째 사라진다 ───────────────────────────────────────

select lives_ok(
  format($$select public.forget_user(%L)$$, (select kim from folks)),
  '김도 처분한다');

select is(
  (select count(*)::int from public.match
   where id in ((select kim_lee from pairs), (select kim_park from pairs))),
  0,
  '남은 사람이 없는 Match 는 사라진다');

select is(
  (select count(*)::int from public.chat_room
   where match_id in ((select kim_lee from pairs), (select kim_park from pairs))),
  0,
  '그 방도 함께 사라진다');

select is(
  (select count(*)::int from public.chat_message m
   join public.chat_room r on r.id = m.room_id
   where r.match_id = (select kim_park from pairs)),
  0,
  '그 메시지도');

select * from finish();
rollback;
