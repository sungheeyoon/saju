-- 사진 올리기는 DB 의 스위치 하나를 따른다 — `db` · `paused` · `s3` (G-120, ADR 0204)
--
-- 운영자 결정(2026-10-23): 사진 저장소로 바꿀 때 **업로드 차단 → 기존 사진 전체 삭제 → 0건 확인 → S3 업로드 개방** 의 차례로
-- 간다. 차단은 화면만이 아니라 서버의 모든 올리는 문에 선다. 그래서 **올리는 문마다 스위치를 보고 제 길이 아니면 거절한다** —
-- 화면 · 배포 · 환경변수가 어떻든 DB 가 마지막 문이다.
--
-- - `db`(기본값) — 지금 길. 바이트 길의 문 둘(`add_my_photo` · `replace_my_photo`)만 받는다. **이 마이그레이션으로 운영 동작은
--   바뀌지 않는다** — 스위치가 `db` 로 서고, 저장소 길의 문은 아직 `authenticated` 에 닫혀 있다(`20261227120000`)
-- - `paused` — 모든 올리기를 거절한다. 지우기 · 옮기기 · 위치 조정 · 보기는 그대로다
-- - `s3` — 저장소 길의 문 셋(`begin_my_photo_upload` · `add_my_photo_object` · `replace_my_photo_object`)만 받는다
--
-- `drop_my_photo_upload`(못 적은 올리기의 표를 지울 줄로 넘기기)는 막지 않는다 — 올리기가 아니라 뒷정리다. 스위치가 바뀌는 사이에
-- 표를 받은 올리기가 거절되면 앱이 이 문으로 표를 버린다.
--
-- 바꾸는 손은 운영 SQL 한 줄이다 — `update public.photo_upload_switch set mode = 'paused', changed_at = now();`
-- (`docs/ops/runbook/photo-store.md`). 앱 역할은 표를 못 읽고 못 쓴다 — 화면은 `photo_upload_mode()` 로 값만 읽는다.
--
-- 다섯 문의 본문은 살아 있는 정의(`add_my_photo` 는 `20261102090000`, 나머지 넷은 `20261227090000`)에서 떠서 스위치 한 줄만
-- 더했다. 한 줄은 계정 잠금(`lock_my_photos` — 로그인 · 정지 · 탈퇴의 거절)과 형식 검사 뒤, 하루 한도를 세기 전에 선다 — 정지된
-- 사람은 지금처럼 「이용이 정지된 계정입니다.」를 받고, 거절된 올리기는 한도를 깎지 않는다. 서명이 그대로라 권한도 그대로다.
--
-- 재는 자리는 `supabase/tests/99_photo_upload_switch.test.sql`.

create table public.photo_upload_switch (
  id boolean primary key default true check (id),
  mode text not null default 'db' check (mode in ('db', 'paused', 's3')),
  changed_at timestamptz not null default now()
);

comment on table public.photo_upload_switch is
  '사진 올리기의 길 — 한 줄뿐. db(바이트) · paused(모두 거절) · s3(저장소). 운영 SQL 로 바꾼다 (G-120, ADR 0204)';

insert into public.photo_upload_switch (id, mode) values (true, 'db');

alter table public.photo_upload_switch enable row level security;
revoke all on public.photo_upload_switch from public, anon, authenticated, service_role;

/** 지금의 길 — 화면이 사진 판을 그릴 때 읽는다. 줄이 없으면 `paused`(어느 길도 안 받는다 — 아래 `photo_upload_must_be` 와 같다) */
create function public.photo_upload_mode()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.mode from public.photo_upload_switch s where s.id), 'paused');
$$;

revoke execute on function public.photo_upload_mode() from public, anon, authenticated, service_role;
grant execute on function public.photo_upload_mode() to authenticated;

/**
 * 올리는 문의 첫 줄 — 스위치가 그 길(`db` · `s3`)이 아니면 거절한다.
 *
 * 멈춘 동안은 화면의 안내와 같은 글자다. 다른 길이면(스위치가 바뀌기 전에 그려진 화면) 「다시 시도」 — 화면이 실패를 받으면
 * 목록을 다시 읽어 새 길로 그린다(`app/me/profile/photo-grid.tsx` 의 `failed`).
 */
create function public.photo_upload_must_be(p_path text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  now_mode text := public.photo_upload_mode();
begin
  if now_mode = 'paused' then
    raise exception '사진 보관 방식을 바꾸는 중이라 지금은 사진을 올릴 수 없어요.' using errcode = '55000';
  end if;
  if now_mode is distinct from p_path then
    raise exception '사진을 올리지 못했어요. 다시 시도해 주세요.' using errcode = '55000';
  end if;
end;
$$;

revoke execute on function public.photo_upload_must_be(text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 바이트 길(`db`)
-- ---------------------------------------------------------------------------

create or replace function public.add_my_photo(p_content_type text, p_base64 text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := public.lock_my_photos();
  raw bytea := public.profile_photo_bytes(p_content_type, p_base64);
  placed integer;
begin
  perform public.photo_upload_must_be('db');

  select count(*)::integer + 1 into placed
  from public.profile_photo where user_id = actor;

  if placed > 6 then
    raise exception '사진은 6장까지입니다.' using errcode = '22023';
  end if;

  perform public.note_my_photo_upload(actor);

  insert into public.profile_photo (user_id, position, content_type, bytes)
  values (actor, placed, p_content_type, raw);

  return placed;
end;
$function$;

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
  perform public.photo_upload_must_be('db');

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
-- 저장소 길(`s3`)
-- ---------------------------------------------------------------------------

create or replace function public.begin_my_photo_upload()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
  key text := format('photos/%s/%s', actor, gen_random_uuid());
begin
  perform public.photo_upload_must_be('s3');
  perform public.note_my_photo_upload(actor);
  insert into public.photo_upload_ticket (object_key, user_id) values (key, actor);
  return key;
end;
$$;

/** 표를 받은 뒤 스위치가 바뀌었으면 여기서 거절한다 — 앱이 표를 지울 줄로 넘긴다(`drop_my_photo_upload`) */
create or replace function public.add_my_photo_object(p_object_key text, p_content_type text)
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
  perform public.photo_upload_must_be('s3');

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

create or replace function public.replace_my_photo_object(p_position integer, p_version bigint, p_object_key text, p_content_type text)
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
  perform public.photo_upload_must_be('s3');

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
