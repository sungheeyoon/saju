-- 사진은 하루(서울)에 스무 장까지 올린다 (ADR 0125, 보안 감사 3~14 의 하나, 운영자 승인 2026-09-28)
--
-- 사진을 올리는 문 둘(`add_my_photo` · 옛 앱의 `set_my_photo`)은 `authenticated` 에 열려 있고 **몇 번 올렸는지 세지 않는다.**
-- 한 장은 512KB 까지(`profile_photo_bytes`), 자리는 여섯까지다(`add_my_photo`). 그런데 지우기(`remove_my_photo`)도 세지
-- 않으므로 「올리고 지우기」를 되풀이하면 한 계정이 512KB 쓰기를 끝없이 낸다 — Postgres `bytea` 라 쓰기마다 WAL · 저장 ·
-- 백업 몫이 늘고(Supabase Free 의 한도 안), 옛 문 `set_my_photo` 는 1번 자리를 제자리에서 덮어써 지우기조차 필요 없다.
--
-- ## 무엇이 바뀌나
--
-- - **올린 것을 적는다** — `profile_photo_upload`(계정 · 시각). 사용자에게 안 열린 표다. 지운 사진의 줄도 남는다 —
--   세는 것은 「지금 몇 장인가」가 아니라 「오늘 몇 번 올렸나」다.
-- - **서울의 하루에 스무 번을 넘으면 거절한다** — 두 문 다. 거절 문장은 새것이다(운영자 승인).
-- - 옮기기 · 지우기는 안 센다 — 바이트를 안 쓴다.
--
-- 어제(서울) 이전의 줄은 그 계정이 다음에 올릴 때 걷는다. 계정을 지우면 함께 지워진다.
--
-- ## 운영자 결정(2026-09-28)
--
-- 「예, 하루 20번」 — 하루 한도 · 서울 자정 · 거절 문장 · 기록의 보존(어제 줄은 다음 올리기 때 걷고 탈퇴 때 함께 지운다)을
-- 제안대로 승인했다. 수는 아래 함수 한 곳에 있다.
--
-- 재는 자리는 `supabase/tests/67_photo_upload_rate.test.sql`.

create table public.profile_photo_upload (
  user_id uuid not null references public.app_user (id) on delete cascade,
  uploaded_at timestamptz not null default now()
);

/** 한 계정의 오늘 줄을 세는 자리 — 올릴 때마다 탄다 */
create index profile_photo_upload_by_user on public.profile_photo_upload (user_id, uploaded_at);

alter table public.profile_photo_upload enable row level security;
-- 정책을 하나도 만들지 않는다 — 쓰는 것은 아래 문 하나다
revoke all on public.profile_photo_upload from anon, authenticated;

/** 서울의 하루에 올릴 수 있는 횟수 — 운영자 승인 2026-09-28 */
create function public.profile_photo_upload_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 20 $$;

revoke execute on function public.profile_photo_upload_limit() from anon, authenticated, public;

/**
 * 오늘(서울) 올린 횟수를 보고, 넘지 않았으면 한 번을 적는다.
 *
 * 부르는 쪽이 계정 행을 이미 잠갔다(`lock_my_photos`) — 한 사람의 두 올리기가 나란히 세어 둘 다 스무 번째가 되는 자리가
 * 없다. 아무에게도 안 연다 — 올리는 문 안에서만 불린다.
 */
create function public.note_my_photo_upload(p_actor uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  today_starts timestamptz := ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
begin
  delete from public.profile_photo_upload u
  where u.user_id = p_actor and u.uploaded_at < today_starts;

  if (select count(*) from public.profile_photo_upload u where u.user_id = p_actor)
     >= public.profile_photo_upload_limit() then
    raise exception '오늘은 사진을 더 올릴 수 없습니다. 내일 다시 올려 주세요.' using errcode = '53400';
  end if;

  insert into public.profile_photo_upload (user_id) values (p_actor);
end;
$$;

revoke execute on function public.note_my_photo_upload(uuid) from anon, authenticated, public;

-- 두 문의 본문은 `20261026090000_the_profile_holds_up_to_six_photos.sql` 의 정의(지금 로컬 · 운영의 것)에 한 줄을 더한 것이다.
-- 서명이 그대로라 권한도 그대로다

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

create or replace function public.set_my_photo(p_content_type text, p_base64 text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := public.lock_my_photos();
  raw bytea := public.profile_photo_bytes(p_content_type, p_base64);
begin
  perform public.note_my_photo_upload(actor);

  update public.profile_photo
  set content_type = p_content_type, bytes = raw, updated_at = clock_timestamp()
  where user_id = actor and position = 1;

  if not found then
    insert into public.profile_photo (user_id, position, content_type, bytes)
    values (actor, 1, p_content_type, raw);
  end if;
end;
$function$;
