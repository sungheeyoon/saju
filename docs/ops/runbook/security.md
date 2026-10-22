# 운영 절차 — 보안 점검 · 운영 주기 · 의존성 취약점

색인은 `docs/ops/runbook.md` 다.

## 보안 점검 — advisor 와 접속기록 (G-23 ⑩ ⑪)

### 보안 advisor — **부르는 명령 하나** (G-23 ⑪)

Supabase 가 스키마와 인증 설정을 훑어 내는 경고다(splinter). 다시 잴 때는 이 한 줄이다 — 원격에 닿으므로
잠금을 지난다(ADR 0096).

```bash
node scripts/remote-lock.mjs npx supabase db advisors --linked --type security --level info --output-format json \
  | jq -r '.results | group_by(.name) | .[] | "\(.[0].level) \(.[0].name) \(length)"'
```

같은 것을 Management API 로도 받는다 — `GET /v1/projects/xgdeguyxgkillndraonc/advisors/security`(열쇠는 CLI 가
macOS 키체인에 둔 것, 문서에 적지 않는다). **로컬 스택의 `--local` 은 0028 · 0029 와 인증 경고를 안 낸다** —
판본이 다르다. 운영에 대고 잰다.

**2026-09-24 에 잰 값(운영).** 합계 WARN 87 → 71, INFO 26 → 26. 고친 뒤 값은 `20261009120000` 을 올린 다음 다시 불러 쟀고, 발행 키로 `rpc/beta_is_over` 를 부르면 `42501` 이다.

| lint | 고치기 전 | 고친 뒤 | 무엇을 했나 |
| --- | --- | --- | --- |
| WARN `function_search_path_mutable`(0011) | 15 | 0 | 상수 함수 열다섯에 `search_path = ''` — `20261009120000` |
| WARN `anon_security_definer_function_executable`(0028) | 3 | 2 | `beta_is_over()` 를 닫았다 — 화면이 안 부르고 definer 안에서만 불린다 |
| WARN `authenticated_security_definer_function_executable`(0029) | 68 | 68 → 69(ADR 0105 의 `note_operator_denial`, 2026-09-24 운영에서 잼) | `claimed_by` · `may_edit_person_input`(남의 claim · 편집권을 묻는 신탁) · `beta_is_over` 를 닫아 65 가 됐고, 같은 날 G-24 가 `/ops/reports` 의 운영자 문 셋(`operator_reports` · `operator_report` · `operator_report_snapshot`, `is_operator()` 검사)을 더했다 |
| WARN `auth_leaked_password_protection` | 1 | 1 | **남긴다 — Pro 플랜부터다**(아래) |
| INFO `rls_enabled_no_policy` | 26 | 26 → 29(ADR 0105 의 `audit.operator_access` · `audit.operator_access_export` · `signup_pause`, 운영에서 잼) | **남긴다 — 의도다**(아래) |

잠금은 pgTAP `44_advisor_lints`(invoker 까지 search_path · 닫은 셋) 와 `33_function_shape`(anon 에 열린 문은
둘 — `current_beta_schedule()` · `shared_reading(text)`).

**남긴 것과 까닭.**

- **0028 둘 · 0029 예순여덟은 앱이 부르라고 연 문이다.** 이 저장소의 쓰기와 읽기는 `security definer` RPC 가
  들고(`docs/notes/rpc-and-exposure-rules.md`), 각 문은 `auth.uid()` 나 그것을 묻는 범위 함수(`reading_scope` · `is_operator` ·
  `visible_notifications` · `may_see_photo`)로 좁힌다 — 2026-09-24 에 `auth.uid()` 를 직접 안 묻는 열여섯의
  몸을 열어 범위 함수 · 운영자 검사 · 상수 · 공유 토큰임을 봤다.
  advisor 문서도 「일부러 연 문이면 그 대상에 대해 무시해도 된다」고 적는다(lint 0029 의 세 번째 길). 대상별로
  끄는 장치는 없고, 규칙째 끄면 **의도하지 않은 새 문도 함께 숨는다** — 끄지 않는다. 이 중 다섯은 정책 · invoker
  함수 · 흐름 검사가 사용자 역할로 불러 닫을 수 없다: `is_active_account` · `chat_room_readable`(RLS 정책) ·
  `set_person_listed`(invoker `create_pair_for_reading`) · `chat_policy` · `presence_policy`(흐름 검사가
  사용자 열쇠로 수를 대조한다). **글자 그대로 0 으로 만드는 길**은 definer 몸을 노출 안 된 스키마로 옮기고
  `public` 에 invoker 껍데기를 두는 것인데, 열리는 문이 같아 막는 것이 없다 — 하지 않았다.
- **유출 비밀번호 검사(HaveIBeenPwned)는 Pro 플랜부터다**(<https://supabase.com/docs/guides/auth/password-security>,
  2026-09-24). 조직 플랜은 `free`(Management API `GET /v1/organizations/{id}` 의 `plan`). 앱의 로그인은 구글
  하나지만 이메일 공급자가 켜져 있다(`external_email_enabled: true`, 확인 메일 필요) — e2e 와 운영 확인 계정이
  비밀번호로 들어오는 길이다. 끌지는 G-23 줄에 남겼다.
- **정책 없는 RLS 표 스물여섯은 의도다** — 앱은 표를 직접 읽지 않고 definer 문으로만 닿는다. 정책이 없으면
  anon · authenticated 는 한 줄도 못 본다. 등급이 INFO 라 경고가 아니다.

**인증 설정 — 바꾼 것 없음(2026-09-24).** 운영 값: OTP 만료 3600초(`mailer_otp_exp`, advisor 의 한도 안),
TOTP MFA 켜짐, 전화 공급자 꺼짐, 익명 로그인 꺼짐, refresh 회전 켜짐. `supabase/config.toml` 은 advisor 가
보는 값과 어긋남이 없다. **JWT 수명은 확인 전** — 대시보드 Auth → JWT expiry 의 값을 읽어 여기 적는다(로컬
`supabase/config.toml` 의 `jwt_expiry` 는 3600초). 다른 기기에서 나간 세션의 쿠키가 사진을 여는 창의 크기다(ADR 0200).

### 성능 advisor — 외래키 인덱스와 안 쓰인 인덱스 (G-23 ⑪ 곁)

같은 명령에서 `--type performance` 로 바꿔 부른다.

```bash
node scripts/remote-lock.mjs npx supabase db advisors --linked --type performance --level info --output-format json \
  | jq -r '.results | group_by(.name) | .[] | "\(.[0].level) \(.[0].name) \(length)"'
```

**2026-09-24 에 잰 값(운영).** 전 값은 G-23 ⑪ 때 적은 23 · 7 에서 `20261010100000`(접속기록) · `20261011090000`(결제 표)이
하나 · 다섯을 더한 것이다. 후 값은 `20261012090000` 을 올린 다음 다시 불렀다.

| lint | 고치기 전 | 고친 뒤 | 무엇을 했나 |
| --- | --- | --- | --- |
| INFO `unindexed_foreign_keys` | 24 | 1 | 외래키 스물셋에 인덱스 — `20261012090000` |
| INFO `unused_index` | 12 | 35 | 하나도 안 지웠다. 새로 세운 스물셋이 아직 안 쓰여 더해졌다 — 탈퇴 처분 · 사람 지우기가 한 번 돌면 준다 |

