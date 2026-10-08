# 운영 절차 — 지우기 · 떠난 사람의 신고 기록 · 탈퇴

색인은 `docs/ops/runbook.md` 다.

## 지우기

**「그만두기」와 「지우기」는 다른 일이다.** 매칭 참여를 끄는 것은 상태이고(ADR 0014)
계정 중지도 상태다. 여기 적힌 것은 되돌릴 수 없는 쪽이다.

### 한 사람

```sql
select * from public.forget_user('<user uuid>');
--  people_forgotten
```

한 문장이면 된다. `auth.users` 하나가 사라지면 `app_user` 가 따라가고 거기서 서른 갈래
남짓이 FK 로 따라간다(2026-09-23 에 31) — Person 엣지·discovery·요청·결과·시도·풀이 설문·서비스
설문·알림·차단·신고·활동 시각. **Match · 대화방 · 메시지는 따라가지 않고 그 사람의 칸만 빈다**
(ADR 0094, 아래). (세어 보려면 `pg_constraint` 에서 `app_user` 를 가리키는 FK 를 센다 — `confdeltype`
이 `n` 인 여섯이 자리만 비는 칸이다.)
그다음 **이 사람이 관리하던 Person 중** 아무도 안 보게 된 것을 지운다(ADR 0023) — 출생
입력은 그 행에 있으므로 함께 사라진다.
남이 놓고 간 고아는 안 건드린다 — 그것은 종료 파기의 일이다.

무엇이 함께 사라지는지 **누르기 전에** 알아야 한다.

- **함께 보던 궁합이 상대 화면에서도 사라진다.** 그 사람의 동의 당시 여덟 글자가 비고 그 Match 의
  궁합풀이와 시도가 지워진다(트리거 둘, ADR 0094). 상대의 Match 목록과 공유 결과에는 이미 없다 —
  `visible_matches()` 가 상대가 `active` 인지 묻는다. **Match 행은 대화방의 닻으로 남는다.**
- **대화방과 메시지는 상대에게 남는다.** 그 사람의 자리(참여자 · 닫은 사람 · 보낸 사람)만 빈다.
  상대는 방을 계속 보고 이름 자리에 「탈퇴한 사용자」가 선다. 열려 있던 방은 이 순간 닫힌다
  (`deletion_request`, 지금) — 보존 90일은 닫힌 날부터다(`docs/ops/runbook/moderation.md` 「채팅」). **둘 다 떠나면** Match 째
  사라지고 방 · 메시지가 따라간다.
- **남이 관리하는 Person 은 남는다.** 「누가 만들었나」만 비워진다.
- **신고 기록은 따로 남는다**(ADR 0098). 신고한 쪽이든 신고당한 쪽이든, 지워지기 **전에** 트리거가
  그 사람이 든 신고와 스냅샷을 `retention.report` 로 옮기고 일반 표에서는 사라진다. 처분일부터 6개월
  뒤 크론이 지운다 — 아래 「떠난 사람의 신고 기록」.

**다시 못 들어오게 하는 것은 이 문이 아니다.** 삭제는 접근 회수가 아니고(`docs/ops/runbook/signup.md` 「초대」 절과
같은 구분), 코드는 사람에 매여 있지 않다 — 지운 사람이 같은 코드를 아직 들고 있으면 그
코드가 살아 있는 동안에는 다시 들어올 수 있다. 막으려면 **그 코드를 닫는다.**

```sql
-- 정원은 1 아래로 못 내린다(검사식 `max_uses between 1 and 1000`) — 사는 하루를 어제로 옮겨 닫는다
update public.signup_code set valid_on = (now() at time zone 'Asia/Seoul')::date - 1, valid_until = (now() at time zone 'Asia/Seoul')::date - 1
where code = '<그 사람에게 준 코드>';
```

### 종료일이 되면 — **저절로 닫힌다**

종료일이 지나면 `is_active_account()` 가 거짓이 되어 discovery·요청·수락·풀이 생성·설문이
한꺼번에 닫히고, `/me` 아래는 「비공개 테스트가 끝났습니다」로 선다. 운영자가 그날 무엇을
누르지 않아도 된다 — 날짜가 집행한다.

