-- 로그인 전 맛보기를 **사람마다 짧은 모델 생성**으로 만들 DB 층 — 넓히기 (ADR 0131 을 대체할 새 ADR 은 예정 — 문서 에이전트가 쓴다)
--
-- 지금 `/` 의 맛보기는 ADR 0131 의 720칸 공용 표(`taste_passage`)다. 운영자가 2026-10-03 에 사람마다의 짧은 생성으로
-- 바꾸기로 하고 값과 흐름을 정했다(아래 「정한 값」, 설계 노트 `docs/notes/2026-10-03-taste-run-experiment.md` 「비용 ·
-- 남용」). 이 마이그레이션은 **DB 층만** 연다 — 앱(서버 액션 · 화면 · 모델 호출)은 뒤따르는 PR 이다. 옛 앱은 이 표도
-- 문도 모르므로 이것만 먼저 올라가도 아무것도 안 바뀐다(ADR 0071 의 넓히기). 옛 `taste_passage` 표와 문은 그대로 둔다 —
-- 앱이 아직 부른다. 좁히기는 앱이 옮긴 뒤다.
--
-- ## 흐름
--
-- 1. 비로그인 방문자가 생년월일시를 넣는다 → 서버가 명식을 계산해 근거 지문(`tasteFingerprintOf`, SHA-256 16진 64자)을 짓는다
-- 2. 서버가 `reserve_taste` 를 **모델 호출 전에** 부른다 — 한 트랜잭션으로 재사용 · 기다림 · 한도 · 예산 · 예약을 가른다
-- 3. 갈래가 `call_model` 이면 서버가 모델을 부르고 `finish_taste` 로 결과(성공 · 실패 · 사용량)를 적는다
-- 4. 브라우저는 `taste_session_view` 로 제 세션을 읽는다 — 세션 id 와 브라우저 HMAC 이 함께 맞아야 읽힌다
-- 5. 가입 뒤 `claim_taste_session` 이 세션을 회원에게 원자적으로 귀속한다 — 지문이 다르면 버림
-- 6. 전체 풀이를 연 뒤(`start_reading_run`, 그대로) `link_taste_reading_run` 이 세션을 그 시도에 잇는다. 풀이 만드는 일은
--    `taste_continuation_of_run` 으로 이어쓸 원문을 읽는다
--
-- ## 정한 값 — 운영자 승인(2026-10-03), 이름 붙은 상수 함수에 산다
--
-- | 값 | 함수 |
-- | --- | --- |
-- | 미가입 맛보기 · 세션 보존 24시간, 생성 시각부터 · 연장 없음 | `taste_keep_for()` |
-- | 브라우저당 새 근거 지문 1시간에 5 | `taste_browser_new_per_hour()` |
-- | IP 당 새 생성 1분에 3 · 하루(서울 날짜) 20 | `taste_ip_calls_per_minute()` · `taste_ip_calls_per_day()` |
-- | 서비스 전체 실제 모델 생성 하루 2,000, 80%(1,600)에서 운영 알림 | `taste_daily_model_calls()`(80% 는 예약 문이 그 값에서 센다) |
-- | 한 artifact 의 모델 시도 최대 3번(자동 재시도 2) | `taste_attempt_limit()` |
-- | 값싼 요청 속도 제한 — IP HMAC 당 1분 30회(캐시 적중도 센다, 조율자가 정함) | `taste_ip_requests_per_minute()` |
-- | 도는 시도의 시간 상한 60초(모델 시간 상한 20초의 세 배 — 이 수만은 이 PR 이 골랐다) | `taste_call_timeout()` |
--
-- **실패한 모델 호출도 상한에 든다** — 예산은 모델을 부르기 **전에** 쓴다. 날짜 경계는 풀이 예산(`reading_spend_today`)과
-- 같은 서울 자정이다.
--
-- ## 원문은 하나도 안 들어온다
--
-- IP · 쿠키 · 생년월일시 원문을 받는 칸이 없다. IP 는 서버가 `HMAC(날짜별 키, IP)` 로, 브라우저 묶음은 서버가
-- `HMAC(안정 비밀, 쿠키 원문)` 으로 지은 **16진 64자**만 받는다 — 모양 검사가 그 밖의 글자(`1.2.3.4` 같은 원문)를
-- `22023` 으로 던진다. HMAC 은 앱이 한다. IP HMAC 이 드는 자리(`taste_rate_event`)는 24시간 뒤 지운다.
--
-- ## 표 넷 — 누구도 직접 못 만진다
--
-- - `taste_artifact` — 생성 결과, **전역 공유.** (지문, 프롬프트 판, 모델 설정 판)이 같으면 브라우저 · 쿠키 · IP 가 달라도
--   한 행이다(`UNIQUE`). 실패한 행을 다시 시도할 때 새 행을 안 만들고 시도 수를 올린다(상한 3).
-- - `taste_session` — 브라우저마다의 승계 기록. **본 판본을 스스로 든다** — artifact 가 성공한 것을 그 세션이 처음 알게
--   되는 순간(성공을 적을 때 · 성공한 것을 재사용할 때) 원문 · 칸 · 판을 세션에 베낀다(스냅숏). artifact 는 24시간 뒤
--   지워지지만 귀속된 세션은 사용자가 읽은 그 글을 그대로 들고 남는다. 귀속 · 이어쓰기 · 풀이 프롬프트는 세션만 읽는다.
--   베끼는 때를 「귀속 순간」이 아니라 「성공을 알게 된 순간」으로 잡은 까닭 — 귀속은 artifact 가 지워진 뒤(23시간 59분에
--   가입)에도 올 수 있고, 그때 베낄 원본이 없다.
-- - `taste_rate_event` — IP · 브라우저의 한도를 세는 사건 기록(요청 · 생성 · 새 지문). 24시간 뒤 지운다.
-- - `taste_daily_count` — 날짜 × 이름의 수. 전체 하루 예산(`model_calls`) · 갈래별 수 · 토큰 합 · 퍼널. 개인을 가리키는 칸이
--   없다 — 지우지 않는다.
--
-- 넷 다 RLS 를 켜고 `anon` · `authenticated` · `service_role` 의 표 권한을 거둔다. 문(함수)만 연다.
--
-- ## 문은 전부 열쇠(`service_role`)에만 연다 — 귀속까지
--
-- - 맛보기 쪽(`reserve_taste` · `finish_taste` · `taste_session_view` · `count_taste_step`)은 방문자가 로그인 전이라 서버가
--   부른다. `anon` 에 열면 아무나 HMAC 칸에 지어낸 값을 넣어 IP · 브라우저 한도를 비켜 간다 — 한도가 서는 까닭이 서버가
--   지은 HMAC 이다.
-- - 귀속 · 잇기(`claim_taste_session` · `link_taste_reading_run` · `taste_continuation_of_run`)도 **열쇠 + 첫 인자 `p_user_id`**
--   다(ADR 0136 의 꼴 — 사람 id 는 서버가 세션에서 얻는다). `auth.uid()` 를 쓰는 로그인 문으로 열지 않은 까닭: 귀속의
--   판정은 **서버가 다시 잰 지문**과 서버만 짓는 브라우저 HMAC 에 기댄다. 로그인한 사람이 PostgREST 로 직접 부를 수
--   있으면 지문을 제가 고른 값으로 넣어 「확정 입력으로 다시 잰 지문과 같다」는 판정을 건너뛴다 — ADR 0136 이 풀의
--   요약을 열쇠로 옮긴 것과 같은 까닭이다. 정지 · 베타 종료 판정은 DB 가 여전히 한다(그 ADR 의 1).
--
-- ## 원자성 — 확인과 증가를 나누지 않는다
--
-- `reserve_taste` 는 자물쇠를 **늘 같은 차례로** 잡는다 — IP → 브라우저 → artifact 열쇠(트랜잭션 advisory lock) → 전체 하루
-- 행(`for update`). 같은 IP 의 요청 · 같은 브라우저의 요청 · 같은 (지문, 판, 판)의 요청 · 모든 모델 예약이 각각 줄을 서므로,
-- 자물쇠 안에서 센 수와 그 뒤의 증가 사이에 남이 끼지 못한다. 차례가 하나라 교착이 없다. 한도에 걸리면 아무것도 증가하지
-- 않는다 — 증가는 모든 확인이 지난 뒤에만 한다. 두 세션 경합은 `scripts/check-db-races.mjs` 의 8 이 실제로 일으킨다.
--
-- ## 상태
--
-- artifact 의 상태는 `running` · `succeeded` · `failed` 셋이다. 브리프의 `reserved` 는 따로 두지 않았다 — 예약하는 트랜잭션이
-- 곧 「이제 부른다」이고 둘 사이를 옮기는 문이 없다. 예약한 순간부터 `running` 이고 시간 상한(60초)도 그때부터 센다.
-- 세션의 상태는 `open`(미귀속) · `claimed`(회원에 귀속) · `discarded`(귀속하려 했는데 지문이 달라 버림) 셋이다.
--
-- ## 지우기
--
-- 크론 `taste-sweep`(5분마다, 매시 1 · 6 · 11 … 분)이 `retention.sweep_taste()` 를 부른다 — 시간 상한을 넘긴 `running` 을
-- `failed`(`timeout`)로 닫고, 24시간 지난 미귀속 세션 · artifact · 사건 기록을 지운다. 귀속된 세션은 안 지운다 — 회원의
-- 풀이 자료다. 탈퇴(`forget_user`)는 `auth.users` 를 지우고 그것이 `app_user` → 귀속된 세션으로 이어 지운다(외래키
-- `on delete cascade`, `reading_run` 이 지워지는 길과 같다). `forget_user` 본문은 고치지 않았다 — 되쓰기 사고를 피한다.
--
-- 재는 자리는 `supabase/tests/80_taste_run.test.sql` 과 `scripts/check-db-races.mjs` 의 8.

