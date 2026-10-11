-- 사진 한 장을 그 자리에서 바꾼다 — 지우고 올리고 옮기는 세 번의 부름이 아니라 한 번 (G-60, 조율자 지시 2026-10-11)
--
-- 프로필 사진 칸을 누르면 「사진 변경」이 선다. 그 일을 앱이 지우기(`remove_my_photo`) + 올리기(`add_my_photo`) +
-- 옮기기(`move_my_photo`)로 하면 셋이 깨진다.
--
-- - **여섯 장이 찼을 때** — 지우기가 먼저 가야 올리기가 자리를 얻는다. 그 사이 망이 끊기면 한 장이 사라진 채 남는다.
-- - **순서** — 새 장은 맨 뒤에 앉으므로 다시 옮겨야 제자리다. 옮기기가 실패하면 대표가 바뀐 채 남는다.
-- - **하루 한도(ADR 0125)** — 올리기 한 번으로 세는 것은 같지만, 실패한 중간 상태를 되돌리려 다시 올리면 한 번을 더 깎는다.
--
-- 그래서 문 하나가 한 트랜잭션에서 그 자리의 바이트만 갈아 끼운다. **판본(`updated_at`)이 바뀐다** — 화면의 그림 주소
-- `?v=` 가 새 장을 가리켜 옛 그림의 캐시를 안 밟는다. 자리 · 다른 장은 그대로다.
--
-- ## 무엇을 보나
--
-- - **정지 · 로그인** — `lock_my_photos` 가 계정 행을 잠그고 본다(올리기 · 옮기기 · 지우기와 같은 문턱).
-- - **형식 · 크기** — `profile_photo_bytes`(올리기와 같은 검사).
-- - **그 장이 그 자리에 있나** — `p_version` 은 화면이 본 그 장이다. 다른 탭이 먼저 목록을 바꿨으면 거절하고 화면이
--   목록을 다시 받는다. **세기 전에 본다** — 낡은 누름이 하루 한도를 깎지 않는다.
-- - **하루 한도** — `note_my_photo_upload` 로 한 번. 올리기와 같은 셈이다(바이트를 새로 쓴다).
--
-- 바꾸는 것은 로그인한 사람이 자기 사진에 하던 일의 묶음이라 **누가 무엇을 볼 수 있는가를 안 바꾼다.** 거절 문장
-- 「사진을 바꾸지 못했어요. 다시 시도해 주세요.」는 새것이다(조율자 승인 2026-10-11, 대장 40).
--
-- 재는 자리는 `supabase/tests/90_photo_replace.test.sql` · `74_authenticated_doors` · `75_suspended_write_doors`.

create function public.replace_my_photo(
  p_position integer,
  p_version bigint,
  p_content_type text,
  p_base64 text
)
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
  set content_type = p_content_type, bytes = raw, updated_at = clock_timestamp()
  where p.user_id = actor and p.position = p_position
  returning p.updated_at into stamped;

  return public.profile_photo_version(stamped);
end;
$$;

comment on function public.replace_my_photo(integer, bigint, text, text) is
  '사진 한 장을 그 자리에서 바꾼다 — 판본이 바뀌고 자리는 그대로. 하루 올리기 한도를 한 번 센다 (G-60)';

revoke execute on function public.replace_my_photo(integer, bigint, text, text) from anon, public;
grant execute on function public.replace_my_photo(integer, bigint, text, text) to authenticated;
