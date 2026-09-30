-- 미리 만든 로그인 전 사주 문단과 그 좁은 문 (`20261104090000`, 흐름 시안 g)
--
-- 여기서 재는 것 넷.
--
-- 1. **표는 아무도 직접 못 읽고 못 쓴다** — 익명도 로그인한 사람도. 쓰는 것은 열쇠(만들기 스크립트)뿐이다
-- 2. **익명이 문으로 열쇠 하나의 글을 읽는다** — 검사를 지난 글만. 못 지난 칸 · 없는 칸은 `null`
-- 3. **문은 열쇠 하나에 글 하나다** — 다른 칸의 글이 섞여 나오지 않는다
-- 4. **표가 모양을 지킨다** — 열쇠의 꼴과 본문의 길이
--
-- 문이 `checked` 를 안 보게 되돌리면 2 의 「못 지난 칸」이 붉다.
begin;
select plan(12);

insert into public.taste_passage (key, body, model, checked) values
  ('丙午-卯', '한낮의 해처럼 먼저 밝히는 사람이에요. 봄의 나무가 불을 받쳐 줘요.', 'test-model', true),
  ('丙午-辰', '검사를 못 지난 글이에요. 화면에 서면 안 되는 글이에요.', 'test-model', false),
  ('壬子-亥', '깊은 물이 겨울을 만나 더 깊어지는 사람이에요. 서두르지 않아요.', 'test-model', true);

-- ---------------------------------------------------------------------------
-- 1. 표는 직접 못 읽는다
-- ---------------------------------------------------------------------------
set local role anon;

select throws_ok(
  $$select body from public.taste_passage$$,
  '42501', null,
  '익명은 로그인 전 사주 문단 표를 직접 못 읽는다 — 열쇠 하나씩 문으로만');

select throws_ok(
  $$insert into public.taste_passage (key, body, model, checked) values ('甲子-子', '익명이 쓴 글이에요. 첫 화면에 서면 안 돼요.', 'x', true)$$,
  '42501', null,
  '익명은 로그인 전 사주 문단을 못 쓴다');

-- ---------------------------------------------------------------------------
-- 2 · 3. 익명이 문으로 읽는다
-- ---------------------------------------------------------------------------
select is(
  public.taste_passage('丙午-卯'),
  '한낮의 해처럼 먼저 밝히는 사람이에요. 봄의 나무가 불을 받쳐 줘요.',
  '익명이 열쇠 하나로 검사를 지난 글을 읽는다');

select is(
  public.taste_passage('丙午-辰'),
  null,
  '검사를 못 지난 칸은 비어 있다 — 화면이 대신 설 문장을 든다');

select is(
  public.taste_passage('甲子-子'),
  null,
  '아직 안 만든 칸은 비어 있다');

select is(
  public.taste_passage('壬子-亥'),
  '깊은 물이 겨울을 만나 더 깊어지는 사람이에요. 서두르지 않아요.',
  '열쇠마다 제 글이 나온다 — 다른 칸이 섞이지 않는다');

select is(
  public.taste_passage('%'),
  null,
  '열쇠는 글자 그대로 맞춘다 — 무늬로 여러 칸을 훑지 못한다');

reset role;
select set_config('request.jwt.claims', tests.claims(tests.signup('taste-reader@example.com')), true);
set local role authenticated;

select throws_ok(
  $$select body from public.taste_passage$$,
  '42501', null,
  '로그인한 사람도 표를 직접 못 읽는다');

select is(
  public.taste_passage('丙午-卯'),
  '한낮의 해처럼 먼저 밝히는 사람이에요. 봄의 나무가 불을 받쳐 줘요.',
  '로그인한 사람도 같은 문으로 읽는다');

-- ---------------------------------------------------------------------------
-- 4. 표의 모양
-- ---------------------------------------------------------------------------
reset role;

select throws_ok(
  $$insert into public.taste_passage (key, body, model) values ('丙午卯', '하이픈이 없는 열쇠예요. 들어가면 안 돼요.', 'x')$$,
  '23514', null,
  '열쇠는 일주 두 글자 · 하이픈 · 월지 한 글자다');

select throws_ok(
  $$insert into public.taste_passage (key, body, model) values ('丙午-巳', '짧아요.', 'x')$$,
  '23514', null,
  '너무 짧은 글은 안 들어간다');

select is(
  (select checked from public.taste_passage where key = '壬子-亥'),
  true,
  '검사를 지났는가가 칸으로 남는다');

select * from finish();
rollback;