**더한 스물셋 — 탈퇴 처분의 사슬.** `forget_user` 가 `auth.users` 를 지우면 `app_user` 를 거쳐 매칭 · 신청 · 노출 ·
채팅 · 주문이 cascade/`set null` 로 따라 지워지고, 같은 함수가 지우는 `person` 은 접근 · 풀이 · 시도 · 관계를,
`match_without_its_pair_is_cleared` 가 지우는 `match` · `reading_run` 은 알림 · 시도를 끌고 간다. 외래키에 인덱스가
없으면 부모 한 줄마다 자식 표를 통째로 훑는다. 스물셋 대부분은 그 칼럼으로 거르는 문도 있다(`forget_orphan_people` 의
`person_id`, `visible_matches` 의 `user_high`, `reading_scope_for` 의 `blocked_user_id`, `keep_payments_of_leaver` 의
`order_id`). 기존 복합 인덱스의 앞 칼럼으로 덮인 것은 없었다 — advisor 가 잘못 본 것은 없다. 로컬에서 `user_person_access`
에 2만 줄을 넣고 `delete … where person_id = …` 가 `user_person_access_by_person` 으로 도는 것, `match` 의
`user_low = … or user_high = …` 가 두 인덱스의 `BitmapOr` 로 도는 것을 `EXPLAIN` 으로 봤다.

**건너뛴 하나 — `app_user.notice_schedule_id`.** 부모 `beta_schedule` 은 운영자가 손으로 넣는 표(운영 2줄)이고 지우는
코드가 없다. 지울 때 `app_user` 를 한 번 훑는 값이 쓰기마다 인덱스를 고치는 값보다 싸다.

**`concurrently` 를 안 쓴 까닭.** `db push` 는 마이그레이션을 트랜잭션 안에서 돌리고 `create index concurrently` 는
트랜잭션 안에서 못 돈다. 대상 표는 운영에서 가장 큰 것이 수백 줄 · 2MB 아래라 SHARE 잠금이 밀리초로 끝났다. 표가 커진
뒤 같은 일을 하면 `concurrently` 로 먼저 세우고 마이그레이션에는 `if not exists` 로 적는다.

잠금은 pgTAP `49_foreign_key_indexes` — advisor 와 같은 셈(외래키 칼럼이 어느 인덱스의 앞 칼럼들과 같은 집합)으로
덮이지 않은 외래키를 이름으로 내고, 목록이 건너뛴 하나와 같은지 잰다. 새 외래키를 인덱스 없이 들이면 붉다.

**안 쓰인 인덱스 열둘 — 지우지 않았다.** 통계가 한 달치(2026-08-25 초기화)이고 결제는 아직 운영에 안 들었다. 다른
인덱스 · 제약과 완전히 겹치는 것(같은 앞 칼럼들)은 없었다. 무엇을 위해 있나:

| 인덱스 | 받치는 질의 |
| --- | --- |
| `report_by_reporter` | 신고 하루 한도 — 신고한 사람의 오늘 건수(`report_user` · `report_chat_message`) |
| `report_by_pair` | 처리 필요인 같은 대상 · 같은 사유의 중복 신고(같은 두 문, `report_is_open`) — `20261017090000` 이 `reviewed_at is null` 부분 인덱스 `report_unreviewed_by_pair` 를 술어 없는 것으로 바꿨다(ADR 0107 정정) |
| `report_unreviewed` | 안 본 신고(`reviewed_at is null`) — 운영자 목록의 처리 필요는 추가 확인 필요까지라(ADR 0107) 이것만으로 다 짚지는 않는다(`operator_reports`) |
| `chat_report_snapshot_by_message` | 같은 메시지의 중복 신고 |
| `chat_room_closed` | 닫힌 지 90일 지난 방의 메시지 지우기(`purge_closed_chat_messages`) |
| `chat_rate_limit_hit_by_time` | `docs/ops/runbook/moderation.md` 「한도에 걸린 건수를 본다」의 기간 집계 |
| `reading_job_open_idx` | 복구기가 못 끝낸 일감을 오래된 차례로 집기(`open_reading_jobs`) |
| `operator_access_by_actor` | 운영자 거절 기록의 시간당 빗장(`note_operator_denial`) |
| `operator_access_by_time` | 접속기록의 시각 범위 조회 · 1년 보존 뒤 정리. 반출은 번호로 돈다 |
| `reading_order_by_user` | 한 사람의 주문 차례(판매 스위치가 꺼져 아직 부르는 문이 없다). `user_id` 만의 찾기는 유일 제약 `(user_id, idempotency_key)` 가 받는다 — 판매가 켜진 뒤에도 `created_at` 차례로 읽는 문이 없으면 그때 지운다 |
| `reading_credit_use_by_bundle` | 묶음별 쓰임(환불 셈 `operator_reading_refund_basis`) · 묶음 지울 때 |
| `retention_payment_expiry` | 5년 지난 결제 기록 지우기(`retention.purge_expired_payments`) |

### 운영자 접속기록 — **어디에 며칠 남나** (G-23 ⑩ · G-25 ③ · ADR 0105)

G-25 ③ 이 운영자의 개인정보처리시스템 접속기록을 **1년 이상** 두기로 했다(「개인정보의 안전성 확보조치 기준」 제8조 —
원칙 1년, 정보주체 5만 명 이상 · 고유식별정보 · 민감정보 처리 등은 2년. CI 가 고유식별정보인지와 2년 여부는 G-25 변호사
확인 목록이다). **1년은 법의 하한이다**(고시 제8조① — 개정 ①② 는 2026-10-31 시행, 부칙 제2025-9호. 근거와 확인 날짜는 ADR 0191 「근거」).
대상 요약 줄의 `reported=<id> reporter=<id>` 는 그 읽기가 처리한 두 정보주체다(고시 제2조 제3호의 「처리한 정보주체 정보」) — 신고의
증거가 아니라서 떠난 사람의 신고 기록(6개월, ADR 0098)보다 오래 남는다. 2026 고시 본문 · 시행일은 다시 확인할 거리이고 법 제21조와의
관계를 포함해 법적 결론은 내리지 않는다(G-111 R-5 — 운영 판단). **정보주체가 5만 명 이상이면 2년으로 옮긴다** — 반출 버킷의
기본 보존을 730일로, 이미 있는 객체의 보존일을 늘린다(아래 「반출」 4). 회원 수는 `docs/ops/runbook/jobs.md` 「제품 지표」의 첫 질의가 낸다.
2026-09-24 에 자리마다 잰 값이다. 플랜은 CLI · API 로 읽었다 — Supabase 조직 `free`, Vercel 팀
`sungheeyoons-projects` `hobby`, GitHub 개인 계정(`User`, 저장소 공개).

