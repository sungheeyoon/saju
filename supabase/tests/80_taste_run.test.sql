-- 사람마다의 로그인 전 맛보기 — 예약 · 결과 · 읽기 · 귀속 · 풀이 잇기 · 정리 (`20261118090000`)
--
-- 여기서 재는 것.
--
--   1. **문은 열쇠에만, 표는 아무에게도** — 익명 · 로그인한 사람 · 열쇠 모두 표를 직접 못 만진다. IP · 쿠키 · 생년월일시
--      원문을 받을 칸이 없고, HMAC 칸에 원문을 넣으면 던진다
--   2. **같은 입력은 모델 예약 하나** — 연타 · 다른 브라우저 · 쿠키를 지운 브라우저가 같은 artifact 를 본다
--   3. **한도** — IP 1분 3 · 하루 20, 브라우저 1시간 새 지문 5, 전체 하루(상한 함수를 낮춰 잰다), 값싼 요청 1분 30.
--      한도에 걸리면 아무것도 늘지 않는다. 상한 함수가 운영 값을 내는지도 잰다
--   4. **실패도 예산을 쓴다 · 재시도는 같은 행에서 셋까지** — 늦게 온 결과는 무시된다
--   5. **시간을 넘긴 시도는 정리 작업이 닫는다**
--   6. **세션은 id 와 브라우저 HMAC 이 함께 맞아야 읽힌다**
--   7. **귀속** — 다른 브라우저 HMAC · 다른 회원은 거절, 같은 회원 재시도는 멱등, 지문이 다르면 버림, 정지 계정은 막힘
--   8. **세션 하나에 풀이 시도 하나** — 성공했으면 그것을 가리키고, 실패했으면 바꿔 잇는다
--   9. **artifact 가 지워져도 귀속된 세션은 본 글을 든다**
--  10. **24시간 정리 · 탈퇴 처분 · 퍼널 · 크론**
--
-- 이 파일이 만든 행만 센다 — 지문 · HMAC 은 이 파일의 이름표로 짓고, 전역인 하루 예산 줄과 알림 줄은 트랜잭션 안에서
-- 0 으로 두고 잰다(롤백이 되돌린다). 한 트랜잭션이라 `now()` 가 멈춰 있다 — 시간이 흐른 것은 시각 칸을 뒤로 밀어 만든다.
--
-- 두 세션 경합(동시 예약 스물)은 pgTAP 이 못 만든다 — `scripts/check-db-races.mjs` 의 8 이 잰다.
begin;
select plan(105);

/** 이 파일의 이름표로 짓는 16진 64자 — 지문 · 브라우저 HMAC · IP HMAC 모두 */
create function pg_temp.h(tag text)
returns text language sql immutable as $$ select encode(sha256(convert_to('taste-test:' || tag, 'UTF8')), 'hex') $$;

/** 예약의 갈래 하나 */
create function pg_temp.go(fp text, browser text, ip text)
returns text language sql as $$
  select r.outcome from public.reserve_taste(pg_temp.h(fp), 'taste-v1', 'luna-none-v1', pg_temp.h(browser), pg_temp.h(ip)) r
$$;

/** 예약 한 줄 통째로 */
create function pg_temp.reserve(fp text, browser text, ip text)
returns table (outcome text, session_id uuid, artifact_id uuid, attempt integer) language sql as $$
  select * from public.reserve_taste(pg_temp.h(fp), 'taste-v1', 'luna-none-v1', pg_temp.h(browser), pg_temp.h(ip))
$$;

create function pg_temp.artifact(fp text)
returns uuid language sql as $$
  select a.id from public.taste_artifact a
  where a.evidence_fingerprint = pg_temp.h(fp) and a.prompt_version = 'taste-v1' and a.model_config_version = 'luna-none-v1'
$$;

create function pg_temp.session(fp text, browser text)
returns uuid language sql as $$
  select s.id from public.taste_session s
  where s.evidence_fingerprint = pg_temp.h(fp) and s.browser_hmac = pg_temp.h(browser)
  order by s.created_at desc limit 1
$$;

