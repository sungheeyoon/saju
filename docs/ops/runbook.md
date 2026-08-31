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

- 성립한 Match 는 한쪽이 지울 수 없다. 두 사람의 것이다.
- 공유된 현재 Reading 의 보존·삭제 기준은 아직 정해지지 않았다.
- 계산 입력과 Person 은 지울 수 있다. 지우면 FK 가 판본·요청·Reading 을 따라 정리한다.

```sql
-- 실제로 지울 때 — auth 쪽을 지우면 app_user 가 따라간다(on delete cascade).
-- 되돌릴 수 없다. 위 목록으로 대상을 확인한 뒤에만 실행한다.
delete from auth.users where id = '<user-id>';
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
