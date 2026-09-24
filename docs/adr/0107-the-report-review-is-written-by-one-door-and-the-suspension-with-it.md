# 신고 검토는 문 하나가 적고, 이용 정지 결정은 그 자리에서 계정을 정지하며, 처리 필요는 추가 확인 필요까지다

ADR 0105 가 신고 곁에 검토 기록(검토한 운영자 · 결과 · 판단 근거 · 제재 대상 · 실행한 운영자)을 세우고 채우는 손을 runbook 의
검토 SQL 로 두었다. ADR 0103 은 목록을 「검토 전 / 검토함」으로 걸렀다. 2026-09-24 에 운영자가 정책과 문구를 확정했고
(아래 「운영자 승인」), 이 ADR 이 그것을 적는다. **ADR 0103 과 ADR 0105 를 고친다** — 아래 「고치는 것」.
마이그레이션은 `20261016090000_the_report_review_is_written_by_one_door_with_its_sanction.sql`.

## 잰 것 — 고치기 전에

로컬 스택에서 되돌린 트랜잭션으로 검토 기록의 모양을 하나씩 넣어 봤다(문구 설명서, 2026-09-24).

- **기록과 제재가 서로 몰랐다.** runbook 의 검토 SQL 은 UPDATE 둘이었다 — 신고에 `suspension` 을 적고, 따로 `app_user.status`
  를 `suspended` 로. 둘째를 빠뜨려도 통과했고, 상세 화면에서는 「해제한 뒤」와 「정지를 안 건 것」이 똑같이 보였다.
- **통과하면 안 되는 넷이 통과했다** — `no_action` 에 제재 대상 · `warning` 에 제재 대상 없음 · 결과 없이 제재 대상만 ·
  운영자가 아닌 UUID 를 검토한 사람으로(외래키가 없고, 화면은 「닉네임 없음」).
- **`needs_more`(추가 확인)가 「검토함」으로 분류됐다** — `reviewed_at` 이 차야 결과를 적을 수 있으므로, 보류한 건이 미검토
  목록 · runbook 의 미검토 · 3영업일 질의에서 다 빠졌다. 다시 볼 목록이 없었다.
- **`retention.report` 에는 칸 모양 검사만 있었다** — 논리 제약(결과에는 검토한 사람 · 제재는 두 계정 중 하나 …)이 없었다.
- 같은 날 운영 DB 는 `public.report` · `retention.report` 둘 다 **0줄**이었다(`npm run db:remote` 로 건수만). 새 제약을 어길
  줄이 없다.

## 정한 것

**1. 처리 필요 = 안 봤거나(`reviewed_at is null`) 추가 확인 필요(`review_outcome = 'needs_more'`).** 처리 완료는 조치 없음 ·
경고 · 이용 정지 결정과, 결과 칸이 생기기 전에 본 옛 검토(시각만 있고 결과가 없는 줄 — 지금 분류를 그대로 둔다)다. 정의는
`public.report_is_open(reviewed_at, review_outcome)` 한 곳이고 목록 문(`operator_reports` 의 거르기와 줄마다 내는 `is_open`) ·
상세 문(`operator_report` 의 `is_open`) · runbook 의 미검토 · 3영업일 질의 · 월 점검이 그것을 부른다. 화면은 문이 낸
`is_open` 을 그대로 글자로 옮긴다 — 정의를 앱에 다시 적지 않는다. 목록 문의 인자 이름 `p_reviewed` 는 옛 앱이 부르는 그대로
두고 뜻만 「처리 완료인가」가 된다. 접속기록의 거른 조건은 `review=open|done|all` 로 적힌다.

**2. 3영업일은 처음 접수한 시각(`created_at`)부터 센다.** 추가 확인 필요로 보류해도 시계는 처음으로 안 돌아간다.