```sql
-- 닫혔는지 본다
select public.beta_is_over(), * from public.current_beta_schedule();
```

미루려면 새 줄을 넣는다(`docs/ops/runbook/signup.md` 「테스트 시작하기」). 넣는 순간 다시 열리고, **모두가 안내를
다시 본다** — 기간이 바뀌는 것은 알린 내용이 바뀌는 것이다.

파기는 저절로 안 된다. 아래를 손으로 돈다.

### 베타 종료 — 전부

```sql
-- 무엇을 지울 것인지 먼저 본다. 세어 보지 않고 지우지 않는다.
select count(*) as 계정 from auth.users;
select count(*) as 사람 from public.person;
```

```sql
-- 하나씩 잊는다. **전체가 한 트랜잭션이다** — 한 명에서 실패하면 앞에서 지운 사람까지
-- 전부 되돌아간다. 그게 맞다: 절반만 지워진 상태로 끝나는 것보다 아무것도 안 지워진
-- 상태에서 이유를 보고 다시 도는 편이 낫다. 어디서 멈췄는지는 notice 가 말한다.
do $$
declare victim uuid;
begin
  for victim in select id from auth.users loop
    raise notice '잊는 중: %', victim;
    perform public.forget_user(victim);
  end loop;
end $$;
```

```sql
-- 사람마다의 삭제는 **그 사람이 관리하던 Person 만** 정리한다(ADR 0023). 아무도
-- 관리한 적 없던 고아는 그 반복으로 안 사라지므로, 여기서 한 번 쓸어 낸다.
select public.forget_orphan_people();
```

```sql
-- 남은 것이 없어야 한다. 남았다면 그것이 이 절차의 구멍이다.
--
-- **FK 로 안 따라오는 것들이 이 목록에 있다.** `reading_webhook_event` 는 어느 표에도
-- 안 매여 있고(도착을 적는 영수증이라 그렇다), 감사 로그와 flow state 는 `forget_user`
-- 가 손으로 지운다 — 둘 다 사용자에 매여 있지 않다.
select
  (select count(*) from auth.users)                  as 계정,
  (select count(*) from auth.audit_log_entries)      as 감사로그,
  (select count(*) from auth.flow_state)             as 로그인중간상태,
  (select count(*) from public.signup_code)          as 가입코드,
  (select count(*) from public.person)               as 사람,
  (select count(*) from public.reading)              as 결과,
  (select count(*) from public.reading_run)          as 시도,
  (select count(*) from public.reading_job)          as 일감,
  (select count(*) from public.reading_feedback)     as 풀이설문,
  (select count(*) from public.service_survey)       as 서비스설문,
  (select count(*) from public.notification)         as 알림,
  (select count(*) from public.match)                as 매치,
  (select count(*) from public.chat_room)            as 대화방,
  (select count(*) from public.report)               as 신고,
  (select count(*) from public.chat_message)         as 메시지,
  (select count(*) from public.chat_report_snapshot) as 신고스냅샷,
  (select count(*) from public.profile_photo)        as 프로필사진,
  (select count(*) from public.reading_webhook_event) as 영수증;

-- **0 이 아닌 것이 맞는 자리 하나** — 떠난 사람의 신고 기록. 종료 파기도 탈퇴와 같은 문이라 처분일부터
-- 6개월 남고 크론이 지운다(ADR 0098). 크론을 끄지 않는다.
select count(*) as 따로둔_신고, min(retained_at) + retention.report_period() as 가장_이른_파기
from retention.report;
```

**프로필 사진은 손으로 안 지운다.** 바이트가 Postgres 안에 있고 `app_user` 에 cascade 로
매여 있어서, 계정이 사라지면 함께 사라진다(ADR 0040). 파일 저장소에 뒀다면 이 절차에
한 단계가 늘고 그 단계는 DB 밖에 있었을 것이다 — 위 표에 0 이 아닌 수가 남으면 그것이
이 결정이 깨졌다는 뜻이다.

