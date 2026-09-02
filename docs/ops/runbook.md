# 운영 절차

폐쇄 초대 MVP 를 운영하는 데 필요한 일들. **화면은 없다** — PRD 가 초기에는 UI 대신
감사 가능한 관리자 절차를 쓸 수 있다고 했고, 지금이 그 단계다. 이 문서가 그 「절차」다.

여기 적힌 것을 그대로 실행할 수 있어야 한다. 기억에 기대면 초대 하나를 넣는 데도
표 이름을 더듬게 되고, 급할 때 더듬는 것은 대개 제재 쪽이다.

## 어디서 실행하나

Supabase 대시보드의 SQL Editor 에서 **원격 프로젝트**에 대고 실행한다.
`skxtqxajfmxiusqrgbuf` — 배포된 앱이 보는 곳이다.

로컬에서 연습하려면 `npm run db:start` 뒤에:

```bash
docker exec -i supabase_db_saju psql -U postgres -c "<문장>"
```

> **`supabase config push` 를 쓰지 않는다.** 원격의 구글 설정을 지운다.

---

## 테스트 시작하기 — **날짜 한 줄**

지금은 아무도 시작할 수 없다. 종료일이 없으면 안내가 만들어지지 않고, 안내가 없으면
`/welcome` 에 버튼이 없다(ADR 0024). 배포 없이 **언제든** 넣고 옮길 수 있다.

**두 가지를 함께 넣는다** — 언제 끝나는가와 **누가 약속하는가**. 처리자와 연락처가 없으면
열람·정정·삭제·처리정지가 적혀만 있는 권리가 되므로, 셋 중 하나라도 비면 안내가 안 선다.

```sql
-- 정한다. 파기 기한은 종료일과 여유에서 나므로 따로 적지 않는다.
insert into public.beta_schedule (
  ends_on, purge_within_days, note,
  operator_name, operator_officer, operator_contact)
values (
  '2026-10-31', 30, '고정 종료일 — 초대 시점과 무관하다',
  '<처리자 이름 또는 상호>', '<보호책임자 이름>', '<직접 닿는 이메일 또는 전화>');

-- 지금 값과 이력
select * from public.current_beta_schedule();
select id, ends_on, purge_within_days, note, set_at from public.beta_schedule order by id desc;
```

**덮어쓰지 않고 쌓는다.** 옮기려면 새 줄을 넣는다 — 이건 사용자에게 한 약속이고, 바뀐
기록이 남아야 「그때 뭐라고 했더라」에 답할 수 있다.

> **옮기면 모두가 안내를 다시 본다.** 확인 기록이 판본과 **본 날짜**를 함께 들기
> 때문이다(`notice_ends_on`). 기간이 바뀌는 것은 알린 내용이 바뀌는 것이라 그게 맞다 —
> 다시 안 물으면 11월에 지운다는 안내를 보고 확인한 사람의 자료를 이듬해까지 들게 된다.

> **연락처는 공개 화면에 그대로 실린다.** `/privacy` 는 로그인 없이 열리므로 여기 적는
> 주소는 누구나 본다. 개인 주소를 쓸지 별도 창구를 팔지는 정하고 넣는다.

**종료일은 초대와 무관하다.** 언제 몇 명을 초대하든 그날 끝난다 — 초대에서 며칠을 세는
값이 아니므로, 테스터를 늦게 넣었다고 자동으로 밀리지 않는다. 밀려면 새 줄을 넣는다.

넣고 나면 `/privacy` 를 열어 날짜가 문장 안에 서 있는지 눈으로 본 뒤 아래 「초대」로 간다.

**문구를 고쳤으면 판본도 올린다**(`NOTICE_VERSION`, 코드). 판본만 올리고 문구를 안 고치면
사람들을 이유 없이 다시 세우는 것이고, 문구만 고치고 판본을 안 올리면 아무도 새 문구를
못 본다. 날짜는 판본에 없다 — 둘은 따로 움직이고 관문이 둘 다 본다.

