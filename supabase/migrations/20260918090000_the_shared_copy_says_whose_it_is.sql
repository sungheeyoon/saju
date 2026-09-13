-- 공유본이 **누구 것인지 말한다**
--
-- 링크를 받은 사람이 글을 다 읽고도 「그래서 이게 누구 건데?」라고 묻고 있었다.
-- 이름이 어디에도 안 서 있었기 때문이다.
--
-- **새로 새는 값이 아니다.** 본문은 이미 그 사람을 이름으로 부른다(자기 풀이는
-- 닉네임으로 — `self_is_called_by_the_nickname`). 여기서 하는 일은 글 속에 흩어져
-- 있는 사실을 **머리에 한 번 세우는 것**이고, 안 세우면 읽는 사람이 그것을 본문에서
-- 찾아내야 한다.
--
-- ## 이름도 사본이다
--
-- 보낸 그때의 이름을 적어 둔다. 나중에 저장한 사람의 이름표를 바꿔도 이미 보낸
-- 링크의 이름은 안 바뀐다 — 글과 같은 규칙이다(ADR 0063). 이름만 지금 값을 읽어
-- 오면, 「엄마」로 보낸 글이 어느 날 「어머니」의 글로 서고 본문은 여전히 「엄마」라
-- 부른다.
--
-- ## 미리보기에는 안 싣는다
--
-- 화면에만 선다. 대화창 목록에, 열어 보기도 전에 남의 이름이 서는 일은 없어야
-- 한다(ADR 0063) — 미리보기가 상수인 까닭이 그것이고 여기서 깨지 않는다.

alter table public.reading_share
  add column name_a text,
  /** 궁합만 둘째 이름을 든다. 한 사람짜리는 `null` 이다 */
  add column name_b text;

alter table public.reading_share
  add constraint share_second_name_follows_the_kind check (
    (kind = 'private') or name_b is null);

/**
 * 이미 나간 링크들 — **지금 닉네임으로 채운다.**
 *
 * 그때 무엇이었는지 우리는 모른다. 짐작인 것을 적어 두는 대신 **짐작이라는 사실을
 * 여기 적는다**: 이 열이 생기기 전의 줄은 전부 자기 풀이(`kind = 'self'`)이고, 그
 * 본문은 닉네임으로 사람을 부르고 있다. 닉네임은 바뀔 수 있으므로 그 둘이 어긋난
 * 줄이 있을 수 있다 — 그 경우 머리의 이름이 아니라 **본문이 맞다.**
 */
update public.reading_share s
set name_a = u.nickname
from public.app_user u
where u.id = s.shared_by and s.name_a is null and u.nickname is not null;

-- ---------------------------------------------------------------------------
-- 내보내는 문 — 이름을 함께 적는다
-- ---------------------------------------------------------------------------

create or replace function public.share_my_reading(
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
  scope record;
  mine public.reading;
  key text;
  made text;
  said text := btrim(coalesce(p_body, ''));
  called_a text;
  called_b text;
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
  select * into scope
  from public.reading_scope(p_kind, p_person_a, p_person_b, null);

  if not found then
    raise exception '공유할 풀이가 없습니다';
  end if;

  select r.* into mine
  from public.reading r
  where r.kind = scope.kind
    and r.owner_user_id is not distinct from scope.owner_user_id
    and r.person_a = scope.person_a
    and r.person_b is not distinct from scope.person_b
    and r.match_id is not distinct from scope.match_id;

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

  /**
   * **부르는 말은 kind 마다 다른 표에서 온다** — `line.ts` 가 목록에서 그러는 것과
   * 같은 자리다. 자기 풀이는 닉네임(앱 안에서 나는 닉네임이다), 나머지는 내가 그
   * 사람에게 붙인 이름표다.
   *
   * 차례를 여기서 다시 정하지 않는다. `reading_scope` 가 두 사람을 Person id 로 줄
   * 세워 내주고 본문의 이름도 그 차례를 따라 붙었으므로, 같은 차례로 적으면 머리와
   * 본문이 같은 사람을 같은 이름으로 부른다.
   */
  if p_kind = 'self' then
    select u.nickname into called_a from public.app_user u where u.id = me;
  else
    select e.local_label into called_a
    from public.user_person_access e
    where e.user_id = me and e.person_id = scope.person_a;
  end if;

  if p_kind = 'private' then
    select e.local_label into called_b
    from public.user_person_access e
    where e.user_id = me and e.person_id = scope.person_b;
  end if;

  key := case
    when mine.source_run_id is not null then 'run:' || mine.source_run_id::text
    else 'reading:' || mine.id::text || '@'
         || to_char(mine.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
  end;

  insert into public.reading_share
    (token, shared_by, version_key, kind, metaphor, score, body, name_a, name_b)
  values (
    replace(pg_catalog.gen_random_uuid()::text, '-', ''),
    me, key, p_kind, mine.metaphor, mine.score, said, called_a, called_b)
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

-- ---------------------------------------------------------------------------
-- 읽는 문 — 이름을 함께 낸다
-- ---------------------------------------------------------------------------

/**
 * 나가는 것이 다섯에서 일곱이 된다. `anon` 에게 열린 유일한 문이라 **느는 것이 곧
 * 로그인 없는 사람이 볼 수 있는 것**이고, 그래서 흐름 검사가 이 이름들을 센다.
 *
 * 여기 실리는 이름은 **본문에 이미 있는 이름**이다. 없던 것을 내주는 것이 아니라,
 * 글 속에 흩어져 있는 사실을 머리에 한 번 세우는 것이다.
 */
drop function public.shared_reading(text);

create function public.shared_reading(p_token text)
returns table (
  kind text,
  name_a text,
  name_b text,
  metaphor text,
  score smallint,
  body text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.kind, s.name_a, s.name_b, s.metaphor, s.score, s.body, s.created_at
  from public.reading_share s
  where s.token = p_token;
$$;

revoke execute on function public.shared_reading(text) from public;
grant execute on function public.shared_reading(text) to anon, authenticated;
