# 운영 절차 — 이용 정지 · 신고 · 채팅

색인은 `docs/ops/runbook.md` 다.

## 이용 정지와 해제

`status` 하나가 모든 문을 막는다 — 읽기까지 막는다(`is_active_account()`). 새 관문을
두지 않았으므로 이 값만 옮기면 discovery·요청·수락·AI 생성이 한꺼번에 닫힌다.

계정은 **UUID 로** 가리킨다 — `/ops/reports` 의 계정 이름 아래 회색 글자다. 이메일로 찾는 것은 break-glass 다(`docs/ops/runbook/access.md`
「개인정보는 화면으로만」). **신고로 정지하는 것이면 아래 UPDATE 대신 「신고와 차단」의 검토 문을 `suspension` 으로 부른다** —
검토 기록과 정지가 한 트랜잭션이다(ADR 0107). 아래 정지 SQL 은 신고와 무관한 정지에만 쓴다. 해제는 어느 쪽이든 아래 SQL 이고,
해제해도 「이용 정지 결정」 기록은 그대로 남는다.

```sql
-- 이용 정지
update public.app_user set status = 'suspended' where id = '<계정 UUID>';

-- 해제
update public.app_user
set status = 'active', deletion_requested_at = null
where id = '<계정 UUID>';
```

> 탈퇴 대기(`deletion_requested`)를 해제할 때도 같은 문을 쓴다. 검사식이 상태와 시각을
> 함께 묶고 있으므로 `deletion_requested_at` 을 같이 비워야 한다.

```sql
-- 지금 살아 있지 않은 계정들 — 이메일 없이
select a.id, a.status, a.deletion_requested_at
from public.app_user a
where a.status <> 'active'
order by a.deletion_requested_at desc nulls last;
```

---

## 신고와 차단

신고는 **운영자가 봐야 하는 기록**이고 차단은 사용자의 개인적 결정이다. 차단 기록을
운영 근거로 쓰지 않는다 — 「보기 싫다」와 「규칙을 어겼다」는 다른 일이다.

**읽는 것은 화면이 있다 — `/ops/reports`**(ADR 0103). 운영자로 로그인해 주소를 직접 친다(메뉴에 없다).
목록은 최신부터 30건씩이고 처리 상태 · 사유 · 대화 근거로 거른다. 「신고 내용 보기」가 신고 한 건과 신고
당시의 스냅샷을 연다. **여는 것마다 접속기록에 남는다**(ADR 0105). 화면은 읽기만 한다 — **검토 기록과 처분은 아래
검토 문이다.** 화면에는 이메일이 없다 — 이메일이 필요한 일(수사기관 요청 등)과 떠난 사람의 신고는 break-glass 다(`docs/ops/runbook/access.md`
「개인정보는 화면으로만」). 언제 보는가는 `docs/ops/runbook/security.md` 「운영 주기」.

**처리 필요 = 아직 안 봤거나 추가 확인 필요(`needs_more`)다**(ADR 0107). 정의는 `public.report_is_open` 하나이고 화면의
「처리 필요」 거르기와 아래 질의가 같은 것을 부른다. 3영업일은 **처음 접수한 시각부터** 센다 — 추가 확인 필요로 보류해도 시계는
처음으로 안 돌아간다.

```sql
-- 처리 필요 — 건수와 가장 오래된 접수. 내용은 화면(`/ops/reports?review=open`)에서 읽는다
select count(*) as 처리_필요,
       count(*) filter (where review_outcome = 'needs_more') as 그중_추가_확인_필요,
       min(created_at) at time zone 'Asia/Seoul' as 가장_오래된_접수
from public.report where public.report_is_open(reviewed_at, review_outcome);

-- 접수 뒤 3영업일을 넘긴 처리 필요(주말만 뺀 어림 — 공휴일은 눈으로). 보류해도 접수 시각부터 센다
select id, created_at at time zone 'Asia/Seoul' as 접수, reason, review_outcome
from public.report
where public.report_is_open(reviewed_at, review_outcome)
  and (select count(*) from generate_series(created_at::date + 1, current_date, interval '1 day') d
       where extract(isodow from d) < 6) > 3
order by created_at;

-- 한 계정에 쌓인 신고 — UUID 로 센다(화면의 「신고받은 계정」 아래 회색 글자). 처분을 정하는 자리
select reported_user_id, reason, count(*), max(created_at) as 마지막
from public.report
group by reported_user_id, reason
order by count(*) desc;
```

