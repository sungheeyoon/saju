-- 로그인한 사람에게 열린 문 — **`authenticated` 가 부를 수 있는 public 함수의 집합을 이름과 인자까지 고정한다**
--
-- `33_function_shape` 는 로그인 안 한 사람(`anon`)의 문 셋을 집합으로 잠갔다. 로그인한 사람의 문은 잠근 자리가 없었다 —
-- 새 함수에 `grant execute ... to authenticated` 가 붙거나, 열쇠에만 열어야 할 문(ADR 0136 의 넷)이 되쓰기 중에 다시
-- 사용자에게 열려도 붉어지는 시험이 없었다(2026-09-28 밤샘 감사 「안 고친 것 — 시험」).
--
-- **수가 아니라 집합을 잰다.** 하나가 늘면 그 이름이 「Extra records」로 드러난다 — 그때 묻는다: 이 문을 로그인한
-- 사람이 PostgREST 로 직접 불러도 되는가, 사람 id 를 인자로 받지 않는가, 정지 · 베타 종료를 스스로 보는가
-- (`75_suspended_write_doors` 가 쓰기 문마다 정지를 두드린다). 하나가 줄면 「Missing records」다 — 걷은 문이면 이
-- 목록에서도 지운다.
--
-- 2026-09-30 에 로컬(`20261106100000` 까지)에서 잰 84 개였고, `clear_my_photo` 를 걷어 83 개, `photo_of` 를 걷어 82 개,
-- `set_my_photo` 를 걷어 81 개다. 화면이 안 부르는 것도 든다 — 정책 · 다른 함수 안에서 불리는 판정(`chat_room_readable` ·
-- `discovery_shown_to_me` · `set_person_listed`), 모양 검사(`is_*` · `reject_bad_chart`). 걷을지는 이 파일이 아니라
-- 마이그레이션이 정한다 — 옛 사진 문 셋은 `clear_my_photo` 를 `20261110090000` 이, `photo_of` 를 `20261112090000` 이,
-- `set_my_photo` 를 `20261115090000` 이 걷었다.
begin;
select plan(1);