```sql
-- 누가 어느 판본·어느 날짜에서 무엇을 골랐나
select u.email, a.notice_version, a.notice_ends_on, a.notice_ack_at,
       a.improvement_consent as 개선활용, a.contact_consent as 후속연락
from public.app_user a join auth.users u on u.id = a.id
order by a.notice_ack_at desc nulls first;
```

---

## 초대

가입 관문은 **정확한 이메일 일치**다. 목록에 없는 주소는 auth 계정 자체가 안 만들어진다
(Before User Created Auth Hook — ADR 0006).

```sql
-- 넣는다. 대소문자는 훅이 정규화하지만 넣을 때도 소문자로 넣는 편이 낫다.
insert into public.invite (email, note)
values ('tester@example.com', '1차 테스터 · 소개: 아무개');

-- 누가 초대돼 있고 그중 누가 실제로 들어왔나
select i.email, i.note, i.created_at, u.id is not null as 가입함
from public.invite i
left join auth.users u on lower(u.email) = lower(i.email)
order by i.created_at desc;
```

**초대를 지우는 것은 접근 회수가 아니다.** 이미 만들어진 세션은 그대로 산다. 이미
들어온 사람을 막으려면 아래의 계정 중지를 쓴다.

```sql
-- 아직 안 들어온 사람만 목록에서 뺀다
delete from public.invite
where email = 'tester@example.com'
  and not exists (select 1 from auth.users u where lower(u.email) = lower(email));
```

---

## 풀이권

폐쇄 베타에서 한 사람이 AI 풀이를 몇 번 만들 수 있는가. **어디에도 적혀 있지 않다** —
`reading_run` 을 세는 것이 곧 잔액이다(ADR 0021). 그래서 누구의 잔액도 손으로 고칠 수
없고, 고칠 자리를 찾을 필요도 없다.

```sql
-- 누가 얼마나 썼나. `reserved` 는 지금 만들고 있는 것이 잡고 있는 자리다.
select u.email,
       count(*) filter (where r.status = 'succeeded') as 쓴것,
       count(*) filter (where r.status = 'running'
         and r.created_at > now() - public.reading_run_timeout()) as 만드는중,
       count(*) filter (where r.status = 'failed') as 실패
from auth.users u
left join public.reading_run r on r.user_id = u.id
group by u.email
order by 쓴것 desc;
```

한 사람에게 더 주려면 상한을 옮긴다. **그 사람만 올릴 수는 없다** — 값이 하나뿐인 것이
이 설계의 요점이다.

```sql
create or replace function public.reading_credit_limit()
returns integer language sql immutable as $$ select 8 $$;
```

> 옮기기 전에 **무엇을 근거로 옮기는지 적어 둔다.** 처음 다섯은 재어 보고 정한 값이
> 아니다(ADR 0021). 「달라고 해서」와 「테스터 대부분이 다섯에서 멈춰서」는 다른 근거이고,
> 뒤의 것만 다음 판을 정하는 데 쓸 수 있다.

**전체 비용은 이 값이 안 막는다.** 사람당 상한일 뿐이라, 초대 인원이 늘면 OpenAI 쪽
예산 한도를 따로 옮겨야 한다. 그리고 실패한 시도도 모델은 이미 불렸으므로 「성공 건수 ×
인원」이 호출 상한이 아니다.

---

## 지우기

**「그만두기」와 「지우기」는 다른 일이다.** 매칭 참여를 끄는 것은 상태이고(ADR 0014)
계정 중지도 상태다. 여기 적힌 것은 되돌릴 수 없는 쪽이다.

### 한 사람

```sql
select * from public.forget_user('<user uuid>');
--  people_forgotten | revisions_forgotten
```

한 문장이면 된다. `auth.users` 하나가 사라지면 `app_user` 가 따라가고 거기서 열여덟
갈래가 FK 로 따라간다 — Person 엣지·discovery·요청·Match·결과·시도·설문·알림·차단·신고.
그다음 **이 사람이 관리하던 Person 중** 아무도 안 보게 된 것과 그 판본을 지운다(ADR 0023).
남이 놓고 간 고아는 안 건드린다 — 그것은 종료 파기의 일이다.