**검토를 적는다 — 문 하나, 신고 id 로**(`public.review_report`, ADR 0107). 화면에서 읽고 판단한 뒤 적는다. 표를 직접
UPDATE 하지 않는다. 결과는 넷 중 하나다 — `no_action`(조치 없음) · `warning`(경고) · `suspension`(이용 정지 결정) ·
`needs_more`(추가 확인 필요). 판단 근거는 500자 안에서 **이메일 · 실명 · 연락처 없이** 적는다. 검토한 사람은 `public.operator` 의
운영자 UUID 다 — 한 번 보고 적어 둔다(`select user_id, note, added_at from public.operator;`, 이메일 없이). 운영자 표에 없는
UUID 면 문이 `42501` 로 거절한다. 실행한 운영자는 검토한 운영자로 적힌다. 이 호출도 `npm run db:remote -- --purpose "신고 검토
<신고 id 앞 8자>" "<sql>"` 로 보낸다 — 목적과 해시가 남는다.

```sql
-- 조치 없음 · 추가 확인 필요 — 제재 대상 없이
select public.review_report('<report-id>', '<운영자 UUID>', 'no_action', '<짧은 판단 근거>');     -- 'needs_more'

-- 경고 — 제재 대상(신고의 두 계정 중 하나)이 있어야 한다. 계정은 그대로다. 갈래를 안 주면 신고 사유가 갈래다(ADR 0108)
select public.review_report('<report-id>', '<운영자 UUID>', 'warning', '<짧은 판단 근거>', '<대상 계정 UUID>');
-- 경고의 갈래를 신고 사유와 다르게 — harassment · impersonation · inappropriate · other 중 하나
select public.review_report('<report-id>', '<운영자 UUID>', 'warning', '<짧은 판단 근거>', '<대상 계정 UUID>', 'inappropriate');

-- 이용 정지 결정 — 같은 트랜잭션에서 대상 계정이 정지된다. 따로 app_user 를 고치지 않는다
select public.review_report('<report-id>', '<운영자 UUID>', 'suspension', '<짧은 판단 근거>', '<대상 계정 UUID>');
```

대상은 보통 신고받은 계정(화면의 「신고받은 계정」 아래 회색 글자)이고, 신고한 쪽이 받는 드문 경우는 그 계정이다. 돌려주는 값은
적은 표다 — `report`(지금 계정의 신고) · `retention`(떠난 사람의 신고). 다시 부르면 덮어쓴다(추가 확인 필요 → 결론).
**경고의 갈래는 이용자에게 가는 말이다** — 신고한 사람이 고른 사유가 운영자가 본 위반과 다르면(제재 대상이 신고한 쪽이면 더 그렇다)
여섯째 인자로 고른다. 경고가 아닌데 갈래를 주면 `22023`. 경고로 적히면 안내번호(`W-` 와 네 글자)가 붙고 상세 화면에 선다.

틀린 모양은 거절된다 — 조치 없음 · 추가 확인 필요에 대상을 주거나, 경고 · 이용 정지 결정에 대상이 없거나, 대상이 신고의 두
계정이 아니거나, 판단 근거가 500자를 넘으면 `23514` 다. **이용 정지 결정은 기록과 정지가 함께 되거나 함께 안 된다** — 탈퇴를
신청한 계정은 계정 검사식이 정지를 거절하므로 기록도 안 남는다(탈퇴 대기는 `docs/ops/runbook/erasure.md` 「탈퇴 신청의 처리」). 신고한 사람은 제 신고의 원래
칸만 읽는다 — 검토 결과 · 근거 · 제재는 안 보인다. **지금** 정지인가는 여전히 `app_user.status` 가 답한다 — 해제해도 「이용 정지
결정」 기록은 그대로 남는다(해제는 「이용 정지와 해제」). 경고를 적기 전에는 아래 「경고를 적기 전에 — 셈과 무게」를 본다.

차단은 참고로만 본다. 누가 누구를 차단했는지는 사용자에게 보이지 않으며, 여기서도
집계로만 읽는다.

```sql
select b.blocked_user_id, count(*) as 차단당한_수
from public.block b
group by b.blocked_user_id
having count(*) > 1
order by count(*) desc;
```

### 경고를 적기 전에 — 셈과 무게 (ADR 0108)

경고는 **사유의 갈래만** 이용자에게 가고(앱 안 안내와 이메일), **경고가 3회째가 되는 검토부터** 이용 정지 결정을 검토한다 —
자동 정지는 없다. **중대한 위반은 횟수를 안 보고 즉시** 검토한다. 결과를 `warning` 으로 적기 전에 셋을 밟는다.

