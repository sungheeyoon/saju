-- ---------------------------------------------------------------------------
-- 「그 밖」과 「아직 모르겠음」은 같은 말이었다
-- ---------------------------------------------------------------------------

/**
 * 갈래를 넷으로 두었더니 고르는 칸에 **같은 뜻이 둘** 섰다.
 *
 * 프롬프트에 나가는 문장이 그것을 그대로 보여 준다. 「그 밖」은 「어느 한쪽으로 단정하지
 * 마라」였고 「아직 모르겠음」은 「어느 쪽으로도 단정하지 말고 어느 사이에나 해당하는
 * 장면으로 읽어라」였다. 모델이 하는 일이 같다.
 *
 * 지우는 쪽은 `other` 다. 안 고른 상태는 **어차피 있어야 한다** — 고르기 전의 기본값이고
 * 라디오를 되돌리는 유일한 길이다. `other` 는 저장되는 값을 하나 늘리면서 글은 안 바꾼다.
 *
 * 「모른다는 행이 없는 것」이라는 규칙도 이걸로 한 겹 더 단단해진다. 없음이 한 값이면
 * 화면도 프롬프트도 물어볼 것이 하나다.
 */

delete from public.pair_relation where relation = 'other';

alter table public.pair_relation drop constraint pair_relation_relation_check;
alter table public.pair_relation
  add constraint pair_relation_relation_check
  check (relation in ('family', 'friend', 'partner'));