/** 성공을 적는다 — 그 artifact 의 지금 시도 번호로 */
create function pg_temp.succeed(fp text, body text default '첫 문단이에요.

장면 안에서 멈추는 물음이에요?')
returns text language sql as $$
  select public.finish_taste(pg_temp.artifact(fp), (select a.attempts from public.taste_artifact a where a.id = pg_temp.artifact(fp)),
    null, body, '겉과 속의 차이', '겉으로는 빠르고 속으로는 오래 저울질한다', '왜 결정 뒤에도 다시 저울질할까요?',
    '저울질을 멈추는 기준 하나를 먼저 세운다', array['analysis.structure', 'pillars.day'],
    11000, 9000, 2000, 400, 0, 4200)
$$;

create function pg_temp.fail(fp text, attempt integer)
returns text language sql as $$
  select public.finish_taste(pg_temp.artifact(fp), attempt, 'model-no-output',
    null, null, null, null, null, null, 11000, 0, 0, 1500, 900, 20000)
$$;

create function pg_temp.today(metric text)
returns bigint language sql as $$
  select coalesce((select c.value from public.taste_daily_count c where c.day = public.taste_today() and c.metric = $1), 0)
$$;

-- 전역 줄은 이 트랜잭션 안에서 0 으로 시작한다(롤백이 되돌린다)
delete from public.taste_daily_count where day = public.taste_today();
delete from public.ops_alert where kind like 'taste-budget-%';

-- ===========================================================================
-- 1. 문 · 표 · 칸
-- ===========================================================================

select ok(
  has_function_privilege('service_role', 'public.reserve_taste(text, text, text, text, text)', 'execute')
  and has_function_privilege('service_role', 'public.finish_taste(uuid, integer, text, text, text, text, text, text, text[], integer, integer, integer, integer, integer, integer)', 'execute')
  and has_function_privilege('service_role', 'public.taste_session_view(uuid, text)', 'execute')
  and has_function_privilege('service_role', 'public.claim_taste_session(uuid, uuid, text, text)', 'execute')
  and has_function_privilege('service_role', 'public.link_taste_reading_run(uuid, uuid, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.taste_continuation_of_run(uuid, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.count_taste_step(text)', 'execute'),
  '맛보기의 문 일곱은 열쇠가 부른다');

select is(
  (select array_agg(p.proname::text order by p.proname::text)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'retention')
     and (p.proname like '%taste%')
     and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))),
  array['taste_passage']::text[],
  '익명 · 로그인한 사람이 부를 수 있는 맛보기 문은 옛 공용 표의 문 하나뿐이다 — 새 문은 하나도 안 열렸다');

select is(
  (select array_agg(p.proname::text order by p.proname::text)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'retention') and p.proname like '%taste%'
     and p.proname not in ('reserve_taste', 'finish_taste', 'taste_session_view', 'claim_taste_session',
                           'link_taste_reading_run', 'taste_continuation_of_run', 'count_taste_step', 'taste_passage',
                           'count_taste_step_once')
     and has_function_privilege('service_role', p.oid, 'EXECUTE')),
  null,
  '상한 · 손잡이 · 정리 함수는 열쇠도 못 부른다');

set local role anon;
select throws_ok($$select * from public.taste_artifact$$, '42501', null, '익명은 맛보기 결과 표를 못 읽는다');
select throws_ok($$select * from public.taste_session$$, '42501', null, '익명은 세션 표를 못 읽는다');
reset role;

set local role authenticated;
select throws_ok($$select * from public.taste_session$$, '42501', null, '로그인한 사람도 세션 표를 못 읽는다');
select throws_ok(
  $$insert into public.taste_daily_count (day, metric, value) values (current_date, 'model_calls', 0)$$,
  '42501', null, '로그인한 사람은 예산 줄을 못 쓴다');
select throws_ok($$select * from public.taste_rate_event$$, '42501', null, '로그인한 사람은 한도 사건을 못 읽는다');
select throws_ok($$select * from public.taste_daily$$, '42501', null, '로그인한 사람은 관측 표를 못 읽는다');
reset role;

set local role service_role;
select throws_ok($$select * from public.taste_artifact$$, '42501', null, '열쇠도 표를 직접 못 읽는다 — 문으로만');
reset role;