1. **무게를 본다.** 처리 필요를 볼 때 `harassment`(괴롭힘이나 위협) 사유를 먼저 연다(`/ops/reports?review=open` 에서 사유로
   거른다). 무엇이 중대한가는 운영자가 판단한다 — 신고 사유에는 무게가 없다. 보기는 약관 초안 제21조(금지 행위)에 맞춘 것이다
   (닫힌 목록이 아니다, ADR 0108 추기): 신체에 대한 위해를 알리거나 공포심 · 불안감을 반복해 일으키는 것 · 원치 않는 음란한
   내용이나 성적 괴롭힘 · 성매매 · 성적 착취의 권유나 알선 · 금전 · 투자 권유나 다른 연락처로 옮기게 하는 사기 · 다른 사람의
   출생 정보를 스토킹 · 신상 파악에 쓰거나 개인정보 · 사진을 퍼뜨리는 것 · 다른 사람의 명의로 본인확인을 하거나 계정을 넘기는 것 ·
   만 19세 미만으로 보이는 정황(이용 자격, ADR 0101). 중대하면 앞선 경고가 없어도 `suspension` 으로 가고, 까닭을 판단 근거에 적는다
2. **대상 계정의 최근 12개월 경고를 센다** — 두 표에서 UUID 로. 12개월보다 오래된 경고는 표에 남아도 셈에 안 든다(운영자 결정
   2026-09-24). 신고한 사람이 떠나 옮겨진 신고(`retention.report`)의 경고도 대상의 것이다. 이메일 · 닉네임 · 판단 근거 · 본문을
   꺼내지 않으므로 보통 질의다(`--purpose "경고 셈 <신고 id 앞 8자>"`)
3. **이번이 3회째 이상이면 이용 정지 결정을 검토한다.** 같은 일을 가리키는 신고 여럿에 적은 경고는 한 번으로 본다 — 날짜와 신고
   id 로 가른다. 검토 끝에 경고로 두는 것도 된다. 경고로 적으면 판단 근거에 「경고 N회째 — 정지 검토함」처럼 남긴다. **횟수는
   이용자에게 말하지 않는다** — 안내 · 이메일 · 답장 어디에도

```sql
-- 대상 계정의 최근 12개월 경고 — 표 · 신고 id · 안내번호 · 갈래 · 경고한 때 · 이용자가 확인했는가. 판단 근거는 안 꺼낸다
select '지금 계정' as 표, id as 신고, warning_ref as 안내번호, warning_category as 갈래,
       reviewed_at at time zone 'Asia/Seoul' as 경고한_때, warning_acknowledged_at is not null as 확인함
from public.report
where review_outcome = 'warning' and sanctioned_user_id = '<대상 계정 UUID>'
  and reviewed_at > now() - interval '12 months'
union all
select '떠난 사람의 신고', report_id, warning_ref, warning_category,
       reviewed_at at time zone 'Asia/Seoul', warning_acknowledged_at is not null
from retention.report
where review_outcome = 'warning' and sanctioned_user_id = '<대상 계정 UUID>'
  and reviewed_at > now() - interval '12 months'
order by 경고한_때;
```

**이용자에게 알리는 길 — 앱 안 안내는 섰고, 이메일은 아직이다(G-57 · G-26).** 경고를 적으면 대상 계정이 다음에 로그인한 화면의
머리 아래에 안내가 선다 — 갈래 · 경고한 날 · 이의 제기의 길 · 안내번호뿐이고, 「확인했습니다」를 누르면 확인한 때가 남는다. 이용이
정지된 계정 · 탈퇴 대기에는 안 서고, 신고한 사람이 떠나 옮겨진 경고도 안 선다(ADR 0108 추기). **이메일은 안 간다** — 발송 칸
(`warning_emailed_at` · `warning_email_result`)은 G-26 의 잡을 기다리며 비어 있고, 운영자가 이메일 주소를 SQL 로 꺼내 손으로
보내지 않는다(이메일 열람은 break-glass 다 — `docs/ops/runbook/access.md` 「개인정보는 화면으로만」). 3회째의 검토에서는 위 질의의 「확인함」을 보고
**앞선 경고가 이용자에게 닿았는가**를 판단에 넣는다. 안내가 서기 전(2026-09-24 전)에 적힌 경고는 없다(그날 운영 DB 는 0줄).

「알렸는가」를 셀 때 — 개인을 가리키지 않는 집계다.

```sql
select count(*) filter (where warning_acknowledged_at is not null) as 확인함,
       count(*) filter (where warning_acknowledged_at is null) as 확인_전,
       count(*) filter (where warning_email_result = 'sent') as 이메일_보냄,
       count(*) filter (where warning_email_result = 'failed') as 이메일_실패
from public.report
where review_outcome = 'warning';
```

