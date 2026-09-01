-- 설문 — **답은 글이 아니라 그 글을 만든 시도에 매인다**
--
-- 현재 결과는 대상마다 하나이고 새 생성이 성공하면 통째로 갈린다(ADR 0013). 답을
-- `reading` 에 붙이면 다음 생성이 그 답을 **다른 글**에 붙여 놓는다 — 「긴 결과가 불만이
-- 많다」를 세었더니 정작 그 답이 매겨진 글은 이미 없는 상태가 된다.
--
-- `reading_run` 은 갈리지 않는다. 그리고 `model` 과 `prompt_version` 을 이미 들고 있어서
-- 「이 프롬프트 판본이 점수가 낮다」가 그 자리에서 나온다.
--
-- **본문은 여기 없다.** `reading_run` 은 글을 남기지 않으므로 답과 함께 남는 것은 점수와
-- 태그와 생성 메타데이터뿐이고, 그 글을 아무도 다시 읽지 않는다. 그래서 개선 활용에
-- 동의하지 않은 사람도 점수는 남길 수 있다 — 사람이 읽는 칸은 자유 입력 하나뿐이다.

-- ---------------------------------------------------------------------------
-- 어느 시도가 이 글을 만들었나
-- ---------------------------------------------------------------------------

/**
 * 저장할 때는 알지만 **새로고침하면 잃던** 값이다.
 *
 * 이 열이 없으면 화면이 「지금 읽고 있는 글」과 「그 글을 만든 시도」를 이을 수 없고,
 * 그러면 설문이 붙을 자리가 없다.
 *
 * `on delete set null` — 시도 기록이 사라져도 결과는 남는다. 그때 잃는 것은 설문을
 * 붙일 자리뿐이고, 글은 글대로 서 있어야 한다.
 */
alter table public.reading
  add column source_run_id uuid references public.reading_run (id) on delete set null;

/**
 * 이미 서 있는 결과에는 **채우지 않는다.**
 *
 * 어느 시도가 만들었는지를 지금 되짚어 지어 넣으면 그것은 기록이 아니라 추측이다.
 * 그 글들에는 설문이 안 붙고, 다음에 새로 만들 때부터 붙는다.
 */

-- ---------------------------------------------------------------------------
-- 개선 활용 동의 — **자유 입력 칸 하나를 위한 열쇠**
-- ---------------------------------------------------------------------------

/**
 * `null` 과 `false` 를 구별한다.
 *
 * `null` 은 「아직 안 물었다」, `false` 는 「거절했다」다. 합쳐 두면 나중에 다시 물어야
 * 할 사람과 다시 묻지 말아야 할 사람이 안 갈린다.
 *
 * **이 값이 막는 것은 설문 전체다.**
 *
 * 처음에는 자유 입력 하나만 막았다. 점수와 태그는 「서비스가 좁아지면 안 된다」는 이유로
 * 동의 없이 받았는데, 그 이유가 가리키는 것은 **사주 서비스**다. 점수와 태그도
 * `respondent_user_id` 와 `reading_run` 에 매여 있고 쓰이는 곳은 제품 개선이다 —
 * 서비스 제공에 필요해서 처리하는 것이 아니라, 우리가 더 나은 것을 만들려고 받는 것이다.
 * 그러면 자유로운 선택 동의를 받아야 한다.
 *
 * 거절해도 **사주 서비스는 그대로다.** 명식·궁합·풀이 생성 어느 것도 이 값을 묻지
 * 않는다. 닫히는 것은 설문 하나뿐이고, 그 둘은 완전히 갈라져 있다.
 *
 * 안내 판본(`notice_version`)과 후속 연락 동의는 여기 없다. 처리방침이 설 때 함께
 * 온다 — 없는 문구의 판본을 미리 적어 두면 그 값이 무엇을 가리키는지 아무도 모른다.
 */
alter table public.app_user add column improvement_consent boolean;

-- ---------------------------------------------------------------------------
-- 답
-- ---------------------------------------------------------------------------