select is(
  (select array_agg(c.relname || '.' || a.attname order by 1)
   from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('taste_artifact', 'taste_session', 'taste_rate_event', 'taste_daily_count')
     and a.attnum > 0 and not a.attisdropped
     and a.attname ~ '(ip|cookie|birth|solar|lunar|calendar|gender|address|email)'
     and a.attname !~ '_hmac$'),
  null,
  'IP · 쿠키 · 생년월일시 원문이 들 칸이 없다 — HMAC 칸뿐이다');

select throws_ok(
  format($$select * from public.reserve_taste(%L, 'taste-v1', 'luna-none-v1', %L, '203.0.113.7')$$,
         pg_temp.h('raw'), pg_temp.h('raw-browser')),
  '22023', null, 'IP 원문을 HMAC 칸에 넣으면 던진다');

select throws_ok(
  format($$select * from public.reserve_taste('1992-05-14 09:30', 'taste-v1', 'luna-none-v1', %L, %L)$$,
         pg_temp.h('raw-browser'), pg_temp.h('raw-ip')),
  '22023', null, '생년월일시를 지문 칸에 넣으면 던진다');

select is(
  array[public.taste_daily_model_calls(), public.taste_browser_new_per_hour(),
        public.taste_ip_calls_per_minute(), public.taste_ip_calls_per_day(), public.taste_ip_requests_per_minute(),
        public.taste_attempt_limit()],
  array[2000, 5, 3, 20, 30, 3],
  '운영 값 — 하루 2,000 · 브라우저 새 지문 5/시간 · IP 3/분 · 20/일 · 요청 30/분 · 시도 3');

select is(
  array[public.taste_keep_for(), public.taste_call_timeout()],
  array[interval '24 hours', interval '60 seconds'],
  '보존 24시간 · 도는 시도의 시간 상한 60초');

-- ===========================================================================
-- 2. 같은 입력은 모델 예약 하나
-- ===========================================================================

select is(
  array[pg_temp.go('fp-a', 'br-a', 'ip-a'), pg_temp.go('fp-a', 'br-a', 'ip-a'), pg_temp.go('fp-a', 'br-a', 'ip-a'),
        pg_temp.go('fp-a', 'br-a', 'ip-a')],
  array['call_model', 'wait_running', 'wait_running', 'wait_running'],
  '같은 입력 연타 — 처음 하나만 모델을 부르고 나머지는 기다린다');

select is(
  (select count(*)::int from public.taste_artifact where evidence_fingerprint = pg_temp.h('fp-a')),
  1, '연타해도 artifact 는 하나다');

select is(
  (select count(*)::int from public.taste_session where evidence_fingerprint = pg_temp.h('fp-a')),
  1, '같은 브라우저 · 같은 지문의 세션은 하나다 — 연타가 세션을 늘리지 않는다');

select is(pg_temp.today('model_calls'), 1::bigint, '하루 예산은 한 번만 썼다');

select is(pg_temp.go('fp-a', 'br-b', 'ip-b'), 'wait_running', '다른 브라우저 · 다른 IP · 같은 지문 — 새로 안 부르고 기다린다');

select is(pg_temp.succeed('fp-a'), 'recorded', '성공을 적는다');

select is(
  (select array_agg(s.preview_markdown is not null order by s.created_at) from public.taste_session s
   where s.evidence_fingerprint = pg_temp.h('fp-a')),
  array[true, true],
  '성공을 적으면 그 artifact 를 기다리던 세션 둘 다 글을 베낀다');

select is(pg_temp.go('fp-a', 'br-cleared', 'ip-c'), 'reuse_succeeded', '쿠키를 지운 브라우저(새 HMAC) · 같은 지문 — 재사용한다');

select is(
  (select count(*)::int from public.taste_artifact where evidence_fingerprint = pg_temp.h('fp-a')),
  1, '세 브라우저가 와도 artifact 는 하나다');

select is(pg_temp.today('model_calls'), 1::bigint, '재사용은 예산을 안 쓴다');

select is(pg_temp.today('funnel:preview_shown'), 3::bigint, '퍼널 「맛보기 성공」은 글을 받은 세션 수다 — 셋');

-- ===========================================================================
-- 3. 한도
-- ===========================================================================

