-- ---------------------------------------------------------------------------
-- 얼린 입력은 일이 도는 동안만 살고, 영수증은 그보다 오래 남는다 (ADR 0020)
-- ---------------------------------------------------------------------------

/**
 * 만드는 일이 요청 수명을 떠나면 **두 가지가 새로 필요하다.**
 *
 * 하나는 「완료가 돌아왔을 때 무엇으로 검사하고 저장할 것인가」다. `reading_run` 은
 * 일부러 본문도 판본 FK 도 안 든다 — 실패한 시도 때문에 출생 판본이 붙들리지 않게 하려는
 * 결정이었다(ADR 0011·0013). 그런데 완료 시점에는 그것들이 다 있어야 한다. 그래서 **일이
 * 도는 동안만 사는** 표를 따로 둔다.
 *
 * 다른 하나는 「이 사건을 이미 처리했는가」다. 재전송은 정상 동작이고 최대 72시간 온다.
 * 그 기억을 앞의 표에 두면 안 된다 — **그 표는 terminal 에 지워지는데 재전송은 그 뒤에
 * 온다.** 지우고 나면 같은 사건을 처음 본 것처럼 다시 집는다. 얼린 입력의 수명과 영수증의
 * 수명은 다른 시계다.
 */

-- ---------------------------------------------------------------------------
-- 얼린 입력 — 일이 도는 동안만
-- ---------------------------------------------------------------------------

create table public.reading_job (
  /**
   * 시도 하나에 작업 하나. `reading_run` 이 지워지면 함께 지워진다 — 주인이 없는 얼린
   * 입력이 남아 판본을 붙들고 있으면 그것이 곧 보존이다.
   */
  run_id uuid primary key references public.reading_run (id) on delete cascade,

  /**
   * **작업 중에는 원래 판본을 붙든다.**
   *
   * 붙드는 이유는 만든 것과 검사한 것을 같은 입력으로 맞추기 위해서다. 낡은 입력으로 쓴
   * 글을 밀어 넣기 위한 것이 아니다 — 그 사이 현재 판본이 바뀌면 `save_reading` 이 그대로
   * 거절한다(「만드는 동안 출생정보가 바뀌었습니다」).
   *
   * `restrict` 다. 도는 작업이 가리키는 판본은 지워지면 안 된다.
   */
  revision_a uuid not null references public.person_chart_revision (id) on delete restrict,
  revision_b uuid references public.person_chart_revision (id) on delete restrict,

  /**
   * 모델에 실제로 보낸 것 그대로.
   *
   * 제출과 완료 사이에 배포가 나면 프롬프트가 달라진다. 그때 새 프롬프트로 검사하면
   * **보내지 않은 것을 기준으로 재는** 셈이 된다.
   */
  prompt text not null,
  evidence text not null,
  prompt_version text not null,

  /** 무엇으로 만들라고 했는가 — 응답한 모델은 다를 수 있어 그쪽은 저장 때 따로 든다 */
  requested_model text not null,
  generation jsonb not null,

  /** 지금이 언제였나. 운은 이 시각으로 짚었다 */
  viewed_at timestamptz not null,

  /**
   * provider 가 준 이름표. **없을 수 있다** — 제출은 됐는데 이 열을 채우기 전에 끊긴 경우다.
   * 그래서 이것 하나에 기대지 않고 요청의 `metadata.reading_run_id` 도 함께 싣는다.
   */
  response_id text unique,

  status text not null default 'submitting'
    check (status in ('submitting', 'submitted', 'retrieving')),

  created_at timestamptz not null default now()
);

/** 복구기가 「아직 안 끝난 것」을 집을 때 쓰는 길 */
create index reading_job_open_idx on public.reading_job (created_at) where status <> 'retrieving';

/**
 * **판본 FK 열에 인덱스를 함께 둔다.**
 *
 * `revisions_in_use(uuid[])` 가 후보 몇 개만 물어 좁히는데, 가리키는 쪽에 인덱스가 없으면
 * 그 좁힘이 값싸지지 않는다 — FK 는 인덱스를 만들지 않는다. 판본을 가리키는 새 표를
 * 만들면서 이걸 빼면, 정리가 도는 자리마다 이 표를 통째로 훑는다.
 */
create index reading_job_revision_a_idx on public.reading_job (revision_a);
create index reading_job_revision_b_idx on public.reading_job (revision_b) where revision_b is not null;

-- ---------------------------------------------------------------------------
-- 영수증 — 얼린 입력보다 오래
-- ---------------------------------------------------------------------------

create table public.reading_webhook_event (
  /** provider 가 붙인 사건 이름. **멱등의 축이 이것이다** */
  event_id text primary key,
  response_id text not null,
  event_type text not null,

  received_at timestamptz not null default now(),
  /** 집어서 끝낸 시각. `null` 이면 아직 안 집었거나 집다 말았다 */
  processed_at timestamptz
);

create index reading_webhook_event_unprocessed_idx
  on public.reading_webhook_event (received_at)
  where processed_at is null;

/**
 * **본문도 prompt 도 evidence 도 넣지 않는다.**
 *
 * 여기 있어야 하는 것은 「이 사건을 받았고 처리했다」뿐이다. 자료를 넣으면 얼린 입력의
 * 짧은 수명과 영수증의 긴 수명이 한 표에서 부딪히고, 그러면 긴 쪽이 이긴다.
 *
 * `run_id` 도 없다. 사건이 도착한 시점에는 아직 모르기 때문이다 — payload 에는
 * `response_id` 만 오고 우리 이름표는 response 를 회수한 뒤에야 읽힌다.
 */

-- ---------------------------------------------------------------------------
-- 권한 — 두 표 다 한 줄도 직접 안 보인다
-- ---------------------------------------------------------------------------

revoke all on public.reading_job, public.reading_webhook_event from anon, authenticated;

alter table public.reading_job enable row level security;
alter table public.reading_webhook_event enable row level security;

/**
 * 정책을 두지 않는다 — 그래서 `authenticated` 에게 닫혀 있다.
 *
 * `reading_job` 에는 프롬프트와 근거가 통째로 있다. 열어 주면 브라우저가 `evidence` 를
 * 직접 읽을 수 있게 되고, 그것은 `reading` 표를 닫아 둔 이유와 같은 자리다. 닿는 길은
 * 열쇠가 부르는 함수뿐이다.
 */