**3. 검토를 적는 길은 문 하나 — `public.review_report(p_report_id, p_reviewer, p_outcome, p_note, p_sanctioned_user_id)`.**
운영자가 CLI(`npm run db:remote -- --purpose …`)로 부른다 — 목적과 해시가 접속기록에 남는다(ADR 0105). `auth.uid()` 가 없으므로
검토한 운영자를 인자로 받고 **`public.operator` 에 없으면 `42501`** 이다. 실행한 운영자(`sanctioned_by`)는 검토한 운영자다.
결과가 없으면 `22023`, 없는 신고는 `P0002`. 지금 계정의 신고(`public.report`)에 없으면 떠난 사람의 신고(`retention.report`,
ADR 0098)에 적는다 — 돌려주는 값이 어느 표인지(`report` · `retention`) 말한다. API 역할 넷(`public` · `anon` · `authenticated` ·
`service_role`)에는 안 열린다. 화면에 쓰는 누름은 여전히 없다(ADR 0103).

**4. 이용 정지 결정은 기록과 계정 정지가 한 트랜잭션이다.** `suspension` 이면 문이 같은 트랜잭션에서 제재 대상의
`app_user.status` 를 `suspended` 로 옮긴다. 어느 쪽이 실패해도 둘 다 되감긴다 — 탈퇴를 신청한 계정은 계정 검사식이 정지를
거절하므로 기록도 안 남고, 판단 근거가 500자를 넘으면 계정도 정지되지 않는다. 떠난 사람의 신고에 정지를 적는데 그 계정이
없으면 거절한다(`P0002`) — 정지할 계정이 없는데 정지했다고 적지 않는다. **이 보장은 적는 순간에만이다.** 「이용 정지 결정」
줄이 있는 동안 계정이 계속 정지여야 한다는 영구 제약은 두지 않는다 — 해제해도(runbook 「이용 정지와 해제」) 기록은 그때의
판단으로 남는다. 지금 정지인가는 여전히 `app_user.status` 하나가 답한다.

**5. 결과와 제재 대상이 맞물린다 — 표의 제약 `sanction_follows_the_outcome`.** 경고 · 이용 정지 결정은 제재 대상과 실행한
운영자가 둘 다 있어야 하고, 조치 없음 · 추가 확인 필요 · 결과 없음은 둘 다 없어야 한다. `suspension_names_who` 는 여기에
들어가므로 걷었다. `retention.report` 에도 `public.report` 의 논리 제약 다섯(`review_has_a_reviewer` ·
`review_note_needs_an_outcome` · `sanction_falls_on_a_party` · `sanction_has_an_actor` · `sanction_follows_the_outcome`)을 같은
이름으로 건다 — 계정의 **지금** 상태는 어느 표에서도 검사하지 않는다(떠난 사람은 계정이 없다). 옮기는 트리거는
`public.report` 의 줄을 그대로 베끼므로 옮긴 줄은 같은 제약을 이미 지킨다(pgTAP `52_report_review_door` 가 경고 줄을 옮겨 잰다).

**6. 경고를 이용자에게 알리는 길은 아직 없다** — 간극 대장 G-57 이 든다. 경고는 지금 운영자 기록일 뿐이다.

## 운영자 승인 (2026-09-24) — 화면 글자

| 자리 | 전 | 후 |
| --- | --- | --- |
| `/me/people` 찾는 칸 아래 결과 수 | `N명` | `검색 결과 N명` (0명의 `찾는 사람이 없습니다` 는 그대로) |
| 검토 결과 `suspension` | 이용 정지 | 이용 정지 결정 |
| 검토 결과 `needs_more` | 추가 확인 | 추가 확인 필요 |
| 상세 항목 제목 | 제재를 받은 쪽 | 당시 제재 대상 |
| 목록 거르기 · 배지 · 상세 상태 | 검토 전 / 검토함 | 처리 필요 / 처리 완료 |

