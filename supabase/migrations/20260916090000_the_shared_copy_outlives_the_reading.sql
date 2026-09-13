-- 공유본 — **「현재 결과 하나」의 유일한 예외**
--
-- `reading` 은 대상마다 한 행이고 새로 만들면 통째로 덮인다(ADR 0013). 그 규칙이
-- 여기서 한 번 깨진다. 링크를 받은 사람이 여는 것은 **보낸 그때의 글**이어야 하기
-- 때문이다 — 보낸 뒤에 원본을 다시 만들었다고 상대가 읽는 글이 바뀌면, 보낸 사람은
-- 자기가 무엇을 보냈는지 모르게 된다.
--
-- 예외를 **표를 갈라서** 만든다. `reading` 에 이력을 붙이면 「현재 하나」가 그 표
-- 안에서 참이 아니게 되고, 그러면 어느 행이 지금 것인지 묻는 자리가 생긴다. 여기
-- 있는 것은 결과가 아니라 **그때 내보낸 글의 사본**이다.
--
-- ## 원본에 수명을 매지 않는다
--
-- `reading`·`person`·`person_chart_revision` 어느 것도 FK 로 안 든다. 들면 판본
-- 정리(ADR 0011)나 사람 삭제가 이미 보낸 링크를 죽이고, 그때 링크를 받은 사람은
-- 이유를 알 수 없는 빈 화면을 본다. 그리고 FK 가 없으므로 `revisions_in_use()` 도
-- 이 표를 안 본다 — 공유본 하나가 옛 출생 입력을 영구히 붙잡는 일이 없다.
--
-- 매는 것은 **계정 하나**다. 떠나는 사람의 자료는 열쇠를 따라 사라지고(ADR 0023),
-- 공유본도 그 자료다.

create table public.reading_share (
  /**
   * 주소에 그대로 서는 값 — **id 가 아니라 열쇠다.**
   *
   * 이 값 하나로 로그인 없이 글이 열리므로 세는 순서가 있으면 안 되고, 사용자나
   * 사람을 가리키는 값에서 뽑아도 안 된다. 새 난수 하나를 그 자리에 둔다.
   */
  token text primary key,

  /** 누가 내보냈나 — **이 표가 드는 유일한 FK다.** 떠나면 함께 사라진다 */
  shared_by uuid not null references public.app_user (id) on delete cascade,

  /**
   * **어느 판의 글인가** — 같은 글을 두 번 보내면 같은 링크가 나오게 하는 값.
   *
   * 눌릴 때마다 새 토큰을 내주면 사용자는 자기가 뿌린 주소가 몇 개인지 모르게 된다.
   * 그래서 결과의 판을 값으로 만들어 유일 인덱스를 건다.
   *
   * `reading.id` 로는 못 가른다 — 교체가 `on conflict do update` 라 **새 글에도 같은
   * id 가 선다.** 가르는 것은 그 글을 만든 시도(`source_run_id`)이고, 그 열이 생기기
   * 전에 저장된 글에는 그것이 없다(ADR 0022). 그때는 id 와 `created_at` 을 함께
   * 적는다 — 교체할 때 `created_at` 도 `now()` 로 갈리므로 옛 글과 새 글이 갈린다.
   */
  version_key text not null,

  /** 그때의 한 줄 요약 — 이 열이 생기기 전 글에는 없다(`null`) */
  metaphor text,

  /**
   * 그때의 **사용자용** 본문.
   *
   * 저장된 원문이 아니다. 내부 검토용 근거 절은 서버 경계에서 잘려 들어온다
   * (`readingBody`). 자르는 규칙은 그 한 곳에 있고 여기서 다시 적지 않는다 —
   * 대신 들어오는 글이 저장된 원문 안의 글인지를 문이 확인한다.
   */
  body text not null check (length(body) between 1 and 60000),

  created_at timestamptz not null default now()
);

/** 같은 판을 두 번 보내면 **같은 링크다.** 동시에 눌러도 이 인덱스가 하나로 만든다 */
create unique index reading_share_one_per_version
  on public.reading_share (shared_by, version_key);

alter table public.reading_share enable row level security;

/**
 * 정책을 한 줄도 안 적는다 — **표는 아무에게도 안 보인다.**
 *
 * 읽는 길은 아래 `shared_reading(token)` 하나뿐이고, 그 함수는 토큰에 해당하는 한
 * 줄의 **글 두 개와 시각**만 내준다. 표를 열면 누가 무엇을 공유했는지가 목록으로
 * 서고, 토큰도 통째로 샌다 — 그때 열쇠는 열쇠가 아니다.
 */
revoke all on public.reading_share from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 내보내는 문
-- ---------------------------------------------------------------------------