무엇이 함께 사라지는지 **누르기 전에** 알아야 한다.

- **Match 가 양쪽에서 사라진다.** 공유 결과와 알림도 함께. 상대 화면에서도 없어진다 —
  공유 결과는 서버가 두 판본을 읽어 자르는 것이라 한쪽이 사라지면 설 수 없다(ADR 0010).
- **남이 관리하는 Person 은 남는다.** 「누가 만들었나」만 비워진다.
- **신고 기록도 사라진다.** 신고한 쪽이든 신고당한 쪽이든 계정이 사라지면 그 행이 따라간다.
  안전 운영에 남겨야 할 것이 있으면 **지우기 전에** 따로 적는다.

`invite` 는 안 건드린다. **삭제는 접근 회수가 아니다** — 위의 초대 절과 같은 구분이다.
다시 못 들어오게 하려면 초대도 따로 지운다.

```sql
delete from public.invite where email = '<지운 사람의 주소>';
```

### 종료일이 되면 — **저절로 닫힌다**

종료일이 지나면 `is_active_account()` 가 거짓이 되어 discovery·요청·수락·풀이 생성·설문이
한꺼번에 닫히고, `/me` 아래는 「비공개 테스트가 끝났습니다」로 선다. 운영자가 그날 무엇을
누르지 않아도 된다 — 날짜가 집행한다.

```sql
-- 닫혔는지 본다
select public.beta_is_over(), * from public.current_beta_schedule();
```

미루려면 새 줄을 넣는다(위 「테스트 시작하기」). 넣는 순간 다시 열리고, **모두가 안내를
다시 본다** — 기간이 바뀌는 것은 알린 내용이 바뀌는 것이다.

파기는 저절로 안 된다. 아래를 손으로 돈다.

### 베타 종료 — 전부

```sql
-- 무엇을 지울 것인지 먼저 본다. 세어 보지 않고 지우지 않는다.
select count(*) as 계정 from auth.users;
select count(*) as 사람, (select count(*) from public.person_chart_revision) as 판본
from public.person;
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
-- 안 매여 있고(도착을 적는 영수증이라 그렇다), 감사 로그·flow state·초대 명단은
-- `forget_user` 가 손으로 지운다 — 셋 다 사용자에 매여 있지 않다.
select
  (select count(*) from auth.users)                  as 계정,
  (select count(*) from auth.audit_log_entries)      as 감사로그,
  (select count(*) from auth.flow_state)             as 로그인중간상태,
  (select count(*) from public.invite)               as 초대명단,
  (select count(*) from public.person)               as 사람,
  (select count(*) from public.person_chart_revision) as 판본,
  (select count(*) from public.reading)              as 결과,
  (select count(*) from public.reading_run)          as 시도,
  (select count(*) from public.reading_job)          as 일감,
  (select count(*) from public.reading_feedback)     as 설문,
  (select count(*) from public.notification)         as 알림,
  (select count(*) from public.report)               as 신고,
  (select count(*) from public.reading_webhook_event) as 영수증;
```

**영수증은 마지막이다.** `reading_webhook_event` 는 도착을 적는 자리라 어느 FK 에도 안
매여 있다. 생성이 도는 중에 지우면 그 사이 도착한 응답을 두 번 집을 수 있다. 순서는
**생성 중단 → 재전송 창(최대 72시간) 경과 또는 webhook 폐쇄 → 영수증 삭제**다.

```sql
-- 위 검증에서 영수증만 남았을 때, 재전송 창이 지난 뒤에 지운다.
delete from public.reading_webhook_event;
```

```sql
-- 초대 명단은 사람 이름이 적힌 명단이다. 사람마다의 삭제가 이미 지우지만,
-- 가입한 적 없는 초대는 계정이 없어 그 길로 안 사라진다.
delete from public.invite;
```

