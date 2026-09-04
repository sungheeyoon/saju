-- 프로필 — **이름은 하나이고 유일하고, 얼굴은 이름이 보이는 자리에서만 보인다**
--
-- PRD §5.1 · §5.2. 여기서 재는 것은 셋이다. 이름의 규칙이 **DB 안에서** 지켜지는가,
-- 「쓸 수 있나」를 묻는 문이 그것만 내주는가, 그리고 사진이 **볼 수 있는 사람에게만**
-- 열리는가.
begin;
select plan(30);

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** 다섯 오행 개수만 주면 요약 한 벌이 된다 — 다른 파일과 같은 손잡이다 */
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

create temporary table who as
select tests.signup('kim-prof@example.com') as kim,
       tests.signup('lee-prof@example.com') as lee,
       tests.signup('park-prof@example.com') as park;
grant select on who to authenticated;

set local role authenticated;
select pg_temp.acting((select kim from who));

-- ── 이름의 규칙 ───────────────────────────────────────────────────────────────

select throws_ok(
  $$select public.save_my_profile('김', null)$$,
  '22023', null,
  '한 자짜리 이름은 못 짓는다');

select throws_ok(
  $$select public.save_my_profile('아홉글자짜리인이름', null)$$,
  '22023', null,
  '아홉 자짜리 이름은 못 짓는다');

select throws_ok(
  $$select public.save_my_profile('   ', null)$$,
  '22023', null,
  '공백만 넣으면 이름이 아니다');

select lives_ok(
  $$select public.save_my_profile('  지영  ', '조용한 편입니다')$$,
  '앞뒤 공백은 깎고 받는다');

select is(
  (select nickname from public.app_user where id = (select kim from who)),
  '지영',
  '표에는 깎인 이름이 앉는다');

select is(
  (select intro from public.app_user where id = (select kim from who)),
  '조용한 편입니다',
  '소개도 함께 앉는다');

/** 소개는 있거나 없다 — 빈 문자열로 저장하면 「없음」이 두 값이 된다 */
select public.save_my_profile('지영', '   ');
select is(
  (select intro from public.app_user where id = (select kim from who)),
  null,
  '공백뿐인 소개는 없는 것으로 앉는다');

select lives_ok(
  $$select public.save_my_profile('지영', null)$$,
  '내 이름을 그대로 다시 저장할 수 있다');

-- ── 유일함 ───────────────────────────────────────────────────────────────────

select pg_temp.acting((select lee from who));

select throws_ok(
  $$select public.save_my_profile('지영', null)$$,
  '23505', null,
  '남이 쓰는 이름은 못 짓는다');

/**
 * **접는 규칙이 한 벌이다.**
 *
 * 유일 인덱스도 확인하는 문도 저장하는 함수도 `nickname_key` 하나를 본다. 갈리면
 * 「비었다고 답하는데 저장은 거절하는」 자리가 생긴다.
 */
select throws_ok(
  $$select public.save_my_profile(' 지영 ', null)$$,
  '23505', null,
  '앞뒤 공백만 다른 이름은 같은 이름이다');

select public.save_my_profile('Mina', null);
select pg_temp.acting((select park from who));
select throws_ok(
  $$select public.save_my_profile('MINA', null)$$,
  '23505', null,
  '대소문자만 다른 이름도 같은 이름이다');

-- ── 「쓸 수 있나」를 묻는 문 ──────────────────────────────────────────────────

select is(
  (select public.nickname_is_available('지영')),
  false,
  '남이 쓰는 이름은 쓸 수 없다고 답한다');

select is(
  (select public.nickname_is_available('아무도안쓴')),
  true,
  '아무도 안 쓰는 이름은 쓸 수 있다고 답한다');

select pg_temp.acting((select kim from who));
select is(
  (select public.nickname_is_available('지영')),
  true,
  '내가 쓰는 이름은 나에게 쓸 수 있다고 답한다 — 고치는 화면이 자기 이름에 걸리지 않는다');

select throws_ok(
  $$select public.nickname_is_available('김')$$,
  '22023', null,
  '길이가 어긋나면 있고 없고를 답하기 전에 거절한다');

reset role;
set local role anon;
select throws_ok(
  $$select public.nickname_is_available('아무도안쓴')$$,
  '42501', null,
  '로그인하지 않으면 이 문이 안 열린다');

-- ── 얼굴 ─────────────────────────────────────────────────────────────────────

reset role;
set local role authenticated;
select pg_temp.acting((select kim from who));

select throws_ok(
  format($$select public.set_my_photo('image/gif', %L)$$, encode('gif89a'::bytea, 'base64')),
  '22023', null,
  '받기로 한 형식이 아니면 거절한다');