**이의 제기 · 이용 정지의 소명 — 고객 문의 이메일로 받는다**(G-25 ④ · ㉤, 첫 답 3영업일 안 · 주소는 사업자등록 뒤). 안내와
이메일이 **안내번호**(`W-7K3F` 꼴)를 함께 적어 달라고 말한다 — 받으면 `/ops/reports?ref=<안내번호>` 로 그 경고를 연다(소문자 ·
앞뒤 빈칸은 괜찮다). 보낸 주소로 계정을 찾지 않는다(break-glass). 번호가 없으면 답장으로 안내번호를 묻는다. 목록에 없으면 신고한
사람이 떠나 옮겨진 경고다 — 아래 질의로 신고 id 를 얻는다. 안내번호는 두 표를 합쳐 한 경고의 것이라 두 곳에서 둘이 나오는 일은 없다. 두 표 어디에도 없는데 대장(`public.warning_reference`)에 있으면 파기된 경고다 — 번호는 다시 쓰지 않는다(ADR 0108 추기). 받아들이면 같은 문을 다시 불러 결과를 덮어쓴다 — 그 경고는 셈에서
빠지고, 아직 확인 전이었으면 안내도 사라진다. 안내번호는 남아 나중에도 그 번호로 찾는다. 답장에도 판단 근거 · 신고한 사람 · 고른
메시지 · 경고 횟수를 옮기지 않는다.

```sql
-- 안내번호로 떠난 사람의 신고에서 찾는다 — 신고 id 와 경고한 때만
select report_id, review_outcome, reviewed_at at time zone 'Asia/Seoul' as 경고한_때
from retention.report where warning_ref = upper('<안내번호>');
```

```sql
select public.review_report('<report-id>', '<운영자 UUID>', 'no_action', '이의 제기 인정 — <짧은 까닭>');
```

### 신고 열람대의 운영 검증 — G-24 를 닫는 열네 걸음 (ADR 0103 · 0105)

`/ops/reports` 가 프로덕션에서 실제로 신고 한 건을 끝까지 보여 주는지 **누구나 그대로 따라 밟을 수 있게** 적었다.
결과는 이슈 하나에 모은다 — 틀은 `.github/ISSUE_TEMPLATE/ops-verification.md`. 열넷을 다 채웠을 때만 G-24 를 닫는다.

**전제 넷 — 하나라도 거짓이면 시작하지 않는다.**

1. **마이그레이션이 운영에 올라 있다** — 적어도 `20261009090000`(운영자 문 셋) · `20261010090000`(검토 기록) ·
   `20261010100000`(접속기록) · `20261010110000`(가입 닫기). `npx supabase migration list` 의 remote 칸이 이 넷에서 비지 않는다
2. **최신 main 이 Production 에서 Ready 다** — `docs/ops/runbook/deploy.md` 「배포」의 「묶음 배포 — 최신 main 을 Production 으로 한 번」을 먼저
   밟는다. 배포 커밋이 main HEAD 가 아니면 옛 화면을 재는 것이다
3. **실제 개인정보가 없는 전용 테스트 계정** — 주소는 `@example.com`, 닉네임은 `검증A-<날짜>` 처럼 누가 봐도 시험인 것.
   운영자 계정(구글)은 제 것을 쓰고, 그 세션은 먼저 `/ops/mfa` 를 지난다(`docs/ops/runbook/operators.md` 「운영자 2단계 인증」, ADR 0123)
4. **테스트 메시지 · 신고 설명에도 실제 이름 · 연락처 · 출생정보를 쓰지 않는다** — 스냅샷은 불변이고 접속기록은 지울 수
   없다. 출생정보는 가짜(예: 1990-05-15 14:30 서울)로 넣는다

SQL 은 전부 `npm run db:remote -- --purpose "G-24 검증 <걸음 번호>" "<sql>"` 로 보낸다(목적과 해시가 접속기록에 남는다).
**아래 질의는 테스트 계정 둘의 UUID 와 신고 id 로만 좁혀 두었다** — 그래도 메시지 본문이 나오는 ⑦ 은 break-glass 규율로
사람이 돈다. 에이전트는 질의를 건네기만 한다(`docs/agents/delegation/permissions.md`, ADR 0105).