### DB 밖

절차가 DB 에서 끝나지 않는다. **여기 적힌 것 중 확인 안 된 것은 확인 안 됐다고 적어 둔다** —
안내에 「파기했습니다」라고 쓰려면 이 목록이 전부 닫혀 있어야 한다.

| 어디 | 무엇이 있나 | 얼마나 남나 |
| --- | --- | --- |
| Supabase Auth | 로그인 신원·세션·토큰 | `auth.users` 삭제가 identities·sessions·one_time_tokens·mfa_factors 를 cascade 로 데려간다(확인함). 감사 로그·flow state 는 FK 가 없어 `forget_user` 가 손으로 지운다 |
| Supabase 백업 | 지운 행이 스냅숏에 남는다 | **Free 플랜에는 자동 일일 백업과 PITR 이 없다.** 운영자가 손으로 dump 를 뜬 적이 없으면 남는 것이 없다. 플랜을 올리면 이 줄을 다시 쓴다 |
| Vercel 로그 | 요청 로그. 출생 원문은 안 적는다(PRD 로그 규율) | **Hobby 플랜의 런타임 로그 보존은 1시간.** 플랜을 올리면 이 줄을 다시 쓴다 |
| OpenAI | 프롬프트에 여덟 글자와 그 위의 사실이 들어간다. 정확한 생년월일시·출생지·분 단위는 안 나간다(ADR 0008) | `store: false` 로 보내되 `background: true` 라 회수용으로 **약 10분** 들고 있다. 그와 별개로 기본 abuse monitoring 로그가 **최대 30일**, 프롬프트 캐시가 마지막 사용 후 **최소 30분**이다 |

> **OpenAI 프로젝트의 ZDR·MAM 설정은 확인 안 됐다.** 별도 승인을 받은 기억이 없으면
> 기본값(최대 30일)으로 안내한다. 승인받았다면 대시보드에서 확인하고 이 줄을 고친다.
>
> 요금제 두 줄은 **지금 플랜 기준**이다. 플랜을 올리는 것은 보존 기간을 늘리는 일이고,
> 그때 처리방침도 함께 고쳐야 한다.

---

## 설문 읽기

답은 **그 글을 만든 시도에 매여 있다**(ADR 0022). 그래서 프롬프트 판본과 모델이 답 옆에
이미 있고, 따로 이어 붙일 일이 없다.

```sql
-- 프롬프트 판본별로 어떻게 읽혔나. 표본이 적을 때는 평균보다 개수를 먼저 본다.
select r.prompt_version, r.model, r.kind,
       count(*) as 답,
       round(avg(f.usefulness), 2) as 도움,
       round(avg(f.perceived_fit), 2) as 체감적합성,
       count(*) filter (where f.felt_length = 'long') as 길다,
       count(*) filter (where f.felt_length = 'short') as 짧다
from public.reading_feedback f
join public.reading_run r on r.id = f.reading_run_id
group by r.prompt_version, r.model, r.kind
order by 답 desc;
```

```sql
-- 무엇이 아쉬웠나. 태그는 여섯 이름뿐이다(`src/lib/reading/feedback.ts`).
select r.prompt_version, t as 태그, count(*)
from public.reading_feedback f
join public.reading_run r on r.id = f.reading_run_id,
     unnest(f.issue_tags) t
group by r.prompt_version, t
order by count(*) desc;
```

> **체감 적합성만 보고 판단하지 않는다.** 바넘 문장은 근거 없이도 「내 얘기 같다」를
> 만든다. 이 값만 오르고 근거 밀착성이 떨어지면 그것은 개선이 아니라 바넘화다(PRD).

**풀이 본문은 여기 없다.** `reading_run` 은 글을 남기지 않으므로 답 옆에 남는 것은 점수와
태그와 생성 메타데이터뿐이고, 사용자의 실제 풀이를 운영자가 읽을 일이 없다.

**설문 전체가 개선 활용 동의 뒤에 있다.** 점수도 태그도 동의한 사람의 것만 들어온다.

