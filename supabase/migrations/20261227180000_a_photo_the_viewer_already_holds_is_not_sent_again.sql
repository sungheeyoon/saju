-- 이미 받은 사진은 다시 안 보낸다 — `photo_at` 이 받은 판본과 같으면 바이트 없이 판본만 낸다 (G-119 안 C, ADR 0200, 운영자 결정 2026-10-22)
--
-- 사진 라우트(`app/me/photo/photo-response.ts`)는 `private, max-age=60` 이었다. 1분이 지나 같은 화면을 다시 열면 장마다
-- 이 문이 바이트(base64, 한 장 상한 512KB)를 다시 냈다. 이제 라우트는 `private, no-cache` 에 `ETag`(판본)를 달고, 브라우저가
-- `If-None-Match` 로 돌려준 판본을 이 문에 넘긴다. 같으면 바이트 칸이 `null` 이고 라우트는 304 를 낸다.
--
-- **볼 수 있는가는 그대로 매번 이 문이 답한다**(ADR 0040). 판본을 견주는 것은 `may_see_photo` 를 지난 행에서만이다 — 못 보는
-- 사람은 판본을 맞혀도 0행이고, 판본도 안 받는다. 그래서 차단 · 정지 · 탈퇴 · 로그인 안 함은 전처럼 404 다.
--
-- 판본은 `profile_photo_version(updated_at)` — `my_photos` 의 `?v=` 와 같은 수다. 올리기 · 바꾸기만 바꾸고(`clock_timestamp()`),
-- 옮기기 · 보일 자리는 안 바꾼다. 그래서 판본은 **그 장**을 가리킨다 — 자리에 다른 장이 앉으면 판본이 달라 바이트가 나간다.
--
-- **바이트가 저장소에 사는 장**(`object_key`, `20261227090000`)은 `bytes` 가 `null` 이라 판본과 상관없이 `base64` 가 빈다 — 앞과
-- 같다. 그래서 「`base64` 가 비었다」는 「같은 판본」을 뜻하지 않는다. 라우트는 판본 칸을 넘긴 판본과 견주어 304 를 가르고,
-- 판본이 다른데 바이트가 비면 그 장은 열람 방식이 정해질 때까지 404 다(G-120).
--
-- ## 모양
--
-- 인자 끝에 `p_version bigint default null` 이 붙고, 반환 칸 끝에 `version` 이 붙는다. 반환형이 바뀌므로 지우고 다시 세운다
-- (권한은 앞과 같게 — `anon` · PUBLIC 닫고 `authenticated` 만). 옛 앱은 두 인자로 부르고 `base64` 만 읽으므로 그대로 선다 —
-- 넓히기만이다.
--
-- **배포 순서: 이 마이그레이션 → 앱.** 새 앱은 세 번째 인자를 넘기므로 이 문이 먼저 있어야 한다.
--
-- 재는 자리는 `supabase/tests/99_photo_version_match.test.sql` · `61_profile_photos` · `74_authenticated_doors`.

drop function public.photo_at(uuid, integer);

/**
 * 사진 한 장 — 없는 자리 · 없는 사람 · 못 보는 사람이 같은 답(0행)을 받는다.
 *
 * `p_version` 이 그 장의 판본과 같으면 `base64` 는 `null` 이다 — 부른 쪽이 이미 그 바이트를 들고 있다.
 * 다르거나 `null` 이면 바이트를 싣는다.
 */
create function public.photo_at(p_user_id uuid, p_position integer, p_version bigint default null)
returns table (content_type text, base64 text, version bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.content_type,
         case when public.profile_photo_version(p.updated_at) = p_version then null
              else encode(p.bytes, 'base64') end,
         public.profile_photo_version(p.updated_at)
  from public.profile_photo p
  where p.user_id = p_user_id
    and p.position = p_position
    and public.may_see_photo(p_user_id);
$$;

comment on function public.photo_at(uuid, integer, bigint) is
  '사진 한 장 — 볼 수 있을 때만(may_see_photo). 받은 판본과 같으면 바이트 없이 판본만 (G-119, 20261227180000)';

revoke execute on function public.photo_at(uuid, integer, bigint) from anon, public;
grant execute on function public.photo_at(uuid, integer, bigint) to authenticated;
