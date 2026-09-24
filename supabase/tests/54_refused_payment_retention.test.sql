-- 떠난 사람의 승인된 적 없는 주문도 거절한 알림이 있으면 5년 따로 남는다 — 거래를 가리킬 최소 칸만 (ADR 0106 추기)
--
-- `20261013090000` 이 금액이 다른 승인 알림을 `payment_event(outcome = 'refused')` 로 남겼지만, 떠날 때
-- `retention.keep_payments_of_leaver` 는 **승인된 적 있는** 주문만 옮겨 승인 전에 거절만 받은 주문의 알림은 계정과 함께
-- 사라졌다(G-23 ⑥ 의 남은 물음). 운영자가 2026-09-24 에 정했다 — 금액이 틀린 결제도 돈이 오간 거래일 수 있으니 옮긴다,
-- 단 최소 식별정보만. 법적 범위는 변호사 검토 B-8 이다.
--
--   1. 거절 알림만 받은 주문이 떠난 뒤 `retention` 어디엔가 남는다 — 표 이름에 기대지 않고 훑는다
--   2. 새 표 `retention.refused_reading_payment` 의 칸은 정한 목록 그대로다(늘면 붉다 — 최소화의 잠금)
--   3. 알림 없는 대기 주문 · 승인된 주문은 이 표에 안 든다(승인된 주문은 전처럼 `reading_payment`)
--   4. 마지막 거절 알림부터 5년 · 고치지 못함 · 보류 · 크론이 지운다 · 앱은 못 읽는다
--
-- 표가 없던 때(마이그레이션 전)에도 붉은 수를 셀 수 있게, 새 표를 읽는 단언은 `pg_temp.cell` 을 지나 없으면 null 을 받는다.
begin;
select plan(13);

create temporary table folks as select tests.signup('rp-leaver@example.com') as leaver;
grant select on folks to authenticated, service_role;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** 새 표가 없으면 null — 마이그레이션 전의 붉은 수를 세려고 */
create or replace function pg_temp.cell(q text)
returns text language plpgsql as $$
declare
  v text;
begin
  execute q into v;
  return v;
exception when undefined_table or undefined_column then
  return null;
end;
$$;

/** `retention` 의 표 전부에서 이 알림 번호를 든 줄 수 — 표 이름에 기대지 않는다 */
create or replace function pg_temp.kept_anywhere(p_event text)
returns integer language plpgsql as $$
declare
  t record;
  n integer;
  total integer := 0;
begin
  for t in select c.relname from pg_catalog.pg_class c
           join pg_catalog.pg_namespace s on s.oid = c.relnamespace
           where s.nspname = 'retention' and c.relkind = 'r' loop
    execute format('select count(*)::integer from retention.%I k where to_jsonb(k)::text like %L',
                   t.relname, '%' || p_event || '%') into n;
    total := total + n;
  end loop;
  return total;
end;
$$;

/** 판매를 연다 — 이 트랜잭션 안에서만 */
create or replace function public.reading_sale_is_open()
returns boolean language sql immutable set search_path = '' as $$ select true $$;

set local role authenticated;
select pg_temp.acting((select leaver from folks));
create temporary table ords as
select 'refused' as name, o.* from public.open_reading_order(3, 'dev', 'rp-order-refused') o
union all
select 'quiet', o.* from public.open_reading_order(1, 'dev', 'rp-order-quiet') o
union all
select 'bought', o.* from public.open_reading_order(1, 'dev', 'rp-order-bought') o;
grant select on ords to authenticated, service_role;

create or replace function pg_temp.ord(n text)
returns uuid language sql as $$ select order_id from ords where name = n $$;

-- 거절 둘 뒤 결제 실패로 닫힌 주문 · 알림 없는 대기 주문 · 거절 뒤 승인된 주문
set local role service_role;
select * from public.approve_reading_order(pg_temp.ord('refused'), 'rp-pay-r', 4900, 'rp-evt-r1');
select * from public.approve_reading_order(pg_temp.ord('refused'), 'rp-pay-r', 100, 'rp-evt-r2');
select public.cancel_reading_order(pg_temp.ord('refused'), 'failed');
select * from public.approve_reading_order(pg_temp.ord('bought'), 'rp-pay-b', 100, 'rp-evt-b1');
select * from public.approve_reading_order(pg_temp.ord('bought'), 'rp-pay-b', 4900, 'rp-evt-b2');

reset role;
create temporary table ordered as
select o.id, o.provider_order_id, o.created_at from public.reading_order o
where o.user_id = (select leaver from folks);
create temporary table last_refusal as
select max(e.received_at) as at from public.payment_event e where e.order_id = pg_temp.ord('refused');

delete from auth.users where id = (select leaver from folks);

-- ── 1. 남는다 ─────────────────────────────────────────────────────────────────

select is(
  pg_temp.kept_anywhere('rp-evt-r1') + pg_temp.kept_anywhere('rp-evt-r2'),
  2,
  '승인된 적 없는 주문의 거절 알림 둘이 떠난 뒤에도 retention 에 남는다');
select is(
  pg_temp.cell(format(
    $$select count(*)::text from retention.refused_reading_payment where order_id in (%L, %L, %L)$$,
    pg_temp.ord('refused'), pg_temp.ord('quiet'), pg_temp.ord('bought'))),
  '1',
  '거절만 받은 주문 하나만 옮긴다 — 알림 없는 대기 주문 · 승인된 주문은 안 든다');