/**
 * 풀이 하나에 대한 답 — **누가 만들었는가가 아니라 누가 읽었는가로 남는다.**
 *
 * `respondent_user_id` 를 따로 드는 것은 공유 궁합 때문이다. 풀이권은 누른 사람만
 * 쓰지만 그 글은 양쪽이 읽고, 양쪽의 체감이 다를 수 있다. 시도의 `user_id` 를 그대로
 * 쓰면 상대의 답은 남길 자리가 없다.
 */
create table public.reading_feedback (
  reading_run_id uuid not null references public.reading_run (id) on delete cascade,
  respondent_user_id uuid not null references public.app_user (id) on delete cascade,

  /** 나를 이해하는 데 도움이 됐나 */
  usefulness smallint not null check (usefulness between 1 and 5),
  /**
   * 실제 경험과 얼마나 비슷했나 — **PRD 가 「체감 적합성」이라 부르는 값이다.**
   *
   * 「정확도」라고 부르지 않는다. 사주 해석의 객관적 정확도를 우리가 잰 적이 없고,
   * 그 낱말을 쓰면 잰 적 없는 것을 쟀다고 말하는 셈이 된다.
   *
   * **혼자 읽으면 안 되는 값이다.** 바넘 문장은 근거 없이도 「내 얘기 같다」를 만든다.
   * 이 값만 오르고 근거 밀착성이 떨어지면 그것은 개선이 아니라 바넘화다(PRD).
   */
  perceived_fit smallint not null check (perceived_fit between 1 and 5),

  /**
   * 분량이 어땠나. **열 이름이 `length` 가 아닌 것은** 같은 검사식 안에서
   * `length(comment)` 를 부르기 때문이다 — 한 이름이 열이면서 함수이면 읽는 사람이
   * 매번 어느 쪽인지 따져야 한다.
   */
  felt_length text not null check (felt_length in ('short', 'right', 'long')),

  /**
   * 아쉬운 점 — **총평이 아니라 항목으로 받는다**(`matching-beta.md`).
   *
   * 별 몇 개만 받으면 오행 보완 공식의 문제인지, 관계 신호의 해석 문제인지, 문장
   * 표현의 문제인지 구분할 수 없다.
   *
   * 아는 이름만 받는다. 모르는 값이 들어오면 세는 쪽에서 조용히 빠지고, 빠진 것은
   * 없는 것과 구별되지 않는다. 중복은 RPC 가 턴다 — 부르는 쪽이 기억할 일이 아니다.
   */
  issue_tags text[] not null default array[]::text[]
    constraint tags_are_known check (
      issue_tags <@ array['abstract', 'repetitive', 'assertive', 'jargon', 'mismatch', 'ui']::text[]
    ),

  /**
   * 어느 대목이 맞았고 어느 대목이 달랐나 — **사람이 읽는 유일한 칸이다.**
   *
   * 그래서 개선 활용에 동의한 사람에게만 열린다(`leave_reading_feedback`).
   *
   * 200자다. 이 저장소는 출생 원문이 모델·주소·로그로 새지 않게 막아 왔는데
   * (`redacted.ts`), 넓은 자유 입력 칸은 사용자가 그것을 **손으로 되돌려 놓는** 문이다.
   * 「특히 맞거나 틀린 부분」처럼 넓게 물으면 사연을 쓰고, 사연에는 남의 생년월일이
   * 들어온다. 그 사람은 동의한 적이 없다.
   *
   * 길이 제한은 그 문을 못 막는다 — 막는 것은 **좁게 묻는 질문**이고, 이 값은 그
   * 질문에 대한 답이 들어갈 만큼만 된다.
   */
  comment text check (length(comment) between 1 and 200),

  submitted_at timestamptz not null default now(),

  primary key (reading_run_id, respondent_user_id)
);

-- 표는 한 줄도 직접 안 보인다. 답은 RPC 로만 들어오고, 세는 것은 운영자의 일이다.
alter table public.reading_feedback enable row level security;
revoke all on public.reading_feedback from anon, authenticated;

