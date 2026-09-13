-- 공유본 — **보낸 그때의 글이 그대로 남고, 로그인 없이 열린다.**
--
-- 여기서 재는 것 여섯.
--
-- 1. **내 것만 내보낸다.** 함수가 대상을 안 받으므로 남의 글을 가리킬 자리가 없고,
--    자기 풀이가 없는 사람은 아무것도 못 낸다.
-- 2. **지어낸 글은 못 지나간다.** 자르는 일은 앱이 하지만 확인은 문이 한다.
-- 3. **같은 판은 같은 링크다.** 두 번 눌러도 토큰이 하나다.
-- 4. **원본을 다시 만들어도 보낸 글은 안 바뀐다** — 그리고 그때는 새 링크가 난다.
-- 5. **로그인 없이 열린다.** 그리고 표 자체는 아무에게도 안 보인다.
-- 6. **없는 토큰은 0행이다.**
begin;
select plan(18);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** 열쇠만 부르는 문이라 한 겹 감싼다(다른 풀이 시험과 같은 자리) */
create or replace function pg_temp.save(run uuid, rev_a uuid, body text, said text)
returns uuid language sql security definer as $$
  select public.save_reading(
    run, rev_a, null, body, null, said,
    '{"charts":{}}', '# 역할', 'reading-prompt-v7', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

/** 공유본이 몇 줄인가 — 표가 닫혀 있으므로(그것이 규칙이다) 세는 손잡이를 따로 둔다 */
create or replace function pg_temp.shares()
returns integer language sql security definer as $$
  select count(*)::int from public.reading_share;
$$;

/** 한 사람이 가입하고 자기 명식까지 세운다 */
create or replace function pg_temp.joins(mail text)
returns uuid language plpgsql as $$
declare uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean');
  return uid;
end;
$$;

/** 자기 풀이 한 편을 실제 문으로 만든다 — 시도를 열고 그 시도로 저장한다 */
create or replace function pg_temp.reads(body text, said text)
returns void language plpgsql as $$
declare run record;
begin
  select * into run from public.start_reading_run('self', gen_random_uuid()::text);
  perform pg_temp.save(run.run_id, run.revision_a, body, said);
end;
$$;

set local role authenticated;

create temporary table folks as
select pg_temp.joins('kim-share@example.com') as kim,
       pg_temp.joins('lee-share@example.com') as lee;
grant select on folks to authenticated, service_role;

-- ── 아직 풀이가 없는 사람 ──────────────────────────────────────────────────

select pg_temp.acting((select kim from folks));

select throws_ok(
  $$select public.share_my_reading('아무 글')$$,
  null, '공유할 내 사주풀이가 없습니다',
  '풀이가 없으면 링크가 안 난다');

-- ── 김이 풀이를 하나 만든다 ────────────────────────────────────────────────

select pg_temp.reads(
  '## 지금의 핵심' || chr(10) || '김공유님은 차분하게 봅니다.' || chr(10)
    || '### 근거' || chr(10) || '- analysis.tenGods',
  '한 줄로 요약한 문장입니다.');

create temporary table first_link as
select public.share_my_reading(
  '## 지금의 핵심' || chr(10) || '김공유님은 차분하게 봅니다.',
  '한 줄로 요약한 문장입니다.') as token;
grant select on first_link to authenticated, service_role, anon;

select isnt((select token from first_link), null, '공유 링크가 난다');
select matches((select token from first_link), '^[0-9a-f]{32}$',
  '토큰은 서른두 자리 난수다');

-- ── 지어낸 글은 못 지나간다 ────────────────────────────────────────────────

select throws_ok(
  $$select public.share_my_reading('제가 직접 쓴 광고 문구입니다.', '한 줄로 요약한 문장입니다.')$$,
  null, '공유할 내용이 저장된 풀이와 다릅니다',
  '저장된 원문에 없는 글은 안 나간다');

select throws_ok(
  $$select public.share_my_reading('## 지금의 핵심', '내가 지은 다른 한 줄')$$,
  null, '공유할 한 줄 요약이 저장된 풀이와 다릅니다',
  '한 줄 요약도 저장된 것과 같아야 한다');

-- ── 같은 판을 다시 보내면 같은 링크다 ──────────────────────────────────────

select is(
  public.share_my_reading(
    '## 지금의 핵심' || chr(10) || '김공유님은 차분하게 봅니다.',
    '한 줄로 요약한 문장입니다.'),
  (select token from first_link),
  '같은 결과를 다시 공유하면 먼저 낸 링크가 그대로 난다');

select is(pg_temp.shares(), 1, '두 번 눌러도 공유본은 하나다');

-- ── 근거 절은 링크에 안 실린다 ─────────────────────────────────────────────

select is(
  (select position('근거' in s.body) from public.shared_reading((select token from first_link)) s),
  0,
  '내부 검토용 근거 절은 공유본에 없다');

select is(
  (select s.body from public.shared_reading((select token from first_link)) s),
  '## 지금의 핵심' || chr(10) || '김공유님은 차분하게 봅니다.',
  '닉네임이 든 사용자용 본문은 그대로 남는다');

select is(
  (select s.metaphor from public.shared_reading((select token from first_link)) s),
  '한 줄로 요약한 문장입니다.',
  '한 줄 요약도 함께 남는다');

-- ── 원본을 다시 만들어도 보낸 글은 안 바뀐다 ───────────────────────────────

select pg_temp.reads(
  '## 새로 받은 풀이' || chr(10) || '이번에는 다르게 읽었습니다.',
  '새로 난 한 줄입니다.');

select is(
  (select s.body from public.shared_reading((select token from first_link)) s),
  '## 지금의 핵심' || chr(10) || '김공유님은 차분하게 봅니다.',
  '원본을 다시 만들어도 이미 보낸 링크의 글은 그대로다');

create temporary table second_link as
select public.share_my_reading(
  '## 새로 받은 풀이' || chr(10) || '이번에는 다르게 읽었습니다.',
  '새로 난 한 줄입니다.') as token;
grant select on second_link to authenticated, service_role, anon;

select isnt((select token from second_link), (select token from first_link),
  '새로 만든 풀이는 새 링크를 받는다');

select is(pg_temp.shares(), 2, '공유본이 둘이 된다');

-- ── 남의 글은 못 내보낸다 ──────────────────────────────────────────────────

select pg_temp.acting((select lee from folks));

select throws_ok(
  $$select public.share_my_reading('## 지금의 핵심', '한 줄로 요약한 문장입니다.')$$,
  null, '공유할 내 사주풀이가 없습니다',
  '남의 풀이 본문을 들고 와도 내 것이 없으면 안 난다');

-- ── 표는 아무에게도 안 보인다 ──────────────────────────────────────────────

select throws_ok(
  $$select 1 from public.reading_share$$,
  '42501', null, '공유본 표는 한 줄도 직접 안 보인다');

-- ── 로그인하지 않은 사람이 연다 ────────────────────────────────────────────

reset role;
set local role anon;
select set_config('request.jwt.claims', null, true);

select is(
  (select s.body from public.shared_reading((select token from first_link)) s),
  '## 지금의 핵심' || chr(10) || '김공유님은 차분하게 봅니다.',
  '로그인하지 않아도 공유본이 열린다');

select is(
  (select count(*)::int from public.shared_reading('0123456789abcdef0123456789abcdef')),
  0,
  '없는 토큰은 0행이다');

select throws_ok(
  $$select public.share_my_reading('아무 글')$$,
  '42501', null, '로그인하지 않은 사람은 링크를 못 낸다');

select * from finish();
rollback;
