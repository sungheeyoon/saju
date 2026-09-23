-- 하루 전체 상한이 500 이 되고, **운영 검증 계정의 시도는 따로 센다** (G-03, ADR 0039)
--
-- 2026-09-23 사람의 결정. 100 은 「테스터 20명 × 풀이권 5개」에서 뽑은 시작값이었고
-- (ADR 0039 「하루 100회로 시작한다」), 2026-09-11~19 에 쓴 날 7일 · 34회 · 하루 최대 13회를
-- 재고 나서 500 으로 올린다. 80% 알림은 상한에서 뽑으므로(`reading_budget_warning`) 따라
-- 400 이 된다 — 여기서 따로 적지 않는다.
--
-- ## 세는 것은 그대로다
--
-- 시도 행을 여는 문은 `start_reading_run_for` 하나다(2026-09-23 에 `insert into
-- public.reading_run` 을 든 함수를 로컬에서 쟀다 — 그것 하나). 개인 풀이(`self`) · 저장한 사람
-- 풀이(`person`) · 직접 궁합(`private`) · 수락 뒤 자동 궁합과 다시 받기(`match`, 자동은
-- `respond_to_match_request` 가 같은 문을 부른다)가 다 그 문을 지나고, 실패한 시도는 행이
-- 남으므로 센다. 하루의 경계는 서울 자정이다. 그래서 세는 법은 안 고친다 — 값 하나만 바뀐다.
--
-- ## 운영 검증 계정 — 「누구의 시도인가」
--
-- 34회 중 5회가 운영자가 제품을 확인하려고 누른 것이었다. 실제 사용자의 호출로 세면
-- 「사람들이 얼마나 쓰나」가 부푼다. 그래서 **어느 계정이 검증용인가**를 표 하나가 답하고,
-- 지출 표가 그 계정의 수를 따로 내준다.
--
-- `operator` 표를 쓰지 않은 까닭: 그 표는 「이 사람이 운영자인가」에만 답한다(CONTEXT
-- 「운영자」). 운영자가 곧 검증 계정인 것은 지금의 우연이다 — 운영자가 실제로 써 보는 날, 또는
-- 운영자가 아닌 시험 계정을 세우는 날 두 물음이 갈린다. 풀이권 예외와 같은 규율이다.
--
-- **상한은 검증 계정의 시도도 센다.** 토큰은 누가 눌렀든 나간다. 가르는 것은 읽는 수이지
-- 막는 수가 아니다.
--
-- 누가 검증 계정인지는 **저장소에 안 적는다**(공개 저장소). 운영자가 SQL 로 넣는다 —
-- `docs/ops/runbook.md` 「AI 비용 한도」.

create or replace function public.reading_daily_budget()
returns integer
language sql
immutable
set search_path = ''
as $$ select 500 $$;

comment on function public.reading_daily_budget() is
  '하루에 서비스 전체가 만들 수 있는 시도 수 — 서울 자정에 되돌아간다. 2026-09-23 에 100 → 500 (G-03, ADR 0039).';

create table public.verification_account (
  user_id uuid primary key references auth.users (id) on delete cascade,
  /** 누구를 왜 세웠나 — `operator` 의 메모와 같은 자리다 */
  note text not null,
  added_at timestamptz not null default now()
);

comment on table public.verification_account is
  '운영 검증 계정 — 제품을 확인하려고 누르는 계정. 「이 시도가 검증용인가」에만 답하고 아무 문도 열지 않는다. 운영자가 SQL 로 넣는다.';

alter table public.verification_account enable row level security;

-- 정책을 하나도 안 만든다. 어느 계정이 검증용인지는 밖에서 물을 일이 아니다.
revoke all on public.verification_account from anon, authenticated, service_role;

/**
 * 지출 표 — **끝에 넷을 더한다.** 앞 칸은 그대로다(`create or replace view` 는 끝에만 붙인다).
 *
 * `attempts` 는 여전히 전부다 — 상한이 보는 수와 같아야 「오늘 몇 번」의 답이 하나다.
 * 실제 사용자의 수는 `attempts - verification_attempts` 다.
 */
create or replace view public.reading_spend_daily as
select
  (r.created_at at time zone 'Asia/Seoul')::date as day,
  r.kind,
  count(*)::integer as attempts,
  count(*) filter (where r.status = 'succeeded')::integer as succeeded,
  count(*) filter (where r.status = 'failed')::integer as failed,
  count(*) filter (where r.usage is null)::integer as usage_unknown,
  sum((r.usage ->> 'inputTokens')::bigint) as input_tokens,
  sum((r.usage ->> 'outputTokens')::bigint) as output_tokens,
  sum((r.usage ->> 'totalTokens')::bigint) as total_tokens,
  count(*) filter (where v.user_id is not null)::integer as verification_attempts,
  count(*) filter (where v.user_id is not null and r.status = 'succeeded')::integer
    as verification_succeeded,
  count(*) filter (where v.user_id is not null and r.status = 'failed')::integer
    as verification_failed,
  sum((r.usage ->> 'totalTokens')::bigint) filter (where v.user_id is not null)
    as verification_total_tokens
from public.reading_run r
left join public.verification_account v on v.user_id = r.user_id
group by 1, 2;

revoke all on public.reading_spend_daily from anon, authenticated;