| 자리 | 기록 종류 — 누가 · 언제 · 무엇 | 보존 | 근거 · 확인 날짜 |
| --- | --- | --- | --- |
| 앱의 운영자 화면 `/ops/reports` | **DB 의 `audit.operator_access`** — 운영자 id · 시각 · 동작(목록 · 상세 · 스냅샷 · 대상 회원 요약 `reports.target` · 처분 `reports.review`) · 대상 신고 id(목록이면 거른 조건) · 성공/거절. 처분은 거른 조건 칸에 `version=<n>`(재시도면 ` replayed`), 대상 요약은 `reported=<id> reporter=<id>` 만 — 판단 근거 · 닉네임은 안 적는다(ADR 0188). 문이 읽거나 적을 때 같은 트랜잭션에서 적고, 거절은 앱의 문이 따로 적는다 — 운영자가 아니면 `denied`(액션이 문을 부르기 전에 거른 모양도, 2026-10-18 부터), 운영자의 처분이 버전 충돌 · 모양 등으로 거절되면 `refused`(거른 조건 칸 `refused=<SQLSTATE>`, 2026-10-17 부터 · ADR 0191). **`refused` 는 앱 액션이 받은 거절만이고 범위가 제한된다** — 한 운영자 한 시간 30줄까지(넘으면 버리고 장애 알림 `operator-refusal-cap:<운영자 id>` 하루 한 번, `20261220090000`), 앱을 거치지 않고 RPC 를 바로 부른 거절은 안 남는다 | DB 에 쌓이고 **매일 S3 로 반출, Object Lock 400일** — 아래 「반출」. AWS 가 켜지기 전에는 DB 에만 있다 | ADR 0105 · 0188 · 0191 · pgTAP `46_operator_access_log` · `99_operator_report_review` · `99_operator_write_refusals` |
| `npm run db:remote` | **같은 표** — 실행자(git 이름, 에이전트면 `(agent)`) · 시각 · **목적 · SQL 의 sha256**. 원문은 안 적는다. 끝난 뒤 **결과 줄 하나**(`cli.result` — 앞 줄의 번호 · 성공/실패 · 오류 분류 `sql` · `connection` · `unknown`, `20261014090000`)가 더해진다 | 위와 같다 | `scripts/db-remote.mjs` · `db-remote.test.ts` |
| `/ops/orders` | **같은 표** — 주문을 찾으면 `credits.refund_basis` · `credits.refund_status`(진행 중인 환불), 환불을 준비 · 확정 · 준비 취소하면 `credits.refund_hold` · `credits.refund_book` · `credits.refund_release` 한 줄씩(운영자 id · 시각 · 거른 조건 칸에 주문 id 만 · 성공/거절). 이메일 · 금액은 안 적는다. 거절은 앱의 문이 같은 동작 이름으로 따로 적는다(2026-10-16 부터) — 운영자의 확보 · 확정 · 준비 취소가 거절되면 `refused`(`order=<id> refused=<SQLSTATE>`, 2026-10-17 부터 · ADR 0191). 확정의 거절은 그 주문의 진행 중인 확보가 그 확보로 확인될 때만 주문 id 를 싣는다 — 확인 읽기가 `credits.refund_status` 한 줄을 더 남기고, 확보가 이미 닫혔으면 주문 칸이 빈다. 시간당 30줄 · 앱 밖의 RPC 는 위 `/ops/reports` 줄과 같다 | 위와 같다 | ADR 0184 · pgTAP `96_operator_refund_order` · `48_reading_bundle_ledger` |
| `/ops/survey` | **같은 표** — 설문 문 일곱이 읽을 때마다 문마다 한 줄(동작 `survey.*` · 운영자 id · 시각 · 성공/거절). 대상 · 거른 조건 칸은 비고 **설문 답 · 글 원문은 안 적는다.** 거절은 앱의 문이 `survey.overview` 한 줄로 적는다(2026-10-01 부터) | 위와 같다 | ADR 0105 추기 2026-10-01 · pgTAP `78_operator_survey_access_log` |
| `/ops/today` | **같은 표** — 오늘 · 이번 주의 숫자 문(`operator_today_figures`)이 읽을 때마다 한 줄(동작 `today.figures` · 운영자 id · 시각 · 성공/거절). 대상 · 거른 조건 칸은 비고 개인을 가리키는 값은 없다. 거절은 앱의 문이 같은 이름으로 적는다 | 위와 같다 | ADR 0183 · pgTAP `95_operator_today_figures` |
| `/ops/members` | **같은 표** — 찾을 때 `members.find`, 경고 이력을 읽을 때 `members.warnings`, 무상 지급분 · 풀이권 이력을 읽을 때 `members.credits` · `members.credit_history`, 무상 풀이권을 지급 · 회수하면 `credits.grant` · `credits.revoke`(거른 조건 칸에 `user=<id> entry=<장부 줄 id>`, 관련 신고면 `report=<id>` — 메모는 안 적는다, ADR 0187) 한 줄씩. 처분 이력을 읽을 때 `members.sanctions`(`user=<id>`), 이용 정지 · 해제하면 `members.suspend` · `members.unsuspend`(거른 조건 칸에 `user=<id> entry=<상태 이력 줄 id>`, 재시도면 ` replayed` — 메모는 안 적는다, ADR 0189) 한 줄씩. 풀이권 이력은 쪽마다(「더 보기」 한 번에) `members.credit_history` 한 줄이고 커서는 안 적는다(ADR 0187 덧). 화면은 경고 이력(`members.warnings`)을 더는 안 읽는다. 거른 조건 칸에 무엇으로 찾았나(`by=nickname\|id`)와 찾은 계정 id(`user=<uuid>`, 없으면 `none`)만 — **찾은 닉네임은 안 적는다.** 거절은 앱의 문이 `members.find` 한 줄로 적는다. 운영자의 지급 · 회수 · 정지 · 해제가 거절되면(버전 충돌 `55000` · 상태 `23514` · 모양 `22023` …) `refused` 한 줄(`user=<id> refused=<SQLSTATE>` — 메모 · 오류 문장은 안 적는다, 2026-10-17 부터 · ADR 0191). 시간당 30줄 · 앱 밖의 RPC 는 위 `/ops/reports` 줄과 같다 | 위와 같다 | ADR 0185 · 0187 · 0189 · pgTAP `97_operator_member` · `99_operator_credit_grant` · `99_operator_member_suspension` · `99_operator_member_history_reads_back` |
| Supabase SQL Editor · Table Editor · `db query --linked` 를 직접 부르는 것 | Postgres 로그. **`log_statement = ddl` 이라 읽기(select)는 안 남는다**, `pgaudit` 은 설치 안 됨 | **읽기 0일** · DDL 1일 | 운영에서 `current_setting('log_statement')` · `pg_extension`(2026-09-24) · 로그 보존 Free 1일 <https://supabase.com/pricing>. **그래서 여기서 개인정보를 읽지 않는다**(`docs/ops/runbook/access.md` 「개인정보는 화면으로만」) |
| Supabase 조직 · 프로젝트 설정(Management API 행위 포함) | Platform Audit Logs | **없음** — Team · Enterprise 만 | <https://supabase.com/docs/guides/security/platform-audit-logs>(2026-09-24) |
| Supabase 계정 | Account Audit Logs(<https://supabase.com/dashboard/account/audit>) — 제 계정의 행위 | **모름** — 문서에 일수가 없고 API(PAT)로는 못 읽는다(`401`) | 같은 문서(2026-09-24). 사람이 화면에서 가장 오래된 줄을 본다 |
| Vercel 팀 | Activity Log — 환경변수 복호화(`env-variable-read`, 사용자 이름) · 배포 · 설정 변경. **로그인은 안 남는다**(SSO 만) | **1년 넘음** — 2025-08-09 줄이 보인다(13달+) | <https://vercel.com/docs/activity-log> 「since its creation」 · `vercel activity -a --until 2026-01-01`(2026-09-24). Audit Log 는 Enterprise |
| GitHub 개인 계정 | Security log — 로그인 · 토큰 · 설정 | **90일** — JSON · CSV 로 내보내기는 화면에서만 | <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-security-log>(2026-09-24). **개인정보처리시스템이 아니다** — 저장소에 이용자 자료가 없고 Actions 비밀값도 0(`gh secret list`) |
| AWS(반출 버킷) | CloudTrail 관리 이벤트(버킷 · IAM 변경) — 기본 90일. 객체 읽기(데이터 이벤트)는 켜야 남는다 | 90일 | 계정을 연 뒤 잰다 |
| PG사 관리자 화면(PortOne 을 거치면 PortOne 콘솔) | — | **계약 전이라 못 잼** | G-21 에서 계약할 때 관리자 접속기록 보존 기간을 묻는다 — PG 와 연동 방식은 미정(ADR 0194) |

**기록이 추가만 되는 것** — 모든 역할(소유자 `postgres` 포함)에서 `update` · `delete` · `truncate` 를 걷었고 트리거가 한
번 더 막는다. 소유자는 트리거를 끌 수 있다 — DB 안에서는 그 이상 못 지키고, 그래서 **밖의 사본(Object Lock)이 지워지지
않는 기록**이다. 월 점검의 「반출이 이어지는가」가 끊긴 자리를 드러낸다.

#### 반출 — 매일 S3, 한 번에 하나, 결과는 DB 에

**접속기록 표에 칸을 더하거나 바꾸면 같은 PR 이 셋을 함께 고친다** — 묶음 머리의 `version`(`app/api/cron/audit-export/bundle.ts`) ·
검증 스크립트의 허용 칸 목록(`scripts/audit-verify.mjs`) · 이 절. #588(`target_report_ids`)이 셋을 함께 바꿨다(2026-10-10).

Vercel Cron `/api/cron/audit-export`(`vercel.json`, 매일 18:37 UTC = 서울 03:37 전후 — Hobby 는 ±59분)가 지난 반출 뒤의
줄을 번호 차례로 읽어 한 파일로 올리고, **올린 뒤에** 범위를 `audit.operator_access_export` 에 적는다. 적는 문은 앞 반출에서
이어지지 않거나 범위 안의 행 수가 틀리면 거절한다 — 빠짐도 겹침도 없다. **같은 범위를 그대로 두 번 적으면 조용히 받는다** —
적고 응답을 잃은 실행의 자리(`20261014090000`). 방금 적힌 줄도 나간다 — 반출은 쓰기와 같은 advisory 자물쇠를 배타로 쥔 뒤에
읽으므로(쓰기는 번호를 받기 전에 공유로 쥔다) 늦게 커밋된 낮은 번호를 건너뛰지 않는다(`20261013090000`).

- **한 번에 하나** — 실행은 시작할 때 `audit.operator_access_export_attempt` 에 한 줄을 적고 5분 임대를 건다. 임대가 살아 있는
  실행이 있으면 뒤 실행은 **「도는 중」(`busy`)으로 적히고 아무것도 안 올린 채 200 `{"busy":true}`** 로 끝난다. 죽은 실행의
  임대는 5분 뒤 풀린다
- **결과는 DB 에** — 실행마다 `audit.operator_access_export_result` 에 한 줄: `succeeded` · `failed` · `not_configured` ·
  `misconfigured` · `busy`, 끝난 시각, 행 수 · 객체 수 · 번호 범위, 실패면 **분류**(`upload:accessdenied` ·
  `batch:57014` · `missing:region` 처럼 걸음과 이름뿐 — 오류 문장은 열쇠 · 버킷 · ARN 이 섞일 수 있어 안 적는다). 추가만 된다
- **알림** — 실패 · 설정 오류로 끝나면 그 자리에서 `audit-export-failed`(연속 실패 수 · 분류). 매일 06:29 UTC 의 감시
  `audit-export-watch` 가 **이틀 넘게 시도가 없으면** `audit-export-silent`(Vercel Cron 이 멈췄다), **설정이 켜졌는데 이틀 넘게
  성공이 없으면** `audit-export-no-success`. 길은 `notify_ops`(Vault `ops_alert_url`, 하루 한 종류 한 번)다. 설정이 없는
  동안과 시도가 한 번도 없는 동안은 조용하다
- **상태를 본다** — 개인을 가리키는 값이 없는 보통 질의다:

  ```bash
  npm run db:remote -- --purpose "접속기록 반출 상태" "select * from audit.export_status()"
  ```

  마지막 시도 · 결과 · 분류, **마지막 성공 시각 · 연속 실패 수 · 밀린 행 수**, 7일의 시도와 실패. 운영자 화면이 서면
  `public.operator_audit_export_status()`(운영자만, 읽으면 접속기록에 남는다)를 부른다
- **파일** — `operator-access/<첫 줄의 서울 날짜 YYYY/MM/DD>/<첫 번호 12자리>-<마지막 번호 12자리>.jsonl`. 첫 줄이 머리
  (`version` 3 · `rows` · `first_id` · `last_id` · `after_id` · 본문 `sha256` · `exported_at`), 그 뒤가 한 줄에 한 행이다.
  해시는 머리를 뗀 나머지의 sha256 이다. 올릴 때 본문 전체의 `ChecksumSHA256` 을 싣는다(Object Lock 버킷이 요구한다).
  `version` 1 은 CLI 결과 칸(`result_of` · `result` · `error_class`)이 서기 전, 2 는 목록이 보인 신고 id 들(`target_report_ids`)이
  서기 전의 파일이다
- **담기는 것** — 운영자 id · 시각 · 채널 · 동작 · 대상 신고 id(목록이면 발췌가 보인 신고 id 들) · 거른 조건 · CLI 의 목적 · 해시 · 실행자 이름 · 결과 ·
  CLI 결과. **결과(`outcome`)는 셋이다** — `allowed` · `denied`(운영자가 아닌 사람) · `refused`(운영자의 쓰기가 거절됨, 2026-10-17
  `20261219090000` 부터). 칸이 늘지 않아 머리의 `version` 은 3 그대로다 — 받는 쪽은 셋째 값을 안다(ADR 0191). **이용자 닉네임 · 메시지 본문 · 이메일은 없다** — Compliance 는 되돌릴 수 없다. 저장소에도 로그 원문을 넣지 않는다.
  **반출 파일의 운영자 UUID · 신고 id 도 개인정보에 준해 다룬다** — 다른 표와 이으면 사람을 가리킨다. 그래서 파일을 저장소 ·
  이슈 · 채팅에 붙이지 않고, 버킷의 읽기는 검증 역할 하나에만 연다(아래 9)
- **켜는 값 — 셋으로 갈린다**(Vercel Production)

  | 상태 | 값 | 크론 | DB 의 결과 |
  | --- | --- | --- | --- |
  | **꺼짐** | 다섯이 **모두** 비었다 | 200 `{"configured":false}` | `not_configured`, 알림 없음 |
  | **켜짐 — 역할(기본안)** | `AUDIT_EXPORT_BUCKET` · `AUDIT_EXPORT_REGION` · `AUDIT_EXPORT_ROLE_ARN` | 올린다 | `succeeded` / `failed` |
  | **켜짐 — 접근 키(대안)** | `AUDIT_EXPORT_BUCKET` · `AUDIT_EXPORT_REGION` · `AUDIT_EXPORT_ACCESS_KEY_ID` · `AUDIT_EXPORT_SECRET_ACCESS_KEY` | 올린다 | 같다 |
  | **오설정** | 그 밖 전부 — 하나라도 넣었는데 모자라거나, 역할과 접근 키를 함께 넣었다 | 500 | `misconfigured` + 분류(`missing:region` · `conflict:credentials`), 알림 |

  **2026-09-24 에는 AWS 계정이 없어 꺼져 있다**
- **실패** — 500 이고, Vercel 로그(1시간)만이 아니라 위 결과 표 · 알림 · 상태 질의에 선다. 기록은 DB 에 남아 다음 실행이
  이어 올린다

**마법사로 켠다 — 아래 1 ~ 9 를 차례대로 (2026-10-23)**

운영자는 AWS 계정을 만든 뒤 저장소 뿌리에서 한 줄을 친다:

```bash
bash scripts/aws-wizard.sh
```

`scripts/aws-wizard.sh` 는 아래 「사람이 켜는 걸음」 1 ~ 9 를 **같은 차례로** 밟는다 — 콘솔에서만 되는 것(계정 · 루트 MFA ·
관리자 사용자 · Vercel OIDC 켜기 · Redeploy)은 주소를 열고 무엇을 누를지 말한 뒤 기다리고, 나머지는 AWS CLI · Vercel CLI 로
한다. 준비물은 AWS CLI 2.32 이상(`aws login`)과 로그인된 Vercel CLI 다.

| 마법사 Stage | 이 절의 걸음 | 무엇을 |
| --- | --- | --- |
| 1 준비물 | — | CLI 둘, Vercel 팀 · 프로젝트 이름(기본 `sungheeyoons-projects` · `saju`) |
| 2 계정 · 루트 MFA | 1 | 콘솔 |
| 3 관리자 · CLI 로그인 | 1 | 콘솔에서 IAM 사용자 `saju-admin`(AdministratorAccess · SignInLocalDevelopmentAccess · MFA) → `aws login --profile saju-admin`. **루트로 로그인했으면 멈춘다** — 루트는 역할을 맡을 수 없어 9 의 검증 역할이 안 되고, CLI 에 루트를 쓰지 않는다 |
| 4 감사 버킷 | 2 | `saju-audit-<무작위 8자>` · 서울 · Object Lock(Versioning 함께) · Block Public Access 넷 · SSE-S3 기본 |
| 5 Governance 1일 | 3 | 기본 보존이 없을 때만 건다. 이미 Governance · Compliance 면 손대지 않는다 |
| 6 Vercel OIDC | 5-1 | 콘솔 — Issuer Mode **Team** |
| 7 OIDC 제공자 | 5-2 | `oidc.vercel.com/<팀>` · audience `https://vercel.com/<팀>` |
| 8 반출 역할 | 5-3 · 5-4 | `saju-audit-export` — 신뢰는 이 프로젝트의 `environment:production` 만, 권한은 `s3:PutObject` 를 `operator-access/*` 에 하나(인라인 `saju-audit-export-put`) |
| 9 검증 역할 | 9 | `saju-audit-verify` — `saju-admin` 사용자만 맡는다(`sts:AssumeRole`), `s3:GetObject`(`operator-access/*`) · `s3:ListBucket`(prefix 그것만). 이 기계의 `~/.aws/config` 에 프로필 `saju-audit-verify`(`source_profile = saju-admin`)를 맞춘다 |
| 10 Vercel 변수 | 6 | Production 에 셋 — `AUDIT_EXPORT_BUCKET` · `AUDIT_EXPORT_REGION` · `AUDIT_EXPORT_ROLE_ARN`(코드의 `configOf` 가 읽는 이름). 다른 값이 있으면 묻고, 접근 키 두 변수가 남아 있으면 오설정이라 알리기만 한다(지우지 않는다) |
| 11 Redeploy | 6 | 콘솔 — 최신 Production 을 Redeploy, Ready |
| 12 첫 반출 · 검증 | 3 · 7 · 9 | `vercel crons run /api/cron/audit-export` 로 한 번 돌리고 → 상태 질의 → 객체 수(검증 프로필) → `npm run audit:verify` → 객체 한 벌 버전째 지우기가 **막히는지** |
| 13 Compliance 400일 | 4 | **Governance 를 건 다음 날 이후에 12 가 초록일 때만**, 버킷 이름을 그대로 쳐야 옮긴다 |

- **두 번 돌려도 하나다.** 걸음마다 AWS 의 지금 상태를 읽고 있으면 다시 쓴다 — 버킷(상태 파일을 잃었으면 `saju-audit-` 로
  시작하는 버킷을 찾는다) · 제공자(ARN) · 역할(이름) · 권한 정책(이름이 같으면 덮어쓴다) · Vercel 변수(마법사가 넣은 값과 같으면
  건너뛴다). 그래서 **첫날 1 ~ 12 를 돌리고, 다음 날 같은 줄을 다시 치면 12 를 다시 재고 13 으로 간다** — runbook 3 의 「하루 돌려」다
- **멈추면 다시 친다.** 오류 · Ctrl-C · 「남은 것」이 있으면 같은 줄을 다시 치면 된 걸음은 건너뛴다. 버킷 이름은 만들기 **전에**
  상태에 적어, 만든 직후 멈춰도 다음 실행이 같은 버킷을 쓴다. Redeploy 전에 멈추면 다음 실행이 Redeploy 를 다시 묻는다
- **값은 저장소 밖** — `~/.config/saju/aws-wizard.env`(버킷 이름 · 역할 ARN · 계정 번호 · 걸음의 날짜). 비밀은 없다 — 마법사는
  열쇠를 만들지 않는다. 그래도 문서 · 채팅 · 커밋 · 이슈에 옮기지 않는다
- **접근 키(대안)는 마법사가 안 한다** — 아래 5 의 「대안」을 손으로 밟는다
- **사진 버킷은 자리만 있다** — 사진 저장(같은 계정 · 다른 버킷 · 다른 권한)은 열람 방식이 정해진 뒤 마법사의 9 와 10 사이에
  걸음을 더한다(스크립트의 「사진 버킷 — 자리만」 주석). 그 전에는 아무것도 만들지 않는다
- 시험: `scripts/aws-wizard.test.ts` — 가짜 `aws` · `vercel` · `npm` 으로 처음 · 재실행 · 부분 실패 · 재사용 · 전환의 순서를 잰다.
  진짜 AWS 는 운영자가 돌리는 날 아래 「성공 조건」이 잰다

**성공 조건 — 다 되면 이렇다**

- 마법사 끝에 「반출이 Compliance 400일로 돈다」가 서고 「남은 것」이 없다
- `select * from audit.export_status()`(위 「상태를 본다」)의 `last_outcome` 이 `succeeded`, `consecutive_failures` 0, `pending_rows` 가 작다
- `audit.operator_access_export` 에 범위가 적혀 있다 — #304 의 7 이 「끝」으로 보는 것이다
- 버킷의 기본 보존이 `COMPLIANCE 400`(`aws --profile saju-admin s3api get-object-lock-configuration --bucket <버킷>`)
- 이튿날 · 달마다 `npm run audit:verify`(아래 9)가 초록

**마법사가 멈췄을 때**

| 무엇이 보이나 | 까닭 | 할 것 |
| --- | --- | --- |
| 「Stage N/13 에서 멈췄다」 + 그 위에 `An error occurred (…)` | AWS 쪽 오류(일시 장애 · 권한 · 로그인 만료) | 같은 줄을 다시 친다. 또 멈추면 오류 이름으로 — `ExpiredToken` · 자격 없음이면 `aws login --profile saju-admin`, `AccessDenied` 면 `saju-admin` 에 AdministratorAccess 가 붙었는지 콘솔에서 본다 |
| 「준비물이 모자라」 · 「2.32 보다 낮다」 | CLI 가 없거나 낮다 · Vercel 로그인 안 됨 | 연 주소대로 깔거나 올리고, `vercel login` 뒤 다시 친다 |
| 「루트로 로그인됐다」 | `aws login` 에서 루트를 골랐다 | `aws logout --profile saju-admin` 뒤 다시 쳐서 `saju-admin` 으로 고른다 |
| 「버킷 이름 … 을 이 계정이 못 쓴다」 | 이름이 남의 것이다 | 상태 파일의 `AUDIT_EXPORT_BUCKET=` 줄을 지우고 다시 친다 — 새 이름을 짓는다 |
| 「Object Lock 이 꺼져 있다」 | 마법사 밖에서 만든 `saju-audit-*` 버킷이다 | 그 버킷은 반출에 쓰지 않는다. 비어 있으면 콘솔에서 지우고, 상태 파일의 `AUDIT_EXPORT_BUCKET=` 줄을 지운 뒤 다시 친다(남겨 두면 상태를 잃었을 때 다시 찾힌다) |
| 상태 파일을 잃었다 | 다른 기계 · 지움 | 그대로 다시 친다 — 자원은 이름으로 다시 찾는다. 콘솔 걸음(2 · 6 · 11)은 한 번 더 묻는다 |
| 12 의 `last_outcome` 이 `not_configured` | Redeploy 가 안 됐거나 변수가 Production 이 아니다 | 11 을 다시 — 변수의 Environment 가 Production 인지 본다 |
| `misconfigured` + `missing:…` · `conflict:credentials` | 변수가 모자라거나 역할과 접근 키가 함께 있다 | 위 「켜는 값」 표 — 접근 키 둘을 대시보드에서 지우고 Redeploy |
| `failed` + `upload:accessdenied` 등 `upload:…` | 역할을 못 받거나(OIDC 가 꺼짐 · 신뢰의 `sub` · `aud` 가 다름) 넣기가 거절됐다(권한 정책의 버킷 · prefix) | 6 이 Team 으로 켜졌는지, 7 의 팀 슬러그 · 8 의 프로젝트 이름이 맞는지 보고 다시 친다 — 신뢰 · 권한 정책은 다시 칠 때마다 맞춰진다. 그 뒤 Redeploy(OIDC 를 켠 뒤의 배포라야 토큰이 든다) |
| 객체가 없다 · `audit:verify` 가 붉다 | 반출이 아직 안 돌았거나 기록과 파일이 어긋난다 | 다음 날 03:37 뒤 다시 친다. 붉음이 이어지면 아래 9 의 출력(키와 어긋남의 이름)으로 본다 — **Compliance 로 가지 않는다** |
| 「지워졌다 — 보존이 안 걸렸다」 | 기본 보존이 객체에 안 걸렸다(시험 객체 하나가 지워졌다 — 반출 기록은 DB 에 남는다) | `get-object-lock-configuration` 으로 Governance 1일인지 본다. 지워진 범위는 DB 의 반출 기록에 남아 있다 — 같은 범위를 다시 올리는 도구는 없으니 그 객체 키와 날짜를 #304 7 의 댓글에 적고, 보존을 맞춘 뒤 다시 친다 |
| 13 이 「아직이다」 | Governance 를 건 날과 같은 날이거나 12 가 초록이 아니다 | 다음 날 다시 친다 — runbook 3 → 4 의 차례다 |
| Compliance 를 잘못 걸었다 | — | **되돌릴 수 없다**(루트도). 그래서 13 은 이름을 쳐야 간다. 400일 동안 객체가 쌓이는 비용만 남는다 |

**사람이 켜는 걸음 — AWS (한 번)** — 마법사가 차례대로 밟는 원본이다

1. **계정을 연다.** 루트 사용자에 MFA 를 건다(G-23 ⑨ 목록에 AWS 가 있다). 루트로는 아래 2 ~ 4 만 하고 그 뒤로 안 쓴다.
   마법사는 루트로 관리자 사용자 `saju-admin` 하나만 만들고 2 ~ 9 를 그 사용자로 한다 — 루트는 역할을 맡을 수 없어 9 의
   검증 역할에 쓸 수 없다
2. **버킷을 만든다 — 서울 `ap-northeast-2`**, 이름 예 `saju-audit-<무작위 몇 자>`. 만들 때 **Object Lock 을 켠다**(켜면
   Versioning 이 함께 켜지고 끌 수 없다). Block Public Access 넷 다 켠다. 암호화는 기본(SSE-S3)
3. **Governance 로 잰다.** 버킷 → Properties → Object Lock → Default retention: **Governance, 1일.** 반출을 켜고(아래 5 ·
   6) 하루 돌려 객체가 서는지, 아래 9 의 검증이 초록인지, 지우기가 막히는지(`DeleteObject` 에 버전 id → AccessDenied)를
   본다. Governance 는 `s3:BypassGovernanceRetention` 권한으로 풀 수 있다 — 잘못 올린 시험 객체는 이때 지운다
4. **Compliance 400일로 옮긴다 — 3 의 검증이 끝난 뒤에만.** Default retention: **Compliance, 400 days.** 이 뒤에 올라온
   객체는 루트도 못 지우고 400일 전에는 못 줄인다. **Governance 동안 올라간 객체는 Governance 그대로다** — 필요하면 객체마다
   보존을 Compliance 로 올린다(늘리기만 된다). G-25 가 2년이라 하면 만료 전에 이미 있는 객체의 보존일을 늘리고
   (`PutObjectRetention`) 기본값을 730일로 바꾼다
5. **반출 역할을 만든다 — 기본안: Vercel OIDC → IAM 역할(단기 자격).** 오래 사는 키가 어디에도 없다.
   1. Vercel 프로젝트 Settings → Security → **OIDC Federation** 을 켠다(Team 발급자 `https://oidc.vercel.com/<팀 슬러그>`)
   2. AWS IAM → Identity providers → OpenID Connect 로 그 발급자를 더한다. Audience 는 `https://vercel.com/<팀 슬러그>`
   3. IAM → Roles → `saju-audit-export` 를 만든다. **신뢰 정책**은 그 발급자의 이 프로젝트 · Production 만 믿는다:

      ```json
      {
        "Version": "2012-10-17",
        "Statement": [{
          "Effect": "Allow",
          "Principal": { "Federated": "arn:aws:iam::<계정>:oidc-provider/oidc.vercel.com/<팀 슬러그>" },
          "Action": "sts:AssumeRoleWithWebIdentity",
          "Condition": {
            "StringEquals": {
              "oidc.vercel.com/<팀 슬러그>:aud": "https://vercel.com/<팀 슬러그>",
              "oidc.vercel.com/<팀 슬러그>:sub": "owner:<팀 슬러그>:project:<프로젝트 이름>:environment:production"
            }
          }
        }]
      }
      ```

   4. **권한 정책은 그 버킷의 그 prefix 에 넣기 하나다:**

      ```json
      {
        "Version": "2012-10-17",
        "Statement": [
          { "Effect": "Allow", "Action": "s3:PutObject", "Resource": "arn:aws:s3:::<버킷>/operator-access/*" }
        ]
      }
      ```

      읽기 · 지우기 · 보존 변경 권한이 없다 — 자격이 새도 올린 객체를 못 지우고 못 읽는다
   5. 발급자 · audience · `sub` 의 정확한 모양은 켜는 날 Vercel 문서(<https://vercel.com/docs/oidc/aws>)로 다시 본다 —
      2026-09-24 에는 계정이 없어 못 쟀다. 2026-10-23 에 문서(갱신 2026-08-28)로 다시 봤다 — Team 발급자 · audience ·
      `sub` 의 모양이 위와 같다. 제공자를 만들 때 thumbprint 는 넣지 않아도 IAM 이 가져온다(`create-open-id-connect-provider`
      CLI 참조). 코드는 `@vercel/oidc` 의 토큰을 `AssumeRoleWithWebIdentity`(세션 이름
      `saju-audit-export`)로 바꾼다(`app/api/cron/audit-export/s3.ts`)

   **대안 — 접근 키.** 역할을 못 세운 날만. IAM → Users → `saju-audit-export`(콘솔 접근 없음)에 위 4 의 정책을 인라인으로
   걸고 Access key 를 하나 만든다. 90일마다 바꾼다(`docs/ops/runbook/secret-leak.md` 「비밀이 새면」 표의 `AUDIT_EXPORT_*` 줄)
6. **Vercel 에 넣는다** — Settings → Environment Variables → **Production**: 기본안은 `AUDIT_EXPORT_BUCKET` ·
   `AUDIT_EXPORT_REGION`(`ap-northeast-2`) · `AUDIT_EXPORT_ROLE_ARN` 셋, 대안은 역할 대신 접근 키 둘(Sensitive). **둘을 함께
   넣으면 오설정이다.** Deployments 의 최신 Production 을 Redeploy 하고 Ready 를 본다. 넣는 값은 문서 · 채팅 · 커밋에 적지 않는다
7. **확인한다** — 다음 날 위 상태 질의의 `last_outcome` 이 `succeeded` 이고 `pending_rows` 가 작으며, S3 콘솔에 같은 키의
   객체가 있고 Object Lock 이 걸려 있다
8. **교체** — 역할은 교체할 열쇠가 없다. 접근 키면 `docs/ops/runbook/secret-leak.md` 「비밀이 새면」 표의 `AUDIT_EXPORT_*` 줄
9. **검증 역할과 검증** — 반출의 쓰기 역할과 **따로** 읽기 역할 `saju-audit-verify` 를 둔다: `s3:GetObject` ·
   `s3:ListBucket` 을 그 버킷의 `operator-access/*` 에만, 사람의 AWS 프로필(SSO 나 MFA 가 걸린 사용자)에서만 받는다. Vercel 에는
   넣지 않는다. 그리고 **월 점검마다 한 번**(그리고 3 의 Governance 확인 때):

   ```bash
   AWS_PROFILE=saju-audit-verify AUDIT_VERIFY_BUCKET=<버킷> AUDIT_VERIFY_REGION=ap-northeast-2 npm run audit:verify
   ```

   `scripts/audit-verify.mjs` 가 `npm run db:remote -- --json` 으로 반출 기록(범위 · 행 수 · sha256 · 객체 키)을 읽고(`--json` 은
   본 질의도 JSON 으로 받는다 — 없으면 사람의 셸에서는 표가 온다, #431), 객체마다 내려받아
   머리와 기록 · 본문 해시 · 줄 수 · 번호 차례 · 범위 이음을 견준다. 어긋나면 키와 어긋남의 이름만 찍고 1 로 끝난다(본문은 안
   찍는다). `-- --since <첫 번호>` 로 그 뒤만 본다

**사람이 할 걸음(그 밖).**

1. Supabase <https://supabase.com/dashboard/account/audit> 에서 가장 오래된 줄의 날짜를 보고 위 표의 「모름」을
   값으로 바꾼다
2. GitHub 보안 로그는 90일이라 **분기마다 한 번** <https://github.com/settings/security-log> → Export → JSON 을
   저장소 밖(개인 보관소)에 쌓는다 — 개인정보처리시스템은 아니지만 비밀값이 생기는 날 필요해진다
3. PG사(PortOne 을 거치면 PortOne)와 계약할 때 관리자 화면 접속기록 보존 기간을 묻는다(G-21 — PG 와 연동 방식은 미정, ADR 0194)

## 운영 주기 — 신고 · 접속기록 · 부재 (ADR 0105)

**내부 운영 목표다 — 이용자에게 약속한 것이 아니다.** 화면과 처리방침은 이 주기를 말하지 않는다.

| 무엇 | 언제 | 어떻게 |
| --- | --- | --- |
| 신고 | **영업일마다** 처리 필요(안 봤거나 추가 확인 필요) 목록을 본다. **접수 뒤** 늦어도 3영업일 안에 1차 판단 — 추가 확인 필요로 보류해도 시계는 접수부터다(ADR 0107) | `/ops/reports?review=open` → 판단 → 신고 상세의 처분 칸(ADR 0188). 화면이 안 되면 `docs/ops/runbook/moderation.md` 「신고와 차단」의 검토 문. 3영업일 넘긴 것은 같은 절의 둘째 질의 |
| 접속기록 | **매월 1회 이상** | 아래 「월 점검」 |
| 자리를 비울 때 | **3영업일을 넘기면 새 가입을 닫는다** — 신고를 볼 사람이 없는 동안 새 사람을 들이지 않는다 | `docs/ops/runbook/signup.md` 「가입을 닫고 연다」 |

### 월 점검 — 개인정보 없이

넷을 본다 — 이상 접근 · 대량 열람 · 업무시간 밖 열람 · 연속 거절. 그리고 **반출이 이어지는가** — 「반출」의 상태 질의
(`audit.export_status()` — 마지막 성공 · 연속 실패 · 밀린 행 수)와, AWS 가 켜진 뒤에는 검증(`npm run audit:verify`).
CLI 질의 가운데 결과 줄(`cli.result`)이 없는 `cli.query` 는 중간에 끊긴 실행이다 — 예외 둘만 빼고. ① #209 머지
(`c2d4dad`, 2026-09-24 00:15:03Z) 전의 실행은 결과를 적는 코드가 없던 때다. ② 그 뒤부터 #430 머지(`a8f3df1`,
2026-10-02 10:31:40Z) 전까지 **사람의 셸에서 돈** 실행은 파서 버그로 결과 줄이 안 남았다 — supabase CLI 2.115 가 사람의
셸이면 표, 에이전트 세션이면 JSON 봉투를 내는데 `db:remote` 는 봉투만 읽었다(#430). 2026-10-02 에 잰 값으로 그런 줄은
3건(2026-09-25 13:53:58Z ~ 2026-10-02 10:29:54Z)이고, 끊긴 실행의 증거가 아니다. 지난 결과 줄은 소급해 만들지 않는다.
질의는 전부 **보통 질의**다(id · 수 · 시각뿐, 이메일과
본문이 없다). `npm run db:remote -- --purpose "접속기록 월 점검 <YYYY-MM>" "<sql>"` 로 부른다. 결과는 저장소 밖 점검 기록에
날짜 · 본 사람 · 이상 여부 · 조치를 한 줄씩 적는다.

```sql
-- 1. 누가 얼마나 — 운영자 id(또는 CLI 실행자)별 지난달 동작 수와 성공/거절
select coalesce(actor_user_id::text, actor_name) as 누구, channel, action, outcome, count(*)
from audit.operator_access
where at >= date_trunc('month', now() at time zone 'Asia/Seoul') - interval '1 month'
  and at <  date_trunc('month', now() at time zone 'Asia/Seoul')
group by 1, 2, 3, 4 order by 5 desc;

-- 2. 대량 열람 — 한 사람이 한 시간에 상세 · 스냅샷을 서른 건 넘게 연 때
select coalesce(actor_user_id::text, actor_name) as 누구, date_trunc('hour', at) as 시각,
       count(distinct target_report_id) as 연_신고
from audit.operator_access
where action in ('reports.detail', 'reports.snapshot') and at > now() - interval '31 days'
group by 1, 2 having count(distinct target_report_id) > 30 order by 3 desc;

-- 3. 업무시간 밖 — 서울 22시 ~ 07시 · 주말의 열람
select coalesce(actor_user_id::text, actor_name) as 누구, at at time zone 'Asia/Seoul' as 서울, action, target_report_id
from audit.operator_access
where at > now() - interval '31 days'
  and (extract(hour from at at time zone 'Asia/Seoul') not between 7 and 21
       or extract(isodow from at at time zone 'Asia/Seoul') > 5)
order by at;

-- 4. 연속 거절 — 운영자가 아닌 계정이 운영자 문을 두드린 흔적
select actor_user_id, count(*) as 거절, min(at) as 처음, max(at) as 마지막
from audit.operator_access
where outcome = 'denied' and at > now() - interval '31 days'
group by 1 order by 2 desc;

-- 4-2. 거절된 운영자 쓰기 — 운영자 · 동작 · 코드별(ADR 0191). 한 사람의 버전 충돌(55000)이 잦으면 두 운영자가 같은 일을 나란히 하고
--      있다, 모양(22023)이 잦으면 화면이 문과 어긋났다
--      장애 알림 `operator-refusal-cap:<운영자 id>` 가 왔으면 그 운영자의 거절이 한 시간 30줄을 넘어 그 뒤가 버려졌다(하루 한 번,
--      `20261220090000`) — 이 질의로 무엇이 잦은지 본다. 버려진 줄은 어디에도 없다
select actor_user_id, action, substring(filter_summary from 'refused=(\S+)$') as 코드, count(*)
from audit.operator_access
where outcome = 'refused' and at > now() - interval '31 days'
group by 1, 2, 3 order by 4 desc;

-- 5. 반출이 이어지는가 — 마지막 반출 시각, 범위의 틈, 아직 안 나간 줄
select max(exported_at) as 마지막_반출,
       (select count(*) from audit.operator_access a
        where a.id > coalesce((select max(last_id) from audit.operator_access_export), 0)) as 안_나간_줄
from audit.operator_access_export;
select e.first_id, lag(e.last_id) over (order by e.first_id) as 앞_끝
from audit.operator_access_export e order by e.first_id;   -- 앞_끝보다 한참 큰 first_id 는 되감긴 번호다 — 행 수는 반출 때 견줬다

-- 6. 신고가 밀렸나 — 처리 필요와 그중 접수 뒤 3영업일을 넘긴 수(ADR 0107). 0 이 아니면 `docs/ops/runbook/moderation.md` 「신고와 차단」의 둘째 질의로 본다
select count(*) as 처리_필요,
       count(*) filter (where (select count(*) from generate_series(created_at::date + 1, current_date, interval '1 day') d
                               where extract(isodow from d) < 6) > 3) as 삼영업일_넘김
from public.report where public.report_is_open(reviewed_at, review_outcome);
```

**이상이면** — 운영자 본인이 한 것이 아니면 곧 `docs/ops/runbook/secret-leak.md` 「비밀이 새면」으로 간다(Supabase · 구글 계정 세션 끊기, 운영자 표에서 그
계정 내리기). 4 에 같은 계정이 여럿이면 그 UUID 로 신고 · 이용 정지를 본다. 5 의 마지막 반출이 이틀보다 오래면 Vercel 의
Cron 실행 기록과 환경변수를 본다. 처리 결과를 점검 기록에 적는다.

## 운영 의존성 취약점 — CI 의 `audit` 이 붉을 때 (G-23 ①, ADR 0104)

`audit` 차선은 `npm audit --omit=dev --audit-level=high` 다. **의존성 목록을 바꾼 PR** 과 **main 푸시 · 하루 한 번의
일정**에서 돈다. PR 에서 붉으면 그 PR 이 들인 것이고, main 에서 붉으면 `ci-main-red` 이슈가 「붉은 차선」을 적는다 —
`audit` 만이면 커밋이 아니라 새로 뜬 advisory 다. 어느 쪽이든 새 작업보다 먼저 한다.

```bash
npm audit --omit=dev                 # 무엇이 · 어느 판에서 · 고친 판이 있나
npm ls <패키지>                       # 누가 끌어왔나 — 직접 의존이면 package.json, 아니면 부모
npm install <패키지>@<고친 판>        # 직접 의존. 간접이면 부모를 올리거나 package.json 의 overrides
npm audit --omit=dev --audit-level=high ; echo $?   # 0 이어야 한다
```

1. **올린다.** 같은 메이저 안이면 올리고 끝이다. 메이저를 넘거나 `overrides` 로 누르면 그 판이 부모와 맞는지
   `npm run build` 와 e2e 로 본다 — `next` 가 그런 자리다(`1e1f6c8` 은 16.3.1 → 16.3.6).
2. **잠금 파일이 맞는지 `npm ci` 로 본다.** `npm audit fix` 가 `@emnapi/*` 를 `package-lock.json` 과 어긋난 채 두었고,
   `npm install` 한 번이 다시 맞췄다(2026-10-07, #515). CI 의 차선은 `npm ci` 로 깐다(`.github/workflows/verify.yml`).
3. **PR 은 `fix(deps): ...`** 로 낸다. 잠금 파일이 바뀌므로 그 PR 에서 `audit` 이 다시 돌아 0 을 잰다.
4. **고친 판이 아직 없으면** 막을 자리를 본다 — 그 경로를 우리가 부르나(`npm audit` 의 advisory 본문). 안 부르면
   간극 대장 G-23 ① 에 패키지 · advisory · 까닭 · 다시 볼 날을 적고, 그동안 붉은 main 은 이슈가 들고 있다.
   `--audit-level` 을 critical 로 올리거나 차선을 끄지 않는다.

개발 의존성(`npm audit` 전체)은 CI 가 안 막는다 — 운영에 안 실린다. 같은 절차로 손으로 정리한다(G-23 ⑫).
