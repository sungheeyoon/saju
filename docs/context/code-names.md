# 만세력 용어집 — 용어 ↔ 코드 · 어긋난 이름

색인은 `GLOSSARY.md` 다 — 용어마다 첫 줄을 읽는 법과 절마다 사는 파일이 거기 있다.

## 9. 용어 ↔ 코드

§1–§7 항목(색인 `GLOSSARY.md` 「차례」의 영역 파일)의 첫 줄을 모은 표다. **이 표의 식별자는 코드에 있어야 한다** — `scripts/code-rules.test.ts`
가 `src/` · `app/` · `supabase/migrations/` 에서 낱말로 찾는다. 이름을 바꾸면 여기와 그 항목을
함께 고친다. 「코드에 없다」는 PRD 에만 있는 말이다.

| 용어 | 코드 | 자리 |
| --- | --- | --- |
| Person | `person` · `user_person_access` | 표 · 엣지 표 |
| User | `app_user` · `AccountState` | 표 · `src/lib/account` |
| selfPerson | `self_person_id` · `create_self_person` | `app_user` 칸 · 함수 |
| localLabel | `local_label` | `user_person_access` 칸 |
| 닉네임 | `nickname` · `nicknameKey` | `app_user` 칸 · `src/lib/profile` |
| 프로필 사진 | `profile_photo` · `photo_at` | 표 · 함수 |
| 이용 정지 | `suspended` · `AccountStatus` | `app_user.status` 값 · `src/lib/account` |
| 계정을 못 읽음 | `AccountRead` · `readAccount` | `app/me/account.ts` |
| 탈퇴 대기 | `deletion_requested` · `requestAccountDeletion` | `app_user.status` 값 · 액션 |
| 운영자 | `operator` · `Operator` | 표 · `src/lib/consent` |
| 운영 검증 계정 | `verification_account` | 표 |
| 신고 | `report` · `report_user` · `reportUser` | 표 · 함수 · 액션 |
| 차단 | `block` · `blockUser` | 표 · 액션 |
| 입력 | `SajuInput` | 엔진 |
| 저장된 입력 | `StoredInput` · `write_person_input` · `edit_person_input` · `storedInputOf` · `storedChartOf` | `src/lib/input` · 함수 · 읽는 문 · 세우는 문 |
| 옵션 | `SajuOptions` · `TimeBasis` · `LATE_NIGHT_RULES` | 엔진 · `src/lib/input` |
| 원본 생일 | `original_date` · `calendar` · `solar_date` | `person` 칸 |
| 윤달 | `lunar_leap` · `CALENDAR_KO` | `Calendar` 값 · 엔진 |
| 명식 | `Saju` · `computeSaju` | 엔진 |
| 원국 | `pillars` · `getFourPillars` | 엔진 |
| 여덟 글자 스냅샷 | `chartSnapshotOf` · `current_chart` · `chart_a` · `chart_b` · `chart_high` · `chart_low` | 엔진 · `person` · `reading` · `match` 칸 |
| 용신을 잡는 네 길 | `JudgementKey` | 엔진 `analysis/precedence` |
| 통관신 | `TONGGWAN_POLICY` | 엔진 `analysis/tonggwan` |
| 억부·조후 대조 | `judgementPrecedenceOf` | 엔진 |
| 억부 판정(구조) | `eokbuJudgementOf` | 엔진 `analysis/eokbuJudgement` |
| 조후 판정(조건부) | `johuJudgementOf` | 엔진 `analysis/johuJudgement` |
| 억부·조후 관계 | `eokbuJohuRelationOf` | 엔진 `analysis/needProfile` |
| 필요 오행 프로필 | `needProfileOf` · `NeedProfile` | 엔진 `analysis/needProfile` |
| 방향별 필요 보완 | `needComplementOf` · `DirectionalNeedComplement` · `ProviderPresence` | 엔진 `analysis/needComplement` |
| claim(끝난 뒤의 규칙) | `claimed_by` · `demote_others_on_claim` | 함수 · `app_user` 트리거 |
| 읽는 문 | `dbFailure` | `app/db-error.ts` |
| 부속 정보 | `SkippableRead` · `unread` | `app/db-error.ts` |
| 열쇠 | `keyedClient` · `service_role` | `app/keyed-client.ts` · DB 역할 |
| 근거 | `Evidence` · `evidenceOf` | 엔진 `evidence/` |
| redacted 근거 | `RedactedEvidence` · `redactEvidence` | 엔진 `evidence/redacted` |
| 공유 범위 근거 | `SharedEvidence` · `shareEvidence` | 엔진 `evidence/shared` |
| 발화 | `Utterance` · `assembleText` | 엔진 `text/` |
| 분석 표 · 궁합 | `Compatibility` · `analyzeCompatibility` | 엔진 `compat/` |
| 해석 | `ReadingOutput` · `output` | `src/lib/reading` · `reading` 칸 |
| 풀이 | `READING_NOUN` | `src/lib/reading` |
| Reading | `reading` · `my_reading` · `save_reading` · `currentReading` | 표 · 함수 · 읽는 문 |
| Reading kind | `ReadingKind` · `READING_KINDS` · `SoloKind` | `src/lib/reading` |
| 결과 생성 요청 | `generateReading` · `start_reading_run` · `beginReading` | 액션 · 함수 · 파이프라인 |
| 시도 | `reading_run` · `my_last_reading_run` · `readingRunState` · `idempotency_key` | 표 · 함수 · 액션 · 칸 |
| 맛보기 세션 | `taste_session` · `reserve_taste` · `claim_taste_session` · `link_taste_reading_run` | 표 · 함수 |
| 맛보기 퍼널 단계 | `count_taste_step_once` · `taste_session_step` · `TASTE_SESSION_STEPS` · `count_taste_step`(`reading_succeeded` 만) · `taste_daily` | 함수 · 표 · `src/lib/reading/taste-visit.ts` · 뷰 |
| 맛보기 생성 결과 | `taste_artifact` · `finish_taste` | 표 · 함수 |
| 근거 지문 | `tasteFingerprintOf` · `evidence_fingerprint` · `tasteEvidenceOf` | `src/lib/reading/taste-run.ts` · 칸 |
| 이어쓰기 | `continuationAnswer` · `continuationBlockOf` · `continuedMarkdownOf` · `taste_continuation_of_run` | `src/lib/reading/continuation.ts` · 함수 |
| 공유본 | `reading_share` · `share_my_reading` · `shared_reading` · `sharedReadingOf` | 표 · 함수 · 읽는 문 |
| 한 줄 요약 | `metaphor` · `metaphorLength` | `reading` 칸 · `READING_POLICY` |
| 다룰 것 | `PairShape` · `needs-v1` | `src/lib/reading/prompt.ts` |
| 용어 판 · 이름을 안 부르는 판 | `Terminology` · `plain` · `PLAIN_FORBIDDEN_TERMS` | `src/lib/reading` |
| 현재 결과 점수 | `score` | `reading` 칸 |
| 기준점 | `baselineIn` · `baselineBlock` · `previewScoreOf` | `src/lib/reading` · `src/lib/discovery` |
| 체감 적합성 | `reading_feedback` · `feedbackQuestions` · `leave_reading_feedback` | 표 · `src/lib/reading` · 함수 |
| 자리 대칭 | `COMPAT_SIDES` | 엔진 `compat/` |
| 매칭 참여 | `opted_in_at` · `opted_out_at` · `set_discovery_participation` · `ensure_discovery_participation` | `discovery_profile` 칸 · 함수 |
| DiscoveryProfile | `discovery_profile` · `prefer_gender` · `DiscoveryProfile` · `myDiscoveryProfile` | 표 · 칸 · `src/lib/discovery` · 읽는 문 |
| 오행 요약 | `ElementSummary` · `elementSummaryOf` · `element_summary` | `src/lib/discovery` · 칸 |
| 후보 | `BoardRow` · `my_discovery_board` · `candidatesForViewer` · `discovery_candidate` | `src/lib/discovery` · 함수 · 읽는 문 · 표 |
| 탐색 후보 | `exploration` · `DISCOVERY_POLICY` | `discovery_impression` 칸 · `src/lib/discovery` |
| 하드 제외 | `discovery_eligible` · `discovery_unavailable` | 함수 |
| 노출 순서 | `DISCOVERY_POLICY` · `fill_discovery_deck` · `refresh_discovery_snapshot_for` | `src/lib/discovery` · 함수 |
| 예측 궁합 점수 | `previewScoreOf` · `buildMatchPreview` | `src/lib/discovery` · `src/lib/matching` |
| 노출 기록 | `discovery_impression` | 표 |
| 지나친 인연 | `discovery_passed` · `passCandidate` · `restorePassed` | 표 · 액션 |
| pending 요청 | `match_request` · `pending` · `RequestStatus` · `requestMatch` | 표 · 값 · `src/lib/consent` · 액션 |
| 무효 | `invalidated` · `invalidate_pending_requests` | 값 · 함수 |
| 거둠 | `cancelled` · `cancelRequest` | 값 · 액션 |
| 동의 화면 | `MATCH_DISCLOSURE` · `CONSENT_FLOW_STEPS` · `respond_to_match_request` | `src/lib/consent` · 함수 |
| Match | `match` · `my_matches` · `visible_matches` | 표 · 함수 |
| 공유 결과 | `matchResultForViewer` | `app/me/match/result.ts` |
| 동의 당시 여덟 글자 | `chart_high` · `chart_low` · `freeze_reading_input` | `match` 칸 · 함수 |
| 대화방 | `chat_room` · `my_chat_rooms` · `unread_chat_count` · `chatRoomsForViewer` · `CHAT_TAB_LABEL` | 표 · 함수 · `app/me/chat` · `src/lib/chat` |
| 메시지 | `chat_message` · `send_chat_message` · `my_chat_messages` · `mark_chat_read` · `sendChatMessage` · `messagesForViewer` | 표 · 함수 · 액션 · 읽는 문 |
| 닫힘 | `closed_reason` · `closed_by_user_id` · `closed_at` · `chat_room_readable` · `closedRoomText` | `chat_room` 칸 · 함수 · `src/lib/chat` |
| 전송 한도 | `chat_rate_limit` · `chat_policy` · `chat_rate_limit_hit` · `CHAT_POLICY` · `RATE_LIMITED_TEXT` | 함수 · 표 · `src/lib/chat` |
| 신고 스냅샷 | `chat_report_snapshot` · `report_chat_message` · `purge_closed_chat_messages` · `reportChatMessage` | 표 · 함수 · 액션 |
| 접속 상태 | `user_activity` · `touch_activity` · `activity_band_of` · `presence_policy` · `ActivityBand` · `activityText` | 표 · 함수 · `src/lib/presence` |
| 풀이권 | `my_reading_credits` · `reading_credit_limit_for` · `readingCredits` | 함수 · 읽는 문 |
| 풀이권 예외 | `reading_credit_grant` | 표 |
| 산 묶음 | `reading_bundle` · `reading_order` · `approve_reading_order` · `READING_BUNDLES` | 표 · 함수 · `src/lib/reading` |
| 사용 이력 | `reading_credit_use` · `operator_reading_refund_basis` · `refundableCredits` | 표 · 함수 · `src/lib/reading` |
| Person 한도 | `person_limit` · `my_person_slots` · `PersonSlots` | 함수 · `src/lib/people` |
| 운영 베타 | `beta_schedule` · `BetaDates` | 표 · `src/lib/consent` |
| 테스트 코드 | `signup_code` · `valid_on` · `max_uses` | 표 · 칸 |
| 가입 완료 | `signed_up_at` · `complete_signup` | `app_user` 칸 · 함수 |
| 앱 내 알림 | `notification` · `NotificationKind` · `my_notifications` | 표 · `src/lib/consent` · 함수 |
| 만드는 중인 풀이 | `my_running_readings` · `RunningReading` · `runningReadings` | 함수 · `app/me/home/running.ts` |
| 계정 채널 | `tell_changed` · `LiveUpdates` · `openUserChannel` · `mark_chat_read` | 함수 · `app/live` · 함수 |
| 새 메시지 알림 | `push_subscription` · `push_delivery` · `save_push_subscription` · `claim_push_deliveries` · `settle_push_delivery` · `pushPayloadFor` · `PushRow` | 표 · 함수 · `src/lib/push` · `app/me/settings` |
| 서비스 설문 | `service_survey` · `SurveyAnswers` · `save_service_survey` · `submitted_at` | 표 · `src/lib/survey` · 함수 · 칸 |
| 지불 의향 | `price_solo` · `price_pair` · `price_options` · `PriceOption` | `service_survey` 칸 · `src/lib/survey` |