```sql
-- 적어 주신 글. 동의한 사람의 것만 들어온다(RPC 가 막는다).
select r.prompt_version, f.comment, f.submitted_at
from public.reading_feedback f
join public.reading_run r on r.id = f.reading_run_id
where f.comment is not null
order by f.submitted_at desc;
```

동의는 `app_user.improvement_consent` 하나다. **`null` 과 `false` 는 다르다** — `null` 은
아직 안 물어본 것이고 `false` 는 거절한 것이다. 안내 화면이 서기 전까지는 전부 `null` 이라
설문이 아무에게도 안 보인다.

값을 손으로 옮기지 않는다. `set_improvement_consent(boolean)` 이 그 문이고, **끄면 그
사람의 답이 함께 지워진다** — 한 트랜잭션이다(ADR 0022). `update` 로 값만 꺼 두면 답은
근거 없이 남는다.

```sql
-- 누가 어디에 있나
select improvement_consent as 동의, count(*) from public.app_user group by 1;
```

---

## 계정 중지와 해제

`status` 하나가 모든 문을 막는다 — 읽기까지 막는다(`is_active_account()`). 새 관문을
두지 않았으므로 이 값만 옮기면 discovery·요청·수락·AI 생성이 한꺼번에 닫힌다.

```sql
-- 중지
update public.app_user
set status = 'suspended'
where id = (select id from auth.users where lower(email) = 'someone@example.com');

-- 해제
update public.app_user
set status = 'active', deletion_requested_at = null
where id = (select id from auth.users where lower(email) = 'someone@example.com');
```

> `deletion_requested` 상태를 해제할 때도 같은 문을 쓴다. 검사식이 상태와 시각을
> 함께 묶고 있으므로 `deletion_requested_at` 을 같이 비워야 한다.

```sql
-- 지금 살아 있지 않은 계정들
select u.email, a.status, a.deletion_requested_at
from public.app_user a join auth.users u on u.id = a.id
where a.status <> 'active'
order by a.deletion_requested_at desc nulls last;
```

---

## 신고와 차단

신고는 **운영자가 봐야 하는 기록**이고 차단은 사용자의 개인적 결정이다. 차단 기록을
운영 근거로 쓰지 않는다 — 「보기 싫다」와 「규칙을 어겼다」는 다른 일이다.

```sql
-- 아직 안 본 신고
select r.id, r.created_at, r.reason, r.detail,
       reporter.email as 신고한_사람, reported.email as 신고당한_사람
from public.report r
join auth.users reporter on reporter.id = r.reporter_user_id
join auth.users reported on reported.id = r.reported_user_id
where r.reviewed_at is null
order by r.created_at;

-- 한 사람에게 쌓인 신고 — 처분을 정하는 자리
select reported.email, r.reason, count(*), max(r.created_at) as 마지막
from public.report r
join auth.users reported on reported.id = r.reported_user_id
group by reported.email, r.reason
order by count(*) desc;

-- 봤다고 적는다. 처분 자체는 여기 안 적는다 — 제재는 `app_user.status` 가 든다.
update public.report set reviewed_at = now() where id = '<report-id>';
```

차단은 참고로만 본다. 누가 누구를 차단했는지는 사용자에게 보이지 않으며, 여기서도
집계로만 읽는다.

```sql
select blocked.email, count(*) as 차단당한_수
from public.block b
join auth.users blocked on blocked.id = b.blocked_user_id
group by blocked.email
having count(*) > 1
order by count(*) desc;
```

---

## 계정 삭제 요청

사용자가 `/me` 에서 요청하면 상태가 `deletion_requested` 로 옮겨지고, 그 순간
후보 노출이 꺼지고 살아 있던 요청이 정리된다. **실제 삭제는 사람이 한다.**

```sql
-- 처리할 요청
select u.email, a.deletion_requested_at,
       (select count(*) from public.match m where m.user_low = a.id or m.user_high = a.id) as 성립한_match
from public.app_user a join auth.users u on u.id = a.id
where a.status = 'deletion_requested'
order by a.deletion_requested_at;
```