| # | 걸음 | 어떻게 | 통과 |
| --- | --- | --- | --- |
| ① | 테스트 계정 A · B 준비 | `auth.admin.createUser({ email: 'g24-a-<날짜>@example.com', password, email_confirm: true })` 로 둘을 만들고(비밀 키 `SUPABASE_SECRET_KEY`), `docs/ops/runbook/signup.md` 「초대」의 SQL 로 **전용 코드**(`max_uses = 2`, 오늘 하루)를 넣어 `complete_signup` 을 지난다. 둘을 `docs/ops/runbook/ai.md` 「운영 검증 계정」 표에 넣는다 — 수락하면 궁합풀이가 자동으로 만들어져 토큰이 나간다. 로그인은 구글이 아니라 비밀번호 세션이다(`scripts/check-chat.mjs` 의 `person` · `cookieFor` 와 같은 모양) | ⓐ 아래 질의가 둘 다 `active` · 가입 완료 ⓑ `verification_account` 에 둘 |
| ② | 둘 사이의 테스트 대화 | 둘 다 자기 사주를 저장하고 닉네임을 세운 뒤(인연 찾기에 든다) A 가 `request_match(B)`, B 가 `respond_to_match_request(요청, true)`. 방이 열리면 서로 세 줄 넘게 보낸다(`send_chat_message`) — 신고할 줄 하나는 「G-24 검증용 신고 대상 메시지」처럼 누가 봐도 시험인 글 | 1 번 질의의 `closed_reason` 이 비고 메시지 수가 보낸 수와 같다 |
| ③ | 신고 1건 | B 가 ② 의 「신고 대상」 메시지를 골라 신고한다 — 화면(방의 신고)이나 `report_chat_message(메시지 id, 'other', 'G-24 검증')`. 돌아온 신고 id 를 적는다 | 2 번 질의에 신고 한 줄 · 스냅샷 한 줄 |
| ④ | 목록에서 보인다 | 운영자 계정으로 `/ops/reports` 를 연다(메뉴에 없다 — 주소를 친다) | 맨 위 근처에 그 신고가 서고, 신고한 사용자 · 신고받은 사용자가 두 테스트 닉네임이다. 이메일 · 출생정보가 화면 어디에도 없다 |
| ⑤ | 거르기 셋 | `?review=open`(처리 필요) · `?reason=other` · `?evidence=chat` 을 하나씩 연다(화면의 거르기 링크와 같다). 그리고 `?review=done`(처리 완료) · `?evidence=none` | 앞의 셋에서는 그 신고가 보이고, 뒤의 둘에서는 안 보인다 |
| ⑥ | 상세 — 신고 내용과 스냅샷 | 「신고 내용 보기」로 `/ops/reports/<신고 id>` 를 연다 | 사유 · 설명 · 접수 시각이 ③ 과 같고, 대화 근거 절이 선다 |
| ⑦ | 고른 메시지와 앞뒤의 차례 | 화면의 스냅샷을 위에서 아래로 읽고 3 번 질의(**break-glass — 사람이**)와 견준다 | 「신고한 메시지」로 강조된 줄이 **하나**이고 ③ 에서 고른 글이다. 앞뒤 줄이 보낸 차례(`seq`)대로 서고 앞 · 뒤 각각 최대 다섯이다. 보낸 쪽이 「신고한 사용자」 · 「신고받은 사용자」로 맞게 붙는다 |
| ⑧ | 접속기록에 셋이 남는다 | 4 번 질의 | ④ ⑤ 의 `reports.list`(거른 조건이 `filter_summary` 에), ⑥ 의 `reports.detail` 과 `reports.snapshot` 이 **각각** `allowed` 로, 운영자 UUID 와 그 신고 id(목록은 비어 있다)로 선다. 줄 id 를 적는다 |
| ⑨ | 검토를 적는다 | 「신고와 차단」의 검토 문 — `select public.review_report('<신고 id>', '<운영자 UUID>', 'no_action', 'G-24 운영 검증 — 테스트 신고')`. 처리 필요에 남는 것을 보려면 먼저 `needs_more` 로 한 번 부르고 목록의 `?review=open` 에 그대로 서는지 본 뒤 `no_action` 으로 다시 부른다. 이용 정지 결정을 시험하려면 `suspension` 과 대상 A 의 UUID 까지(같은 트랜잭션에서 A 가 정지되고 방이 닫힌다 — 「이용 정지와 해제」로 푼다) | 돌려준 값 `report`. 정지를 시험했으면 1 번 질의에서 A 가 `suspended` |
| ⑩ | 화면과 DB 가 같다 | 상세를 새로 고치고 5 번 질의와 견준다 | 처리 상태 · 검토 결과(`no_action` → 「조치 없음」, `suspension` → 「이용 정지 결정」) · 검토한 운영자(닉네임) · 판단 근거 · 당시 제재 대상(없으면 항목 없음)이 DB 값과 한 글자도 다르지 않다. 목록의 `?review=done` 에 그 신고가 옮겨 서고 배지가 `처리 완료 · 조치 없음` 이다 |
| ⑪ | 비운영자는 못 읽는다 | A(또는 B)의 세션으로 `/ops/reports` 와 `/ops/reports/<신고 id>` 를 연다 | 둘 다 404 이고 자료가 한 줄도 안 선다. 6 번 질의에 그 계정의 `denied` 줄이 `reports.list` · `reports.detail` 로 선다 |
| ⑫ | 이슈에 적는다 | `ops-verification` 틀로 이슈를 연다 | 배포 SHA · Production URL · Ready 시각 · 신고 id · 실행 시각 · 접속기록 줄 id(⑧ ⑪) · 검토 결과(⑨) · 화면 확인 결과(④ ~ ⑦ ⑩ ⑪ 각각 통과/실패)가 다 있다. **이메일 · 메시지 본문은 적지 않는다** |
| ⑬ | 테스트 자료를 정리하거나 보존 방식을 적는다 | 아래 「정리」 | 이슈에 무엇을 지웠고 무엇이 왜 남는지(아래) 적혀 있다 |
| ⑭ | 닫는다 | 위 열셋이 전부 통과일 때만 | G-24 줄을 gaps 에서 지우고 changelog 에 날짜 · 이슈 번호와 함께 옮긴다. 하나라도 실패면 이슈에 실패한 걸음을 적고 **닫지 않는다** |