**영수증은 마지막이다.** `reading_webhook_event` 는 도착을 적는 자리라 어느 FK 에도 안
매여 있다. 생성이 도는 중에 지우면 그 사이 도착한 응답을 두 번 집을 수 있다. 순서는
**생성 중단 → 재전송 창(최대 72시간) 경과 또는 webhook 폐쇄 → 영수증 삭제**다.

```sql
-- 위 검증에서 영수증만 남았을 때, 재전송 창이 지난 뒤에 지운다.
delete from public.reading_webhook_event;
```

```sql
-- 가입 코드는 사람 이름이 아니라 문자열과 운영자 메모다. 그래도 「누가 그 코드로
-- 들어왔나」가 계정과 함께 사라진 뒤에는 남길 이유가 없다.
delete from public.signup_code;
```

### DB 밖

절차가 DB 에서 끝나지 않는다. **여기 적힌 것 중 확인 안 된 것은 확인 안 됐다고 적어 둔다** —
안내에 「파기했습니다」라고 쓰려면 이 목록이 전부 닫혀 있어야 한다.

| 어디 | 무엇이 있나 | 얼마나 남나 |
| --- | --- | --- |
| Supabase Auth | 로그인 신원·세션·토큰 | `auth.users` 삭제가 identities·sessions·one_time_tokens·mfa_factors 를 cascade 로 데려간다(확인함). 감사 로그·flow state 는 FK 가 없어 `forget_user` 가 손으로 지운다 |
| Supabase 백업 | 지운 행이 스냅숏에 남는다 | **Free 플랜에는 자동 일일 백업과 PITR 이 없다.** 운영자가 손으로 dump 를 뜬 적이 없으면 남는 것이 없다. 플랜을 올리면 이 줄을 다시 쓴다 |
| Vercel 로그 | 요청 로그. 출생 원문은 안 적는다(`prd-archive` 로그 규율) | **Hobby 플랜의 런타임 로그 보존은 1시간.** 플랜을 올리면 이 줄을 다시 쓴다 |
| OpenAI | 프롬프트에 여덟 글자와 그 위의 사실이 들어간다. 정확한 생년월일시·출생지·분 단위는 안 나간다(ADR 0008) | `store: false` 로 보내되 `background: true` 라 회수용으로 **약 10분** 들고 있다. 그와 별개로 기본 abuse monitoring 로그가 **최대 30일**, 프롬프트 캐시가 마지막 사용 후 **최소 30분**이다 |

> **OpenAI 프로젝트의 ZDR·MAM 설정은 확인 안 됐다.** 별도 승인을 받은 기억이 없으면
> 기본값(최대 30일)으로 안내한다. 승인받았다면 대시보드에서 확인하고 이 줄을 고친다.
>
> 요금제 두 줄은 **지금 플랜 기준**이다. 플랜을 올리는 것은 보존 기간을 늘리는 일이고,
> 그때 처리방침도 함께 고쳐야 한다.

---

## 떠난 사람의 신고 기록 — **처분일부터 6개월, 운영자만** (ADR 0098)

신고한 쪽이든 당한 쪽이든 떠나면, 그 사람이 든 신고는 지워지기 **전에** `retention.report` 로 옮겨진다
(`auth.users` 의 트리거 `reports_outlive_the_leaver` — 크론의 처분이든 `forget_user` 든 같다). 처리방침의 절
「신고 기록은 따로 둡니다」가 이것을 알린다(`notice-v6`).

- **남는 것** — 사유와 상세 · 신고 시각과 검토 상태 · 불변 스냅샷(jsonb) · 두 계정의 UUID · 옮긴 순간의 로그인
  이메일 · 가입일(`auth.users.created_at`) · 탈퇴일. **IP · 실명 · 주민등록번호 · 전화번호 · 주소는 없다** —
  받은 적이 없다
- **누가 읽나** — 이 SQL 을 도는 운영자(`postgres`)뿐이다. `retention` 스키마는 API 에 안 나가고 `anon` ·
  `authenticated` · `service_role` 이 못 쓴다 — 앱 서버의 비밀 열쇠로도 못 읽는다. **신고한 사람이 요구해도
  상대의 신원을 알려 주지 않는다**