-- IP 1분 셋 — 브라우저 · 지문은 매번 새것(쿠키를 지우며 다른 입력을 넣는 사람)
select is(
  array[pg_temp.go('ipm-1', 'ipm-br-1', 'ip-minute'), pg_temp.go('ipm-2', 'ipm-br-2', 'ip-minute'),
        pg_temp.go('ipm-3', 'ipm-br-3', 'ip-minute'), pg_temp.go('ipm-4', 'ipm-br-4', 'ip-minute')],
  array['call_model', 'call_model', 'call_model', 'limited_ip'],
  '한 IP 의 새 생성은 1분에 셋 — 넷째는 막힌다');

select is(
  (select count(*)::int from public.taste_artifact where evidence_fingerprint = pg_temp.h('ipm-4'))
  + (select count(*)::int from public.taste_session where evidence_fingerprint = pg_temp.h('ipm-4')),
  0, '막힌 요청은 artifact 도 세션도 안 만든다');

select is(pg_temp.today('model_calls'), 4::bigint, '막힌 요청은 하루 예산을 안 쓴다');

update public.taste_rate_event set at = at - interval '2 minutes'
where subject_hmac = pg_temp.h('ip-minute') and kind = 'ip-call';

select is(pg_temp.go('ipm-4', 'ipm-br-4', 'ip-minute'), 'call_model', '1분이 지나면 같은 IP 가 다시 부른다');

-- IP 하루 스물 — 1분 상한은 이 자리에서만 풀어 둔다(롤백이 되돌린다)
create or replace function public.taste_ip_calls_per_minute()
returns integer language sql immutable set search_path = '' as $$ select 100 $$;

select is(
  (select array_agg(pg_temp.go('ipd-' || g, 'ipd-br-' || g, 'ip-day') order by g) from generate_series(1, 21) g),
  array_fill('call_model'::text, array[20]) || array['limited_ip'],
  '한 IP 의 새 생성은 하루 스물 — 스물한째는 막힌다');

create or replace function public.taste_ip_calls_per_minute()
returns integer language sql immutable set search_path = '' as $$ select 3 $$;

-- 브라우저 1시간 새 지문 다섯 — IP 는 매번 다르게
select is(
  (select array_agg(pg_temp.go('brh-' || g, 'br-hour', 'brh-ip-' || g) order by g) from generate_series(1, 6) g),
  array_fill('call_model'::text, array[5]) || array['limited_browser'],
  '한 브라우저의 새 지문은 한 시간에 다섯 — 여섯째는 막힌다');

select is(pg_temp.go('fp-a', 'br-hour', 'brh-ip-7'), 'reuse_succeeded',
  '막힌 브라우저도 이미 성공한 지문은 재사용한다 — 새 생성이 아니다');

update public.taste_rate_event set at = at - interval '61 minutes'
where subject_hmac = pg_temp.h('br-hour') and kind = 'browser-new';

select is(pg_temp.go('brh-6', 'br-hour', 'brh-ip-6'), 'call_model', '한 시간이 지나면 같은 브라우저가 새 지문을 부른다');

-- 값싼 요청 1분 서른 — 캐시 적중도 센다
select is(
  (select array_agg(pg_temp.go('fp-a', 'req-br-' || g, 'ip-requests') order by g) from generate_series(1, 31) g),
  array_fill('reuse_succeeded'::text, array[30]) || array['limited_request'],
  '한 IP 의 요청은 캐시 적중이어도 1분에 서른 — 서른한째는 막힌다');

-- 전체 하루 — 상한 함수를 낮춰 잰다. 오늘 줄을 0 으로 두고 상한을 둘로
update public.taste_daily_count set value = 0 where day = public.taste_today() and metric = 'model_calls';
delete from public.ops_alert where kind like 'taste-budget-%';

create or replace function public.taste_daily_model_calls()
returns integer language sql immutable set search_path = '' as $$ select 5 $$;

select is(
  (select array_agg(pg_temp.go('glob-' || g, 'glob-br-' || g, 'glob-ip-' || g) order by g) from generate_series(1, 6) g),
  array_fill('call_model'::text, array[5]) || array['limited_global'],
  '서비스 전체 하루 상한에 닿으면 다음 새 생성은 막힌다');

select is(pg_temp.today('model_calls'), 5::bigint, '막힌 요청은 하루 수를 안 넘긴다');