```sql
-- 1. 두 계정의 상태 · 가입 완료 · 방 (① ②) — 이메일을 찍지 않는다
select u.id, u.status, u.nickname is not null as 닉네임, u.notice_version,
       exists (select 1 from public.verification_account v where v.user_id = u.id) as 검증계정
from public.app_user u where u.id in ('<A>', '<B>');
select r.match_id, r.closed_reason, count(m.id) as 메시지
from public.chat_room r left join public.chat_message m on m.room_id = r.id
where r.user_low = least('<A>'::uuid, '<B>'::uuid) and r.user_high = greatest('<A>'::uuid, '<B>'::uuid)
group by r.match_id, r.closed_reason;

-- 2. 신고와 스냅샷이 한 줄씩 (③)
select r.id, r.reason, r.created_at, r.reviewed_at,
       s.context_before, s.context_after, jsonb_array_length(s.messages) as 스냅샷_줄
from public.report r left join public.chat_report_snapshot s on s.report_id = r.id
where r.reporter_user_id = '<B>' and r.reported_user_id = '<A>' order by r.created_at desc;

-- 3. break-glass(사람이, 대장 먼저) — 스냅샷의 차례. 테스트 계정의 시험 글만 든다 (⑦)
select (e ->> 'seq')::bigint as 차례, (e ->> 'chosen')::boolean as 고른_것,
       case e ->> 'sender_user_id' when '<B>' then '신고한 사용자' when '<A>' then '신고받은 사용자' end as 보낸_쪽,
       e ->> 'body' as 본문
from public.chat_report_snapshot s cross join lateral jsonb_array_elements(s.messages) e
where s.report_id = '<신고 id>' order by 차례;

-- 4. 운영자의 열람이 셋 다 남았나 (⑧)
select id, at at time zone 'Asia/Seoul' as 서울, action, target_report_id, filter_summary, outcome
from audit.operator_access
where channel = 'app' and actor_user_id = '<운영자 UUID>' and at > now() - interval '2 hours'
order by id;

-- 5. 검토 기록 — 화면과 견줄 값 (⑩)
select reviewed_at at time zone 'Asia/Seoul' as 검토, reviewed_by, review_outcome, review_note,
       sanctioned_user_id, sanctioned_by, public.report_is_open(reviewed_at, review_outcome) as 처리_필요
from public.report where id = '<신고 id>';

-- 6. 비운영자의 거절이 남았나 (⑪)
select id, at at time zone 'Asia/Seoul' as 서울, action, target_report_id, outcome
from audit.operator_access
where actor_user_id = '<A>' and outcome = 'denied' and at > now() - interval '2 hours' order by id;
```

**정리(⑬) — 무엇이 지워지고 무엇이 남나.** 두 테스트 계정을 `docs/ops/runbook/erasure.md` 「지우기」의 `forget_user` 로 **둘 다** 지우고 전용 코드를 닫는다
(`update public.signup_code set max_uses = 0 where code = '<코드>'`). 그러면 방 · 메시지 · 궁합은 사라진다. 남는 것은 둘이다.

- **신고와 스냅샷** — 지우기 전에 트리거가 `retention.report` 로 옮긴다(ADR 0098). 처분일부터 6개월 뒤 크론이 지운다.
  테스트 자료라 그 전에 지워도 되지만, 그 표를 손으로 지우는 길은 문서에 두지 않았다 — **6개월 뒤 자동 파기에 맡기고**
  신고 id 와 「테스트 — 6개월 뒤 자동 파기」를 이슈에 적는 것을 기본으로 한다