select is(
  (select count(*)::integer from retention.reading_payment where order_id = pg_temp.ord('bought')),
  1,
  '승인된 주문은 전처럼 reading_payment 로 — 거절 알림까지 결과째');

-- ── 2. 최소 칸 ────────────────────────────────────────────────────────────────

select is(
  (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
   where table_schema = 'retention' and table_name = 'refused_reading_payment'),
  array['order_id', 'user_id', 'provider', 'provider_order_id', 'amount', 'ordered_at', 'events',
        'left_at', 'keep_until', 'hold_reason', 'held_at'],
  '칸은 거래를 가리킬 최소만 — 이메일 · 출생 정보 · 주문 열쇠 · 묶음 · 거래 번호가 없다');
select is(
  pg_temp.cell(format(
    $$select concat_ws('|', k.provider, k.provider_order_id, k.amount, k.ordered_at = o.created_at)
      from retention.refused_reading_payment k join ordered o on o.id = k.order_id
      where k.order_id = %L$$, pg_temp.ord('refused'))),
  concat_ws('|', 'dev', (select provider_order_id from ordered where id = pg_temp.ord('refused')), 12900, true),
  '제공자 · 가맹점 주문 번호 · 주문 금액 · 주문 시각이 옮겨진다');
select is(
  pg_temp.cell(format(
    $$select string_agg(concat_ws(':', e ->> 'provider_event_id', e ->> 'kind', e ->> 'amount', e ->> 'outcome'),
                        ',' order by e ->> 'received_at')
      from retention.refused_reading_payment k, jsonb_array_elements(k.events) e where k.order_id = %L$$,
    pg_temp.ord('refused'))),
  'rp-evt-r1:approved:4900:refused,rp-evt-r2:approved:100:refused',
  '알림은 번호 · 종류 · 받은 금액 · 결과로 — 받은 시각 차례');
select is(
  pg_temp.cell(format(
    $$select (select array_agg(key order by key) from jsonb_object_keys(k.events -> 0) key)::text
      from retention.refused_reading_payment k where k.order_id = %L$$, pg_temp.ord('refused'))),
  '{amount,kind,outcome,provider_event_id,received_at}',
  '알림 한 건의 칸도 다섯뿐이다');

-- ── 3. 기한 · 고치지 못함 · 보류 · 크론 ─────────────────────────────────────────

select is(
  pg_temp.cell(format(
    $$select (k.keep_until = (select at from last_refusal) + interval '5 years')::text
      from retention.refused_reading_payment k where k.order_id = %L$$, pg_temp.ord('refused'))),
  'true',
  '마지막 거절 알림부터 5년 둔다');
select is(
  (select count(*)::integer from public.payment_event where provider_event_id like 'rp-evt-%'),
  0,
  '일반 표에는 떠난 사람의 알림이 안 남는다');
select is(
  pg_temp.cell(format($$
    do $do$ begin
      update retention.refused_reading_payment set amount = 1 where order_id = %L;
      raise exception 'updated';
    exception when sqlstate '55000' then null;
    end $do$;
    select 'refused'$$, pg_temp.ord('refused'))),
  'refused',
  '옮긴 기록은 고치지 못한다 — 보류 두 칸만');

do $$
begin
  execute format($q$update retention.refused_reading_payment set hold_reason = '시험 — 분쟁 중', held_at = now()
                   where order_id = %L$q$, pg_temp.ord('refused'));
  execute $q$insert into retention.refused_reading_payment (
      order_id, user_id, provider, provider_order_id, amount, ordered_at, events, keep_until)
    values (gen_random_uuid(), gen_random_uuid(), 'dev', 'rp-old-order', 4900, now() - interval '6 years',
            '[{"provider_event_id": "rp-old-evt", "outcome": "refused"}]'::jsonb, now() - interval '1 year')$q$;
exception when undefined_table then null;
end;
$$;
-- 지운 뒤를 세는 것은 다음 문장에서 — 한 문장 안의 부분 질의는 지우기 전의 스냅샷을 본다
create temporary table purged as select retention.purge_expired_payments() as gone;
select is(
  concat_ws('|', (select gone from purged),
    pg_temp.cell($$select count(*)::text from retention.refused_reading_payment
                   where provider_order_id = 'rp-old-order'$$),
    pg_temp.cell(format($$select count(*)::text from retention.refused_reading_payment where order_id = %L$$,
                        pg_temp.ord('refused')))),
  '1|0|1',
  '결제 기록을 지우는 크론의 문이 5년 지난 거절 기록도 지우고 보류가 걸린 줄은 남긴다');
select is(
  (select command from cron.job where jobname = 'payment-retention-purge'),
  'select retention.purge_expired_payments()',
  '크론은 전과 같은 문 하나를 매일 부른다');

-- ── 4. 앱은 못 읽는다 ─────────────────────────────────────────────────────────

set local role service_role;
select is(
  pg_temp.cell($$
    do $do$ begin
      perform 1 from retention.refused_reading_payment;
      raise exception 'read';
    exception when insufficient_privilege then null;
    end $do$;
    select 'denied'$$),
  'denied',
  'service_role 도 못 읽는다 — retention 은 API 역할 셋 모두에 닫혀 있다');
reset role;

select * from finish();
rollback;