`no_action`(조치 없음) · `warning`(경고)과 계정 상태 글자(이용 중 · 이용 정지 · 탈퇴 대기)는 그대로다. 「이용 정지 결정」은 계정의
지금 상태 「이용 정지」와 같은 글자가 되지 않게 한 것이다(해제 뒤 한 카드에 둘이 같이 서던 혼동). 따라 바뀐 운영자 글자 둘 —
거르기 묶음 이름 「검토 상태」 → 「처리 상태」, 상세 항목 제목 「검토 상태」 → 「처리 상태」 — 은 ADR 0103 의 `/ops/**` 예외로
맞췄다. 주소의 값도 `?review=unreviewed|reviewed` → `?review=open|done` 으로 옮겼다(모르는 값은 거르지 않은 것으로 읽는다).

## 고치는 것

- **ADR 0103** — 「검토 여부는 `reviewed_at` 이 있는가 하나다」 → 처리 여부는 `report_is_open` 하나다(1). 목록 거르기
  「검토 전 / 검토함」 → 「처리 필요 / 처리 완료」.
- **ADR 0105** — 「채우는 손은 runbook 의 검토 SQL 이다」 → 채우는 손은 검토 문 `review_report` 하나다(3). 「기록과 `status`
  는 따로」 → 이용 정지 결정은 적는 순간 계정 정지와 한 트랜잭션이다(4). 「3영업일 안에 1차 판단」의 대상은 처리 필요 전체이고
  시계는 접수부터다(1 · 2).

## 정정 (2026-09-24) — 같은 신고를 거듭 막는 판단도 처리 필요다

아래 「잠그지 않은 것」에 남겨 둔 한 자리를 조율자가 정했다(같은 날). 고친 것은
`20261017090000_the_held_report_still_counts_as_a_duplicate.sql`.

- **잰 값.** 두 신고 문(`report_user` · `report_chat_message`)의 중복 판단이 `reviewed_at is null` 이라, 추가 확인 필요로 보류한
  동안 같은 사람 · 같은 사유(메시지 신고는 같은 메시지 · 같은 사유)의 신고가 또 쌓였다 — 운영자 목록에는 같은 건이 처리 필요로
  둘 섰다. pgTAP `53_report_duplicate_is_open` 이 고치기 전 12 중 6 붉었다(두 문의 보류 중 거절 둘, 그 뒤를 잇는 둘, 판단의 모양 둘).
- **정한 것.** 중복 판단은 목록 · runbook 질의 · 월 점검과 같은 `report_is_open(reviewed_at, review_outcome)` 을 부른다. 추가 확인
  필요로 보류한 신고와 같은 신고는 「이미 접수」(`23505`)로 거절하고, 조치 없음 · 경고 · 이용 정지 결정으로 끝났거나 옛 검토(결과
  없음)면 전처럼 다시 낼 수 있다. 문구 · 판정 순서(중복이 하루 수보다 먼저) · 하루 수는 그대로다.
- **받치는 인덱스.** `report_unreviewed_by_pair`(`where reviewed_at is null`)는 새 판단을 못 받친다. `report_is_open(...)` 을 술어로
  단 부분 인덱스는 로컬 EXPLAIN 에서 쓰였지만 그 함수를 `create or replace` 로 고치면 인덱스가 옛 정의로 남아 조용히 틀린 답을
  낸다 — 정의의 둘째 사본이 된다. 그래서 술어 없는 `report_by_pair (reporter_user_id, reported_user_id, reason)` 로 바꿨다. 같은
  두 사람 · 같은 사유의 줄은 중복이 막아 몇 줄뿐이다. 메시지 신고는 전처럼 `chat_report_snapshot_by_message` 가 받친다.

## 잠그지 않은 것

- 실행한 운영자(`sanctioned_by`)는 화면에 안 선다 — 상세의 「당시 제재 대상」은 기록된 `sanctioned_user_id` 를 신고 안의 자리로만
  말한다.
- 신고한 사람은 여전히 제 신고의 `reviewed_at` 을 API 로 읽는다(ADR 0105 의 칸 일곱) — 결과 · 근거 · 제재는 못 읽는다.
- 검토 문을 부르는 것이 접속기록에 남는 것은 CLI 의 목적 · 해시 한 줄이다 — 문 자체는 따로 적지 않는다.