/**
 * PK 가 `(reading_run_id, respondent_user_id)` 라 시도로 찾는 길은 이미 있다. 없던
 * 것은 **사람으로 찾는 길**이고, 그것이 철회할 때 지울 행을 고르는 길이다.
 */
create index reading_feedback_by_respondent
  on public.reading_feedback (respondent_user_id);

/**
 * 답을 남긴다 — **만든 사람이 아니라 읽을 수 있는 사람이 남긴다.**
 *
 * 자격을 `reading_run.user_id` 로 물으면 공유 궁합에서 누르지 않은 쪽이 답할 수 없다.
 * 물어야 하는 것은 「이 글을 볼 수 있는가」이고, 그 질문에는 이미 답하는 함수가 있다
 * (`reading_scope_for`) — 여기서 다시 지으면 판정하는 자리가 둘이 된다.
 *
 * **다시 답하면 고쳐진다.** 사람은 마음을 바꾸고, 바꾼 답을 못 남기게 하면 처음 누른
 * 값이 영원히 그 사람의 답이 된다.
 */
create or replace function public.leave_reading_feedback(
  p_run_id uuid,
  p_usefulness smallint,
  p_perceived_fit smallint,
  p_felt_length text,
  p_issue_tags text[] default array[]::text[],
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  run record;
  consent boolean;
  tags text[];
  said text := nullif(btrim(p_comment), '');
begin
  select * into run from public.reading_run r where r.id = p_run_id;

  if not found then
    raise exception '답할 풀이를 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  /** 아직 만들어지지 않은 글에는 답할 것이 없다 */
  if run.status <> 'succeeded' then
    raise exception '완성된 풀이에만 답할 수 있습니다.' using errcode = 'check_violation';
  end if;

  /**
   * **있다는 것만 보면 안 된다 — 같은 대상인지까지 본다.**
   *
   * `reading_scope_for` 의 `self` 갈래는 `p_person_a` 를 보지 않는다. 물어보는 사람의
   * selfPerson 을 스스로 찾아 내주므로, 「행이 있는가」만 물으면 **자기 풀이 자격이
   * 있는 모든 사람에게 참**이 된다 — 남의 시도 id 로 남의 글에 답할 수 있었다.
   *
   * 이 함수가 그렇게 생긴 것은 잘못이 아니다. 대상을 **푸는** 함수라 「나의 self 는
   * 무엇인가」에 답하는 것이 그 일이고, 여기서 필요한 것은 그 답이 **이 시도의 대상과
   * 같은가**다. 그 견줌은 부르는 쪽이 한다.
   */
  if not exists (
    select 1 from public.reading_scope_for(
      (select auth.uid()), run.kind, run.person_a, run.person_b, run.match_id) s
    where s.person_a is not distinct from run.person_a
      and s.person_b is not distinct from run.person_b
      and s.match_id is not distinct from run.match_id
  ) then
    -- 없는 것과 못 보는 것을 가르지 않는다 — 가르면 남의 시도 id 를 확인하는 문이 된다.
    raise exception '답할 풀이를 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  select u.improvement_consent into consent
  from public.app_user u where u.id = (select auth.uid());

  /**
   * **설문 전체가 이 값 뒤에 있다.**
   *
   * 점수와 태그만 따로 받아 두던 때가 있었다. 「선택 동의를 거절했다고 서비스가
   * 좁아지면 안 된다」가 그 근거였는데, 그것이 지키라고 하는 것은 **사주 서비스**다.
   * 설문은 서비스 제공에 필요한 처리가 아니라 우리가 더 나은 것을 만들려고 받는
   * 것이므로, 자유로운 선택 동의 뒤에 서야 한다.
   *
   * **`not consent` 라고 쓰지 않는다.** `null` 은 그 갈래에 안 들어가고, 그러면 아직
   * 묻지도 않은 사람의 답이 그대로 들어온다 — 이 저장소가 한 번 걸려 본 자리다.
   */
  if coalesce(consent, false) = false then
    raise exception '설문은 풀이 개선에 활용하는 데 동의하신 뒤에 받을 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  -- 중복을 여기서 턴다. 부르는 쪽이 기억해야 맞는 것은 언젠가 안 지켜진다.
  select coalesce(array_agg(distinct t order by t), array[]::text[]) into tags
  from unnest(coalesce(p_issue_tags, array[]::text[])) t;

  insert into public.reading_feedback (
    reading_run_id, respondent_user_id,
    usefulness, perceived_fit, felt_length, issue_tags, comment
  )
  values (
    p_run_id, (select auth.uid()),
    p_usefulness, p_perceived_fit, p_felt_length, tags, said
  )
  on conflict (reading_run_id, respondent_user_id) do update
  set usefulness = excluded.usefulness,
      perceived_fit = excluded.perceived_fit,
      felt_length = excluded.felt_length,
      issue_tags = excluded.issue_tags,
      comment = excluded.comment,
      submitted_at = now();
end;
$$;

revoke execute on function public.leave_reading_feedback(
  uuid, smallint, smallint, text, text[], text) from anon, public;
grant execute on function public.leave_reading_feedback(
  uuid, smallint, smallint, text, text[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- 저장할 때 그 시도를 함께 적는다
-- ---------------------------------------------------------------------------

/**
 * 바뀐 것은 넣는 열 하나와 교체할 때 함께 갈리는 줄 하나뿐이다. `p_run_id` 는 이미
 * 받고 있었다 — 알고 있었는데 안 적어 두고 있었을 뿐이다.
 */
create or replace function public.save_reading(
  p_run_id uuid,
  p_revision_a uuid,
  p_revision_b uuid,
  p_output text,
  p_score smallint,
  p_evidence text,
  p_prompt text,
  p_prompt_version text,
  p_model text,
  p_generation jsonb,
  p_viewed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run record;
  pinned record;
  reading_id uuid;
  partner uuid;
begin
  -- 행을 잠그고 읽는다. 같은 시도로 두 번 저장하려는 길을 여기서 막는다.
  select * into run from public.reading_run r where r.id = p_run_id for update;

  if not found then
    raise exception '기록할 시도를 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if run.status <> 'running' then
    raise exception '이미 끝난 시도입니다.' using errcode = 'check_violation';
  end if;

  /**
   * **만료된 시도로는 저장하지 않는다.**
   *
   * 만료를 지나면 같은 대상에 새 시도가 열릴 수 있고, 그 새 시도가 이미 성공했을 수
   * 있다. 그때 늦게 돌아온 이 호출을 받아 주면 사용자가 방금 읽은 글이 옛 글로 되돌아간다.
   */
  if run.created_at <= now() - public.reading_run_timeout() then
    raise exception '만드는 데 너무 오래 걸려 이 결과는 저장하지 않았습니다.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.reading_run later
    where later.created_at > run.created_at
      and later.kind = run.kind
      and later.person_a is not distinct from run.person_a
      and later.person_b is not distinct from run.person_b
      and later.match_id is not distinct from run.match_id
  ) then
    raise exception '그 사이에 새 시도가 열려 이 결과는 저장하지 않았습니다.'
      using errcode = 'check_violation';
  end if;

  /**
   * **저장 직전에도 자격을 묻는다.** 시작할 때 자격이 있었다고 해서 만드는 동안 생긴
   * 차단·계정 중지를 무시하면 「새 접근과 접촉을 즉시 멈춘다」가 최대 십 분 늦어진다.
   * actor 는 앱이 대지 않고, 사용자 JWT 로 열린 시도 행에서만 읽는다.
   */
  select * into pinned
  from public.reading_scope_for(
    run.user_id, run.kind, run.person_a, run.person_b, run.match_id);

  if not found then
    raise exception '결과를 저장할 대상을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  /**
   * 만든 판본과 지금 판본이 갈렸다.
   *
   * 사용자가 글을 만드는 동안 출생정보를 고친 경우다. 그대로 저장하면 「지금 입력으로
   * 쓴 글」이라고 적힌 옛 글이 남는다. 저장하지 않고 그렇게 말한다 — 다시 누르면
   * 새 입력으로 만들어진다.
   */
  if pinned.revision_a is distinct from p_revision_a
     or pinned.revision_b is distinct from p_revision_b then
    raise exception '만드는 동안 출생정보가 바뀌었습니다. 새 입력으로 다시 만들어 주세요.'
      using errcode = 'check_violation';
  end if;

  update public.reading_run r
  set status = 'succeeded', finished_at = now(), model = p_model, prompt_version = p_prompt_version
  where r.id = p_run_id;

  insert into public.reading (
    kind, owner_user_id, match_id, person_a, person_b, revision_a, revision_b,
    output, score, evidence, prompt, prompt_version, model, generation, viewed_at,
    source_run_id
  )
  values (
    run.kind,
    -- 공유 결과에는 주인이 없다. 누가 눌렀든 양쪽이 같은 것을 본다.
    case when run.kind = 'match' then null else run.user_id end,
    run.match_id, run.person_a, run.person_b,
    p_revision_a, p_revision_b,
    p_output, p_score, p_evidence, p_prompt, p_prompt_version, p_model,
    coalesce(p_generation, '{}'::jsonb), p_viewed_at,
    /*
      **어느 시도가 이 글을 만들었나.** 교체될 때 함께 갈린다 — 안 갈면 새 글에 옛
      시도가 매달리고, 그 시도에 달린 설문이 읽지도 않은 글의 답이 된다.
    */
    p_run_id
  )
  on conflict (target_key) do update
  set revision_a = excluded.revision_a,
      revision_b = excluded.revision_b,
      output = excluded.output,
      score = excluded.score,
      evidence = excluded.evidence,
      prompt = excluded.prompt,
      prompt_version = excluded.prompt_version,
      model = excluded.model,
      generation = excluded.generation,
      viewed_at = excluded.viewed_at,
      source_run_id = excluded.source_run_id,
      created_at = now()
  returning id into reading_id;

  /**
   * Match 만 알린다 — **상대에게만.**
   *
   * 누른 사람은 결과를 그 자리에서 본다. 상대는 자기가 보던 공유 결과가 바뀐 것을
   * 알아야 하고, 그것이 이 알림이 있는 유일한 이유다.
   */
  if run.kind = 'match' then
    select case when m.user_low = run.user_id then m.user_high else m.user_low end
    into partner
    from public.match m where m.id = run.match_id;

    insert into public.notification (user_id, kind, match_id)
    values (partner, 'reading_ready', run.match_id);
  end if;

  return reading_id;
end;
$$;

revoke execute on function public.save_reading(
  uuid, uuid, uuid, text, smallint, text, text, text, text, jsonb, timestamptz
) from anon, public, authenticated;
grant execute on function public.save_reading(
  uuid, uuid, uuid, text, smallint, text, text, text, text, jsonb, timestamptz
) to service_role;

-- ---------------------------------------------------------------------------
-- 화면이 설문을 붙일 수 있게
-- ---------------------------------------------------------------------------

/**
 * 결과와 함께 **그 글을 만든 시도**와 **내가 이미 답했는가**를 낸다.
 *
 * 따로 묻는 문을 두지 않는다. 두면 화면이 두 번 왕복하는 사이에 글이 갈릴 수 있고,
 * 그때 사용자는 새 글을 보면서 옛 글의 설문에 답한다.
 *
 * `create or replace` 가 아니라 **떨어뜨리고 다시 세운다.** 내주는 열이 늘면 Postgres 는
 * 되쓰기를 거절한다.
 */
drop function public.my_reading(text, uuid, uuid, uuid);

create function public.my_reading(
  p_kind text,
  p_person_a uuid default null,
  p_person_b uuid default null,
  p_match_id uuid default null
)
returns table (
  id uuid,
  kind text,
  score smallint,
  output text,
  model text,
  viewed_at timestamptz,
  created_at timestamptz,
  viewer_is_first boolean,
  from_current_revision boolean,
  /**
   * 이 글을 만든 시도 — **설문이 매달릴 자리.**
   *
   * 이 값이 없는 글이 있다. 이 열이 생기기 전에 저장된 것들이고, 되짚어 지어 넣지
   * 않았다(위). 그 글에는 설문이 안 붙는다.
   */
  source_run_id uuid,
  /**
   * 그 시도에 **내가** 남긴 답 — 없으면 `null`.
   *
   * 「답했는가」만 내주던 때가 있었다. 그러면 고치는 화면이 **빈 칸으로 열리고**,
   * 거기서 다시 보내면 적어 두었던 글까지 `null` 로 덮인다 — 고치는 것이 아니라
   * 지우는 것이 된다.
   *
   * 값을 함께 내주므로 화면은 그 값으로 칸을 채워 연다. 공유 궁합은 두 사람이 따로
   * 답하므로 이것은 **부른 사람의 답**이다.
   */
  my_feedback jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.kind, r.score, r.output, r.model, r.viewed_at, r.created_at,
    s.viewer_is_first,
    r.revision_a = s.revision_a and r.revision_b is not distinct from s.revision_b,
    r.source_run_id,
    (
      select jsonb_build_object(
        'usefulness', f.usefulness,
        'perceivedFit', f.perceived_fit,
        'feltLength', f.felt_length,
        'issueTags', to_jsonb(f.issue_tags),
        'comment', f.comment)
      from public.reading_feedback f
      where f.reading_run_id = r.source_run_id
        and f.respondent_user_id = (select auth.uid())
    )
  from public.reading_scope(p_kind, p_person_a, p_person_b, p_match_id) s
  join public.reading r
    on r.kind = s.kind
   and r.owner_user_id is not distinct from s.owner_user_id
   and r.person_a = s.person_a
   and r.person_b is not distinct from s.person_b
   and r.match_id is not distinct from s.match_id;
$$;

revoke execute on function public.my_reading(text, uuid, uuid, uuid) from anon, public;
grant execute on function public.my_reading(text, uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 동의를 켜고 끄는 문 — **끄는 것이 곧 지우는 것이다**
-- ---------------------------------------------------------------------------

/**
 * 개선 활용 동의를 정한다.
 *
 * **철회하면 그때까지 받은 답을 지운다.**
 *
 * 「앞으로는 안 받는다」로만 두면 이미 받은 것은 남고, 사용자는 자기가 철회한 뒤에도
 * 자기 답이 개선에 쓰이는 것을 모른다. 「동의했으니 계속 보존한다」로 해결할 수 있는
 * 문제가 아니다 — 동의를 근거로 처리하던 것은 동의가 사라지면 근거가 사라진다.
 *
 * 폐쇄 베타에서는 지우는 것이 가장 단순하다. 남길 이유가 있다면 그것은 별도 결정이고,
 * 그 결정은 안내 문구에 적혀야 한다.
 *
 * **끄는 일과 지우는 일이 한 트랜잭션이다.** 갈라 두면 지우기가 실패한 채 값만 꺼지고,
 * 그때 남은 행은 아무 근거 없이 사는 행이 된다.
 *
 * 이 문을 부르는 화면은 아직 없다. 안내와 처리방침이 설 때 그 화면이 온다 — 문을
 * 먼저 만들어 두는 것은 잠금이 무엇을 잠그는지 여기서 한 번에 적어 두려는 것이다.
 */
create or replace function public.set_improvement_consent(p_consent boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_consent is null then
    raise exception '동의 여부를 정해 주세요.' using errcode = 'check_violation';
  end if;

  update public.app_user u
  set improvement_consent = p_consent
  where u.id = (select auth.uid()) and u.status = 'active';

  if not found then
    raise exception '계정을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if p_consent = false then
    delete from public.reading_feedback f
    where f.respondent_user_id = (select auth.uid());
  end if;
end;
$$;

revoke execute on function public.set_improvement_consent(boolean) from anon, public;
grant execute on function public.set_improvement_consent(boolean) to authenticated;