- **접속기록 줄** — 추가만 되는 표라 지울 수 없고(ADR 0105), AWS 가 켜져 있으면 S3 에도 나간다. 줄 id 를 이슈에 「G-24 운영
  검증」으로 적어 월 점검에서 이상 접근으로 읽히지 않게 한다

`verification_account` 의 줄은 계정을 따라 사라진다.

## 채팅 (ADR 0091)

채팅 안전 베타의 운영자 수단은 **화면이 아니라 여기 SQL 이다**(PRD §7.0). 방은 Match 에 1:1 이고
차단 · 이용 정지 · 탈퇴 신청이 트리거로 닫는다. 운영자가 누를 것은 없다 — 이용 정지는 위 「이용 정지와
해제」의 그 한 줄이 방까지 닫는다.

**대화방 전체를 여는 열쇠는 없다.** 운영자가 읽는 것은 신고에 붙은 스냅샷뿐이다. 아래 질의는
전부 SQL Editor(`postgres`)에서 돈다 — 앱 역할에는 이 표들이 닫혀 있다.

### 신고 스냅샷을 읽는다

**화면이 먼저다 — `/ops/reports/<report-id>`**(ADR 0103). 스냅샷을 차례대로 펴고, 고른 메시지에 「신고한
메시지」가 서고, 보낸 쪽을 「신고한 사용자」 · 「신고받은 사용자」로 적는다. 목록에서 「대화 근거 있음」으로
거르면 스냅샷이 붙은 신고만 남는다. 여는 것마다 접속기록에 남는다(ADR 0105). **아래 SQL 은 break-glass 다** — 메시지
본문과 이메일이 든다. 화면이 안 열리는 장애나 수사기관의 요청일 때만, `docs/ops/runbook/access.md` 「개인정보는 화면으로만」의 대장을 먼저 적고
사람이 돈다. 검토를 적는 것은 「신고와 차단」의 검토 문이다.

```sql
-- break-glass — 한 신고의 스냅샷을 차례대로 편다. `chosen` 이 참인 줄이 고른 메시지다.
-- 보낸 사람은 UUID 로 둔다 — 이메일이 필요하면 그것도 대장에 적은 목적 안에서만 푼다.
select (e ->> 'seq')::bigint as 차례,
       (e ->> 'created_at')::timestamptz at time zone 'Asia/Seoul' as 보낸_시각,
       e ->> 'sender_user_id' as 보낸_사람,
       (e ->> 'chosen')::boolean as 고른_것,
       e ->> 'body' as 본문
from public.chat_report_snapshot s
cross join lateral jsonb_array_elements(s.messages) e
where s.report_id = '<report-id>'
order by 차례;
```

스냅샷은 **불변**이다 — `update` 는 소유자에게도 막힌다(`55000`). 지워지는 길은 신고가 사라질
때뿐이고, 신고는 계정을 따라간다(`docs/ops/runbook/erasure.md` 「지우기」). 그 전에 트리거가 신고째 `retention.report` 로 옮긴다 —
떠난 사람의 신고는 `docs/ops/runbook/erasure.md` 「떠난 사람의 신고 기록」에서 읽는다.

### 닫힌 지 90일 지난 방의 메시지를 지운다 — **손으로**

크론이 아니다(PRD §7.1). 배포한 날이나 달마다 한 번 돈다. 기간은 DB 의 `chat_retention()` 이
들고(90일), 이 함수와 pgTAP 이 같은 문을 돌린다.

```sql
-- 무엇을 지울 것인지 먼저 본다. 세어 보지 않고 지우지 않는다.
select r.match_id, r.closed_reason, r.closed_at, count(m.id) as 메시지
from public.chat_room r
join public.chat_message m on m.room_id = r.id
where r.closed_at < now() - public.chat_retention()
group by r.match_id, r.closed_reason, r.closed_at
order by r.closed_at;

-- 지운다. 지우는 것은 메시지뿐이다 — 방은 남아 닫힌 이유를 계속 말하고, 스냅샷은 신고를 따른다.
select public.purge_closed_chat_messages();  -- 지운 메시지 수
```

### 한도에 걸린 건수를 본다

전송 한도는 계정당 1분 30건이고(`chat_policy()`), 걸린 전송은 거절되며 **한 건 한 줄**로 남는다.
거절이 값으로 돌아오기 때문에 트랜잭션이 남는다(ADR 0091).

```sql
-- 최근 7일, 날짜 × 사람
select (h.created_at at time zone 'Asia/Seoul')::date as 날짜, u.email, count(*) as 거절
from public.chat_rate_limit_hit h
join auth.users u on u.id = h.user_id
where h.created_at > now() - interval '7 days'
group by 1, 2
order by 1 desc, 3 desc;

-- 지금 정책의 수 다섯 — 앱의 lib 이 같은 수를 들어야 한다
select * from public.chat_policy();
```

