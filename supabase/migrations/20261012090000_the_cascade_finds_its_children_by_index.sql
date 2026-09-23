-- 부모가 지워질 때 자식을 인덱스로 찾는다 — performance advisor 의 외래키 스물셋 (G-23 ⑪ 곁)
--
-- 2026-09-24 에 운영의 performance advisor 를 불렀다 — INFO `unindexed_foreign_keys` 24 · `unused_index` 12.
-- (G-23 ⑪ 때 적은 23 · 7 에 뒤의 `20261010100000` 접속기록 · `20261011090000` 결제 표가 하나 · 다섯을 더했다.)
--
-- **외래키 스물넷 중 스물셋이 탈퇴 처분의 사슬 위에 있다.** `forget_user` 가 `auth.users` 를 지우면
-- `app_user` → 매칭 · 신청 · 노출 · 채팅 · 주문이 cascade/`set null` 로 따라 지워지고, 같은 함수가 지우는
-- `person` 은 접근 · 풀이 · 시도 · 관계를, `match_without_its_pair_is_cleared` 가 지우는 `match` · `reading_run`
-- 은 알림 · 시도를 끌고 간다. Postgres 는 외래키에 인덱스를 만들지 않으므로 부모 한 줄마다 자식 표를 통째로
-- 훑는다. 그리고 대부분은 부모 쪽이 아니라 **그 칼럼으로 거르는 문**도 있다 — `forget_orphan_people` 의
-- `person_id`, `visible_matches` · `may_see_photo` 의 `user_high`, `reading_scope_for` 의 `blocked_user_id`,
-- `reading_about` 의 `person_low/high`, `keep_payments_of_leaver` 의 `order_id` 처럼.
-- 이미 있는 복합 인덱스의 **앞 칼럼**으로 덮이는 것은 없었다 — 스물넷 모두 둘째 이하 칼럼이거나 인덱스가 없다.
--
-- **하나는 건너뛴다 — `app_user.notice_schedule_id`.** 부모 `beta_schedule` 은 운영자가 손으로 한 줄씩 넣는
-- 표이고(운영 2줄) 지우는 코드가 없다. 지울 때 `app_user` 를 한 번 훑는 값이 이 칼럼을 쓰기마다 드는 값보다 싸다.
--
-- **`concurrently` 는 쓰지 않는다.** `db push` 는 마이그레이션을 트랜잭션 안에서 돌리고 `create index
-- concurrently` 는 트랜잭션 안에서 못 돈다. 대상 표는 운영에서 가장 큰 것이 수백 줄 · 수백 kB 라
-- (2026-09-24 `pg_stat_user_tables`) 쓰기를 막는 SHARE 잠금이 밀리초로 끝난다. 표가 커진 뒤 같은 일을 하면
-- 마이그레이션 밖에서 `concurrently` 로 먼저 세우고 여기에는 `if not exists` 로 적는다.
--
-- **안 쓰인 인덱스 열둘은 하나도 지우지 않는다.** 통계가 한 달치이고(2026-08-25 초기화) 결제는 아직
-- 운영에 안 들었다. 다른 인덱스 · 제약과 완전히 겹치는 것이 없었다 — 무엇을 위해 있는지는 runbook
-- 「성능 advisor」가 하나씩 든다. pgTAP `49_foreign_key_indexes` 가 advisor 와 같은
-- 셈으로 덮이지 않은 외래키를 잰다 — 새 외래키가 인덱스 없이 들어오면 이름으로 잡힌다.

-- 계정이 지워질 때 (auth.users → app_user → …)
create index block_by_blocked on public.block (blocked_user_id);
create index chat_read_by_user on public.chat_read (user_id);
create index chat_room_by_closer on public.chat_room (closed_by_user_id);
create index chat_rate_limit_hit_by_user on public.chat_rate_limit_hit (user_id);
create index chat_rate_limit_hit_by_room on public.chat_rate_limit_hit (room_id);
create index discovery_candidate_slot_by_candidate on public.discovery_candidate_slot (candidate_user_id);
create index discovery_impression_by_viewer on public.discovery_impression (viewer_user_id);
create index discovery_passed_by_passed on public.discovery_passed (passed_user_id);
create index match_by_user_high on public.match (user_high);
create index match_request_by_impression on public.match_request (impression_id);
create index payment_event_by_order on public.payment_event (order_id);

-- 사람이 지워질 때 (person → …)
create index user_person_access_by_person on public.user_person_access (person_id);
create index pair_relation_by_person_low on public.pair_relation (person_low);
create index pair_relation_by_person_high on public.pair_relation (person_high);
create index reading_by_person_a on public.reading (person_a);
create index reading_by_person_b on public.reading (person_b);
create index reading_run_by_person_a on public.reading_run (person_a);
create index reading_run_by_person_b on public.reading_run (person_b);

-- 매칭 · 신청 · 시도가 지워질 때 (match · match_request · reading_run → …)
create index reading_run_by_match on public.reading_run (match_id);
create index reading_by_source_run on public.reading (source_run_id);
create index notification_by_match on public.notification (match_id);
create index notification_by_request on public.notification (request_id);
create index notification_by_run on public.notification (run_id);