select is(
  (select array_agg(kind order by kind) from public.ops_alert where kind like 'taste-budget-%'),
  array['taste-budget-reached', 'taste-budget-warning'],
  '80% 에 알림, 상한에 닿으면 또 알림 — 하루 한 줄씩');

select is(pg_temp.go('fp-a', 'glob-br-late', 'glob-ip-late'), 'reuse_succeeded', '전체 상한이 차도 성공한 글은 재사용한다');

create or replace function public.taste_daily_model_calls()
returns integer language sql immutable set search_path = '' as $$ select 2000 $$;

-- ===========================================================================
-- 4. 실패 · 재시도
-- ===========================================================================

update public.taste_daily_count set value = 0 where day = public.taste_today() and metric = 'model_calls';

select is((select attempt from pg_temp.reserve('fp-fail', 'fail-br', 'fail-ip')), 1, '첫 시도');
select is(pg_temp.fail('fp-fail', 1), 'recorded', '실패를 적는다');
select is(pg_temp.today('model_calls'), 1::bigint, '실패한 호출도 하루 예산에 든다');

select is((select attempt from pg_temp.reserve('fp-fail', 'fail-br', 'fail-ip')), 2, '같은 지문을 다시 부르면 둘째 시도');
select is(pg_temp.fail('fp-fail', 1), 'ignored', '앞 시도의 늦은 결과는 무시한다 — 지금 시도가 아니다');
select is(
  (select status from public.taste_artifact where id = pg_temp.artifact('fp-fail')),
  'running', '늦은 결과가 지금 시도를 닫지 않는다');
select is(pg_temp.fail('fp-fail', 2), 'recorded', '둘째도 실패');

select is((select attempt from pg_temp.reserve('fp-fail', 'fail-br-2', 'fail-ip')), 3,
  '다른 브라우저가 와도 같은 행의 셋째 시도다');
select is(pg_temp.fail('fp-fail', 3), 'recorded', '셋째도 실패');
select is(pg_temp.go('fp-fail', 'fail-br', 'fail-ip'), 'retries_exhausted', '셋을 다 쓰면 더 안 부른다');

select is(
  (select count(*)::int from public.taste_artifact where evidence_fingerprint = pg_temp.h('fp-fail')),
  1, '재시도는 새 행을 안 만든다');
select is(pg_temp.today('model_calls'), 3::bigint, '세 번의 실패가 다 예산을 썼다');
select is(pg_temp.today('call:late'), 1::bigint, '늦은 결과도 사용량은 날짜별 수에 남는다 — 따로 센다');

-- ===========================================================================
-- 5. 시간을 넘긴 시도
-- ===========================================================================

select is(pg_temp.go('fp-slow', 'slow-br', 'slow-ip'), 'call_model', '시도를 예약한다');
update public.taste_artifact set attempt_started_at = now() - interval '2 minutes' where id = pg_temp.artifact('fp-slow');

select ok(retention.sweep_taste() >= 1, '정리 작업이 돈다');
select is(
  (select status || ':' || failure_code from public.taste_artifact where id = pg_temp.artifact('fp-slow')),
  'failed:timeout', '시간을 넘긴 시도는 정리 작업이 실패로 닫는다');
select is(pg_temp.succeed('fp-slow'), 'ignored', '시간을 넘겨 닫힌 뒤에 온 결과는 무시한다');
select is(
  (select state || ':' || retryable from public.taste_session_view(pg_temp.session('fp-slow', 'slow-br'), pg_temp.h('slow-br'))),
  'failed:true', '시간을 넘겨 닫힌 시도는 failed 이고 다시 부를 수 있다');
select is((select attempt from pg_temp.reserve('fp-slow', 'slow-br', 'slow-ip')), 2, '다시 부르면 같은 행의 둘째 시도다');

-- ===========================================================================
-- 6. 세션 읽기
-- ===========================================================================

select is(
  (select count(*)::int from public.taste_session_view(pg_temp.session('fp-a', 'br-a'), pg_temp.h('br-b'))),
  0, '세션 id 만으로는 못 읽는다 — 다른 브라우저 HMAC 이면 0행');

select is(
  (select state || ':' || preview_markdown from public.taste_session_view(pg_temp.session('fp-a', 'br-a'), pg_temp.h('br-a'))),
  'succeeded:첫 문단이에요.

장면 안에서 멈추는 물음이에요?',
  'id 와 브라우저 HMAC 이 맞으면 글을 읽는다');