### 접속 상태 — 구간만 나간다 (ADR 0092)

로그인된 요청마다 `proxy.ts` 가 `touch_activity()` 를 부르고, 그 문은 **1분에 한 번**만
`user_activity.last_active_at` 을 적는다. 상대에게 나가는 것은 구간 셋(`now` 5분 미만 · `day` 24시간
미만 · `earlier`)뿐이고 시각은 어느 읽는 문에도 없다. 표는 앱 역할에 닫혀 있어 여기서만 읽는다.

```sql
-- 지금 정책의 수 셋(초) — 앱의 lib 이 같은 수를 들어야 한다
select * from public.presence_policy();

-- 한 사람의 마지막 활동과 구간
select a.last_active_at, public.activity_band_of(a.user_id) as 구간
from public.user_activity a where a.user_id = '<user uuid>';

-- 프로덕션 확인 — 구간을 바꿔 본다(#121 의 끝났다고 말할 조건 2)
update public.user_activity set last_active_at = now() - interval '25 hours' where user_id = '<B>';

-- 읽는 문 둘의 반환에 활동 시각이 없다(pgTAP 35 와 같은 질의 — 0 이어야 한다)
select count(*) from pg_proc p
cross join lateral unnest(p.proargnames, p.proargmodes) as a(name, mode)
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('my_chat_rooms', 'my_discovery_board')
  and a.mode = 't' and a.name like '%active_at%';
```

### 완료 조건 여섯을 프로덕션에서 밟는 순서

§7.0 의 여섯을 **운영자가 지정한 테스트 계정 둘**(A · B)로 한 번씩 밟는다. 화면은 `/me/chat`(탭 「채팅」)
이고 방은 함께 보는 궁합의 「채팅」으로도 연다. 확인은 SQL 로 한다.

1. **주고받는다.** A 와 B 를 매칭시키고(요청 → 수락) 서로 한 줄씩 보낸다.
   ```sql
   select r.match_id, r.closed_reason, count(m.id) as 메시지
   from public.chat_room r left join public.chat_message m on m.room_id = r.id
   where r.user_low = least('<A>', '<B>') and r.user_high = greatest('<A>', '<B>')
   group by r.match_id, r.closed_reason;   -- closed_reason 이 null, 메시지 2
   ```
2. **한도 거절.** A 가 1분 안에 31건을 보낸다(화면에서든 `send_chat_message` 를 31번 부르든).
   31번째가 거절되고 `chat_rate_limit_hit` 에 A 의 줄이 하나 선다(위 「한도에 걸린 건수」).
3. **신고 스냅샷.** B 가 A 의 메시지 하나를 골라 신고한다. 위 「신고 스냅샷을 읽는다」로 고른
   메시지와 앞뒤가 베껴졌는지 본다. 이때 방은 그대로 열려 있어야 한다(신고는 닫지 않는다).
4. **차단.** A 가 B 를 차단한다. 방의 `closed_reason` 이 `block` 이고, **둘 다** 이전 대화를 보며
   둘 다 입력이 안 된다. 그리고 매칭 목록에서는 내려간다(§6.5).
5. **이용 정지.** 다른 쌍(A · C)을 세우고 C 를 정지한다(「이용 정지와 해제」의 한 줄). 방의 `closed_reason`
   이 `suspension`, `closed_by_user_id` 가 C. A 는 방과 대화를 보고 C 는 아무것도 못 본다.
   ```sql
   update public.app_user set status = 'suspended' where id = '<C>';
   select closed_reason, closed_by_user_id, closed_at from public.chat_room
   where user_low = least('<A>', '<C>') and user_high = greatest('<A>', '<C>');
   ```
6. **삭제 요청.** 또 다른 쌍(A · D)을 세우고 D 가 `/me/settings` 의 「탈퇴」→「탈퇴를 신청합니다」로 신청한다. `closed_reason` 이
   `deletion_request`, `closed_at` 이 D 의 `deletion_requested_at` 과 같다. A 는 보고 D 는 못 본다.

끝나면 테스트 계정을 `docs/ops/runbook/erasure.md` 「지우기」로 정리한다 — **쌍의 두 계정을 다** 지운다. 한쪽만 지우면 방과 메시지는
남는 쪽에 남는다(ADR 0094). 둘 다 지우면 Match 째 사라지고, 신고 · 스냅샷은 신고를 따라 사라진다.
지우기 전에 위 검증의 결과를 이슈 #115 에 적는다.