- **언제 사라지나** — 먼저 떠난 쪽의 처분일(`retained_at`)부터 6개월. 크론 `report-retention-purge`(매시 47분)가
  지운다. 남은 쪽이 나중에 떠나면 그 사람의 탈퇴일만 채워지고 시계는 그대로다. 실패는 `cron-watch` 가
  `cron-failed:report-retention-purge` 로 알린다
- **증거는 못 고친다** — 적을 수 있는 것은 검토 기록(시각 · 누가 · 결과 · 근거 · 제재 둘, ADR 0105 — 검토 문으로, ADR 0107)과 보류 두 칸뿐이다.
  나머지는 `55000` 으로 막힌다
- **읽는 것은 break-glass 다** — 화면에 없고 이메일과 본문이 든다. `docs/ops/runbook/access.md` 「개인정보는 화면으로만」의 대장을 먼저 적고
  사람이 돈다. 이메일 · 본문이 안 드는 첫 질의(파기 예정과 보류)는 보통 질의다

```sql
-- 따로 둔 신고 — 파기 예정일과 보류(이메일 없이)
select report_id, reported_at, reason, reviewed_at, review_outcome,
       reporter_left_at, reported_left_at,
       retained_at, retained_at + retention.report_period() as 파기_예정,
       hold_reason, held_at
from retention.report
order by retained_at desc;

-- break-glass — 두 계정의 당시 이메일
select report_id, reporter_email, reported_email from retention.report where report_id = '<report-id>';

-- break-glass — 한 건의 스냅샷을 편다(본문이 든다)
select (e ->> 'seq')::bigint as 차례,
       (e ->> 'created_at')::timestamptz at time zone 'Asia/Seoul' as 보낸_시각,
       e ->> 'sender_user_id' as 보낸_사람,
       (e ->> 'chosen')::boolean as 고른_것,
       e ->> 'body' as 본문
from retention.report k
cross join lateral jsonb_array_elements(k.snapshot -> 'messages') e
where k.report_id = '<report-id>'
order by 차례;

-- 검토를 적는다 — 떠난 뒤에도 검토는 이어진다. `docs/ops/runbook/moderation.md` 「신고와 차단」의 검토 문 그대로다(돌려준 값이 `retention`).
-- 같은 제약이 걸린다(ADR 0107). 이용 정지 결정은 남은 쪽에만 된다 — 떠난 계정에는 정지할 계정이 없어 거절된다
select public.review_report('<report-id>', '<운영자 UUID>', 'no_action', '<짧은 판단 근거>');

-- 크론이 도는가
select jobname, schedule, active from cron.job where jobname = 'report-retention-purge';
```

### 수사기관의 요청이 오면

주는 것은 **확인된 수사기관의 적법한 요청**에만, **가진 범위 안에서**다(ADR 0098 「정한 것」). 근거는
전기통신사업법 제83조③ · 형사소송법의 영장이고, 개인정보 보호법 제18조②2 가 제3자 제공을 연다.

1. **서면을 받는다.** 제83조④ — 요청사유 · 가입자와의 연관성 · 필요한 자료의 범위를 적은 서면. 긴급해서 서면
   없이 왔으면 사유가 끝나는 대로 서면을 받는다. 서면이 없으면 주지 않는다
2. **기관을 확인한다.** 공문의 발신 기관 대표 번호로 되걸어 요청자를 확인한다 — 전화나 메일로 온 요청의 번호로
   되걸지 않는다
3. **범위를 좁힌다.** 요청서가 가리키는 계정 · 신고만 뽑는다. 줄 수 있는 것은 위 「남는 것」뿐이고, 그중
   요청서가 적은 항목만이다. 살아 있는 계정의 것이면 `public.report` · `auth.users` 에서, 떠난 사람의 것이면
   `retention.report` 에서 뽑는다
4. **대장에 적는다.** 제83조⑤ — 제공한 날 · 요청 기관 · 요청서 번호 · 제공한 자료의 범위를 적고 요청서를 함께
   보관한다. 대장은 이 DB 밖의 운영 문서에 둔다(요청서가 종이이거나 PDF 다)
