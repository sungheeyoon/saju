-- 스위치를 바꾸는 일은 진행 중인 올리기가 끝날 때까지 기다린다 (G-120, ADR 0203 「덧붙임 — 바꾸는 일은 진행 중인 올리기를 기다린다」)
--
-- `20261228140000` 의 `photo_upload_must_be` 는 스위치 값을 읽기만 했다. 그래서 이런 차례가 가능했다(리뷰, 2026-10-23).
--
-- 1. `db` 검사를 지난 올리기가 아직 커밋 전이다
-- 2. 운영자가 스위치를 `paused` 로 바꾼다 — 읽기만 한 줄이라 곧바로 바뀐다
-- 3. 운영자가 바이트 줄을 전부 지우고 0건을 잰다
-- 4. 1 의 올리기가 뒤늦게 커밋한다 — 지운 뒤에 옛 길의 사진이 다시 선다
--
-- **이제 올리는 문은 스위치 줄을 `for share` 로 읽고 커밋까지 쥔다.** 운영자의 `update`(행 잠금 `for no key update`)는 `for share`
-- 와 부딪쳐, 그 줄을 쥔 올리기가 모두 커밋하거나 거절될 때까지 기다린다. 그래서 `update … returning` 이 돌아온 순간에는 바꾸기 전
-- 값으로 검사를 지난 올리기가 하나도 남아 있지 않다 — 3 의 삭제가 그 뒤에 온다. 바꾸는 동안 들어온 올리기는 운영자의 갱신 뒤에 줄을
-- 서고, 그 갱신이 커밋되면 새 값을 읽는다(READ COMMITTED 의 다시 읽기).
--
-- `for key share` 로는 안 된다 — 키가 아닌 칸(`mode`)의 갱신과 부딪치지 않는다.
--
-- **교착이 없는 까닭** — 올리는 문의 차례는 늘 계정 잠금(`lock_my_photos` — `app_user` 줄 `for update`) → 스위치 줄(`for share`)이다.
-- 스위치를 바꾸는 쪽은 스위치 줄 하나만 잠그고 계정 줄에 닿지 않는다. 올리는 문끼리는 `for share` 가 서로 안 막는다. 삭제 SQL 은
-- `profile_photo` 만 지운다(바이트 줄이라 지울 줄 트리거도 안 선다).
--
-- 값을 읽는 문 `photo_upload_mode()`(화면)는 그대로 잠그지 않는다 — 화면은 거절하지 않고, 거절은 이 문이 한다.
-- `for share` 를 쓰므로 이 함수는 `stable` 이 아니라 `volatile` 이다.
--
-- 재는 자리는 `supabase/tests/99_photo_upload_switch_waits.test.sql`.

create or replace function public.photo_upload_must_be(p_path text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  now_mode text;
begin
  select s.mode into now_mode
  from public.photo_upload_switch s
  where s.id
  for share;

  if now_mode is null or now_mode = 'paused' then
    raise exception '사진 보관 방식을 바꾸는 중이라 지금은 사진을 올릴 수 없어요.' using errcode = '55000';
  end if;
  if now_mode is distinct from p_path then
    raise exception '사진을 올리지 못했어요. 다시 시도해 주세요.' using errcode = '55000';
  end if;
end;
$$;

revoke execute on function public.photo_upload_must_be(text) from public, anon, authenticated, service_role;
