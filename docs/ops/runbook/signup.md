# 운영 절차 — 베타 시작 · 초대 · 가입을 닫고 연다

색인은 `docs/ops/runbook.md` 다.

## 테스트 시작하기 — **날짜 한 줄**

지금 시작할 수 있는지는 `select * from public.current_beta_schedule();` 가 답한다 — 줄이 없으면 아무도 시작할 수
없다. 종료일이 없으면 안내가 만들어지지 않고, 안내가 없으면 `/signup` 에 폼이 아예 없다(ADR 0024). 배포 없이 **언제든** 넣고 옮길 수 있다.

> **일정을 옮기면 이미 가입한 사람도 다시 확인한다.** 관문이 「지금 일정 줄」을 보므로
> (ADR 0042) 그 사람들은 다음 방문에 `/signup` 으로 돌아가 확인 하나만 다시 누른다 —
> 코드와 닉네임은 다시 안 묻는다.

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

## 초대 — **코드 한 줄** (ADR 0042)

이메일 명단은 걷었다. 지금 문을 여는 것은 **테스트 코드**다 — 운영자가 코드를 하나 만들고
그 문자열만 전하면 받은 사람이 스스로 들어온다.

> **테스트가 아닌 사람을 처음 들이기 전에 출시 단계를 옮긴다**(ADR 0093 · 0097). 실제 사용자의 자료가 운영
> DB 에 들어오는 날이 공개 뒤의 규율이 켜지는 날이다 — `docs/product/prd/roadmap.md` §7.0 의 「(지금)」을 옮기면 머지 전 전체
> 검증(CI)과 등급 3 의 잠금이 함께 돌아온다. 잠금 쪽은 시험이 `docs/agents/delegation/permissions.md` 「공식 운영에
> 들어가면 켜는 잠금」의 걸음으로 데려간다. 코드를 먼저 건네고 나중에 옮기지 않는다.

코드에는 둘이 붙는다: **사는 기간**과 **최대 인원**. 기한 없는 코드는 새면 영원히 열린
문이고, 수 없는 코드는 한 사람이 퍼뜨리면 정원이 없다. 둘을 함께 두면 새어도 N명까지다.

**정원은 기간 전체에 누적이다**(ADR 0066). 이틀짜리 스무 명은 이틀 합쳐 스무 명이지
날마다 스무 명이 아니다 — `app_user.signup_code` 로 세므로 자리가 안 돌아온다.
**이틀을 덮겠다고 날짜만 다른 코드를 두 줄 넣지 마라.** 그러면 정원이 두 벌이 된다.

```sql
-- 오늘 하루, 열 명. 코드는 **대문자**로 넣는다(검사식이 그것만 받는다).
-- 하루의 경계는 서울 자정이다 — 「오늘」이 사용자가 읽는 오늘과 같아야 한다.
-- `valid_until` 을 안 적으면 하루짜리다.
insert into public.signup_code (code, note, valid_on, max_uses)
values ('SAJU1001', '1차 테스터 · 오픈채팅방 공지', (now() at time zone 'Asia/Seoul')::date, 10);

-- 오늘부터 내일까지, 합쳐서 스무 명.
insert into public.signup_code (code, note, valid_on, valid_until, max_uses)
values ('SAJU1002', '2차 테스터 · 오픈채팅방 공지',
        (now() at time zone 'Asia/Seoul')::date,
        (now() at time zone 'Asia/Seoul')::date + 1, 20);

-- 오늘 살아 있는 코드와 남은 자리
select c.code, c.note, c.valid_on, c.valid_until, c.max_uses,
       count(u.id) as 들어온사람,
       c.max_uses - count(u.id) as 남은자리
from public.signup_code c
left join public.app_user u on u.signup_code = c.code
where (now() at time zone 'Asia/Seoul')::date between c.valid_on and c.valid_until
group by c.code, c.note, c.valid_on, c.valid_until, c.max_uses;

-- 어느 계정이 어느 코드로 왔나
select au.email, u.signup_code, u.signed_up_at, u.nickname
from public.app_user u
join auth.users au on au.id = u.id
order by u.signed_up_at desc nulls last;
```

**`signed_up_at` 이 비어 있는 계정은 「구글 로그인만 한 사람」이다.** 코드를 못 넣었거나
안 넣은 것이고, 그 계정은 아무것도 못 한다 — 사주도 저장한 사람도 못 넣는다. 그대로 두면
된다. 다시 코드를 주면 그 자리에서 가입이 끝난다.

**코드를 지우는 것은 접근 회수가 아니다.** 이미 들어온 사람의 세션은 그대로 산다. 그리고
**누가 그 코드로 들어왔는지가 곧 기록**이라 쓰인 코드는 지워지지 않는다(FK). 막으려면
아래의 계정 중지를 쓴다.

```sql
-- 아직 아무도 안 쓴 코드만 지워진다. 쓰인 코드는 FK 가 막는다 — 그게 맞다.
delete from public.signup_code where code = 'SAJU1001';

-- 쓰인 코드는 하루를 어제로 옮겨 닫는다. 정원은 1 아래로 못 내린다(검사식 `max_uses between 1 and 1000`) —
-- `max_uses = 0` 은 검사식이 거절한다(20260911090000 의 `signup_code`)
update public.signup_code set valid_on = (now() at time zone 'Asia/Seoul')::date - 1, valid_until = (now() at time zone 'Asia/Seoul')::date - 1 where code = 'SAJU1001';
```

> **훅은 껐다.** `[auth.hook.before_user_created]` 는 `config.toml` 에서 지웠다. **원격
> 프로젝트에서는 손으로 꺼야 하고, 그것을 마이그레이션보다 먼저 해야 한다** — `docs/ops/runbook/deploy-once.md`
> 「가입 코드 배포 — 훅을 먼저 끈다」.

---

## 가입을 닫고 연다

운영자가 **3영업일을 넘게** 자리를 비우면 떠나기 전에 닫는다. 닫힌 동안 새 사람은 코드가 살아 있어도 가입이 안 끝나고
「지금 쓸 수 있는 코드가 아닙니다.」를 본다(기존 문장). 이미 가입한 사람은 그대로 쓴다 — 바뀐 안내의 재확인도 된다.

```bash
# 닫는다 — 까닭에 이용자 개인정보를 적지 않는다
npm run db:remote -- --purpose "가입 닫기 — 운영자 부재" \
  "insert into public.signup_pause (reason) values ('운영자 부재 <시작일>~<돌아올 날>')"

# 지금 닫혀 있나
npm run db:remote -- --purpose "가입 닫힘 확인" \
  "select id, paused_at, reason, resumed_at from public.signup_pause order by id desc limit 3"

# 연다 — 돌아와서 밀린 신고를 본 뒤에
npm run db:remote -- --purpose "가입 열기 — 운영자 복귀" \
  "update public.signup_pause set resumed_at = now() where resumed_at is null"
```

열린 줄은 하나뿐이다 — 이미 닫혀 있는데 또 닫으면 `23505` 다. 줄은 지우지 않고 쌓는다(언제 · 왜 닫았는지가 남는다).
