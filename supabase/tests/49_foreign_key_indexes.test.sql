-- 외래키는 인덱스의 앞 칼럼으로 덮인다 — performance advisor `unindexed_foreign_keys` (G-23 ⑪ 곁)
--
-- `20261012090000` 이 스물셋을 세웠다. 여기서 재는 것은 advisor 와 같은 셈이다 — 외래키의 칼럼이
-- 어느 인덱스의 **앞 칼럼들**과 같은 집합이면 덮였다. 둘째 칼럼에 있는 것은 안 덮인다.
-- 건너뛴 하나(`app_user.notice_schedule_id` — 부모가 손으로 넣는 표)는 이름으로 적어 둔다. 새 외래키를
-- 인덱스 없이 들이면 이 목록에 이름이 뜬다 — 세우거나, 까닭을 적고 여기 더한다.
begin;
select plan(3);

select ok(
  (select count(*) > 60 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
   where c.contype = 'f' and n.nspname in ('public', 'audit', 'retention')),
  '재는 외래키가 있다 — 우리 스키마에 예순을 넘는다');

select is(
  (select coalesce(array_agg(c.conrelid::regclass || '.' || c.conname order by c.conrelid::regclass::text, c.conname), '{}')
   from pg_constraint c join pg_namespace n on n.oid = c.connamespace
   where c.contype = 'f' and n.nspname in ('public', 'audit', 'retention')
     and not exists (
       select 1 from pg_index i
       where i.indrelid = c.conrelid
         and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
         and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey)),
  array['app_user.app_user_notice_schedule_id_fkey'],
  '외래키는 하나(손으로 넣는 부모)만 빼고 전부 인덱스의 앞 칼럼으로 덮인다');

select is(
  (select count(*)::int from pg_indexes
   where schemaname = 'public' and indexname in (
     'block_by_blocked', 'chat_read_by_user', 'chat_room_by_closer',
     'chat_rate_limit_hit_by_user', 'chat_rate_limit_hit_by_room',
     'discovery_candidate_slot_by_candidate', 'discovery_impression_by_viewer',
     'discovery_passed_by_passed', 'match_by_user_high', 'match_request_by_impression',
     'payment_event_by_order', 'user_person_access_by_person',
     'pair_relation_by_person_low', 'pair_relation_by_person_high',
     'reading_by_person_a', 'reading_by_person_b', 'reading_run_by_person_a', 'reading_run_by_person_b',
     'reading_run_by_match', 'reading_by_source_run',
     'notification_by_match', 'notification_by_request', 'notification_by_run')),
  23,
  '20261012090000 이 세운 인덱스 스물셋이 있다');

select * from finish();
rollback;