무엇을 지우고 무엇을 남길지는 **공개 출시 전에 확정하기로 한 항목**이다(PRD). 지금은
아래를 지키고, 판단이 필요한 건은 남겨 둔다.

- **성립한 Match 는 양쪽에서 사라진다.** 그 공유 결과와 알림도 함께. 고를 수 있는 다른
  답이 없다 — 공유 결과는 서버가 두 판본을 읽어 자르는 것이라 한쪽이 사라지면 그 화면은
  설 수 없다(ADR 0010·0023). 삭제 화면이 누르기 전에 이 사실을 말한다.
- 계산 입력과 Person 은 지운다. 남이 함께 관리하는 Person 은 남고 「누가 만들었나」만
  비워진다.
- **처리 기한은 영업일 3일이다.** 화면과 처리방침이 그렇게 적혀 있다.

```sql
-- **`delete from auth.users` 를 직접 쓰지 않는다.**
--
-- 그 문장은 FK 가 닿는 것만 데려간다. 감사 로그(모든 행이 이메일을 든다)·flow state·
-- 초대 명단은 사용자에 안 매여 있어 그대로 남는다(ADR 0023). 위의 「지우기」 절과 같은
-- 문을 쓴다 — 절차가 둘이면 하나는 낡는다.
select * from public.forget_user('<user-id>');
```

지운 뒤에는 **아래 「베타 종료 — 전부」의 검증 질의를 그대로** 돌려 그 사람의 흔적이
없는지 본다. 한 사람을 지운 뒤라 전체가 0일 수는 없으므로, 그 사람의 이메일과 id 로
좁혀 본다.

```sql
select
  (select count(*) from auth.users where id = '<user-id>') as 계정,
  -- **두 조건을 다 본다.** `forget_user` 가 그 둘로 지운다 — id 로만 세면 이메일만
  -- 든 행(로그인 시도 등)이 남아도 0으로 보인다.
  (select count(*) from auth.audit_log_entries
   where payload ->> 'actor_id' = '<user-id>'
      or payload ->> 'actor_username' = '<지운 주소>') as 감사로그,
  (select count(*) from auth.flow_state where user_id = '<user-id>') as 로그인중간상태,
  (select count(*) from public.invite where email = '<지운 주소>') as 초대명단;
```

---

## AI 생성 — 호출량 · 실패 · 지연

한 번의 생성 요청이 `reading_run` 에 한 줄이다. **본문은 남지 않는다**(ADR 0013) —
여기서 볼 수 있는 것은 언제·무엇으로·어떻게 끝났나뿐이다.

```sql
-- 최근 24시간: 얼마나 불렀고 얼마나 실패했나
select date_trunc('hour', created_at) as 시각,
       count(*) as 시도,
       count(*) filter (where status = 'succeeded') as 성공,
       count(*) filter (where status = 'failed') as 실패,
       round(avg(extract(epoch from (finished_at - created_at))) filter
             (where finished_at is not null)::numeric, 1) as 평균_초
from public.reading_run
where created_at > now() - interval '24 hours'
group by 1 order by 1 desc;

-- 무엇이 막고 있나 — 검사에 걸린 것과 모델이 못 낸 것을 가른다
select failure_code, count(*), max(created_at) as 마지막
from public.reading_run
where status = 'failed' and created_at > now() - interval '7 days'
group by failure_code order by count(*) desc;

-- 도는 채로 남은 시도 (서버가 죽은 자리). DB 가 10분 뒤 만료로 닫지만 세어 둔다.
select id, kind, user_id, created_at
from public.reading_run
where status = 'running' and created_at < now() - interval '10 minutes';

-- 지금 어떤 모델·프롬프트 판본으로 서 있나
select model, prompt_version, count(*), max(created_at) as 마지막
from public.reading_run group by 1, 2 order by 4 desc;
```