/**
 * 내 사주풀이를 공유본으로 내놓고 **주소를 받는다.**
 *
 * ## 무엇을 확인하는가
 *
 * 부르는 사람의 `self` 결과를 **이 함수가 직접 찾는다.** 대상을 인자로 받지 않으므로
 * 남의 글을 가리킬 자리가 없다 — 「내 사주풀이만」이 규칙이 아니라 서명이다.
 *
 * ## 본문을 받으면서도 앱을 안 믿는다
 *
 * 자르는 일은 앱이 한다(`readingBody`). 자르는 규칙을 SQL 에 한 벌 더 적으면 두
 * 자리가 갈리고, 갈리는 날 근거 절이 링크를 타고 나간다.
 *
 * 그래서 **받되 확인한다.** 들어온 글이 저장된 원문 안에 그대로 들어 있는지 본다.
 * 잘린 앞부분은 원문의 부분 문자열이므로 이 검사는 통과하고, 지어낸 글은 못 지나간다.
 * ADR 0013 이 `save_reading` 을 열쇠에게만 연 까닭이 여기서도 그대로 참이다 —
 * 열려 있으면 로그인한 사람이 **아무 글이나 「만세력이 쓴 사주풀이」로 내걸 수 있다.**
 * 다만 저 검사가 그 구멍을 닫으므로 이 문은 `authenticated` 에게 열어도 된다.
 *
 * @returns 공유 주소에 실리는 토큰. 같은 판을 다시 보내면 **먼저 낸 토큰 그대로**.
 */
create function public.share_my_reading(p_body text, p_metaphor text default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  mine public.reading;
  key text;
  made text;
  said text := btrim(coalesce(p_body, ''));
begin
  if me is null then
    raise exception '로그인이 필요합니다';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다';
  end if;

  select r.* into mine
  from public.reading r
  where r.kind = 'self' and r.owner_user_id = me;

  if not found then
    raise exception '공유할 내 사주풀이가 없습니다';
  end if;

  if said = '' then
    raise exception '공유할 내용이 비어 있습니다';
  end if;

  /* 저장된 원문 안의 글인가 — 지어낸 글이 이 문을 지나가지 못하게 하는 자리 */
  if strpos(mine.output, said) = 0 then
    raise exception '공유할 내용이 저장된 풀이와 다릅니다';
  end if;

  if p_metaphor is distinct from mine.metaphor then
    raise exception '공유할 한 줄 요약이 저장된 풀이와 다릅니다';
  end if;

  /*
    **같은 글인가를 무엇으로 아는가.** `source_run_id` 가 있으면 그것이 답이고,
    없는 옛 글은 id 와 생성 시각을 함께 적는다 — 교체될 때 시각이 갈리므로
    새로 만든 글은 새 링크를 받는다.
  */
  key := case
    when mine.source_run_id is not null then 'run:' || mine.source_run_id::text
    else 'reading:' || mine.id::text || '@'
         || to_char(mine.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
  end;

  insert into public.reading_share (token, shared_by, version_key, metaphor, body)
  values (
    replace(pg_catalog.gen_random_uuid()::text, '-', ''),
    me, key, mine.metaphor, said)
  on conflict (shared_by, version_key) do nothing
  returning token into made;

  /*
    **이미 있으면 그것을 돌려준다.** 중복 누름도 동시 요청도 여기로 떨어진다 —
    유일 인덱스가 둘째를 막고, 막힌 쪽은 먼저 난 토큰을 읽어 같은 주소를 받는다.
  */
  if made is null then
    select s.token into made
    from public.reading_share s
    where s.shared_by = me and s.version_key = key;
  end if;

  return made;
end;
$$;

revoke execute on function public.share_my_reading(text, text) from anon, public;
grant execute on function public.share_my_reading(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 읽는 문 — **로그인하지 않은 사람에게 열리는 이 저장소의 첫 함수**
-- ---------------------------------------------------------------------------

/**
 * 토큰 하나의 공유본.
 *
 * `anon` 에게 여는 첫 문이라 **내주는 것을 센다.** 나가는 것은 글 둘과 시각 하나뿐이다.
 * `shared_by` 도 `version_key` 도 안 나간다 — 앞엣것은 누구의 글인지를 말하고,
 * 뒤엣것은 그 사람의 다른 링크를 짐작하게 한다.
 *
 * 없는 토큰이면 0행이다. 「없다」와 「못 본다」를 가르지 않는 이 저장소의 규율이
 * 여기서는 저절로 지켜진다 — 못 보는 토큰이라는 것이 없다.
 */
create function public.shared_reading(p_token text)
returns table (metaphor text, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.metaphor, s.body, s.created_at
  from public.reading_share s
  where s.token = p_token;
$$;

revoke execute on function public.shared_reading(text) from public;
grant execute on function public.shared_reading(text) to anon, authenticated;