select set_eq(
  $$select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE')$$,
  $$values ('acknowledge_warning(p_ref text)'),
           ('add_my_photo(p_content_type text, p_base64 text)'),
           ('block_user(p_user_id uuid)'),
           ('cancel_match_request(p_request_id uuid)'),
           ('chat_policy()'),
           ('chat_room_readable(p_room_id uuid)'),
           ('complete_signup(p_code text, p_nickname text, p_version text, p_schedule_id bigint, p_improvement boolean, p_contact boolean)'),
           ('create_managed_person(p_local_label text, p_note text, p_calendar text, p_original_date date, p_solar_date date, p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text, p_time_basis text, p_chart jsonb, p_chart_engine_version text)'),
           ('create_pair_for_reading(p_a_local_label text, p_a_note text, p_a_calendar text, p_a_original_date date, p_a_solar_date date, p_a_birth_time time without time zone, p_a_gender text, p_a_city text, p_a_late_night_rule text, p_a_time_basis text, p_b_local_label text, p_b_note text, p_b_calendar text, p_b_original_date date, p_b_solar_date date, p_b_birth_time time without time zone, p_b_gender text, p_b_city text, p_b_late_night_rule text, p_b_time_basis text, p_relation text, p_a_person uuid, p_b_person uuid, p_listed boolean, p_a_chart jsonb, p_a_chart_engine_version text, p_b_chart jsonb, p_b_chart_engine_version text)'),
           ('current_beta_schedule()'),
           ('discovery_shown_to_me(p_other uuid)'),
           ('is_active_account()'),
           ('is_chart_pillar(pillar jsonb)'),
           ('is_chart_snapshot(chart jsonb)'),
           ('is_element_summary(summary jsonb)'),
           ('is_need_summary(summary jsonb)'),
           ('leave_reading_feedback(p_run_id uuid, p_usefulness smallint, p_perceived_fit smallint, p_felt_length text, p_issue_tags text[], p_comment text)'),
           ('mark_chat_read(p_match_id uuid, p_up_to_seq bigint)'),
           ('mark_notifications_read()'),
           ('match_reading_source(p_match_id uuid)'),
           ('match_request_ttl()'),
           ('move_my_photo(p_from integer, p_to integer, p_version bigint)'),
           ('my_chat_messages(p_match_id uuid, p_before_seq bigint, p_limit integer)'),
           ('my_chat_rooms()'),
           ('my_discovery_board()'),
           ('my_last_reading_run(p_kind text, p_person_a uuid, p_person_b uuid, p_match_id uuid)'),
           ('my_match_requests()'),
           ('my_match_scope(p_match_id uuid)'),
           ('my_matches()'),
           ('my_notifications()'),
           ('my_passed_connections()'),
           ('my_person_slots()'),
           ('my_photos()'),
           ('my_reading(p_kind text, p_person_a uuid, p_person_b uuid, p_match_id uuid)'),
           ('my_reading_artifacts(p_kind text, p_person_a uuid, p_person_b uuid, p_match_id uuid)'),
           ('my_reading_credits()'),
           ('my_readings()'),
           ('my_service_survey()'),
           ('my_warning_notice()'),
           ('nickname_is_available(p_nickname text)'),
           ('note_operator_denial(p_action text, p_report_id uuid)'),
           ('open_reading_order(p_bundle_credits integer, p_provider text, p_idempotency_key text)'),
           ('operator_audit_export_status()'),
           ('operator_reading_refund_basis(p_order_id uuid)'),
           ('operator_report(p_report_id uuid)'),
           ('operator_report_snapshot(p_report_id uuid)'),
           ('operator_reports(p_reviewed boolean, p_reason text, p_has_snapshot boolean, p_page integer, p_warning_ref text)'),
           ('operator_service_survey_counts()'),
           ('operator_service_survey_overview()'),
           ('operator_service_survey_texts()'),
           ('operator_survey_by_version()'),
           ('operator_survey_comments()'),
           ('operator_survey_overview()'),
           ('operator_survey_tags()'),
           ('pair_relation_of(p_person_a uuid, p_person_b uuid)'),
           ('person_for_pair(p_person uuid, p_local_label text, p_note text, p_calendar text, p_original_date date, p_solar_date date, p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text, p_time_basis text, p_chart jsonb, p_chart_engine_version text)'),
           ('photo_at(p_user_id uuid, p_position integer)'),
           ('presence_policy()'),
           ('push_subscription_registered(p_endpoint text)'),
           ('reject_bad_chart(p_chart jsonb, p_chart_engine_version text, p_birth_time time without time zone)'),
           ('remove_my_photo(p_position integer, p_version bigint)'),
           ('remove_push_subscription(p_endpoint text)'),
           ('report_chat_message(p_message_id uuid, p_reason text, p_detail text)'),
           ('report_user(p_user_id uuid, p_reason text, p_detail text)'),
           ('request_account_deletion()'),
           ('request_match(p_candidate_user_id uuid)'),
           ('respond_to_match_request(p_request_id uuid, p_accept boolean)'),
           ('restore_passed_connection(p_candidate_user_id uuid)'),
           ('save_my_profile(p_nickname text, p_intro text)'),
           ('save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)'),
           ('save_service_survey(p_liked text[], p_unknown text[], p_improve text[], p_improve_text text, p_wants text[], p_wants_new text[], p_price_solo text, p_price_pair text, p_price_factors text[], p_free_text text, p_price_options text[], p_submit boolean)'),
           ('send_chat_message(p_match_id uuid, p_body text)'),
           ('service_survey_context()'),
           ('set_contact_consent(p_consent boolean)'),
           ('set_improvement_consent(p_consent boolean)'),
           ('set_pair_relation(p_person_a uuid, p_person_b uuid, p_relation text)'),
           ('set_person_listed(p_person uuid, p_listed boolean)'),
           ('share_my_reading(p_body text, p_metaphor text, p_kind text, p_person_a uuid, p_person_b uuid)'),
           ('shared_reading(p_token text)'),
           ('start_reading_run(p_kind text, p_idempotency_key text, p_person_a uuid, p_person_b uuid, p_match_id uuid, p_model text, p_prompt_version text)'),
           ('taste_passage(p_key text)'),
           ('touch_activity()'),
           ('unread_chat_count()'),
           ('unread_notifications()')$$,
  'authenticated 가 부를 수 있는 public 함수는 이 목록뿐이다');

select * from finish();
rollback;