select is(pg_temp.go('fp-run', 'run-br', 'run-ip'), 'call_model', '도는 세션을 하나 둔다');
select is(
  (select state || ':' || retryable from public.taste_session_view(pg_temp.session('fp-run', 'run-br'), pg_temp.h('run-br'))),
  'running:false', '만드는 중이면 running');

select is(
  (select state || ':' || retryable from public.taste_session_view(pg_temp.session('fp-fail', 'fail-br'), pg_temp.h('fail-br'))),
  'failed:false', '셋을 다 실패했으면 failed 이고 다시 못 부른다');

-- ===========================================================================
-- 7. 귀속
-- ===========================================================================

create temporary table who as
select tests.signup('taste-kim@example.com') as kim, tests.signup('taste-lee@example.com') as lee;

select is(
  (select outcome from public.claim_taste_session((select kim from who), pg_temp.session('fp-a', 'br-a'),
     pg_temp.h('br-b'), pg_temp.h('fp-a'))),
  'not_found', '다른 브라우저 HMAC 으로는 귀속 못 한다 — 없는 세션과 가르지 않는다');

select is(
  (select outcome || ':' || continuation_question from public.claim_taste_session((select kim from who),
     pg_temp.session('fp-a', 'br-a'), pg_temp.h('br-a'), pg_temp.h('fp-a'))),
  'claimed:왜 결정 뒤에도 다시 저울질할까요?', '같은 브라우저 · 같은 지문이면 귀속하고 본 글을 낸다');

select is(
  (select outcome from public.claim_taste_session((select kim from who),
     pg_temp.session('fp-a', 'br-a'), pg_temp.h('br-a'), pg_temp.h('fp-a'))),
  'claimed', '같은 회원의 재시도는 멱등이다');

select is(pg_temp.today('funnel:session_claimed'), 1::bigint, '재시도는 퍼널 「귀속」을 다시 안 센다');

select is(
  (select outcome from public.claim_taste_session((select lee from who),
     pg_temp.session('fp-a', 'br-a'), pg_temp.h('br-a'), pg_temp.h('fp-a'))),
  'taken', '다른 회원에게 이미 귀속된 세션은 거절한다');

select is(
  (select outcome from public.claim_taste_session((select lee from who),
     pg_temp.session('fp-a', 'br-b'), pg_temp.h('br-b'), pg_temp.h('fp-other'))),
  'discarded', '확정 입력으로 다시 잰 지문이 다르면 버림 — 이어쓰기 없음');

select is(
  (select status from public.taste_session where id = pg_temp.session('fp-a', 'br-b')),
  'discarded', '버린 세션은 버림 상태로 남는다');

select is(
  (select outcome from public.claim_taste_session((select kim from who),
     pg_temp.session('fp-run', 'run-br'), pg_temp.h('run-br'), pg_temp.h('fp-run'))),
  'not_ready', '아직 글이 없는 세션은 귀속 못 한다');

update public.taste_session set created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour'
where id = pg_temp.session('fp-a', 'br-cleared');

select is(
  (select outcome from public.claim_taste_session((select kim from who),
     pg_temp.session('fp-a', 'br-cleared'), pg_temp.h('br-cleared'), pg_temp.h('fp-a'))),
  'expired', '24시간 지난 미귀속 세션은 귀속 못 한다');

update public.app_user set status = 'suspended' where id = (select lee from who);
select throws_ok(
  format($$select * from public.claim_taste_session(%L, %L, %L, %L)$$,
         (select lee from who), pg_temp.session('fp-a', 'br-hour'), pg_temp.h('br-hour'), pg_temp.h('fp-a')),
  '42501', null, '정지된 계정은 귀속 못 한다');
update public.app_user set status = 'active' where id = (select lee from who);

select throws_ok(
  format($$select * from public.claim_taste_session(null, %L, %L, %L)$$,
         pg_temp.session('fp-a', 'br-hour'), pg_temp.h('br-hour'), pg_temp.h('fp-a')),
  '28000', null, '회원 id 없이는 귀속 못 한다');

-- ===========================================================================
-- 8. 풀이 시도에 잇는다
-- ===========================================================================

