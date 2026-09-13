-- 공유본이 **저장한 사람과 두 사람의 궁합까지** 든다
--
-- 첫 판은 내 사주풀이 하나였다(ADR 0063). 남은 셋을 미뤄 둔 까닭은 「남의 자료가 섞여
-- 있어 내보낼 범위를 따로 정해야 한다」였고, 그 판단이 이제 났다.
--
-- **셋을 열고 하나를 닫는다.**
--
-- - `self`(내 사주풀이) · `person`(저장한 사람) · `private`(내가 고른 두 사람) — 연다.
--   셋 다 **내가 넣은 자료**다. 남을 저장한 것도 내가 적어 넣은 것이고, 그 사람을 뭐라
--   부를지도 내가 정했다. 내보낼지 말지는 넣은 사람이 정하는 것이 맞다.
-- - `match`(인연 궁합) — **닫는다.** 거기 있는 상대는 실재하는 계정이고, 그 사람이
--   동의한 것은 「이 사람에게 내 여덟 글자를 연다」이지 「누구에게든 연다」가 아니다
--   (ADR 0012). 링크 하나로 그 동의의 범위가 바뀐다. 그래서 새 서명은 `p_match_id` 를
--   **받지 않는다** — 막는 규칙이 아니라 부를 수 없는 모양이다.
--
-- ## 자격을 여기서 다시 판정하지 않는다
--
-- 「이 대상을 볼 수 있는가」는 `reading_scope` 가 이미 답한다. 그 함수를 그대로 지나
-- 같은 조인으로 결과를 집는다(`my_reading` 과 같은 모양) — 여기서 조건을 손으로 다시
-- 적으면 판정하는 자리가 둘이 되고, 둘이 갈리면 열려 있는 쪽은 언제나 더 바깥이다.
--
-- ## 넓히고 나중에 좁힌다
--
-- 옛 두 인자짜리를 **안 지운다.** 마이그레이션이 앱보다 먼저 배포되므로, 지우면 그
-- 사이에 도는 앱이 없는 함수를 부른다. 둘 다 서 있는 동안 옛 것은 `self` 로 넘긴다.
-- 기본값을 안 붙인 것은 그래야 PostgREST 가 인자 이름으로 둘을 **또렷이 가르기**
-- 때문이다 — 기본값이 있으면 두 인자짜리 호출이 어느 쪽인지 모호해진다.

-- ---------------------------------------------------------------------------
-- 공유본이 무엇의 사본인지 스스로 든다
-- ---------------------------------------------------------------------------

/**
 * **어느 갈래의 풀이인가.**
 *
 * 화면이 셋으로 갈리기 때문이다. 링크 미리보기의 그림은 받은 사람이 **열기 전에 보는
 * 유일한 것**이라 무엇이 열릴지를 그림이 말해 줘야 하고, 그 그림은 주소마다 상수로
 * 서야 한다(ADR 0063: 동적 메타데이터는 수집기가 놓친다). 그래서 갈래를 값으로 든다.
 *
 * `match` 는 애초에 들어올 수 없다(위). 검사식이 그 사실을 못박는다.
 */
alter table public.reading_share
  add column kind text not null default 'self'
    check (kind in ('self', 'person', 'private'));

alter table public.reading_share alter column kind drop default;

/**
 * 궁합만 드는 점수 — 한 사람짜리는 `null` 이다.
 *
 * 「한 줄 요약과 본문 둘뿐」이라고 적어 두었는데, 궁합에서는 **점수가 그 글의 일부**다.
 * 빼고 내보내면 받은 사람이 보는 글이 보낸 사람이 본 글과 다르다.
 */
alter table public.reading_share add column score smallint check (score between 0 and 100);

alter table public.reading_share
  add constraint share_score_follows_the_kind check (
    (kind = 'private') or score is null);

-- ---------------------------------------------------------------------------
-- 내보내는 문 — 대상을 받는다
-- ---------------------------------------------------------------------------

create function public.share_my_reading(
  p_body text,
  p_metaphor text,
  p_kind text,
  p_person_a uuid,
  p_person_b uuid
)
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

  if p_kind not in ('self', 'person', 'private') then
    raise exception '이 갈래는 공유 링크를 만들 수 없습니다';
  end if;

  /*
    **볼 수 있는가를 여기서 안 묻는다.** `reading_scope` 가 그 답을 들고 있고,
    못 보는 대상이면 0행이라 아래 조인이 아무것도 안 집는다.
  */
  select r.* into mine
  from public.reading_scope(p_kind, p_person_a, p_person_b, null) s
  join public.reading r
    on r.kind = s.kind
   and r.owner_user_id is not distinct from s.owner_user_id
   and r.person_a = s.person_a
   and r.person_b is not distinct from s.person_b
   and r.match_id is not distinct from s.match_id;

  if not found then
    raise exception '공유할 풀이가 없습니다';
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

  key := case
    when mine.source_run_id is not null then 'run:' || mine.source_run_id::text
    else 'reading:' || mine.id::text || '@'
         || to_char(mine.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
  end;

  insert into public.reading_share (token, shared_by, version_key, kind, metaphor, score, body)
  values (
    replace(pg_catalog.gen_random_uuid()::text, '-', ''),
    me, key, p_kind, mine.metaphor, mine.score, said)
  on conflict (shared_by, version_key) do nothing
  returning token into made;

  if made is null then
    select s.token into made
    from public.reading_share s
    where s.shared_by = me and s.version_key = key;
  end if;

  return made;
end;
$$;

revoke execute on function public.share_my_reading(text, text, text, uuid, uuid) from anon, public;
grant execute on function public.share_my_reading(text, text, text, uuid, uuid) to authenticated;

/**
 * 옛 두 인자짜리 — **아직 안 지운다**(위: 넓히고 나중에 좁힌다).
 *
 * 배포 순서가 DB 먼저이므로, 이 창이 닫히기 전까지는 옛 앱이 이것을 부른다.
 * 하는 일은 새 문에 `self` 로 넘기는 것뿐이다.
 */
create or replace function public.share_my_reading(p_body text, p_metaphor text default null)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select public.share_my_reading(p_body, p_metaphor, 'self', null::uuid, null::uuid);
$$;

-- ---------------------------------------------------------------------------
-- 읽는 문 — 갈래와 점수를 함께 낸다
-- ---------------------------------------------------------------------------

/**
 * 갈래를 내주는 까닭은 **화면이 셋이기 때문**이다. 주소마다 미리보기 그림이 다르므로,
 * 한 사람짜리 토큰을 궁합 주소로 열면 그 화면은 아무것도 안 보여야 한다 — 안 그러면
 * 대화창에는 「두 사람의 궁합」이 서고 열면 한 사람 글이 나온다.
 *
 * 나가는 것은 여전히 **글과 수와 갈래**뿐이다. 누가 보냈는지도, 어느 판인지도,
 * 누구에 대한 글인지도 안 나간다.
 */
drop function public.shared_reading(text);

create function public.shared_reading(p_token text)
returns table (kind text, metaphor text, score smallint, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.kind, s.metaphor, s.score, s.body, s.created_at
  from public.reading_share s
  where s.token = p_token;
$$;

revoke execute on function public.shared_reading(text) from public;
grant execute on function public.shared_reading(text) to anon, authenticated;
