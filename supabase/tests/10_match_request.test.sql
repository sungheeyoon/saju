-- 요청 · 동의 · Match — **동의는 사람이 아니라 그때 그 입력에 대한 것이다.**
--
-- 여기서 재는 것은 상태 머신의 규칙이 **DB 안에서** 지켜지는가다. 「후보로 본 적 있는
-- 사람에게만」, 「살아 있는 결정은 한 쌍에 하나」, 「수락 순간 판본을 다시 본다」,
-- 「없는 사람과 못 보는 사람의 답이 같다」.
begin;
select plan(92);

/**
 * 참여자 하나를 세우는 손잡이.
 *
 * 오행 요약을 손으로 지어 넣는다 — 여기서 재려는 것은 줄 세우기가 아니라 요청이라,
 * **누가 누구에게 무엇을 채우는지**가 또렷하게 갈리는 요약을 골라 넣는 편이 낫다.
 */
create or replace function pg_temp.participant(mail text, who text, summary jsonb)
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean');
  insert into public.discovery_profile (nickname, prefer_gender) values (who, 'any');
  perform public.set_discovery_participation(true, summary);
  return uid;
end;
$$;

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

/** 그 사람인 척한다. `postgres` 로 재면 RLS 를 그냥 지나가므로 역할도 함께 바꾼다 */
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
  pg_temp.participant('kim-mr@example.com', '김', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-mr@example.com', '이', pg_temp.summary(0, 0, 4, 4, 0)) as lee,
  pg_temp.participant('park-mr@example.com', '박', pg_temp.summary(2, 2, 2, 2, 0)) as park,
  pg_temp.participant('choi-mr@example.com', '최', pg_temp.summary(0, 0, 0, 0, 8)) as choi;
grant select on folks to authenticated;

/**
 * **다른 검사가 남긴 참여자는 이 시험의 관심 밖이다**(`09_discovery_board` 와 같은 이유).
 *
 * `my_discovery_board` 는 `security definer` 라 RLS 로 좁혀지지 않는다. 좁히지 않으면
 * 이 파일이 「DB 가 비어 있는가」를 잰다.
 */
reset role;
insert into public.discovery_hidden (user_id, hidden_user_id)
select mine.uid, p.user_id
from (select kim as uid from folks union all select lee from folks
      union all select park from folks union all select choi from folks) mine,
     public.discovery_profile p
where p.user_id not in (select uid from (
  select kim as uid from folks union all select lee from folks
  union all select park from folks union all select choi from folks) ours);

create temporary table persons as
select
  (select self_person_id from public.app_user where id = (select park from folks)) as park_person,
  (select current_revision_id from public.person
   where id = (select self_person_id from public.app_user where id = (select park from folks))) as park_first;
grant select on persons to authenticated;

set local role authenticated;

-- ── 후보를 본 데서 요청이 난다 ────────────────────────────────────────────────
select pg_temp.acting((select kim from folks));
create temporary table kim_board as select * from public.my_discovery_board();
grant select on kim_board to authenticated;

select is((select count(*)::int from kim_board), 3, '김의 목록에 셋이 선다');

-- 박도 목록을 연다. 나중에 박이 김에게 청하려면 김을 본 적이 있어야 한다.
select pg_temp.acting((select park from folks));
select lives_ok($$select count(*) from public.my_discovery_board()$$, '박도 목록을 연다');

/**
 * **후보로 한 번도 뜨지 않은 사람에게는 청할 수 없다.**
 *
 * 최는 아직 목록을 연 적이 없다. 남의 uuid 를 주워 아무에게나 두드리는 길이 닫혀
 * 있는지를 여기서 잰다.
 */
select pg_temp.acting((select choi from folks));
select throws_ok(
  format($$select public.request_match(%L::uuid)$$, (select kim from folks)),
  '42501', '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.',
  '후보로 본 적 없는 사람에게는 청할 수 없다');

select throws_ok(
  $$select public.request_match('00000000-0000-0000-0000-000000000000'::uuid)$$,
  '42501', '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.',
  '없는 사람에게 청할 때도 **같은 문장**이다 — 갈라서 말하면 존재를 묻는 문이 된다');

-- ── 김이 이에게 청한다 ───────────────────────────────────────────────────────
select pg_temp.acting((select kim from folks));

create temporary table asked as
select public.request_match((select lee from folks)) as request_id;
grant select on asked to authenticated;

select isnt((select request_id from asked), null, '요청이 난다');

select throws_ok(
  format($$select public.request_match(%L::uuid)$$, (select lee from folks)),
  '42501', '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.',
  '같은 쌍에 살아 있는 결정은 하나뿐이다');

select is(
  (select count(*)::int from public.my_discovery_board()
   where candidate_user_id = (select lee from folks)),
  0,
  '청한 사람은 후보 목록에서 빠진다');

select is(
  (select count(*)::int from public.my_notifications()),
  0,
  '청한 쪽에는 알림이 오지 않는다 — 자기가 한 일이다');

select is(
  (select direction from public.my_match_requests() where request_id = (select request_id from asked)),
  'sent',
  '보낸 쪽에서는 sent 다');

select is(
  (select supplied_to_me from public.my_match_requests() where request_id = (select request_id from asked)),
  array['土', '金'],
  '보낸 쪽이 읽는 것은 **상대가 내게 채우는 오행**이다');

-- 표에는 한 줄도 안 보인다. 읽는 길은 함수뿐이다.
select throws_ok($$select 1 from public.match_request$$, '42501',
  null, '요청 표는 직접 못 읽는다');
select throws_ok($$select 1 from public.notification$$, '42501',
  null, '알림 표도 직접 못 읽는다');
select throws_ok($$select 1 from public.match$$, '42501',
  null, 'Match 표도 직접 못 읽는다');

-- ── 받은 쪽 ──────────────────────────────────────────────────────────────────
select pg_temp.acting((select lee from folks));

select is((select count(*)::int from public.my_notifications()), 1, '받은 쪽에 알림이 하나 선다');
select is((select kind from public.my_notifications()), 'request_received', '새 요청 알림이다');
select is((select counterpart_nickname from public.my_notifications()), '김',
  '알림은 상대의 **공개용 별명**을 든다');
select is((select unread_notifications()), 1, '안 읽은 알림이 하나다');

select is(
  (select direction from public.my_match_requests() where request_id = (select request_id from asked)),
  'received',
  '받은 쪽에서는 received 다');

select is(
  (select supplied_to_me from public.my_match_requests() where request_id = (select request_id from asked)),
  array['木', '火'],
  '받은 쪽이 읽는 오행은 **뒤집혀** 나온다 — 화면이 방향을 다시 계산하지 않는다');

-- ── 수락 ─────────────────────────────────────────────────────────────────────

/**
 * **`null` 은 답이 아니다.**
 *
 * `if not p_accept` 는 `null` 에서 참이 아니라 거절 갈래를 지나 수락으로 떨어졌다.
 * 명시적 동의 경계에서 「모름」이 「예」로 읽히면, 답한 적 없는 사람의 Match 가 선다.
 */
select throws_ok(
  format($$select public.respond_to_match_request(%L::uuid, null)$$, (select request_id from asked)),
  '22004', '수락인지 거절인지 정해 주세요.', 'null 은 수락이 아니다');

select is(
  (select status from public.my_match_requests() where request_id = (select request_id from asked)),
  'pending',
  '답하지 않은 요청은 그대로 pending 이다');

select is(
  public.respond_to_match_request((select request_id from asked), true),
  'accepted',
  '수락하면 accepted 다');

select is(
  (select count(*)::int from public.my_matches()),
  1,
  'Match 가 하나 난다');

select is(
  (select partner_user_id from public.my_matches()),
  (select kim from folks),
  'Match 는 상대의 식별자를 든다 — 차단하는 문이 하나이려면 필요하다');

select is(
  public.respond_to_match_request((select request_id from asked), true),
  'accepted',
  '두 번 수락해도 지금 상태를 그대로 돌려준다');

select is(
  (select count(*)::int from public.my_matches()),
  1,
  '중복 수락이 Match 를 둘로 만들지 않는다');

select is(
  (select partner_nickname from public.my_matches()),
  '김',
  '받은 쪽에서 상대는 김이다');

select is(
  (select count(*)::int from public.my_notifications() where kind = 'request_accepted'),
  1,
  '성립은 받은 쪽도 알림으로 받는다');

/**
 * **Match 는 `user_person_access` 에 아무 행도 만들지 않는다**(US 46).
 *
 * 「내가 등록했다」와 「우리가 합의했다」는 다른 갈래다. 합쳐지면 저장 자리 한도가 Match
 * 를 세기 시작하고, 「이 사람이 왜 내 목록에 있지」를 되짚을 수 없게 된다.
 */
select is(
  (select count(*)::int from public.user_person_access),
  1,
  'Match 는 내 사람 목록을 늘리지 않는다 — 여전히 나 하나다');

select pg_temp.acting((select kim from folks));
select is((select partner_nickname from public.my_matches()), '이', '보낸 쪽에서 상대는 이다');

-- ── 입력이 바뀌면 pending 이 무효가 된다 ──────────────────────────────────────
create temporary table asked_park as
select public.request_match((select park from folks)) as request_id;
grant select on asked_park to authenticated;

select pg_temp.acting((select park from folks));

/**
 * **이름·메모를 고치는 것은 요청을 무효화하지 않는다**(`prd-archive`).
 *
 * 판본이 실제로 쌓였을 때만 무효화가 돈다. 같은 값으로 저장을 누르면 아무것도 쌓이지
 * 않으므로 여기까지 오지 않는다.
 */
select lives_ok(
  format($$select public.add_person_revision(%L::uuid,
    'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean')$$,
    (select park_person from persons)),
  '같은 값으로 다시 저장한다');

select is(
  (select status from public.my_match_requests() where request_id = (select request_id from asked_park)),
  'pending',
  '아무것도 안 바뀌었으면 요청은 그대로 산다');

select lives_ok(
  format($$select public.add_person_revision(%L::uuid,
    'solar', '1990-05-15', '1990-05-15', '15:45', 'female', '서울', 'jo', 'localMean')$$,
    (select park_person from persons)),
  '출생 시각을 고친다');

select is(
  (select status from public.my_match_requests() where request_id = (select request_id from asked_park)),
  'invalidated',
  'Evidence 를 바꾸는 수정은 pending 을 무효로 만든다');

select is(
  (select count(*)::int from public.my_notifications() where kind = 'request_invalidated'),
  1,
  '무효화는 **양쪽 다** 알림을 받는다 — 받은 쪽');

select pg_temp.acting((select kim from folks));
select is(
  (select count(*)::int from public.my_notifications() where kind = 'request_invalidated'),
  1,
  '무효화는 양쪽 다 알림을 받는다 — 청한 쪽');

-- ── 수락하는 순간에도 판본을 다시 본다 ───────────────────────────────────────
--
-- 아래 상태는 **앱 경로로는 만들 수 없다** — 판본을 고치는 그 트랜잭션이 pending 을
-- 이미 거두기 때문이다. 무효화와 수락이 겹치는 찰나를 손으로 세워 두고, 그때도
-- 수락이 Match 를 만들지 않는지를 잰다(US 44).
select pg_temp.acting((select park from folks));
select public.refresh_discovery_summary(
  (select park_person from persons), pg_temp.summary(0, 0, 4, 4, 0));

/**
 * **어제 본 카드로 오늘의 요청을 만들 수 없다.**
 *
 * 박의 요약이 바뀌었으므로 김이 들고 있는 노출 기록은 지금의 박이 아니다. 그대로 청하게
 * 두면 화면에서 읽은 이유와 요청에 남는 이유가 갈린다 — ADR 0009 의 「그때 무엇을 보고
 * 눌렀나」가 그 자리에서 깨진다.
 */
select pg_temp.acting((select kim from folks));
select throws_ok(
  format($$select public.request_match(%L::uuid)$$, (select park from folks)),
  '42501', '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.',
  '요약이 바뀐 사람에게는 목록을 다시 열기 전까지 청할 수 없다');

/**
 * **다시 여는 것으로는 안 된다 — 새로 받아야 한다**(ADR 0037).
 *
 * 목록이 스냅샷이 된 뒤로 읽기는 아무것도 적지 않는다. 박의 카드는 그때의 판본을
 * 가리키므로 읽는 자리에서 빠지고, 새 노출 기록은 다시 뽑을 때만 난다. 사람이 누르는
 * 문은 5분 쿨다운이 있어, 시험은 씨앗을 고르는 닫힌 문으로 뽑는다.
 */
reset role;
create temporary table kim_refreshed as
select public.refresh_discovery_snapshot_for((select kim from folks), 'ten') as id;

set local role authenticated;
select pg_temp.acting((select kim from folks));

select is(
  (select count(*)::int from public.my_discovery_board()
   where candidate_user_id = (select park from folks)),
  1,
  '새로 받으면 박이 다시 선다');

create temporary table asked_again as
select public.request_match((select park from folks)) as request_id;
grant select on asked_again to authenticated;

/**
 * 요청이 든 이유는 **그 기록이 보여준 것 그대로**여야 한다.
 *
 * 두 표 다 사용자에게 닫혀 있으므로 운영자 자리에서 본다 — 이 시험이 재는 것은 화면이
 * 무엇을 받는가가 아니라 **무엇이 남는가**다.
 */
reset role;
select is(
  (select r.supplied_to_requester from public.match_request r
   where r.id = (select request_id from asked_again)),
  (select i.supplied_elements from public.discovery_impression i
   where i.id = (select r.impression_id from public.match_request r
                 where r.id = (select request_id from asked_again))),
  '요청의 추천 이유는 그 노출 기록의 것과 같다');
set local role authenticated;

reset role;
update public.match_request
set addressee_revision_id = (select park_first from persons)
where id = (select request_id from asked_again);
set local role authenticated;

select pg_temp.acting((select park from folks));
select is(
  public.respond_to_match_request((select request_id from asked_again), true),
  'invalidated',
  '잡아 둔 판본과 지금 판본이 다르면 수락이 아니라 무효다');

select pg_temp.acting((select kim from folks));
select is(
  (select count(*)::int from public.my_matches()),
  1,
  '무효가 된 요청은 Match 를 만들지 않는다');

-- ── 거절은 되돌리지 않는다 ───────────────────────────────────────────────────
create temporary table asked_choi as
select public.request_match((select choi from folks)) as request_id;
grant select on asked_choi to authenticated;

select pg_temp.acting((select choi from folks));
select is(
  public.respond_to_match_request((select request_id from asked_choi), false),
  'rejected',
  '거절하면 rejected 다');

select pg_temp.acting((select kim from folks));
select is(
  (select count(*)::int from public.my_notifications() where kind = 'request_rejected'),
  1,
  '거절은 청한 쪽에만 알린다');

select throws_ok(
  format($$select public.request_match(%L::uuid)$$, (select choi from folks)),
  '42501', '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.',
  '거절한 사람에게 다시 두드리는 길은 열지 않는다');

select is(
  (select count(*)::int from public.my_discovery_board()
   where candidate_user_id = (select choi from folks)),
  0,
  '거절한 사람은 후보 목록에도 서지 않는다');

-- ── 차단 ─────────────────────────────────────────────────────────────────────
select is(public.block_user((select lee from folks)), true, '차단한다');

select is((select count(*)::int from public.my_matches()), 0, '차단하면 Match 가 목록에서 빠진다');

select pg_temp.acting((select lee from folks));
select is((select count(*)::int from public.my_matches()), 0, '차단당한 쪽에서도 빠진다');

/**
 * **전역 개수를 세지 않는다.**
 *
 * `public.match` 를 통째로 세면 이 시험은 「DB 가 비어 있는가」를 재게 된다 — flow 검사가
 * 남긴 Match 위에서는 이유 없이 깨진다. 이 시험이 만든 쌍으로 좁힌다.
 */
reset role;
select is(
  (select count(*)::int from public.match
   where user_low = least((select kim from folks), (select lee from folks))
     and user_high = greatest((select kim from folks), (select lee from folks))),
  1,
  '그래도 Match 행은 지우지 않는다 — 새 접근만 멈춘다');
set local role authenticated;

/**
 * **차단은 살아 있던 요청을 함께 거둔다** — 그리고 방향에 따라 이름이 다르다.
 *
 * 박이 청하고 김이 차단하면 김이 거절한 것이다. 상대가 받는 것은 평범한 거절 알림이고,
 * 차단했다는 사실은 알리지 않는다.
 */
select pg_temp.acting((select park from folks));
-- 박도 자기 요약이 바뀌었으므로 자기가 든 옛 기록은 더 이상 지금의 자기가 아니다.
-- 목록을 다시 열어 새 기록을 남긴 뒤에 청한다.
select lives_ok($$select count(*) from public.my_discovery_board()$$, '박이 목록을 다시 연다');

create temporary table asked_kim as
select public.request_match((select kim from folks)) as request_id;
grant select on asked_kim to authenticated;

select pg_temp.acting((select kim from folks));
select is(public.block_user((select park from folks)), true, '받은 요청이 있는 사람을 차단한다');

select pg_temp.acting((select park from folks));
select is(
  (select status from public.my_match_requests() where request_id = (select request_id from asked_kim)),
  'rejected',
  '받은 쪽이 차단하면 그 요청은 거절로 거둬진다');

select is(
  (select count(*)::int from public.my_notifications() where kind = 'request_rejected'),
  1,
  '상대는 평범한 거절 알림을 받는다');

select pg_temp.acting((select kim from folks));
select throws_ok(
  format($$select public.block_user(%L::uuid)$$, (select kim from folks)),
  '22023', '자기 자신은 차단할 수 없습니다.', '자기 자신은 차단할 수 없다');

/**
 * **푸는 길이 없다**(용어집: 차단은 되돌리지 않는다).
 *
 * 「푸는 길이 없다」를 화면 문구로만 두면 언젠가 그 문구를 지나가는 경로가 하나 생긴다.
 * 표에 지우는 권한 자체를 주지 않았고, 여기서 그것을 잰다.
 */
select throws_ok($$delete from public.block$$, '42501', null, '차단은 지울 수 없다');
select is((select count(*)::int from public.block), 2, '내가 건 차단은 내게 보인다');

-- ── 제재된 사람의 Match 는 만들어지지 않는다 ─────────────────────────────────
--
-- 「계정 제재는 새 접근과 접촉을 중단한다」(`prd-archive`)는 **받는 쪽에만** 거는 규칙이 아니다.
-- 답하는 쪽 상태만 물었더니 제재된 요청자의 Match 가 그대로 만들어졌다.
set local role authenticated;
create temporary table han as
select pg_temp.participant('han-mr@example.com', '한', pg_temp.summary(4, 0, 0, 0, 4)) as uid;
grant select on han to authenticated;

reset role;
insert into public.discovery_hidden (user_id, hidden_user_id)
select (select uid from han), p.user_id
from public.discovery_profile p
where p.user_id not in (select lee from folks) and p.user_id <> (select uid from han);
set local role authenticated;

select pg_temp.acting((select uid from han));
select is(
  (select count(*)::int from public.my_discovery_board()
   where candidate_user_id = (select lee from folks)),
  1,
  '한의 목록에 이가 선다');

/**
 * ── 바뀐 성별 조건을 **옛 노출 기록이 우회하지 못한다** ──────────────────────
 *
 * 요약만 견주면 이 자리가 열린다 — 성별 조건은 요약을 바꾸지 않기 때문이다. 상대가
 * 조건을 바꿔 내 목록에서 사라진 뒤에도 어제 남은 기록으로 청할 수 있었다(재어 봤다).
 * 후보 자격을 후보 목록과 **같은 함수**에 묻게 하고 나서 닫혔다.
 */
select pg_temp.acting((select lee from folks));
update public.discovery_profile set prefer_gender = 'male' where user_id = (select lee from folks);

select pg_temp.acting((select uid from han));
select is(
  (select count(*)::int from public.my_discovery_board()
   where candidate_user_id = (select lee from folks)),
  0,
  '조건이 바뀌면 목록에서 사라진다');

select throws_ok(
  format($$select public.request_match(%L::uuid)$$, (select lee from folks)),
  '42501', '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.',
  '목록에서 사라진 사람에게는 옛 기록으로도 청할 수 없다');

-- 조건을 되돌리면 다시 선다.
select pg_temp.acting((select lee from folks));
update public.discovery_profile set prefer_gender = 'any' where user_id = (select lee from folks);

select pg_temp.acting((select uid from han));
select lives_ok($$select count(*) from public.my_discovery_board()$$, '한이 목록을 다시 연다');

create temporary table asked_lee_by_han as
select public.request_match((select lee from folks)) as request_id;
grant select on asked_lee_by_han to authenticated;

reset role;
update public.app_user set status = 'suspended' where id = (select uid from han);
set local role authenticated;

/**
 * **잠근 뒤 다시 물어도 답이 같아야 한다.**
 *
 * `request_match` 는 잠그기 **전에** 한 번, 잠근 뒤 다시 한 번 자기 상태를 묻는다.
 * 그 사이에 제재가 커밋되면 앞의 답은 이미 낡았기 때문이다. 뒤엣것이 기대는 것이
 * 이 판정이다 — 중지된 사람은 누구의 후보도 아니다.
 */
reset role;
select is(
  public.discovery_eligible((select uid from han), (select lee from folks)),
  false,
  '중지된 사람은 잠근 뒤 다시 물어도 후보 자격이 없다');
set local role authenticated;

select pg_temp.acting((select lee from folks));
select throws_ok(
  format($$select public.respond_to_match_request(%L::uuid, true)$$,
    (select request_id from asked_lee_by_han)),
  '42501', '요청을 찾지 못했습니다.',
  '제재된 사람의 요청은 수락되지 않는다 — 없는 요청과 같은 문장이다');

reset role;
select is(
  (select count(*)::int from public.match
   where user_low = least((select uid from han), (select lee from folks))
     and user_high = greatest((select uid from han), (select lee from folks))),
  0,
  '제재된 요청자의 Match 는 만들어지지 않는다');
set local role authenticated;
select pg_temp.acting((select lee from folks));

select is(
  (select count(*)::int from public.my_match_requests()
   where request_id = (select request_id from asked_lee_by_han)),
  0,
  '중지된 계정과의 요청은 목록에도 서지 않는다');

select is(
  (select count(*)::int from public.my_notifications()
   where request_id = (select request_id from asked_lee_by_han)),
  0,
  '그 통보도 서지 않는다');

-- ── 취소한 요청은 없던 일이 된다 ─────────────────────────────────────────────
select pg_temp.acting((select choi from folks));
select lives_ok($$select count(*) from public.my_discovery_board()$$, '최가 목록을 연다');

create temporary table asked_lee as
select public.request_match((select lee from folks)) as request_id;
grant select on asked_lee to authenticated;

select is(
  public.cancel_match_request((select request_id from asked_lee)),
  'cancelled',
  '보낸 요청을 거둔다');

select pg_temp.acting((select lee from folks));
select is(
  (select count(*)::int from public.my_match_requests()
   where request_id = (select request_id from asked_lee)),
  0,
  '거둬진 요청은 받은 쪽 목록에 서지 않는다');

select is(
  (select count(*)::int from public.my_notifications()
   where request_id = (select request_id from asked_lee)),
  0,
  '거둬진 요청의 통보도 서지 않는다 — 눌러도 아무것도 없는 알림은 두지 않는다');

/**
 * **목록과 배지가 같은 것을 센다.**
 *
 * 목록은 거둬진 요청의 통보를 숨기는데 배지가 모든 안 읽은 행을 세면, 「목록엔 아무것도
 * 없는데 수는 는다」가 실재한다. 조건이 두 벌이면 언젠가 갈린다.
 */
select is(
  (select public.unread_notifications()),
  (select count(*)::int from public.my_notifications() where read_at is null),
  '안 읽은 수는 목록에 선 것만 센다');

-- ── 읽음은 사건이다 ──────────────────────────────────────────────────────────
select ok((select public.unread_notifications()) > 0, '안 읽은 알림이 있다');
select ok((select public.mark_notifications_read()) > 0, '읽음으로 바꾼 개수를 돌려준다');
select is((select public.unread_notifications()), 0, '읽고 나면 안 읽은 알림이 없다');

-- ── 요청이 풀이권 한 자리를 잡는다 (ADR 0038) ────────────────────────────────
--
-- **예약은 값이 아니라 세는 법이다.** 원장을 두지 않았으므로 여기서 재는 것은 「차감과
-- 반환이 맞는가」가 아니라 **살아 있는 요청이 셈에 드는가**다. 끝나는 갈래가 넷이고
-- 그중 어느 것도 되돌리는 일을 하지 않는다.

reset role;

/**
 * **한 장으로 잰다.** 다섯 장을 쓰려면 결과를 다섯 번 저장해야 하고, 그건 이 파일이
 * 재려는 것이 아니다. 경계는 한 장에서도 똑같이 서 있다.
 */
create or replace function public.reading_credit_limit()
returns integer language sql immutable as $limit$ select 1 $limit$;

set local role authenticated;

create temporary table later as
select
  pg_temp.participant('yoon-mr@example.com', '윤', pg_temp.summary(4, 4, 0, 0, 0)) as yoon,
  pg_temp.participant('jang-mr@example.com', '장', pg_temp.summary(0, 0, 4, 4, 0)) as jang,
  pg_temp.participant('moon-mr@example.com', '문', pg_temp.summary(0, 0, 0, 0, 8)) as moon;
grant select on later to authenticated;

/** 앞선 시험들이 남긴 사람들은 이 셋의 관심 밖이다 — 서로만 보이게 둔다 */
reset role;
insert into public.discovery_hidden (user_id, hidden_user_id)
select ours.uid, p.user_id
from (select yoon as uid from later union all select jang from later
      union all select moon from later) ours,
     public.discovery_profile p
where p.user_id not in (
  select yoon from later union all select jang from later union all select moon from later);
set local role authenticated;

select pg_temp.acting((select yoon from later));
select is(
  (select array[used, reserved, requested, available] from public.my_reading_credits()),
  array[0, 0, 0, 1],
  '아직 아무것도 안 잡혀 있다');

select lives_ok($$select count(*) from public.my_discovery_board()$$, '윤이 목록을 연다');

create temporary table asked_jang as
select public.request_match((select jang from later)) as request_id;
grant select on asked_jang to authenticated;

select is(
  (select array[used, reserved, requested, available] from public.my_reading_credits()),
  array[0, 0, 1, 0],
  '요청 한 건이 풀이권 한 자리를 잡는다');

/**
 * **제품에 새로 서는 사실 하나** — 요청을 띄운 사람은 자기 사주 풀이를 못 만든다.
 * 버그가 아니라 정책이라, 거절의 말이 「다 썼다」가 아니라 **왜 잡혀 있는지**를 말한다.
 */
select throws_like(
  $$select * from public.start_reading_run('self', 'yoon-self-0001')$$,
  '%인연 요청%',
  '요청이 잡고 있으면 자기 풀이도 못 만든다');

/** **제품에 새로 서는 사실 둘** — 풀이권 없이는 인연 요청을 못 한다 */
select throws_like(
  format($$select public.request_match(%L::uuid)$$, (select moon from later)),
  '%풀이권%',
  '잔액이 없으면 청할 수 없다');

-- ── 끝나는 갈래는 다 자리를 푼다 ─────────────────────────────────────────────

select is(
  public.cancel_match_request((select request_id from asked_jang)),
  'cancelled',
  '거두면 요청이 없던 일이 된다');

select is(
  (select array[requested, available] from public.my_reading_credits()),
  array[0, 1],
  '거두면 자리가 풀린다 — 되돌리는 일 없이');

select lives_ok($$select count(*) from public.my_discovery_board()$$, '윤이 목록을 다시 연다');
create temporary table asked_jang_again as
select public.request_match((select jang from later)) as request_id;
grant select on asked_jang_again to authenticated;

select pg_temp.acting((select jang from later));
select is(
  public.respond_to_match_request((select request_id from asked_jang_again), false),
  'rejected',
  '장이 거절한다');

select pg_temp.acting((select yoon from later));
select is(
  (select array[requested, available] from public.my_reading_credits()),
  array[0, 1],
  '거절당하면 자리가 풀린다');

-- ── 7일이 지나면 만료다 ─────────────────────────────────────────────────────

select lives_ok($$select count(*) from public.my_discovery_board()$$, '윤이 문을 보러 목록을 연다');
create temporary table asked_moon as
select public.request_match((select moon from later)) as request_id;
grant select on asked_moon to authenticated;

select is(
  (select array[requested, available] from public.my_reading_credits()),
  array[1, 0],
  '문에게 청한 것도 한 자리를 잡는다');

reset role;
update public.match_request set expires_at = now() - interval '1 minute'
where id = (select request_id from asked_moon);
set local role authenticated;
select pg_temp.acting((select yoon from later));

/**
 * **잔액은 미는 일을 안 기다린다.** 셈이 `expires_at > now()` 만 보므로 풀이권은 기한이
 * 지나는 그 순간 이미 돌아와 있다. cron 이 늦어도 사용자가 잃는 것이 없다.
 */
select is(
  (select array[requested, available] from public.my_reading_credits()),
  array[0, 1],
  '기한이 지나면 밀기 전에도 자리가 풀려 있다');

/** 미는 일이 하는 것은 **표시와 유일 인덱스**다 — 목록에서 내려가고 다시 청할 수 있게 된다 */
reset role;
select is(public.expire_match_requests(), 1, '기한이 지난 요청 하나를 만료로 민다');
set local role authenticated;
select pg_temp.acting((select yoon from later));

select is(
  (select status from public.my_match_requests()
   where request_id = (select request_id from asked_moon)),
  'expired',
  '만료는 거둠·무효와 다른 상태로 남는다');

select is(
  (select count(*)::int from public.my_notifications()
   where request_id = (select request_id from asked_moon) and kind = 'request_expired'),
  1,
  '요청자에게만 만료가 알려진다 — 풀이권이 돌아왔다는 것을 알아야 한다');

/**
 * 받은 쪽에는 만료가 안 선다 — 답을 안 한 것이라 알릴 일이 없고, 알리면 「답하지
 * 않았다」를 두드리는 도구가 된다. 처음 받은 통보는 그대로 남는다.
 */
select pg_temp.acting((select moon from later));
select is(
  (select count(*)::int from public.my_notifications()
   where request_id = (select request_id from asked_moon) and kind = 'request_expired'),
  0,
  '답하지 않은 쪽은 두드리지 않는다');

/** 만료된 요청은 다시 청할 수 있다 — `one_live_request_between_two` 가 `pending` 만 묶는다 */
select pg_temp.acting((select yoon from later));
select lives_ok($$select count(*) from public.my_discovery_board()$$, '윤이 다시 목록을 연다');
select isnt(
  public.request_match((select moon from later)),
  null,
  '만료된 뒤에는 같은 사람에게 다시 청할 수 있다');

reset role;
select * from finish();
rollback;