select throws_ok(
  format($$select public.set_my_photo('image/png', %L)$$,
    encode(repeat('0', 600000)::bytea, 'base64')),
  '22023', null,
  '512KB 를 넘으면 거절한다');

select lives_ok(
  format($$select public.set_my_photo('image/png', %L)$$, encode('PNG-김'::bytea, 'base64')),
  '사진을 올린다');

select is(
  (select content_type from public.photo_of((select kim from who))),
  'image/png',
  '내 사진은 내가 읽는다');

select is(
  (select decode(base64, 'base64') from public.photo_of((select kim from who))),
  'PNG-김'::bytea,
  '올린 바이트가 그대로 돌아온다');

/**
 * **아무 사이도 아닌 사람의 사진은 안 열린다.**
 *
 * 없는 사람과 못 보는 사람이 같은 답을 받는다 — 갈라서 말하면 「저 사람이 이 서비스를
 * 쓰나」를 묻는 문이 된다.
 */
select pg_temp.acting((select park from who));
select is(
  (select count(*)::int from public.photo_of((select kim from who))),
  0,
  '남의 사진은 이유 없이 안 열린다');

select is(
  (select count(*)::int from public.photo_of(gen_random_uuid())),
  0,
  '없는 사람의 사진도 같은 답을 받는다');

/**
 * **후보로 서면 사진도 함께 선다.**
 *
 * 조건을 새로 짓지 않았다. 사진이 서는 자리는 이름이 서는 자리이고, 그 좁힘은 이미
 * 후보 목록이 든다.
 */
select pg_temp.acting((select kim from who));
select public.create_self_person(
  '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean');
select public.set_discovery_participation(true, pg_temp.summary(4, 4, 0, 0, 0));

select pg_temp.acting((select lee from who));
select public.create_self_person(
  '나', 'solar', '1992-03-03', '1992-03-03', '09:00', 'female', '서울', 'jo', 'localMean');
select public.set_discovery_participation(true, pg_temp.summary(0, 0, 4, 4, 0));

-- 이 열기가 스냅샷을 만든다. 김이 그 목록에 서 있어야 이가 김의 사진을 열 수 있다.
select is(
  (select count(*)::int from public.my_discovery_board() b
   where b.candidate_user_id = (select kim from who)),
  1,
  '김이 이의 후보로 선다');

select is(
  (select has_photo from public.my_discovery_board() b
   where b.candidate_user_id = (select kim from who)),
  true,
  '카드가 사진이 있다고 말한다');

select is(
  (select content_type from public.photo_of((select kim from who))),
  'image/png',
  '후보로 선 사람의 사진은 열린다');

/**
 * **이름 없는 사람은 남에게 안 선다.**
 *
 * 「사주가 있으면 이름도 있다」를 검사식으로 안 걸었다 — 이름이 계정으로 옮겨 오기
 * 전에 사주를 등록한 사람들이 정확히 그 상태라, 걸었으면 그들에게 안 고른 이름을 지어
 * 넣어야 했다. 대신 **남에게 보이는 문**이 이름을 묻는다. 그 문이 실제로 잠기는지를
 * 여기서 잰다.
 */
reset role;
update public.app_user set nickname = null where id = (select lee from who);
set local role authenticated;
select pg_temp.acting((select lee from who));

select throws_ok(
  $$select public.set_discovery_participation(true, '{"glyphCount":8,"counts":{"木":0,"火":0,"土":4,"金":4,"水":0},"ratios":{"木":0,"火":0,"土":0.5,"金":0.5,"水":0}}'::jsonb)$$,
  '23502', null,
  '이름이 없으면 남의 목록에 설 수 없다');

reset role;
update public.app_user set nickname = '이프' where id = (select lee from who);
set local role authenticated;
select pg_temp.acting((select lee from who));

/** 감추면 후보에서 빠지고 — **사진도 함께 닫힌다** */
insert into public.discovery_hidden (hidden_user_id) values ((select kim from who));
select is(
  (select count(*)::int from public.photo_of((select kim from who))),
  0,
  '그만 보기로 한 사람의 사진은 닫힌다');

-- ── 지우는 일은 열쇠를 따라간다 ──────────────────────────────────────────────

reset role;
select is(
  (select count(*)::int from public.profile_photo where user_id = (select kim from who)),
  1,
  '떠나기 전에는 사진이 한 장 있다');

select public.forget_user((select kim from who));

select is(
  (select count(*)::int from public.profile_photo where user_id = (select kim from who)),
  0,
  '계정이 사라지면 사진도 함께 사라진다 — 손으로 적은 줄이 없다');

select * from finish();
rollback;
