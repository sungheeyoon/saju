-- 사진의 바이트가 DB 밖(객체 저장소)에 살 수 있다 — 표 · 문만 넓히고, 앱은 켜는 값이 없으면 지금 길 그대로다 (G-120)
--
-- 지금 사진은 `profile_photo.bytes`(512KB, 긴 변 512px)에 산다(ADR 0040). 저장소(AWS S3 서울)로 옮길 때 DB 는 계속
-- **원본의 장부**다 — 누가 어느 자리에 무슨 판본을 두었나, 볼 수 있나(`may_see_photo`)는 그대로 DB 가 답하고, 바이트만
-- 밖에 둔다. 이 마이그레이션은 그 장부의 칸과 문만 연다. 지금 앱은 새 문을 안 부르고, 운영에는 저장소 값이 없다.
--
-- ## 1. 한 장은 바이트 **또는** 열쇠 하나를 든다
--
-- `object_key` 는 저장소의 접두사(`photos/{user_id}/{upload_id}`)이고 두 벌(`…/card` · `…/large`)이 그 아래 산다. 한 줄이
-- 둘 다 들거나 둘 다 비면 어느 쪽이 그 장인지 모른다 — 검사식으로 하나만 든다.
--
-- ## 2. 올리기는 표(`photo_upload_ticket`)를 먼저 받는다 — 고아가 안 남는다
--
-- 앱이 저장소에 먼저 쓰고 DB 에 나중에 적는다. 그 사이에 함수가 죽으면 저장소에 아무 줄도 안 가리키는 객체가 남는다.
-- 그래서 **쓰기 전에** DB 가 열쇠를 짓고 표를 적는다(`begin_my_photo_upload`). 저장이 표를 걷고(`add_my_photo_object` ·
-- `replace_my_photo_object`), 실패하면 앱이 표를 지울 줄로 옮기며(`drop_my_photo_upload`), 그것마저 못 하면 청소기가 한 시간
-- 지난 표를 옮긴다(`photo_sweep_tickets`). 열쇠는 DB 만 짓는다 — 사람이 남의 접두사를 가리킬 수 없다.
--
-- **하루 올리기 한도(ADR 0125)는 표를 받을 때 센다** — 저장소에 쓰는 것이 비용이므로, 저장에 실패한 올리기도 한 번이다.
--
-- ## 3. 지울 줄(`photo_object_trash`) — 바꾸기 · 지우기 · 탈퇴가 같은 길이다
--
-- 줄이 열쇠를 잃는 모든 길(지우기 · 바꾸기 · 계정 삭제의 cascade · 옛 문의 바꾸기)에서 트리거가 옛 열쇠를 지울 줄에 넣는다.
-- 저장소를 지우는 일은 DB 가 못 하므로(ADR 0040 이 bytea 를 고른 까닭) 청소기(`app/api/cron/photo-sweep`)가 줄을 받아
-- 지우고 결과를 적는다(`photo_trash_batch` · `photo_trash_settle`). 실패하면 늘어나는 간격으로 다시 하고(청소가 하루 한 번이라
-- 처음 며칠은 날마다), 다섯 번째부터 운영 알림(`notify_ops`)을 낸다. 지울 줄에는 사람 id 칸이 없지만 **열쇠의 접두사가 계정 id 다**
-- — 탈퇴한 사람의 id 가 그 줄이 지워질 때까지 남는다(표의 `user_id` 도 같다). 켜는 날의 확인 거리다(G-120).
--
-- ## 4. 옛 사진을 옮기는 문 셋 — 열쇠에만
--
-- `photo_move_begin` · `photo_bytes_to_move` · `photo_bytes_moved` · `photo_object_keys` — `scripts/photo-move.mjs` ·
-- `scripts/photo-verify.mjs` 가 부른다. 옮기기도 올리기와 같이 **표를 먼저 받는다** — 도구가 두 벌을 쓰다 죽어도 표가 남아 청소기가
-- 지운다. **판본(`updated_at`)을 안 바꾼다** — 같은 그림이 자리만 옮기므로 화면의 `?v=` 가 그대로 맞다. 그 사이 사람이
-- 그 장을 바꿨으면(판본이 다르면) 옮기지 않고 올린 객체를 지울 줄에 넣는다.
--
-- ## 그대로인 것
--
-- - **볼 수 있는가** — `may_see_photo` · `photo_at` 은 한 글자도 안 바뀐다. `photo_at` 은 열쇠 줄에서 `base64` 가 비고,
--   지금 라우트는 그것을 없는 장(404)으로 받는다. 열쇠 줄을 어떻게 내줄지(열람 방식)는 G-120 의 결정이다.
-- - `replace_my_photo`(DB 길)는 본문 한 칸만 — 열쇠 줄을 바이트로 바꾸면 열쇠를 걷는다(1 의 검사식). 트리거가 옛 객체를 지울
--   줄에 넣는다. 그 밖은 `20261203090000` 그대로다.
-- - RLS 켜고 정책 0 · 새 표를 아무에게도 안 여는 것.
--
-- 재는 자리는 `supabase/tests/99_photo_object_store.test.sql` · `74_authenticated_doors` · `75_suspended_write_doors`.