## 10. 어긋난 이름

코드가 용어집과 다른 말을 쓰는 자리다. 고칠 때는 여기서 지운다. 2026-09-22 에 잰 것이고,
고치는 일은 값을 재고 따로 한다(ADR 0088).

| 코드의 이름 | 용어집의 말 | 어디 | 왜 남았나 |
| --- | --- | --- | --- |
| 사유값 `unreadable-revision` | 저장된 입력을 못 읽었다 | `fail_reading_job` 의 `p_failure_code` 로 적히는 값 · `app/me/reading/pipeline.ts` | 그대로 둔다 — DB 에 이미 적힌 값이라 바꾸면 옛 행과 새 행이 갈린다. 화면에 안 나간다(2026-09-23 결정) |
| `metaphor` · `metaphorLength` | 한 줄 요약 | `reading` · `reading_share` 칸 · RPC 다섯 · 구조화 출력 필드 · `READING_POLICY` | 그대로 둔다 — 구조화 출력의 키는 프롬프트의 일부라 바꾸면 프롬프트를 바꾸는 일이고(실호출이 들고, 배포 순간 돌던 생성은 옛 키로 돌아온다), 칸 이름은 RPC 의 반환 열 · 인자라 바꾸면 떠 있는 옛 앱이 깨진다. 비유를 접은 뒤에도(ADR 0056) 이름만 남았다(2026-09-23 결정) |
| `refresh_discovery_snapshot_for` · `snapshot_id` | 후보 목록 | 함수 · `discovery_candidate_slot` 칸 | 그대로 둔다 — 표 둘은 2026-09-23 에 `discovery_candidate` · `discovery_candidate_slot` 으로 옮겼다. 닫힌 문 하나와 칸은 표를 따라 읽히고 뜻은 안 갈린다(2026-09-23 결정). 앱이 부르던 `my_discovery_snapshot` · `refresh_discovery_snapshot` 은 새로고침 단추가 걷힌 뒤(ADR 0115) 좁히기로 지웠다(G-61, `20261029090000`) |
| `requestAccountDeletion` · `request_account_deletion` · `deletion_requested` · `DELETION_NOTE` | 탈퇴 대기 | 액션 · 함수 · `app_user.status` 값 · `src/lib/account` | 식별자는 그대로 둔다 — DB 값을 바꾸면 마이그레이션이고 뜻은 안 갈린다. 화면 문구는 2026-09-23 에 옮겼다(카드 「탈퇴」 · 버튼은 2026-09-28 부터 「탈퇴 신청하기」) |
