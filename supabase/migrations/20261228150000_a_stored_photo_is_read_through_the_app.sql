-- **결정 전 — draft.** 저장소에 사는 장을 앱 경로가 중계한다(G-120 의 안 A). 운영에 올리지 않는다
--
-- `photo_at` 이 열쇠 줄의 열쇠를 함께 낸다 — 라우트가 판정(`may_see_photo`)을 지난 줄의 열쇠로 저장소에서 읽어 바이트를 낸다.
-- 판정 · 조건 · 판본 대조는 `20261227180000` 의 정의 그대로다. 반환 칸 하나가 는다(`object_key`) — 옛 앱은 아는 칸만 집는다
-- (`docs/ops/runbook/deploy.md` 규약 넷의 3). 반환형이 바뀌므로 지우고 다시 세운다 — 권한도 앞과 같게.
--
-- **올리는 문 넷을 연다** — `20261227120000` 이 열람 방식이 정해질 때까지 닫아 두었다. 읽는 길이 서야 올린 장이 보이므로 같은 날 연다.

drop function public.photo_at(uuid, integer, bigint);

create function public.photo_at(p_user_id uuid, p_position integer, p_version bigint default null)
returns table (content_type text, base64 text, version bigint, object_key text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.content_type,
         case when public.profile_photo_version(p.updated_at) = p_version then null
              else encode(p.bytes, 'base64') end,
         public.profile_photo_version(p.updated_at),
         p.object_key
  from public.profile_photo p
  where p.user_id = p_user_id
    and p.position = p_position
    and public.may_see_photo(p_user_id);
$$;

comment on function public.photo_at(uuid, integer, bigint) is
  '사진 한 장 — 볼 수 있을 때만(may_see_photo). 받은 판본과 같으면 바이트 없이 판본만, 저장소에 사는 장은 열쇠를 (G-119 · G-120)';

revoke execute on function public.photo_at(uuid, integer, bigint) from anon, public;
grant execute on function public.photo_at(uuid, integer, bigint) to authenticated;

grant execute on function public.begin_my_photo_upload() to authenticated;
grant execute on function public.add_my_photo_object(text, text) to authenticated;
grant execute on function public.replace_my_photo_object(integer, bigint, text, text) to authenticated;
grant execute on function public.drop_my_photo_upload(text) to authenticated;