5. **반기마다 보고한다.** 제83조⑥ — 제공 현황을 연 2회 과기정통부에 보고한다. 제공이 없던 반기에는 할 것이 없다

### 보존 요청 — 보류를 걸고 푼다

6개월 안에 수사기관이 **보존**을 요청하면(적법한 서면) 그 줄에 보류를 건다. 걸린 줄은 크론이 안 지운다.
보류는 요청서가 가리킨 줄에만 건다 — 한 사람의 신고 전부에 거는 것이 아니다.

```sql
-- 건다 — 무엇을 근거로 걸었는지 남긴다: 기관 · 문서 번호 · 받은 날
update retention.report
set hold_reason = '<기관> <문서 번호> <받은 날> 보존 요청', held_at = now()
where report_id = '<report-id>';

-- 걸린 줄
select report_id, hold_reason, held_at, retained_at + retention.report_period() as 원래_파기_예정
from retention.report where hold_reason is not null;

-- 푼다 — 사유가 끝났을 때(수사 종결 통보 · 요청 철회). 6개월이 이미 지났으면 다음 실행(매시 47분)이 지운다
update retention.report set hold_reason = null, held_at = null where report_id = '<report-id>';
```

**보류는 연장이 아니라 미룸이다.** 풀면 원래 처분일부터 센 6개월로 돌아간다. 보류를 걸어 둔 채 잊지 않도록
분기마다 위 「걸린 줄」 질의를 한 번 돈다.

---

## 탈퇴 신청의 처리

사용자가 `/me/settings` 의 「탈퇴」에서 신청하면 상태가 **탈퇴 대기**(`deletion_requested`)로 옮겨지고,
그 순간 후보 노출이 꺼지고 살아 있던 요청이 정리된다. **처분은 크론이 한다**(2026-09-23, G-53, ADR 0094 덧) —
처분이 끝난 계정이 **탈퇴**다(PRD §5.3).

- **기한은 신청 뒤 3일이다** — 달력의 날이고 주말 · 공휴일을 안 가른다. 시계는 앱이 적은
  `deletion_requested_at` 하나다. **연락처로 요청하는 경로는 없다.**
- 크론 `account-disposal`(매시 23분)이 **신청 뒤 하루가 지난** 대기를 집어 `forget_user` 를 돌리고, 바로
  흔적을 잰다(`account_residue`). 흔적이 남으면 처분째 되감기고 계정은 대기에 남아 다음 시간에 다시 집힌다.
  하루를 두는 것은 되돌릴 틈이고, 남은 이틀은 다시 시도할 여유다.
- **운영자가 할 일은 알림이 왔을 때뿐이다.** `account-disposal-failed`(실패) · `account-disposal-overdue`
  (신청 뒤 3일이 지난 대기가 있다). 성공은 안 알린다.

```sql
-- 기다리는 계정과 그 시도 — 실패한 줄만 id 를 든다
select a.id, a.deletion_requested_at, d.attempts, d.last_attempt_at, d.last_error
from public.app_user a
left join public.account_disposal d on d.user_id = a.id
where a.status = 'deletion_requested'
order by a.deletion_requested_at;

-- 처분된 것 — 누구였는지는 안 남는다. 신청 · 처분 시각과 시도 수만
select requested_at, disposed_at, attempts from public.account_disposal
where disposed_at is not null order by disposed_at desc limit 20;

-- 크론이 도는가
select jobname, schedule, active from cron.job where jobname = 'account-disposal';
```

**실패했을 때.** `last_error` 가 원인을 든다 — 「처분 뒤 흔적이 남았다: <자리>」면 그 자리가
`forget_user` 가 모르는 새 흔적이다. 그 자리를 `forget_user` 에 더하는 마이그레이션이 해법이고, 그때까지는
크론이 한 시간마다 다시 실패하고 알린다(같은 종류는 하루 한 번). 손으로 급히 처분해야 하면 아래 한 줄과
흔적 질의를 그대로 쓴다 — 크론과 같은 문이다.

