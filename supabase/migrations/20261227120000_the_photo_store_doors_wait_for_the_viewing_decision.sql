-- 사진 저장소의 올리는 문 넷은 열람 방식이 정해질 때까지 닫는다 · 옮긴 표시는 표가 있을 때만 바이트를 걷는다 (G-120, 독립 검토)
--
-- `20261227090000` 이 운영에 오른 뒤 독립 검토가 찾은 둘이다.
--
-- 1. **문 넷이 로그인한 사람에게 열려 있었다** — `begin_my_photo_upload` · `add_my_photo_object` · `replace_my_photo_object` ·
--    `drop_my_photo_upload`. 지금 앱은 안 부르지만 PostgREST 로 바로 부르면 바이트 없는 열쇠 줄이 선다 — 저장소에 아무것도 없는
--    줄이라, 그 사람의 사진이 남의 화면에 깨진 그림으로 선다(지금 라우트는 그 줄을 500 으로 받는다). 누가 무엇을 할 수 있는가가
--    바뀌는 것이라 결정이다 — 여기서 걷고, 켜는 날의 마이그레이션(열람 방식과 함께, G-120)이 다시 연다.
-- 2. **옮긴 표시가 표 없이도 바이트를 걷었다** — 옮기는 도구가 표를 받고 두 벌을 쓴 뒤 멈췄다가 한 시간 넘게 지나 돌아오면, 청소기가
--    그 표를 지울 줄로 옮겨 객체를 지운 뒤다. 그때 표시를 받아 주면 줄은 지워진 객체를 가리키고 바이트는 사라진다 — 하나뿐인 사본을
--    잃는다. 이제 표를 걷는 데 성공했을 때만 고친다(`take_my_photo_ticket` 과 같은 꼴). 표가 없으면 아무것도 안 고치고 거짓이다 —
--    그 열쇠는 이미 청소기의 몫이다.
--
-- 재는 자리는 `supabase/tests/99_photo_object_store.test.sql` · `74_authenticated_doors` · `75_suspended_write_doors`.

revoke execute on function public.begin_my_photo_upload() from authenticated;
revoke execute on function public.add_my_photo_object(text, text) from authenticated;
revoke execute on function public.replace_my_photo_object(integer, bigint, text, text) from authenticated;
revoke execute on function public.drop_my_photo_upload(text) from authenticated;

create or replace function public.photo_bytes_moved(p_user_id uuid, p_position integer, p_version bigint, p_object_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  held text;
begin
  if p_object_key is null or p_object_key not like format('photos/%s/%%', p_user_id) then
    raise exception 'photo_bytes_moved: 열쇠가 그 사람의 접두사가 아니다' using errcode = '22023';
  end if;

  delete from public.photo_upload_ticket t where t.object_key = p_object_key
  returning t.object_key into held;

  if held is null then
    return false;
  end if;

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