-- ---------------------------------------------------------------------------
-- 1. 정한 값
-- ---------------------------------------------------------------------------

/** 미가입 맛보기 · 세션 · 사건 기록을 남기는 기간 — 생성 시각부터, 연장 없음. 운영자 승인(2026-10-03) */
create function public.taste_keep_for()
returns interval language sql immutable set search_path = '' as $$ select interval '24 hours' $$;

/** 서비스 전체가 하루(서울 날짜)에 부를 수 있는 맛보기 모델 수 — 실패한 호출도 센다. 운영자 승인(2026-10-03) */
create function public.taste_daily_model_calls()
returns integer language sql immutable set search_path = '' as $$ select 2000 $$;

/** 브라우저 하나가 한 시간에 새로 모델을 부르게 하는 근거 지문 수. 운영자 승인(2026-10-03) */
create function public.taste_browser_new_per_hour()
returns integer language sql immutable set search_path = '' as $$ select 5 $$;

/** IP 하나가 1분에 부르게 하는 모델 수. 운영자 승인(2026-10-03) */
create function public.taste_ip_calls_per_minute()
returns integer language sql immutable set search_path = '' as $$ select 3 $$;

/** IP 하나가 하루(서울 날짜)에 부르게 하는 모델 수. 운영자 승인(2026-10-03) */
create function public.taste_ip_calls_per_day()
returns integer language sql immutable set search_path = '' as $$ select 20 $$;

/** IP 하나가 1분에 보낼 수 있는 맛보기 요청 수 — 캐시 적중도 센다. 조율자 결정(2026-10-03) */
create function public.taste_ip_requests_per_minute()
returns integer language sql immutable set search_path = '' as $$ select 30 $$;

/** 한 artifact 의 모델 시도 상한 — 처음 한 번 + 자동 재시도 둘. 운영자 승인(2026-10-03) */
create function public.taste_attempt_limit()
returns integer language sql immutable set search_path = '' as $$ select 3 $$;

/** 도는 시도를 죽은 것으로 보는 시간 — 모델 시간 상한(20초)의 세 배 */
create function public.taste_call_timeout()
returns interval language sql immutable set search_path = '' as $$ select interval '60 seconds' $$;

/** 오늘(서울 날짜) */
create function public.taste_today()
returns date language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Seoul')::date $$;

/** 오늘(서울 날짜)이 시작한 때 */
create function public.taste_day_start()
returns timestamptz language sql stable set search_path = ''
as $$ select date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' $$;

-- ---------------------------------------------------------------------------
-- 2. 표
-- ---------------------------------------------------------------------------

