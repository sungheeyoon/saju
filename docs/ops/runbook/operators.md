# 운영 절차 — 운영자 · 설문

색인은 `docs/ops/runbook.md` 다.

## 설문 읽기 — **화면이 있다** (ADR 0061)

운영자로 로그인해서 **`/ops/survey`** 를 연다. 메뉴에 없는 주소라 직접 친다.

화면이 드는 것 넷 — 들어온 답과 동의 분포, 판본별 평균, 아쉬운 점 태그, 적어 주신 글.
아래 SQL 과 **같은 수**를 낸다(집계가 `operator_survey_*` 넷으로 옮겨 갔다). 화면이 안
열리거나 그 수를 의심할 때만 아래로 내려간다.
화면의 문은 읽을 때마다 접속기록에 남는다 — `docs/ops/runbook/security.md` 「운영자 접속기록」(ADR 0105 추기 2026-10-01).

### 운영자를 세우고 내린다

「이 사람이 운영자인가」에만 답하는 표가 따로 있다(`public.operator`). 앱에는 이 표에 닿는
길이 없고 `service_role` 에도 안 열려 있다 — SQL Editor 에서만 넣는다.

```sql
-- 세운다
insert into public.operator (user_id, note)
select id, '누구에게 왜 주었는지'
from auth.users where email = '<그 사람의 구글 계정>';

-- 지금 누가 있나
select u.email, o.note, o.added_at
from public.operator o join auth.users u on u.id = o.user_id;

-- 내린다 — 이 줄이 사라지면 `/ops/survey` 는 그 사람에게 없는 화면이 된다
delete from public.operator where user_id =
  (select id from auth.users where email = '<그 사람의 구글 계정>');
```

**운영자라는 이름으로 열리는 문은 그 이름을 묻는 자리의 개수다.** 지금은 설문을 읽는 함수들과
신고를 읽는 함수 셋(`operator_reports` · `operator_report` · `operator_report_snapshot`, ADR 0103)이고 전부
읽기만 한다. 풀이권 예외는 여기 안 딸려 온다 — 그것은 별개의 표다(`docs/ops/runbook/credits.md` 「풀이권」). 이 줄이 사라지면
`/ops/reports` 도 그 사람에게 없는 화면이 된다.

### 운영자 2단계 인증 — `/ops/mfa` (ADR 0123)

운영 화면(`/ops/reports` · `/ops/survey`)은 **세션이 2단계 인증(aal2)을 마쳐야** 운영자 문을 부른다. 인증 앱(Google
Authenticator · 1Password 등 TOTP)을 쓴다.

- **처음 한 번 — 주소를 직접 친다.** 로그인한 채 **`/ops/mfa`** 를 열고 「인증 앱 등록하기」 → QR 을 찍거나 설정 키를
  넣고 → 앱의 6자리를 넣는다. 등록한 적이 없으면 운영 화면은 운영자가 아닌 사람과 같은 404 라 확인 화면으로 안 보낸다.
- **그다음부터** — 새로 로그인한 세션(다른 기기 · 로그아웃 뒤)으로 운영 화면을 열면 `/ops/mfa` 로 가고, 6자리를 넣으면 보던
  화면으로 돌아온다. **확인하는 순간 Supabase 가 그 계정의 다른 세션을 끊는다** — 다른 기기는 다시 로그인한다.
- **인증 앱을 잃었으면** 사람이 대시보드 Authentication → Users → 그 계정 → MFA factors 에서 요소를 지우고 위 「처음 한 번」을
  다시 밟는다. 에이전트는 이 걸음을 안 한다.
- **운영 Auth 의 TOTP 가 켜져 있어야 한다**(대시보드 Authentication → Multi-Factor → TOTP, 2026-09-24 켜짐 확인 — `docs/ops/runbook/security.md`
  「보안 advisor」 끝). 꺼져 있으면 등록이 「등록을 시작하지 못했습니다」로 선다.
- 이 막음은 **화면의** 것이다. 운영자 문(`is_operator()`)이 aal 을 함께 묻는 마이그레이션은 ADR 0123 「DB 층」이 설계만 든다 —
  그것이 들기 전에 운영자가 운영에서 등록을 마쳐야 한다.

### 두 설문이 한 화면에 선다

`/ops/survey` 는 **풀이 설문**(글 하나에 대한 답)과 **서비스 설문**(서비스 전체에 대한 답,
ADR 0062) 둘을 함께 든다. 아래 SQL 은 앞의 것을 손으로 세는 자리이고, 서비스 설문 쪽은
「서비스 설문 — 손으로 세는 자리」 절에 있다.

### 손으로 세는 자리

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
> 만든다. 이 값만 오르고 근거 밀착성이 떨어지면 그것은 개선이 아니라 바넘화다(`prd-archive`).

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

## 서비스 설문 — 손으로 세는 자리 (ADR 0062)

화면은 `/ops/survey` 의 아래쪽 절이다. 여기 SQL 은 그 화면이 안 열리거나 수를 의심할 때,
그리고 **파기 전에 합계를 뽑을 때** 쓴다.

**제출한 것만 센다.** `submitted_at` 이 비어 있는 줄은 쓰다 만 초안이고, 그 문장을 제출한
의견처럼 읽으면 안 된다.

```sql
-- 참여
select
  count(*) filter (where submitted_at is not null) as 제출,
  count(*) filter (where submitted_at is null)     as 초안,
  count(*) filter (where updated_at is not null)   as 고쳐_다시_제출
from public.service_survey;
```

```sql
-- 문항별 선택지. 이름은 코드가 말로 옮긴다(`src/lib/survey`).
select '좋았던 기능' as 문항, t as 선택, count(*)
from public.service_survey s, unnest(s.liked) t
where s.submitted_at is not null group by t
union all
select '몰랐던 기능', t, count(*)
from public.service_survey s, unnest(s.unknown_features) t
where s.submitted_at is not null group by t
union all
select '개선할 부분', t, count(*)
from public.service_survey s, unnest(s.improve) t
where s.submitted_at is not null group by t
order by 1, 3 desc;
```

```sql
-- 값 — **제시 금액 목록과 함께 본다.** 목록을 옮기고 나면 고른 값만으로는 뜻이 없다.
select price_options as 제시목록,
       price_solo as 사주풀이, price_pair as 궁합, count(*)
from public.service_survey
where submitted_at is not null
group by 1, 2, 3
order by count(*) desc;
```

> **지불 의향이지 실제 구매가 아니다.** 가격 후보를 좁히는 참고 자료로 쓰고, 판매 가격의
> 적절성은 실제 구매·이탈 결과와 함께 판단한다.

```sql
-- 적어 주신 글
select improve_text, free_text, submitted_at
from public.service_survey
where submitted_at is not null and (improve_text is not null or free_text is not null)
order by submitted_at desc;
```

### 파기 전에 뽑는다

답은 계정에 매여 있어 **베타 파기 때 함께 사라진다**(ADR 0023). 위 세 질의를 파기 **전에**
돌려 결과를 따로 보관한다 — 남기는 것은 사람을 못 가리키는 **합계뿐**이고, 자유 서술은
그대로 옮기지 않는다.