/** 자기 풀이 시도 하나 — 시도를 여는 문과 풀이권은 여기서 재는 것이 아니다(15 · 16 이 잰다) */
create function pg_temp.run(owner uuid, outcome text default 'running')
returns uuid language plpgsql as $$
declare
  made uuid;
begin
  set local session_replication_role = replica;
  insert into public.reading_run (user_id, kind, status, idempotency_key, finished_at)
  values (owner, 'self', outcome, 'taste-' || gen_random_uuid(), case when outcome <> 'running' then now() end)
  returning id into made;
  set local session_replication_role = origin;
  return made;
end;
$$;

create function pg_temp.set_run(id uuid, outcome text)
returns void language plpgsql as $$
begin
  set local session_replication_role = replica;
  update public.reading_run r set status = outcome, finished_at = now(),
    failure_code = case when outcome = 'failed' then 'model-no-output' end
  where r.id = set_run.id;
  set local session_replication_role = origin;
end;
$$;

create temporary table runs as
select pg_temp.run((select kim from who)) as first, pg_temp.run((select kim from who)) as second,
       pg_temp.run((select lee from who)) as lees;

select is(
  (select outcome from public.link_taste_reading_run((select kim from who), pg_temp.session('fp-a', 'br-a'),
     (select first from runs))),
  'linked', '귀속된 세션을 내 자기 풀이 시도에 잇는다');

select is(
  (select outcome from public.link_taste_reading_run((select kim from who), pg_temp.session('fp-a', 'br-a'),
     (select first from runs))),
  'linked', '같은 시도로 다시 이으면 멱등이다');

select is(
  (select outcome from public.link_taste_reading_run((select kim from who), pg_temp.session('fp-a', 'br-a'),
     (select second from runs))),
  'already_running', '앞 시도가 도는 동안은 다른 시도로 안 바꾼다');

select pg_temp.set_run((select first from runs), 'succeeded');

select is(
  (select outcome || ':' || (reading_run_id = (select first from runs)) from public.link_taste_reading_run(
     (select kim from who), pg_temp.session('fp-a', 'br-a'), (select second from runs))),
  'already_succeeded:true', '앞 시도가 성공했으면 새로 안 만들고 그 풀이를 가리킨다');

select is(
  (select reading_run_status from public.claim_taste_session((select kim from who),
     pg_temp.session('fp-a', 'br-a'), pg_temp.h('br-a'), pg_temp.h('fp-a'))),
  'succeeded', '다시 귀속을 눌러도 이어진 풀이가 성공했다는 것을 낸다');

select pg_temp.set_run((select first from runs), 'failed');

select is(
  (select outcome from public.link_taste_reading_run((select kim from who), pg_temp.session('fp-a', 'br-a'),
     (select second from runs))),
  'linked', '앞 시도가 실패했으면 같은 회원 · 같은 세션으로 새 시도에 다시 잇는다');

select is(
  (select outcome from public.link_taste_reading_run((select kim from who), pg_temp.session('fp-a', 'br-a'),
     (select lees from runs))),
  'wrong_run', '남의 풀이 시도에는 못 잇는다');

select is(
  (select outcome from public.link_taste_reading_run((select lee from who), pg_temp.session('fp-a', 'br-a'),
     (select lees from runs))),
  'not_claimed', '남의 세션은 못 잇는다');

-- 둘째 세션을 귀속해 같은 시도에 이으려 한다
select is(pg_temp.go('fp-b', 'br-a', 'ip-b2'), 'call_model', '둘째 맛보기');
select is(pg_temp.succeed('fp-b'), 'recorded', '둘째도 성공');
select is(
  (select outcome from public.claim_taste_session((select kim from who), pg_temp.session('fp-b', 'br-a'),
     pg_temp.h('br-a'), pg_temp.h('fp-b'))),
  'claimed', '둘째 세션도 귀속');
select is(
  (select outcome from public.link_taste_reading_run((select kim from who), pg_temp.session('fp-b', 'br-a'),
     (select second from runs))),
  'run_taken', '풀이 시도 하나는 세션 하나에만 이어진다');

-- ===========================================================================
-- 9. artifact 가 지워져도 본 글은 남는다
-- ===========================================================================