create table public.taste_artifact (
  id uuid primary key default gen_random_uuid(),
  /** `tasteFingerprintOf` — 여덟 글자 · 성별 · 시간 앎 · 엔진 판의 SHA-256. 원문이 아니다 */
  evidence_fingerprint text not null check (evidence_fingerprint ~ '^[0-9a-f]{64}$'),
  prompt_version text not null check (prompt_version ~ '^[A-Za-z0-9._:-]{1,64}$'),
  model_config_version text not null check (model_config_version ~ '^[A-Za-z0-9._:-]{1,64}$'),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  /** 몇 번째 시도인가 — 예약할 때마다 하나씩, 상한은 `taste_attempt_limit()` */
  attempts integer not null default 1 check (attempts between 1 and 3),
  /** 지금 시도를 예약한 때 — 시간 상한을 여기서 센다 */
  attempt_started_at timestamptz not null default now(),
  preview_markdown text check (char_length(preview_markdown) between 1 and 2000),
  topic text check (char_length(topic) between 1 and 100),
  distinctive_pattern text check (char_length(distinctive_pattern) between 1 and 1000),
  continuation_question text check (char_length(continuation_question) between 1 and 500),
  answer_direction text check (char_length(answer_direction) between 1 and 1000),
  supporting_claims text[] check (cardinality(supporting_claims) between 1 and 6),
  input_tokens integer check (input_tokens >= 0),
  cache_read_tokens integer check (cache_read_tokens >= 0),
  cache_write_tokens integer check (cache_write_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  reasoning_tokens integer check (reasoning_tokens >= 0),
  response_ms integer check (response_ms >= 0),
  failure_code text check (failure_code ~ '^[a-z0-9-]{1,64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  constraint taste_artifact_one_per_input unique (evidence_fingerprint, prompt_version, model_config_version),
  /* 성공은 낼 칸이 다 있고 실패 코드가 없다. 실패는 코드가 있다 */
  constraint taste_artifact_succeeded_has_content check (
    status <> 'succeeded' or (
      preview_markdown is not null and topic is not null and distinctive_pattern is not null
      and continuation_question is not null and answer_direction is not null and supporting_claims is not null
      and failure_code is null)),
  constraint taste_artifact_failed_has_code check (status <> 'failed' or failure_code is not null)
);

comment on table public.taste_artifact is
  '로그인 전 맛보기의 생성 결과 — (근거 지문, 프롬프트 판, 모델 설정 판)마다 한 행, 전역 공유. 24시간 뒤 지운다. 문으로만 만진다.';

create index taste_artifact_by_expiry on public.taste_artifact (expires_at);
create index taste_artifact_running on public.taste_artifact (attempt_started_at) where status = 'running';

create table public.taste_session (
  /** 추측할 수 없는 id — `gen_random_uuid()` 는 무작위 122비트다. 브라우저의 httpOnly 쿠키 곁에 선다 */
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid references public.taste_artifact (id) on delete set null,
  /** 서버가 `HMAC(안정 비밀, 쿠키 원문)` 으로 지은 값 — 쿠키 원문이 아니다 */
  browser_hmac text not null check (browser_hmac ~ '^[0-9a-f]{64}$'),
  evidence_fingerprint text not null check (evidence_fingerprint ~ '^[0-9a-f]{64}$'),
  prompt_version text not null check (prompt_version ~ '^[A-Za-z0-9._:-]{1,64}$'),
  model_config_version text not null check (model_config_version ~ '^[A-Za-z0-9._:-]{1,64}$'),
  status text not null default 'open' check (status in ('open', 'claimed', 'discarded')),
  /* 본 판본 — 성공을 처음 알게 된 순간 artifact 에서 베낀다. artifact 가 지워져도 남는다 */
  preview_markdown text check (char_length(preview_markdown) between 1 and 2000),
  topic text check (char_length(topic) between 1 and 100),
  distinctive_pattern text check (char_length(distinctive_pattern) between 1 and 1000),
  continuation_question text check (char_length(continuation_question) between 1 and 500),
  answer_direction text check (char_length(answer_direction) between 1 and 1000),
  supporting_claims text[] check (cardinality(supporting_claims) between 1 and 6),
  snapshot_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  claimed_by uuid references public.app_user (id) on delete cascade,
  claimed_at timestamptz,
  reading_run_id uuid references public.reading_run (id) on delete set null,
  constraint taste_session_one_run unique (reading_run_id),
  constraint taste_session_snapshot_whole check (
    (snapshot_at is null and preview_markdown is null)
    or (snapshot_at is not null and preview_markdown is not null and topic is not null
        and distinctive_pattern is not null and continuation_question is not null
        and answer_direction is not null and supporting_claims is not null)),
  constraint taste_session_claim_whole check (
    (status = 'open' and claimed_by is null and claimed_at is null and reading_run_id is null)
    or (status <> 'open' and claimed_by is not null and claimed_at is not null)),
  constraint taste_session_run_only_claimed check (reading_run_id is null or status = 'claimed')
);

comment on table public.taste_session is
  '로그인 전 맛보기를 본 브라우저 하나의 승계 기록 — 본 글을 스스로 든다. 미귀속은 24시간 뒤 지우고, 귀속된 것은 회원의 풀이 자료로 남는다(탈퇴 때 지운다).';

/** 같은 브라우저 · 같은 지문 · 같은 판의 열린 세션은 하나 */
create unique index taste_session_open_one on public.taste_session
  (browser_hmac, evidence_fingerprint, prompt_version, model_config_version) where status = 'open';
create index taste_session_by_artifact on public.taste_session (artifact_id);
create index taste_session_by_member on public.taste_session (claimed_by);
create index taste_session_by_expiry on public.taste_session (expires_at) where status <> 'claimed';

create table public.taste_rate_event (
  id uuid primary key default gen_random_uuid(),
  /** 서버가 지은 HMAC — IP 는 날짜별 키, 브라우저는 안정 비밀. 원문이 아니다 */
  subject_hmac text not null check (subject_hmac ~ '^[0-9a-f]{64}$'),
  /** `ip-request`(IP 의 요청) · `ip-call`(IP 의 모델 예약) · `browser-new`(브라우저의 새 지문 예약) */
  kind text not null check (kind in ('ip-request', 'ip-call', 'browser-new')),
  at timestamptz not null default now()
);

comment on table public.taste_rate_event is
  '맛보기 한도를 세는 사건 — HMAC · 갈래 · 시각뿐. 24시간 뒤 지운다.';

create index taste_rate_event_window on public.taste_rate_event (subject_hmac, kind, at);
create index taste_rate_event_by_at on public.taste_rate_event (at);

create table public.taste_daily_count (
  day date not null,
  /**
   * - `model_calls` — 전체 하루 예산이 세는 수(예약한 모델 호출, 실패 포함)
   * - `reserve:<갈래>` — `reserve_taste` 가 낸 갈래별 수
   * - `call:succeeded` · `call:failed` · `call:late`(시간을 넘겨 닫힌 뒤 온 결과) · `call:timeout`
   * - `tokens:input` · `tokens:cache_read` · `tokens:cache_write` · `tokens:output` · `tokens:reasoning`
   * - `ms:sum` · `ms:max` · `ms:count`
   * - `funnel:<단계>`
   */
  metric text not null check (metric ~ '^[a-z_]+:?[a-z_]*$' and char_length(metric) <= 64),
  value bigint not null default 0 check (value >= 0),
  primary key (day, metric)
);

comment on table public.taste_daily_count is
  '맛보기의 날짜별 수 — 전체 하루 예산 · 갈래 · 토큰 · 응답 시간 · 퍼널. 개인을 가리키는 칸이 없다.';

alter table public.taste_artifact enable row level security;
alter table public.taste_session enable row level security;
alter table public.taste_rate_event enable row level security;
alter table public.taste_daily_count enable row level security;

-- 정책을 하나도 안 만든다 — 문으로만 만진다
revoke all on table public.taste_artifact, public.taste_session, public.taste_rate_event, public.taste_daily_count
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. 안쪽 손잡이 — 아무에게도 안 연다
-- ---------------------------------------------------------------------------

/** 오늘의 수 하나를 더한다(`p_max` 면 큰 값을 남긴다). 값이 `null` 이면(사용량을 모름) 아무것도 안 한다 */
create function public.taste_tally(p_metric text, p_value bigint default 1, p_max boolean default false)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.taste_daily_count (day, metric, value)
  select public.taste_today(), p_metric, greatest(p_value, 0)
  where p_value is not null
  on conflict (day, metric) do update
  set value = case when p_max then greatest(public.taste_daily_count.value, excluded.value)
                   else public.taste_daily_count.value + excluded.value end;
$$;

/**
 * 세션에 성공한 artifact 의 글을 베낀다 — 아직 안 베낀 세션만. 베낀 수만큼 퍼널 「맛보기 성공」을 센다.
 *
 * @returns 이번에 베낀 세션 수
 */
create function public.taste_snapshot(p_artifact_id uuid, p_session_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  copied integer;
begin
  with done as (
    update public.taste_session s
    set preview_markdown = a.preview_markdown,
        topic = a.topic,
        distinctive_pattern = a.distinctive_pattern,
        continuation_question = a.continuation_question,
        answer_direction = a.answer_direction,
        supporting_claims = a.supporting_claims,
        snapshot_at = now()
    from public.taste_artifact a
    where a.id = p_artifact_id and a.status = 'succeeded'
      and s.artifact_id = a.id and s.snapshot_at is null
      and (p_session_id is null or s.id = p_session_id)
    returning 1
  )
  select count(*)::integer into copied from done;

  if copied > 0 then
    perform public.taste_tally('funnel:preview_shown', copied);
  end if;

  return copied;
end;
$$;

/** 모양 검사 — 16진 64자 */
create function public.taste_is_hex64(p_value text)
returns boolean language sql immutable set search_path = '' as $$ select coalesce(p_value ~ '^[0-9a-f]{64}$', false) $$;

/** 모양 검사 — 판 이름 */
create function public.taste_is_version(p_value text)
returns boolean language sql immutable set search_path = ''
as $$ select coalesce(p_value ~ '^[A-Za-z0-9._:-]{1,64}$', false) $$;

-- ---------------------------------------------------------------------------
-- 4. 예약 — `reserve_taste`
-- ---------------------------------------------------------------------------

/**
 * 맛보기 요청 하나를 **모델 호출 전에** 가른다 — 한 트랜잭션.
 *
 * 갈래(`outcome`) — 앱은 수를 화면에 안 보이고 이 글자로만 가른다.
 *
 * - `call_model` — 모델을 불러라. `attempt` 번째 시도이고, 끝나면 그 번호로 `finish_taste` 를 부른다
 * - `reuse_succeeded` — 이미 성공한 글이 있다. 세션이 그 글을 들었다 — `taste_session_view` 로 읽는다. 예산을 안 쓴다
 * - `wait_running` — 같은 입력을 누군가 지금 만들고 있다. 새로 안 부른다 — `taste_session_view` 로 다시 본다
 * - `retries_exhausted` — 같은 입력이 세 번 실패했다. 24시간 안에는 다시 안 부른다
 * - `limited_request` — 이 IP 의 요청이 1분 상한을 넘었다(캐시 적중도 센다)
 * - `limited_browser` — 이 브라우저가 한 시간에 새 지문 다섯을 이미 불렀다
 * - `limited_ip` — 이 IP 가 1분에 셋 또는 오늘 스물을 이미 불렀다
 * - `limited_global` — 오늘 서비스 전체 상한(2,000)이 찼다
 *
 * 세션은 같은 브라우저 · 같은 지문 · 같은 판의 열린 것이 있으면 그것을 쓰고, 없으면 만든다 — 다만 `limited_*` 와 처음
 * 부르는 입력의 한도 거절에서는 안 만든다(`session_id` 가 `null` 일 수 있다).
 *
 * @param p_evidence_fingerprint `tasteFingerprintOf` — 16진 64자
 * @param p_prompt_version 맛보기 프롬프트 판
 * @param p_model_config_version 모델 · 추론 세기 · 상한의 판
 * @param p_browser_hmac 서버가 지은 브라우저 묶음 HMAC — 16진 64자
 * @param p_ip_hmac 서버가 날짜별 키로 지은 IP HMAC — 16진 64자
 * @throws 22023 모양이 틀린 값
 */
create function public.reserve_taste(
  p_evidence_fingerprint text,
  p_prompt_version text,
  p_model_config_version text,
  p_browser_hmac text,
  p_ip_hmac text
)
returns table (outcome text, session_id uuid, artifact_id uuid, attempt integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_session public.taste_session;
  found_artifact public.taste_artifact;
  new_session boolean;
  used bigint;
  verdict text;
  today date := public.taste_today();
begin
  if not public.taste_is_hex64(p_evidence_fingerprint) or not public.taste_is_hex64(p_browser_hmac)
     or not public.taste_is_hex64(p_ip_hmac) then
    raise exception 'taste: fingerprint and hmacs are 64 lowercase hex characters' using errcode = '22023';
  end if;

  if not public.taste_is_version(p_prompt_version) or not public.taste_is_version(p_model_config_version) then
    raise exception 'taste: versions are short names' using errcode = '22023';
  end if;

  -- 자물쇠 차례 — IP → 브라우저 → artifact 열쇠 → 전체 하루 행. 늘 이 차례다(머리말 「원자성」)
  perform pg_advisory_xact_lock(hashtext('taste:ip:' || p_ip_hmac));
  perform pg_advisory_xact_lock(hashtext('taste:browser:' || p_browser_hmac));
  perform pg_advisory_xact_lock(hashtext(
    'taste:artifact:' || p_evidence_fingerprint || ':' || p_prompt_version || ':' || p_model_config_version));

  -- 0. 값싼 요청 속도 제한 — 캐시 적중도 센다
  if (select count(*) from public.taste_rate_event e
      where e.subject_hmac = p_ip_hmac and e.kind = 'ip-request' and e.at > now() - interval '1 minute')
     >= public.taste_ip_requests_per_minute() then
    perform public.taste_tally('reserve:limited_request');
    return query select 'limited_request'::text, null::uuid, null::uuid, null::integer;
    return;
  end if;

  insert into public.taste_rate_event (subject_hmac, kind) values (p_ip_hmac, 'ip-request');

  -- 이 브라우저의 열린 세션 — 만료된 것은 지우고 없는 것으로 본다(미귀속이다)
  delete from public.taste_session s
  where s.status = 'open' and s.expires_at <= now()
    and s.browser_hmac = p_browser_hmac and s.evidence_fingerprint = p_evidence_fingerprint
    and s.prompt_version = p_prompt_version and s.model_config_version = p_model_config_version;

  select * into found_session from public.taste_session s
  where s.status = 'open'
    and s.browser_hmac = p_browser_hmac and s.evidence_fingerprint = p_evidence_fingerprint
    and s.prompt_version = p_prompt_version and s.model_config_version = p_model_config_version
  for update;

  new_session := found_session.id is null;

  -- 세션이 이미 글을 들었으면 끝이다 — artifact 가 지워졌어도
  if not new_session and found_session.snapshot_at is not null then
    perform public.taste_tally('reserve:reuse_succeeded');
    return query select 'reuse_succeeded'::text, found_session.id, found_session.artifact_id, null::integer;
    return;
  end if;

  -- artifact — 만료된 것은 지운다(세션의 글은 남는다), 시간을 넘긴 시도는 닫는다
  delete from public.taste_artifact a
  where a.evidence_fingerprint = p_evidence_fingerprint and a.prompt_version = p_prompt_version
    and a.model_config_version = p_model_config_version and a.expires_at <= now();

  select * into found_artifact from public.taste_artifact a
  where a.evidence_fingerprint = p_evidence_fingerprint and a.prompt_version = p_prompt_version
    and a.model_config_version = p_model_config_version
  for update;

  if found_artifact.status = 'running' and found_artifact.attempt_started_at <= now() - public.taste_call_timeout() then
    update public.taste_artifact a
    set status = 'failed', failure_code = 'timeout', updated_at = now()
    where a.id = found_artifact.id
    returning * into found_artifact;
    perform public.taste_tally('call:timeout');
  end if;

  -- ①② 성공한 것 · 도는 것 · 다 쓴 것 — 모델을 안 부른다. 세션만 잇는다
  if found_artifact.id is not null
     and (found_artifact.status in ('succeeded', 'running') or found_artifact.attempts >= public.taste_attempt_limit()) then
    if new_session then
      insert into public.taste_session
        (artifact_id, browser_hmac, evidence_fingerprint, prompt_version, model_config_version, created_at, expires_at)
      values (found_artifact.id, p_browser_hmac, p_evidence_fingerprint, p_prompt_version, p_model_config_version,
              now(), now() + public.taste_keep_for())
      returning * into found_session;
    elsif found_session.artifact_id is distinct from found_artifact.id then
      update public.taste_session s set artifact_id = found_artifact.id where s.id = found_session.id;
    end if;

    verdict := case found_artifact.status
      when 'succeeded' then 'reuse_succeeded'
      when 'running' then 'wait_running'
      else 'retries_exhausted' end;

    if verdict = 'reuse_succeeded' then
      perform public.taste_snapshot(found_artifact.id, found_session.id);
    end if;

    perform public.taste_tally('reserve:' || verdict);
    return query select verdict, found_session.id, found_artifact.id, null::integer;
    return;
  end if;

  -- ③ 브라우저 — 새 지문일 때만 센다(이미 연 세션의 재시도는 새 지문이 아니다)
  if new_session and (
      select count(*) from public.taste_rate_event e
      where e.subject_hmac = p_browser_hmac and e.kind = 'browser-new' and e.at > now() - interval '1 hour')
     >= public.taste_browser_new_per_hour() then
    verdict := 'limited_browser';
  -- ④ IP — 1분 · 오늘
  elsif (select count(*) from public.taste_rate_event e
         where e.subject_hmac = p_ip_hmac and e.kind = 'ip-call' and e.at > now() - interval '1 minute')
        >= public.taste_ip_calls_per_minute()
     or (select count(*) from public.taste_rate_event e
         where e.subject_hmac = p_ip_hmac and e.kind = 'ip-call' and e.at >= public.taste_day_start())
        >= public.taste_ip_calls_per_day() then
    verdict := 'limited_ip';
  end if;

  if verdict is null then
    -- ⑤ 전체 — 오늘의 행을 잠그고 센다
    insert into public.taste_daily_count (day, metric, value) values (today, 'model_calls', 0)
    on conflict (day, metric) do nothing;

    select c.value into used from public.taste_daily_count c
    where c.day = today and c.metric = 'model_calls'
    for update;

    if used >= public.taste_daily_model_calls() then
      verdict := 'limited_global';
    end if;
  end if;

  if verdict is not null then
    perform public.taste_tally('reserve:' || verdict);
    return query select verdict, found_session.id, found_session.artifact_id, null::integer;
    return;
  end if;

  -- ⑥ 다 지났다 — 이제야 센다
  update public.taste_daily_count c set value = c.value + 1
  where c.day = today and c.metric = 'model_calls'
  returning c.value into used;

  insert into public.taste_rate_event (subject_hmac, kind) values (p_ip_hmac, 'ip-call');

  if new_session then
    insert into public.taste_rate_event (subject_hmac, kind) values (p_browser_hmac, 'browser-new');
  end if;

  if found_artifact.id is null then
    insert into public.taste_artifact
      (evidence_fingerprint, prompt_version, model_config_version, status, attempts, attempt_started_at,
       created_at, updated_at, expires_at)
    values (p_evidence_fingerprint, p_prompt_version, p_model_config_version, 'running', 1, now(),
            now(), now(), now() + public.taste_keep_for())
    returning * into found_artifact;
  else
    -- 실패한 행의 재시도 — 새 행을 안 만든다. 앞 시도의 사용량 · 실패 코드는 날짜별 수에 이미 들었다
    update public.taste_artifact a
    set status = 'running', attempts = a.attempts + 1, attempt_started_at = now(), failure_code = null,
        input_tokens = null, cache_read_tokens = null, cache_write_tokens = null, output_tokens = null,
        reasoning_tokens = null, response_ms = null, updated_at = now()
    where a.id = found_artifact.id
    returning * into found_artifact;
  end if;

  if new_session then
    insert into public.taste_session
      (artifact_id, browser_hmac, evidence_fingerprint, prompt_version, model_config_version, created_at, expires_at)
    values (found_artifact.id, p_browser_hmac, p_evidence_fingerprint, p_prompt_version, p_model_config_version,
            now(), now() + public.taste_keep_for())
    returning * into found_session;
  elsif found_session.artifact_id is distinct from found_artifact.id then
    update public.taste_session s set artifact_id = found_artifact.id where s.id = found_session.id;
  end if;

  perform public.taste_tally('reserve:call_model');

  -- 방금 넣은 것까지 세서 문턱을 넘었으면 알린다 — 풀이 예산(`start_reading_run_for`)과 같은 꼴, 하루 한 줄
  if used >= public.taste_daily_model_calls() then
    perform public.notify_ops(
      'taste-budget-reached',
      format('오늘 맛보기 모델 호출 %s건으로 하루 상한(%s)을 채웠습니다. 다음 새 맛보기부터 막힙니다.',
             used, public.taste_daily_model_calls()));
  /*
    80% 는 상한 함수에서 바로 센다 — 따로 함수를 두면(`taste_budget_warning()` 꼴) 저장된 계획이 그 안쪽 상한을 접어 두어,
    상한 함수를 고쳐도 떠 있는 연결은 옛 80% 를 본다(2026-10-03 에 pgTAP 이 잡았다 — 상한은 새 값, 알림은 옛 값).
  */
  elsif used >= (public.taste_daily_model_calls() * 4) / 5 then
    perform public.notify_ops(
      'taste-budget-warning',
      format('오늘 맛보기 모델 호출 %s건으로 하루 상한(%s)의 80%%를 넘었습니다.',
             used, public.taste_daily_model_calls()));
  end if;

  return query select 'call_model'::text, found_session.id, found_artifact.id, found_artifact.attempts;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. 결과 — `finish_taste`
-- ---------------------------------------------------------------------------

/**
 * 모델의 결과를 적는다 — `p_failure_code` 가 `null` 이면 성공(낼 칸이 다 있어야 한다), 아니면 실패.
 *
 * **멱등이다.** artifact 가 `running` 이고 시도 번호가 같을 때만 적고 `recorded` 를 낸다. 이미 닫혔거나(시간 상한 ·
 * 앞선 결과) 다음 시도가 시작된 뒤에 온 결과는 `ignored` 다 — 행을 안 바꾼다. **사용량은 어느 쪽이든 날짜별 수에
 * 더한다** — 늦게 온 결과도 토큰은 나갔다.
 *
 * 성공이면 그 artifact 를 가리키는 세션 전부에 글을 베낀다(스냅숏).
 *
 * @returns `recorded` · `ignored`
 * @throws 22023 모양이 틀린 값 — 성공인데 칸이 비었거나, 실패 코드 꼴이 아니거나, 사용량이 음수
 */
create function public.finish_taste(
  p_artifact_id uuid,
  p_attempt integer,
  p_failure_code text default null,
  p_preview_markdown text default null,
  p_topic text default null,
  p_distinctive_pattern text default null,
  p_continuation_question text default null,
  p_answer_direction text default null,
  p_supporting_claims text[] default null,
  p_input_tokens integer default null,
  p_cache_read_tokens integer default null,
  p_cache_write_tokens integer default null,
  p_output_tokens integer default null,
  p_reasoning_tokens integer default null,
  p_response_ms integer default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.taste_artifact;
  succeeded boolean := p_failure_code is null;
begin
  if p_artifact_id is null or p_attempt is null then
    raise exception 'taste: artifact and attempt are required' using errcode = '22023';
  end if;

  if not succeeded and p_failure_code !~ '^[a-z0-9-]{1,64}$' then
    raise exception 'taste: failure code is a short slug' using errcode = '22023';
  end if;

  if succeeded and (
       coalesce(char_length(p_preview_markdown), 0) not between 1 and 2000
       or coalesce(char_length(p_topic), 0) not between 1 and 100
       or coalesce(char_length(p_distinctive_pattern), 0) not between 1 and 1000
       or coalesce(char_length(p_continuation_question), 0) not between 1 and 500
       or coalesce(char_length(p_answer_direction), 0) not between 1 and 1000
       or coalesce(cardinality(p_supporting_claims), 0) not between 1 and 6
       or exists (select 1 from unnest(p_supporting_claims) c where c !~ '^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*$')) then
    raise exception 'taste: a success carries every field' using errcode = '22023';
  end if;

  if least(p_input_tokens, p_cache_read_tokens, p_cache_write_tokens, p_output_tokens, p_reasoning_tokens, p_response_ms) < 0 then
    raise exception 'taste: usage is never negative' using errcode = '22023';
  end if;

  -- 사용량은 늘 센다
  perform public.taste_tally('tokens:input', p_input_tokens);
  perform public.taste_tally('tokens:cache_read', p_cache_read_tokens);
  perform public.taste_tally('tokens:cache_write', p_cache_write_tokens);
  perform public.taste_tally('tokens:output', p_output_tokens);
  perform public.taste_tally('tokens:reasoning', p_reasoning_tokens);
  if p_response_ms is not null then
    perform public.taste_tally('ms:sum', p_response_ms);
    perform public.taste_tally('ms:count', 1);
    perform public.taste_tally('ms:max', p_response_ms, true);
  end if;

  select * into target from public.taste_artifact a where a.id = p_artifact_id for update;

  if target.id is null or target.status <> 'running' or target.attempts <> p_attempt then
    perform public.taste_tally('call:late');
    return 'ignored';
  end if;

  update public.taste_artifact a
  set status = case when succeeded then 'succeeded' else 'failed' end,
      failure_code = p_failure_code,
      preview_markdown = case when succeeded then p_preview_markdown end,
      topic = case when succeeded then p_topic end,
      distinctive_pattern = case when succeeded then p_distinctive_pattern end,
      continuation_question = case when succeeded then p_continuation_question end,
      answer_direction = case when succeeded then p_answer_direction end,
      supporting_claims = case when succeeded then p_supporting_claims end,
      input_tokens = p_input_tokens,
      cache_read_tokens = p_cache_read_tokens,
      cache_write_tokens = p_cache_write_tokens,
      output_tokens = p_output_tokens,
      reasoning_tokens = p_reasoning_tokens,
      response_ms = p_response_ms,
      updated_at = now()
  where a.id = target.id;

  perform public.taste_tally(case when succeeded then 'call:succeeded' else 'call:failed' end);

  if succeeded then
    perform public.taste_snapshot(target.id);
  end if;

  return 'recorded';
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. 브라우저가 읽는다 — `taste_session_view`
-- ---------------------------------------------------------------------------

/**
 * 브라우저 하나가 제 세션을 읽는다 — **세션 id 와 브라우저 HMAC 이 함께 맞아야** 한다. id 만으로는 0행이다.
 *
 * `state`
 * - `succeeded` — 글이 있다(`preview_markdown`)
 * - `running` — 아직 만드는 중이다. 조금 뒤 다시 읽는다
 * - `failed` — 이번 시도가 실패했다(시간 상한을 넘긴 것 포함). `retryable` 이 참이면 `reserve_taste` 를 다시 부르면 다음
 *   시도가 예약된다
 * - `claimed` — 이미 회원에게 귀속됐다. 로그인 전 화면에는 글을 다시 안 낸다
 *
 * 없는 세션 · HMAC 이 다른 세션 · 24시간이 지난 미귀속 세션 · 결과가 지워진 세션은 0행이다.
 */
create function public.taste_session_view(p_session_id uuid, p_browser_hmac text)
returns table (state text, retryable boolean, preview_markdown text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when s.status <> 'open' then 'claimed'
      when s.snapshot_at is not null then 'succeeded'
      when a.status = 'succeeded' then 'succeeded'
      when a.status = 'running' and a.attempt_started_at > now() - public.taste_call_timeout() then 'running'
      else 'failed'
    end,
    coalesce(
      s.status = 'open' and s.snapshot_at is null and a.attempts < public.taste_attempt_limit()
        and (a.status = 'failed'
             or (a.status = 'running' and a.attempt_started_at <= now() - public.taste_call_timeout())),
      false),
    case when s.status = 'open' then coalesce(s.preview_markdown, case when a.status = 'succeeded' then a.preview_markdown end) end,
    s.expires_at
  from public.taste_session s
  left join public.taste_artifact a on a.id = s.artifact_id
  where s.id = p_session_id
    and s.browser_hmac = p_browser_hmac
    and (s.status <> 'open' or s.expires_at > now())
    and (s.status <> 'open' or s.snapshot_at is not null or a.id is not null);
$$;

-- ---------------------------------------------------------------------------
-- 7. 귀속 — `claim_taste_session`
-- ---------------------------------------------------------------------------

/**
 * 가입한 회원에게 세션 하나를 **한 번에** 귀속한다. 세션 행을 잠그고 가른다.
 *
 * `outcome`
 * - `claimed` — 귀속했다, 또는 이미 이 회원 것이다(같은 회원의 재시도는 멱등). 글 · 판 · 이어진 풀이 시도를 함께 낸다
 * - `discarded` — 확정 입력으로 다시 잰 지문이 세션의 지문과 다르다. 이어쓰기 없이 보통 풀이로 간다. 열린 세션이었으면
 *   버림(`discarded`)으로 닫아 이 회원에게 붙여 둔다. 이미 귀속된 세션이면 행은 그대로 둔다(그 세션의 풀이가 남는다)
 * - `taken` — 다른 회원에게 이미 귀속됐다
 * - `expired` — 24시간이 지난 미귀속 세션이다
 * - `not_ready` — 세션에 아직 글이 없다(만드는 중 · 실패)
 * - `not_found` — 없는 세션이거나 브라우저 HMAC 이 다르다(둘을 가르지 않는다 — id 만으로 세션이 있는지 못 묻게)
 *
 * `reading_run_status` 는 이어진 풀이 시도의 상태다 — `running` · `succeeded` · `failed`(시간 상한을 넘긴 `running` 포함) ·
 * 이어진 것이 없으면 `null`. `succeeded` 면 앱은 새로 만들지 않고 그 풀이를 연다.
 *
 * @param p_user_id 서버가 로그인 세션에서 얻은 회원 id(ADR 0136 의 꼴)
 * @param p_evidence_fingerprint 확정 입력으로 서버가 다시 잰 지문
 * @throws 28000 회원 id 가 없다
 * @throws 42501 정지됐거나 · 베타가 끝났거나 · 가입을 안 마친 계정
 * @throws 22023 모양이 틀린 값
 */
create function public.claim_taste_session(
  p_user_id uuid,
  p_session_id uuid,
  p_browser_hmac text,
  p_evidence_fingerprint text
)
returns table (
  outcome text,
  preview_markdown text,
  topic text,
  distinctive_pattern text,
  continuation_question text,
  answer_direction text,
  supporting_claims text[],
  prompt_version text,
  model_config_version text,
  reading_run_id uuid,
  reading_run_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  account public.app_user;
  target public.taste_session;
  run_status text;
begin
  if p_user_id is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if p_session_id is null or not public.taste_is_hex64(p_browser_hmac) or not public.taste_is_hex64(p_evidence_fingerprint) then
    raise exception 'taste: session, browser hmac and fingerprint are required' using errcode = '22023';
  end if;

  select * into account from public.app_user u where u.id = p_user_id;

  /* 열쇠 문의 관문 — `create_self_person`(`20261106090000`)과 같은 셋, 같은 문장 */
  if account.id is null or account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = '42501';
  end if;

  if account.signed_up_at is null then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  select * into target from public.taste_session s where s.id = p_session_id for update;

  if target.id is null or target.browser_hmac <> p_browser_hmac then
    return query select 'not_found'::text, null::text, null::text, null::text, null::text, null::text,
      null::text[], null::text, null::text, null::uuid, null::text;
    return;
  end if;

  if target.status <> 'open' and target.claimed_by <> p_user_id then
    return query select 'taken'::text, null::text, null::text, null::text, null::text, null::text,
      null::text[], null::text, null::text, null::uuid, null::text;
    return;
  end if;

  if target.status = 'open' and target.expires_at <= now() then
    return query select 'expired'::text, null::text, null::text, null::text, null::text, null::text,
      null::text[], null::text, null::text, null::uuid, null::text;
    return;
  end if;

  if target.status = 'discarded' or target.evidence_fingerprint <> p_evidence_fingerprint then
    if target.status = 'open' then
      update public.taste_session s
      set status = 'discarded', claimed_by = p_user_id, claimed_at = now()
      where s.id = target.id;
    end if;

    return query select 'discarded'::text, null::text, null::text, null::text, null::text, null::text,
      null::text[], null::text, null::text, null::uuid, null::text;
    return;
  end if;

  if target.snapshot_at is null then
    return query select 'not_ready'::text, null::text, null::text, null::text, null::text, null::text,
      null::text[], null::text, null::text, null::uuid, null::text;
    return;
  end if;

  if target.status = 'open' then
    update public.taste_session s
    set status = 'claimed', claimed_by = p_user_id, claimed_at = now()
    where s.id = target.id;
    perform public.taste_tally('funnel:session_claimed');
  end if;

  select case when r.status = 'running' and r.created_at <= now() - public.reading_run_timeout() then 'failed'
              else r.status end
  into run_status
  from public.reading_run r where r.id = target.reading_run_id;

  return query select 'claimed'::text, target.preview_markdown, target.topic, target.distinctive_pattern,
    target.continuation_question, target.answer_direction, target.supporting_claims,
    target.prompt_version, target.model_config_version, target.reading_run_id, run_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. 풀이 시도에 잇는다 — `link_taste_reading_run`
-- ---------------------------------------------------------------------------

/**
 * 귀속된 세션을 이 회원의 자기 풀이 시도 하나에 잇는다 — 세션 하나는 시도 하나에만, 시도 하나는 세션 하나에만.
 *
 * 풀이권 규칙은 안 건드린다 — 시도를 여는 것은 그대로 `start_reading_run` 이다(실패한 시도는 풀이권을 안 쓴다). 앱은 시도를
 * 연 뒤 이 문을 부른다.
 *
 * `outcome`
 * - `linked` — 이었다(같은 시도로 다시 부르면 멱등). 앞에 이어진 시도가 실패했으면(시간 상한 포함) 새 시도로 바꿔 잇는다
 * - `already_succeeded` — 앞에 이어진 시도가 성공했다. 바꾸지 않는다 — `reading_run_id` 의 풀이를 연다
 * - `already_running` — 앞에 이어진 시도가 아직 돈다. 바꾸지 않는다
 * - `not_claimed` — 이 회원에게 귀속된 세션이 아니다(없음 · 남의 것 · 버림)
 * - `wrong_run` — 이 회원의 자기 풀이(`self`) 시도가 아니다
 * - `run_taken` — 그 시도가 이미 다른 세션에 이어졌다
 *
 * @throws 28000 회원 id 가 없다
 * @throws 22023 세션 · 시도가 없다
 */
create function public.link_taste_reading_run(p_user_id uuid, p_session_id uuid, p_reading_run_id uuid)
returns table (outcome text, reading_run_id uuid, reading_run_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.taste_session;
  run public.reading_run;
  linked public.reading_run;
  linked_status text;
begin
  if p_user_id is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if p_session_id is null or p_reading_run_id is null then
    raise exception 'taste: session and reading run are required' using errcode = '22023';
  end if;

  select * into target from public.taste_session s where s.id = p_session_id for update;

  if target.id is null or target.status <> 'claimed' or target.claimed_by <> p_user_id then
    return query select 'not_claimed'::text, null::uuid, null::text;
    return;
  end if;

  select * into run from public.reading_run r where r.id = p_reading_run_id;

  if run.id is null or run.user_id <> p_user_id or run.kind <> 'self' then
    return query select 'wrong_run'::text, null::uuid, null::text;
    return;
  end if;

  if target.reading_run_id = run.id then
    return query select 'linked'::text, run.id, run.status;
    return;
  end if;

  if target.reading_run_id is not null then
    select * into linked from public.reading_run r where r.id = target.reading_run_id;
    linked_status := case when linked.status = 'running' and linked.created_at <= now() - public.reading_run_timeout()
                          then 'failed' else linked.status end;

    if linked_status = 'succeeded' then
      return query select 'already_succeeded'::text, linked.id, linked_status;
      return;
    elsif linked_status = 'running' then
      return query select 'already_running'::text, linked.id, linked_status;
      return;
    end if;
  end if;

  if exists (select 1 from public.taste_session s where s.reading_run_id = run.id and s.id <> target.id) then
    return query select 'run_taken'::text, null::uuid, null::text;
    return;
  end if;

  update public.taste_session s set reading_run_id = run.id where s.id = target.id;
  perform public.taste_tally('funnel:reading_started');

  return query select 'linked'::text, run.id, run.status;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. 이어쓸 원문 — `taste_continuation_of_run`
-- ---------------------------------------------------------------------------

/**
 * 풀이 시도 하나에 이어진 맛보기 — 풀이 프롬프트의 이어쓰기 블록과 결과 화면의 「아까 보던 내용」이 읽는다. **세션의
 * 스냅숏을 읽는다** — artifact 를 다시 안 읽는다. 이 회원에게 귀속되고 이 시도에 이어진 것이 없으면 0행이다.
 */
create function public.taste_continuation_of_run(p_user_id uuid, p_reading_run_id uuid)
returns table (
  session_id uuid,
  preview_markdown text,
  topic text,
  distinctive_pattern text,
  continuation_question text,
  answer_direction text,
  supporting_claims text[],
  prompt_version text,
  model_config_version text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.preview_markdown, s.topic, s.distinctive_pattern, s.continuation_question, s.answer_direction,
         s.supporting_claims, s.prompt_version, s.model_config_version
  from public.taste_session s
  where s.reading_run_id = p_reading_run_id and s.claimed_by = p_user_id and s.status = 'claimed'
    and s.snapshot_at is not null;
$$;

-- ---------------------------------------------------------------------------
-- 10. 퍼널 · 관측
-- ---------------------------------------------------------------------------

/**
 * 퍼널의 한 단계를 오늘의 수에 하나 더한다 — **앱이 보는 단계만** 받는다. 날짜와 단계뿐이고 누구인지는 안 받는다.
 *
 * - `more_clicked` — 맛보기 아래 「더보기」를 눌렀다
 * - `signup_started` — 가입을 시작했다
 * - `signup_completed` — 가입을 마쳤다
 * - `reading_succeeded` — 이어 쓴 전체 풀이가 성공했다
 *
 * DB 가 스스로 세는 단계는 안 받는다 — 두 번 세지 않게. `preview_shown`(세션이 글을 처음 받음) · `session_claimed`(귀속) ·
 * `reading_started`(풀이 시도에 이음).
 *
 * @throws 22023 모르는 단계
 */
create function public.count_taste_step(p_step text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_step is null or p_step not in ('more_clicked', 'signup_started', 'signup_completed', 'reading_succeeded') then
    raise exception 'taste: step is one of more_clicked, signup_started, signup_completed, reading_succeeded'
      using errcode = '22023';
  end if;

  perform public.taste_tally('funnel:' || p_step);
end;
$$;

/**
 * 맛보기의 날짜별 한 줄 — 운영자가 `select * from public.taste_daily order by day desc` 한 줄로 본다. 개인이 없다.
 *
 * 비용은 토큰까지다 — 금액은 단가를 아는 앱 · runbook 이 곱한다. 응답 시간 평균은 결과가 온 호출(늦게 온 것 포함)의 평균이다.
 */
create view public.taste_daily with (security_invoker = true) as
select
  c.day,
  coalesce(max(c.value) filter (where c.metric = 'model_calls'), 0) as model_calls,
  coalesce(max(c.value) filter (where c.metric = 'reserve:call_model'), 0) as call_model,
  coalesce(max(c.value) filter (where c.metric = 'reserve:reuse_succeeded'), 0) as reuse_succeeded,
  coalesce(max(c.value) filter (where c.metric = 'reserve:wait_running'), 0) as wait_running,
  coalesce(max(c.value) filter (where c.metric = 'reserve:retries_exhausted'), 0) as retries_exhausted,
  coalesce(max(c.value) filter (where c.metric = 'reserve:limited_request'), 0) as limited_request,
  coalesce(max(c.value) filter (where c.metric = 'reserve:limited_browser'), 0) as limited_browser,
  coalesce(max(c.value) filter (where c.metric = 'reserve:limited_ip'), 0) as limited_ip,
  coalesce(max(c.value) filter (where c.metric = 'reserve:limited_global'), 0) as limited_global,
  coalesce(max(c.value) filter (where c.metric = 'call:succeeded'), 0) as calls_succeeded,
  coalesce(max(c.value) filter (where c.metric = 'call:failed'), 0) as calls_failed,
  coalesce(max(c.value) filter (where c.metric = 'call:timeout'), 0) as calls_timed_out,
  coalesce(max(c.value) filter (where c.metric = 'call:late'), 0) as calls_late,
  coalesce(max(c.value) filter (where c.metric = 'tokens:input'), 0) as input_tokens,
  coalesce(max(c.value) filter (where c.metric = 'tokens:cache_read'), 0) as cache_read_tokens,
  coalesce(max(c.value) filter (where c.metric = 'tokens:cache_write'), 0) as cache_write_tokens,
  coalesce(max(c.value) filter (where c.metric = 'tokens:output'), 0) as output_tokens,
  coalesce(max(c.value) filter (where c.metric = 'tokens:reasoning'), 0) as reasoning_tokens,
  round(max(c.value) filter (where c.metric = 'ms:sum')::numeric
        / nullif(max(c.value) filter (where c.metric = 'ms:count'), 0)) as avg_response_ms,
  max(c.value) filter (where c.metric = 'ms:max') as max_response_ms,
  coalesce(max(c.value) filter (where c.metric = 'funnel:preview_shown'), 0) as preview_shown,
  coalesce(max(c.value) filter (where c.metric = 'funnel:more_clicked'), 0) as more_clicked,
  coalesce(max(c.value) filter (where c.metric = 'funnel:signup_started'), 0) as signup_started,
  coalesce(max(c.value) filter (where c.metric = 'funnel:signup_completed'), 0) as signup_completed,
  coalesce(max(c.value) filter (where c.metric = 'funnel:session_claimed'), 0) as session_claimed,
  coalesce(max(c.value) filter (where c.metric = 'funnel:reading_started'), 0) as reading_started,
  coalesce(max(c.value) filter (where c.metric = 'funnel:reading_succeeded'), 0) as reading_succeeded
from public.taste_daily_count c
group by c.day;

comment on view public.taste_daily is
  '맛보기의 날짜별 수 — 예산 · 갈래 · 실패 · 토큰 · 응답 시간 · 퍼널. 개인 없음. 금액은 단가를 곱해 따로 낸다.';

revoke all on public.taste_daily from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. 지우기 — 크론 `taste-sweep`
-- ---------------------------------------------------------------------------

/**
 * 맛보기 정리 — 시간 상한을 넘긴 시도를 닫고, 24시간 지난 미귀속 세션 · artifact · 한도 사건을 지운다. 귀속된 세션은
 * 안 지운다(회원의 풀이 자료, 탈퇴 때 지운다). 여러 번 돌아도 안전하다.
 *
 * @returns 이번에 닫거나 지운 행 수
 */
create function retention.sweep_taste()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  closed integer;
  sessions integer;
  artifacts integer;
  events integer;
begin
  with done as (
    update public.taste_artifact a
    set status = 'failed', failure_code = 'timeout', updated_at = now()
    where a.status = 'running' and a.attempt_started_at <= now() - public.taste_call_timeout()
    returning 1
  )
  select count(*)::integer into closed from done;

  if closed > 0 then
    perform public.taste_tally('call:timeout', closed);
  end if;

  with gone as (
    delete from public.taste_session s where s.status <> 'claimed' and s.expires_at <= now() returning 1
  )
  select count(*)::integer into sessions from gone;

  with gone as (
    delete from public.taste_artifact a where a.expires_at <= now() returning 1
  )
  select count(*)::integer into artifacts from gone;

  with gone as (
    delete from public.taste_rate_event e where e.at <= now() - public.taste_keep_for() returning 1
  )
  select count(*)::integer into events from gone;

  return closed + sessions + artifacts + events;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. 권한 — 문은 열쇠에만, 나머지는 아무에게도
-- ---------------------------------------------------------------------------

revoke execute on function
  public.taste_keep_for(),
  public.taste_daily_model_calls(),
  public.taste_browser_new_per_hour(),
  public.taste_ip_calls_per_minute(),
  public.taste_ip_calls_per_day(),
  public.taste_ip_requests_per_minute(),
  public.taste_attempt_limit(),
  public.taste_call_timeout(),
  public.taste_today(),
  public.taste_day_start(),
  public.taste_tally(text, bigint, boolean),
  public.taste_snapshot(uuid, uuid),
  public.taste_is_hex64(text),
  public.taste_is_version(text),
  public.reserve_taste(text, text, text, text, text),
  public.finish_taste(uuid, integer, text, text, text, text, text, text, text[], integer, integer, integer, integer, integer, integer),
  public.taste_session_view(uuid, text),
  public.claim_taste_session(uuid, uuid, text, text),
  public.link_taste_reading_run(uuid, uuid, uuid),
  public.taste_continuation_of_run(uuid, uuid),
  public.count_taste_step(text),
  retention.sweep_taste()
from public, anon, authenticated, service_role;

grant execute on function
  public.reserve_taste(text, text, text, text, text),
  public.finish_taste(uuid, integer, text, text, text, text, text, text, text[], integer, integer, integer, integer, integer, integer),
  public.taste_session_view(uuid, text),
  public.claim_taste_session(uuid, uuid, text, text),
  public.link_taste_reading_run(uuid, uuid, uuid),
  public.taste_continuation_of_run(uuid, uuid),
  public.count_taste_step(text)
to service_role;

/** 이름으로 지우고 다시 건다 — 두 번 돌려도 일정이 하나다. 5분마다 매시 1 · 6 · 11 … 분 — 다른 잡(매시 0 · 10 … · 7 · 23 · 47분)과 안 겹친다 */
select cron.unschedule('taste-sweep')
where exists (select 1 from cron.job where jobname = 'taste-sweep');

select cron.schedule('taste-sweep', '1-59/5 * * * *', 'select retention.sweep_taste()');