**무엇이 지워지고 무엇이 남는가**(2026-09-23, ADR 0094 · PRD §5.3). 처분은 아래 한 줄이고, 무엇을
지우고 남기는지는 FK 와 트리거가 든다 — 운영자가 표마다 지우지 않는다.

| 무엇 | 처분 |
| --- | --- |
| 계정 · 닉네임 · 사진 · 활동 · Person 과 입력 · 풀이 · 설문 · 동의 · 요청 · 소식 · 차단 · 공유 링크 | **지운다.** 남이 함께 관리하는 Person 은 남는다(ADR 0023) |
| 함께 보던 궁합 — 그 사람의 동의 당시 여덟 글자, 그 Match 의 궁합풀이와 시도 | **지운다.** 상대 화면에서는 신청 때부터 내려가 있었다 |
| 대화방 · 메시지 | **남는다.** 그 사람의 자리만 비고 상대가 닫힌 날부터 90일까지 본다. 상대 화면의 이름은 「탈퇴한 사용자」 |
| Match 행 | **남는다** — 대화방을 매단 자리로만. 상대도 떠나면 방째 사라진다 |
| 신고 · 신고 스냅샷 | **따로 6개월 남는다.** 지워지기 전에 `retention.report` 로 옮겨지고 일반 표에서는 사라진다 — 위 「떠난 사람의 신고 기록」(ADR 0098) |

- **처리 기한은 신청 뒤 3일이고 크론이 센다**(위). 화면과 처리방침의 「영업일 3일」 문장은 #165 가
  `notice-v6` 으로 한 번에 고친다 — 그 사이에는 약속보다 빨리 지우는 쪽이다.
- **되돌리려면 처분 전에** 상태를 `active` 로 되돌린다 — 닫힌 대화방은 다시 안 열린다(ADR 0091).
  처분 뒤에는 되돌릴 길이 없다.

```sql
-- **`delete from auth.users` 를 직접 쓰지 않는다.**
--
-- 그 문장은 FK 가 닿는 것만 데려간다. 감사 로그(모든 행이 이메일을 든다)와 flow state 는
-- 사용자에 안 매여 있어 그대로 남는다(ADR 0023). 위의 「지우기」 절과 같은 문을 쓴다 —
-- 절차가 둘이면 하나는 낡는다.
select * from public.forget_user('<user-id>');
```

지운 뒤에는 **위 「베타 종료 — 전부」의 검증 질의를 그대로** 돌려 그 사람의 흔적이
없는지 본다. 한 사람을 지운 뒤라 전체가 0일 수는 없으므로, 그 사람의 이메일과 id 로
좁혀 본다. 대화방이 남았는지와 그 사람의 여덟 글자가 비었는지도 함께 본다.

```sql
select
  (select count(*) from auth.users where id = '<user-id>') as 계정,
  -- **두 조건을 다 본다.** `forget_user` 가 그 둘로 지운다 — id 로만 세면 이메일만
  -- 든 행(로그인 시도 등)이 남아도 0으로 보인다.
  (select count(*) from auth.audit_log_entries
   where payload ->> 'actor_id' = '<user-id>'
      or payload ->> 'actor_username' = '<지운 주소>') as 감사로그,
  (select count(*) from auth.flow_state where user_id = '<user-id>') as 로그인중간상태;

-- 남는 것 — 처분 전에 적어 둔 Match id 들로 본다. 상대의 칸과 여덟 글자는 그대로, 그 사람의
-- 칸 · 여덟 글자 · 궁합풀이는 비고, 방은 닫힌 채 남는다.
select m.id, m.user_low, m.user_high,
       m.chart_low is not null as 낮은쪽_여덟글자, m.chart_high is not null as 높은쪽_여덟글자,
       (select count(*) from public.reading r where r.match_id = m.id) as 궁합풀이,
       r.closed_reason, r.closed_at,
       (select count(*) from public.chat_message x where x.room_id = r.id and x.sender_user_id is null) as 떠난쪽_메시지
from public.match m join public.chat_room r on r.match_id = m.id
where m.id in ('<match-id>');
```
