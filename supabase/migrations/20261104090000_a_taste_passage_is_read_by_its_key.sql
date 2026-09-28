-- 로그인 전 첫 화면의 **맛보기 글을 미리 만들어 두고 열쇠 하나로 읽는다** (흐름 시안 g 2라운드, 넓히기)
--
-- 비로그인 `/` 에서 생일을 넣으면 사주 카드 아래 짧은 맛보기 문단이 선다. 그 글을 방문마다 모델에게 쓰게 하면
-- 방문자의 생년월일시가 모델 제공자에게 나가고(처리방침의 「풀이를 만들 때 밖으로 나가는 것」이 로그인 전으로 번진다),
-- 비용이 방문 수를 따라 끝없이 는다. 그래서 **열쇠를 거칠게 잡아 미리 만든다** — 일주(60) × 월지(12) = 720칸.
-- 한 칸은 같은 일주 · 같은 달에 난 사람 모두의 글이라 개인을 가리키지 않는다.
--
-- ## 무엇이 생기나
--
-- - `taste_passage` 표 — 열쇠 · 본문 · 만든 모델 · 검사를 지났는가 · 만든 때. 쓰는 것은 만들기 스크립트
--   하나다(열쇠로 돈다 — 운영자가 손으로 돌린다). 로그인한 사람도 익명도 표를 직접 못 읽는다.
-- - `taste_passage(p_key)` — **익명이 부르는 좁은 문.** 열쇠 하나를 받아 검사를 지난 본문 하나만 낸다. 없으면
--   `null` 이고 화면은 엔진의 정해진 문장으로 대신 선다.
--
-- ## 넓히기다
--
-- 옛 앱은 이 표도 문도 모른다 — 이 마이그레이션만 먼저 올라가도 아무것도 안 바뀐다. 앱이 뒤따라 든다(ADR 0071).
-- 표가 비어 있는 동안에도 앱은 선다(문이 `null` 을 낸다).
--
-- 재는 자리는 `supabase/tests/69_taste_passage.test.sql`.

create table public.taste_passage (
  /** `丙午-卯` — 일주 두 글자, 하이픈, 월지 한 글자 */
  key text primary key,
  body text not null,
  /** 이 글을 쓴 모델 — 다시 만들 때 무엇이 쓴 글인지 가른다 */
  model text not null,
  /** 짧은 규칙 검사를 지났는가 — 문은 지난 것만 낸다 */
  checked boolean not null default false,
  made_at timestamptz not null default now(),
  constraint taste_passage_key_shape
    check (key ~ '^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]-[子丑寅卯辰巳午未申酉戌亥]$'),
  /* 맛보기는 두세 문장이다 — 잘못 만든 긴 글이 첫 화면을 밀어내지 못하게 */
  constraint taste_passage_body_length check (char_length(body) between 20 and 600)
);

alter table public.taste_passage enable row level security;
revoke all on table public.taste_passage from anon, authenticated, public;
grant select, insert, update, delete on table public.taste_passage to service_role;

/**
 * 열쇠 하나의 맛보기 — **로그인 없이 부른다.**
 *
 * 받는 것은 열쇠뿐이고 내는 것은 본문 하나다. 누구의 것도 아닌 글이라 개인정보가 없다. 검사를 못 지났거나 아직
 * 없는 칸은 `null` 이다 — 화면이 대신 설 문장을 든다.
 */
create function public.taste_passage(p_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select t.body from public.taste_passage t where t.key = p_key and t.checked;
$$;

revoke execute on function public.taste_passage(text) from anon, authenticated, public;
grant execute on function public.taste_passage(text) to anon, authenticated;