update public.taste_artifact set expires_at = now() - interval '1 second' where id = pg_temp.artifact('fp-a');
select ok(retention.sweep_taste() >= 1, '만료된 artifact 를 정리한다');
select is(pg_temp.artifact('fp-a'), null, 'artifact 는 지워졌다');

select is(
  (select continuation_question || ' / ' || answer_direction || ' / ' || array_to_string(supporting_claims, ',')
     || ' / ' || prompt_version || ' / ' || model_config_version
   from public.taste_continuation_of_run((select kim from who), (select second from runs))),
  '왜 결정 뒤에도 다시 저울질할까요? / 저울질을 멈추는 기준 하나를 먼저 세운다 / analysis.structure,pillars.day / taste-v1 / luna-none-v1',
  '귀속된 세션은 물음 · 답의 방향 · 근거 경로 · 판을 스스로 든다');

select is(
  (select count(*)::int from public.taste_continuation_of_run((select lee from who), (select second from runs))),
  0, '남의 풀이 시도로는 이어쓸 원문을 못 읽는다');

-- ===========================================================================
-- 10. 24시간 정리 · 탈퇴 · 퍼널 · 크론
-- ===========================================================================

update public.taste_session set created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour'
where evidence_fingerprint in (pg_temp.h('fp-run'), pg_temp.h('fp-b'));
update public.taste_rate_event set at = now() - interval '25 hours' where subject_hmac = pg_temp.h('run-ip');

select ok(retention.sweep_taste() >= 1, '24시간 지난 것을 정리한다');

select is(
  (select array_agg(status order by status) from public.taste_session
   where evidence_fingerprint in (pg_temp.h('fp-run'), pg_temp.h('fp-b'))),
  array['claimed'],
  '24시간 지난 미귀속 세션은 지우고, 귀속된 세션은 기한이 지나도 남긴다');

select is(
  (select count(*)::int from public.taste_rate_event where subject_hmac = pg_temp.h('run-ip')),
  0, 'IP HMAC 이 든 사건은 24시간 뒤 지운다');

select ok(
  (select count(*) from public.taste_session where claimed_by = (select kim from who)) > 0,
  '탈퇴 전 — 귀속된 세션이 있다');
select lives_ok(format($$select public.forget_user(%L)$$, (select kim from who)), '탈퇴 처분');
select is(
  (select count(*)::int from public.taste_session where claimed_by = (select kim from who)),
  0, '탈퇴 처분은 그 회원에게 귀속된 세션을 지운다');

select lives_ok($$select public.count_taste_step('reading_succeeded')$$, '회수는 풀이 성공을 센다');
select is(pg_temp.today('funnel:reading_succeeded'), 1::bigint, '퍼널은 날짜와 단계의 수만 든다');
select throws_ok($$select public.count_taste_step('signup_started')$$, '22023', null,
  '옛 문은 가입 시작을 안 받는다 — 세션당 한 번 세는 문이 받는다(G-91)');
select throws_ok($$select public.count_taste_step('signup_completed')$$, '22023', null,
  '옛 문은 가입 완료를 안 받는다 — 세션당 한 번 세는 문이 받는다(G-91)');
select throws_ok($$select public.count_taste_step('more_clicked')$$, '22023', null,
  '「더보기」는 걷은 단계다 — 앱도 못 센다(G-85)');
select hasnt_column('public', 'taste_daily', 'more_clicked', '날짜별 한 줄에 「더보기」 칸이 없다 — 퍼널은 다섯 단계다(G-85)');
select throws_ok($$select public.count_taste_step('session_claimed')$$, '22023', null,
  'DB 가 세는 단계는 앱이 못 센다 — 두 번 안 센다');

select is(
  (select schedule || ' ' || command from cron.job where jobname = 'taste-sweep' and active),
  '1-59/5 * * * * select retention.sweep_taste()',
  '정리 크론은 5분마다 돈다');

select ok(
  (select prosrc like '%pg_advisory_xact_lock%' and prosrc like '%for update%'
   from pg_proc where oid = 'public.reserve_taste(text, text, text, text, text)'::regprocedure),
  '예약은 자물쇠를 잡고 센다 — 두 세션 경합은 scripts/check-db-races.mjs 의 8 이 잰다');

select * from finish();
rollback;