-- ---------------------------------------------------------------------------
-- 1. 표 — 바이트 또는 열쇠
-- ---------------------------------------------------------------------------

alter table public.profile_photo alter column bytes drop not null;

alter table public.profile_photo
  add column object_key text
    constraint profile_photo_object_key_shape check (
      object_key ~ '^photos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),
  add constraint profile_photo_bytes_or_object check ((bytes is null) <> (object_key is null)),
  add constraint profile_photo_object_key_unique unique (object_key);

comment on column public.profile_photo.object_key is
  '저장소의 접두사 photos/{user_id}/{upload_id} — 두 벌(card · large)이 그 아래. 바이트(bytes)와 둘 중 하나만 (G-120)';

/** 받은 표 — 저장소에 쓰기 전에 DB 가 지은 열쇠. 저장이 걷고, 남으면 청소기가 지울 줄로 옮긴다 */
create table public.photo_upload_ticket (
  object_key text primary key
    constraint photo_upload_ticket_key_shape check (
      object_key ~ '^photos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),
  user_id uuid not null,
  issued_at timestamptz not null default clock_timestamp()
);

create index photo_upload_ticket_by_issue on public.photo_upload_ticket (issued_at);

alter table public.photo_upload_ticket enable row level security;
revoke all on public.photo_upload_ticket from anon, authenticated;

/** 지울 객체 — 열쇠 하나가 두 벌을 든다. 청소기가 지우고 걷는다 */
create table public.photo_object_trash (
  object_key text primary key
    constraint photo_object_trash_key_shape check (
      object_key ~ '^photos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),
  queued_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 0 check (attempts >= 0),
  next_try_at timestamptz not null default clock_timestamp(),
  /** 실패의 분류 — 문장이 아니라 이름만(오류 문장에는 버킷 이름 · 역할이 섞일 수 있다) */
  last_error text check (last_error ~ '^[a-z0-9_.:-]{1,60}$')
);

create index photo_object_trash_due on public.photo_object_trash (next_try_at);

alter table public.photo_object_trash enable row level security;
revoke all on public.photo_object_trash from anon, authenticated;

/** 열쇠 하나를 지울 줄에 — 이미 있으면 그대로(다시 넣어도 한 줄) */
create function public.trash_photo_object(p_object_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.photo_object_trash (object_key) values (p_object_key)
  on conflict (object_key) do nothing;
$$;

revoke execute on function public.trash_photo_object(text) from public, anon, authenticated, service_role;

/**
 * 줄이 열쇠를 잃으면 옛 열쇠를 지울 줄에 — 지우기 · 바꾸기 · cascade(계정 삭제)가 다 이 한 자리를 지난다.
 *
 * 자리만 옮기는 갱신(`move_my_photo` · `remove_my_photo` 의 당겨 앉기)은 열쇠가 그대로라 아무것도 안 넣는다.
 */
create function public.profile_photo_object_left()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.object_key is not null
     and (tg_op = 'DELETE' or new.object_key is distinct from old.object_key) then
    perform public.trash_photo_object(old.object_key);
  end if;
  return null;
end;
$$;

revoke execute on function public.profile_photo_object_left() from public, anon, authenticated, service_role;

create trigger profile_photo_object_left
after update of object_key or delete on public.profile_photo
for each row execute function public.profile_photo_object_left();

-- ---------------------------------------------------------------------------
-- 2. 올리는 문 — 표 받기 · 더하기 · 바꾸기 · 표 버리기 (로그인한 사람)
-- ---------------------------------------------------------------------------

/**
 * 저장소에 쓸 열쇠를 받는다 — 하루 올리기 한도를 여기서 한 번 센다.
 *
 * 정지 · 로그인 · 계정 잠금은 다른 쓰는 문과 같은 `lock_my_photos` 다.
 */
create function public.begin_my_photo_upload()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
  key text := format('photos/%s/%s', actor, gen_random_uuid());
begin
  perform public.note_my_photo_upload(actor);
  insert into public.photo_upload_ticket (object_key, user_id) values (key, actor);
  return key;
end;
$$;

/** 받은 표를 걷는다 — 내 표가 아니면 올리기와 같은 거절. 걷힌 표의 열쇠는 이제 줄이 든다 */
create function public.take_my_photo_ticket(p_actor uuid, p_object_key text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.photo_upload_ticket t
  where t.object_key = p_object_key and t.user_id = p_actor;
  if not found then
    raise exception '사진을 올리지 못했어요. 다시 시도해 주세요.' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.take_my_photo_ticket(uuid, text) from public, anon, authenticated, service_role;

/** 형식은 바이트 길과 같은 목록 — 거절 문장도 같다 */
create function public.check_photo_content_type(p_content_type text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_content_type is null or p_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'JPG · PNG · WebP 만 올릴 수 있습니다.' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.check_photo_content_type(text) from public, anon, authenticated, service_role;

/**
 * 저장소에 올린 한 장을 **맨 뒤에** 놓는다 — `add_my_photo` 와 같은 자리 셈, 바이트 대신 열쇠.
 *
 * 하루 한도는 표를 받을 때 셌다 — 여기서 다시 세지 않는다.
 */
create function public.add_my_photo_object(p_object_key text, p_content_type text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
  placed integer;
begin
  perform public.check_photo_content_type(p_content_type);

  select count(*)::integer + 1 into placed
  from public.profile_photo where user_id = actor;

  if placed > 6 then
    raise exception '사진은 6장까지입니다.' using errcode = '22023';
  end if;

  perform public.take_my_photo_ticket(actor, p_object_key);

  insert into public.profile_photo (user_id, position, content_type, object_key)
  values (actor, placed, p_content_type, p_object_key);

  return placed;
end;
$$;

/**
 * 한 장을 **그 자리에서** 저장소의 새 장으로 바꾼다 — `replace_my_photo` 와 같은 뜻(판본이 바뀌고 자리는 그대로, 보일 자리는
 * 가운데로). 옛 장이 열쇠였으면 트리거가 지울 줄에 넣는다. 낡은 누름이면 표를 걷지 않고 거절한다 — 앱이 표를 버린다.
 */
create function public.replace_my_photo_object(p_position integer, p_version bigint, p_object_key text, p_content_type text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
  stamped timestamptz;
begin
  perform public.check_photo_content_type(p_content_type);

  if not exists (
    select 1 from public.profile_photo p
    where p.user_id = actor
      and p.position = p_position
      and public.profile_photo_version(p.updated_at) = p_version
  ) then
    raise exception '사진을 바꾸지 못했어요. 다시 시도해 주세요.' using errcode = '22023';
  end if;

  perform public.take_my_photo_ticket(actor, p_object_key);

  update public.profile_photo p
  set content_type = p_content_type, bytes = null, object_key = p_object_key,
      updated_at = clock_timestamp(), focus_x = 50, focus_y = 50
  where p.user_id = actor and p.position = p_position
  returning p.updated_at into stamped;

  return public.profile_photo_version(stamped);
end;
$$;

/**
 * 저장하지 못한 올리기의 표를 지울 줄로 — 저장소에 무엇이 남았든 청소기가 지운다. 없는 표면 조용히 지나간다(두 번 부름).
 *
 * 다른 쓰는 문과 같은 문턱(`lock_my_photos`)이다 — 정지된 계정의 표는 한 시간 뒤 청소기가 옮긴다.
 */
create function public.drop_my_photo_upload(p_object_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
begin
  delete from public.photo_upload_ticket t
  where t.object_key = p_object_key and t.user_id = actor;
  if found then
    perform public.trash_photo_object(p_object_key);
  end if;
end;
$$;

revoke execute on function public.begin_my_photo_upload() from public, anon;
revoke execute on function public.add_my_photo_object(text, text) from public, anon;
revoke execute on function public.replace_my_photo_object(integer, bigint, text, text) from public, anon;
revoke execute on function public.drop_my_photo_upload(text) from public, anon;
grant execute on function public.begin_my_photo_upload() to authenticated;
grant execute on function public.add_my_photo_object(text, text) to authenticated;
grant execute on function public.replace_my_photo_object(integer, bigint, text, text) to authenticated;
grant execute on function public.drop_my_photo_upload(text) to authenticated;

/** 바이트 길의 바꾸기 — `20261203090000` 의 본문에서 열쇠를 걷는 한 칸만 더했다(머리말 「그대로인 것」) */
create or replace function public.replace_my_photo(p_position integer, p_version bigint, p_content_type text, p_base64 text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
  raw bytea := public.profile_photo_bytes(p_content_type, p_base64);
  stamped timestamptz;
begin
  if not exists (
    select 1 from public.profile_photo p
    where p.user_id = actor
      and p.position = p_position
      and public.profile_photo_version(p.updated_at) = p_version
  ) then
    raise exception '사진을 바꾸지 못했어요. 다시 시도해 주세요.' using errcode = '22023';
  end if;

  perform public.note_my_photo_upload(actor);

  update public.profile_photo p
  set content_type = p_content_type, bytes = raw, object_key = null,
      updated_at = clock_timestamp(), focus_x = 50, focus_y = 50
  where p.user_id = actor and p.position = p_position
  returning p.updated_at into stamped;

  return public.profile_photo_version(stamped);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. 청소기의 문 — 열쇠(service_role)에만
-- ---------------------------------------------------------------------------

/** 한 시간 넘게 안 걷힌 표를 지울 줄로 옮긴다 — 저장 전에 죽은 올리기. 옮긴 수 */
create function public.photo_sweep_tickets()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  moved integer;
begin
  with gone as (
    delete from public.photo_upload_ticket t
    where t.issued_at < now() - interval '1 hour'
    returning t.object_key
  )
  insert into public.photo_object_trash (object_key)
  select g.object_key from gone g
  on conflict (object_key) do nothing;

  get diagnostics moved = row_count;
  return moved;
end;
$$;

/**
 * 지울 차례가 온 열쇠들 — 오래된 것부터. **아직 어떤 줄이 그 열쇠를 들면 안 낸다**(지우면 보이는 사진이 깨진다) — 그런 줄은
 * 여기서 걷는다. 트리거와 옮기는 문이 그런 줄을 안 만들지만, 지우는 쪽이 마지막으로 한 번 더 본다.
 */
create function public.photo_trash_batch(p_limit integer)
returns table (object_key text, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.photo_object_trash t
  where exists (select 1 from public.profile_photo p where p.object_key = t.object_key);

  return query
  select t.object_key, t.attempts
  from public.photo_object_trash t
  where t.next_try_at <= now()
  order by t.next_try_at, t.object_key
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

/**
 * 지운 결과를 적는다 — 지운 것은 걷고, 못 지운 것은 간격을 늘려(1 · 2 · 4 · … 시간, 길어야 이레) 다시 둔다. 청소가 하루 한
 * 번이라 처음 다섯 번은 날마다 다시 하는 셈이고, 다섯 번째 실패(닷새째)부터 운영 알림 — 종류마다 하루 한 줄이다(`notify_ops`).
 *
 * @returns 이번에 알렸으면 참
 */
create function public.photo_trash_settle(p_deleted text[], p_failed text[], p_error_class text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  stuck integer;
begin
  delete from public.photo_object_trash t where t.object_key = any(coalesce(p_deleted, '{}'));

  update public.photo_object_trash t
  set attempts = t.attempts + 1,
      next_try_at = now() + least(interval '7 days', interval '1 hour' * power(2, least(t.attempts, 8))),
      last_error = coalesce(nullif(p_error_class, ''), 'unknown')
  where t.object_key = any(coalesce(p_failed, '{}'));

  select count(*)::integer into stuck from public.photo_object_trash t where t.attempts >= 5;
  if stuck > 0 then
    return public.notify_ops(
      'photo-trash-stuck',
      format('지울 사진 객체 %s개가 다섯 번 넘게 지워지지 않았다(마지막 분류 %s) — 탈퇴 · 바꾼 사진이 저장소에 남아 있다. docs/ops/runbook/photo-store.md 「지울 줄이 안 줄 때」',
             stuck, coalesce(nullif(p_error_class, ''), 'unknown')));
  end if;
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. 옛 사진을 옮기는 문 — 열쇠(service_role)에만
-- ---------------------------------------------------------------------------

/** 옮기는 도구의 표 — 그 사람의 접두사로 열쇠를 짓고 표를 적는다. 하루 한도는 안 센다(사람이 올린 것이 아니다) */
create function public.photo_move_begin(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  key text := format('photos/%s/%s', p_user_id, gen_random_uuid());
begin
  insert into public.photo_upload_ticket (object_key, user_id) values (key, p_user_id);
  return key;
end;
$$;

/** 아직 바이트로 사는 장 — 사람 · 자리 차례로. 옮기는 도구가 받는다 */
create function public.photo_bytes_to_move(p_limit integer)
returns table (user_id uuid, "position" integer, version bigint, content_type text, base64 text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.position::integer, public.profile_photo_version(p.updated_at), p.content_type, encode(p.bytes, 'base64')
  from public.profile_photo p
  where p.bytes is not null
  order by p.user_id, p.position
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

/**
 * 옮긴 장을 적는다 — 그 자리의 판본이 그대로이고 아직 바이트일 때만 열쇠로 바꾸고 바이트를 걷는다. **판본은 안 바꾼다.**
 * 표(`photo_move_begin`)는 어느 쪽이든 걷는다. 못 적으면(그 사이 바뀜 · 지워짐) 올린 객체를 지울 줄에 넣고 거짓.
 */
create function public.photo_bytes_moved(p_user_id uuid, p_position integer, p_version bigint, p_object_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_object_key is null or p_object_key not like format('photos/%s/%%', p_user_id) then
    raise exception 'photo_bytes_moved: 열쇠가 그 사람의 접두사가 아니다' using errcode = '22023';
  end if;

  delete from public.photo_upload_ticket t where t.object_key = p_object_key;

  update public.profile_photo p
  set object_key = p_object_key, bytes = null
  where p.user_id = p_user_id
    and p.position = p_position
    and p.bytes is not null
    and public.profile_photo_version(p.updated_at) = p_version;

  if found then
    return true;
  end if;

  perform public.trash_photo_object(p_object_key);
  return false;
end;
$$;

/** 열쇠로 사는 장 — 검증 도구가 저장소와 견준다. 열쇠 차례로 이어 받는다(`p_after`) */
create function public.photo_object_keys(p_after text, p_limit integer)
returns table (object_key text, content_type text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.object_key, p.content_type
  from public.profile_photo p
  where p.object_key is not null
    and p.object_key > coalesce(p_after, '')
  order by p.object_key
  limit greatest(1, least(coalesce(p_limit, 500), 1000));
$$;

revoke execute on function public.photo_sweep_tickets() from public, anon, authenticated;
revoke execute on function public.photo_trash_batch(integer) from public, anon, authenticated;
revoke execute on function public.photo_trash_settle(text[], text[], text) from public, anon, authenticated;
revoke execute on function public.photo_move_begin(uuid) from public, anon, authenticated;
revoke execute on function public.photo_bytes_to_move(integer) from public, anon, authenticated;
revoke execute on function public.photo_bytes_moved(uuid, integer, bigint, text) from public, anon, authenticated;
revoke execute on function public.photo_object_keys(text, integer) from public, anon, authenticated;
grant execute on function public.photo_sweep_tickets() to service_role;
grant execute on function public.photo_trash_batch(integer) to service_role;
grant execute on function public.photo_trash_settle(text[], text[], text) to service_role;
grant execute on function public.photo_move_begin(uuid) to service_role;
grant execute on function public.photo_bytes_to_move(integer) to service_role;
grant execute on function public.photo_bytes_moved(uuid, integer, bigint, text) to service_role;
grant execute on function public.photo_object_keys(text, integer) to service_role;