**비용은 여기서 안 보인다.** 호출 수는 위에서 세지만 금액은 provider 쪽에 있다.

> **게이트웨이가 아니라 OpenAI 를 직접 부른다.** 이 문단은 「Vercel AI Gateway 에
> 예산 한도를 걸어 둔다」라고 적혀 있었는데, 게이트웨이가 카드 없음으로 거절하는
> 동안 `@ai-sdk/openai` 로 옮겼다(`app/me/reading/model.ts`). 한도를 걸 자리도
> 함께 옮겨 갔다.

한도는 **OpenAI 대시보드**에 건다 — Settings → Organization → Limits 의 월 예산과
경고선이다. 앱의 빗장(`reading_rate_limit()`, 한 시간 20회)은 **사용자당**이라
총액을 막지 못한다. 테스터가 열 명이면 한 시간에 200번까지 열려 있다.

지금 서 있는 값은 `GENERATION` 이 든다. 무엇으로 얼마나 불렀는지는 위의
`reading_run` 질의가 세고, **그것에 값을 곱해 보는 일은 대시보드에서 한다.**

---

## 제품 지표

PRD 의 「제품 분석 지표」를 SQL 로 읽는 자리. 성장 목표 숫자는 아직 두지 않았다 —
먼저 분포를 본다.

```sql
-- 온보딩: 가입한 사람 중 자기 사주를 저장한 비율
select count(*) as 계정,
       count(self_person_id) as selfPerson_저장,
       round(100.0 * count(self_person_id) / nullif(count(*), 0), 1) as 비율
from public.app_user where status = 'active';

-- 참여 · 노출 · 요청 · 수락
select
  (select count(*) from public.discovery_profile where opted_in_at is not null) as 참여중,
  (select count(*) from public.discovery_impression) as 노출,
  (select count(*) from public.match_request) as 요청,
  (select count(*) from public.match_request where status = 'accepted') as 수락,
  (select count(*) from public.match_request where status = 'rejected') as 거절,
  (select count(*) from public.match_request where status = 'pending') as 미응답;

-- 자리와 탐색 여부에 따라 요청률이 다른가 — `discovery-v0` 를 평가하는 근거
select i.position, i.exploration, count(*) as 노출,
       count(r.id) as 요청,
       round(100.0 * count(r.id) / nullif(count(*), 0), 1) as 요청률
from public.discovery_impression i
left join public.match_request r
  on r.requester_user_id = i.viewer_user_id
 and r.addressee_user_id = i.candidate_user_id
group by i.position, i.exploration
order by i.position, i.exploration;

-- 출생시간 유무에 따른 노출 격차 (고정 표본 측정은 `src/lib/discovery/exposure.test.ts`)
select rev.birth_time is not null as 시각_있음,
       count(distinct p.user_id) as 사람,
       count(i.candidate_user_id) as 노출
from public.discovery_profile p
join public.app_user a on a.id = p.user_id
join public.person per on per.id = a.self_person_id
join public.person_chart_revision rev on rev.id = per.current_revision_id
left join public.discovery_impression i on i.candidate_user_id = p.user_id
where p.opted_in_at is not null
group by 1;
```

---

## 배포

`main` 에 푸시하면 자동 배포된다 — https://saju-snowy.vercel.app

마이그레이션은 따로 올린다.

```bash
npx supabase db push          # 새 마이그레이션을 원격에 적용
npx supabase migration list   # 로컬과 원격이 같은지 확인
```

배포 전 확인은 `npm run verify` 와 네 층 전부:

```bash
npm test && npm run test:db && npm run test:flow
npm run test:e2e          # 백엔드 없이 돈다
npm run test:e2e:authed   # `npm run db:start` 를 요구한다
```

**e2e 가 두 명령인 것은 계약이다.** 로그인하지 않은 사람을 돌려보내는 데 백엔드가
필요하면 그것부터 잘못이라, 그쪽은 CI 의 껍데기 접속값으로도 돈다. 로그인 흐름만
로컬 스택을 요구한다.
