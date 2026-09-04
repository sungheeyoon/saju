-- ---------------------------------------------------------------------------
-- 만든 글은 **한 목록에** 선다
-- ---------------------------------------------------------------------------

/**
 * 풀이가 네 자리에 흩어져 있었다. 자기 풀이는 `/me` 에만, 저장한 사람의 풀이는 그
 * 사람 상세에만, 비공개 궁합은 `/me/compat` 의 「본 궁합」에만, 인연 궁합은
 * `/me/match/[id]` 에만.
 *
 * **만든 글이 어디 있는지 사용자가 외워야 하는 상태였다.** 「본 궁합」이 이미 그 문제를
 * 한 번 풀었고(`my_private_readings`), 그때 적은 말이 나머지 셋에도 그대로 해당한다 —
 * **저장돼 있는데 닿을 수 없는 것은 사용자에게 없는 것과 같다**(ADR 0033).
 *
 * ## 왜 `my_private_readings` 를 안 넓히나
 *
 * 저것은 `/me/compat` 안에서 **「무엇을 볼까」**에 답하는 목록이고 이것은 **「내가 뭘
 * 만들었나」**에 답한다. 물음이 다르면 좁힘도 다르다 — 저쪽은 언제나 `private` 하나이고
 * 이쪽은 네 kind 를 다 든다. 한 함수가 둘을 겸하면 호출부마다 인자로 물음을 고르게
 * 되고, 그 인자를 잘못 준 화면이 남의 물음에 답한다.
 *
 * ## 본문을 안 싣는다
 *
 * `reading` 은 한 줄도 직접 안 보인다(정책 없이 RLS 만 켜져 있다). **이 함수가 내주는
 * 것이 곧 브라우저가 볼 수 있는 것**이라, 반환형이 곧 계약이다.
 *
 * 목록에 본문을 실으면 그 목록이 곧 두 번째 결과 화면이 되고, 「결과 화면에 무엇이
 * 나가는가」의 답이 둘이 된다(ADR 0008). 특히 `match` 는 **잘린 글**이라 자르는 자리가
 * 둘이 되는 순간 한쪽이 덜 자른다. 나가는 것은 종류 · 대상 이름 · 날짜 · 점수 ·
 * 「이전 입력」인가, 그리고 **가는 길**뿐이다.
 *
 * ## 이름은 kind 마다 다른 표에서 난다
 *
 * `person` 과 `private` 은 내 엣지의 `local_label`, `match` 는 상대의 **공개 별명**
 * (`discovery_profile.nickname`)이다. `local_label` 은 내가 그 사람을 부르는 말이라
 * 매칭 상대에게는 없다. 여기서 합쳐 내주지 않으면 화면이 네 번 묻는다.
 *
 * `self` 는 **이름을 안 낸다.** 대상이 나이므로 부를 이름이 필요 없고, 화면은 그 줄을
 * 「내 사주」로 적는다. 내 엣지의 `local_label` 을 실어 보내면 화면이 그것으로 줄을
 * 지을 수 있게 되는데, 그 값은 **내가 나를 부르는 말**이라 목록에서 「민수 사주」로
 * 서면 남의 사주처럼 읽힌다.
 *
 * ## `match` 는 Person id 를 안 낸다
 *
 * 가는 길이 `match_id` 하나면 되고, 상대의 Person id 는 이 사용자에게 열려 있지 않다
 * (Match 는 `user_person_access` 엣지를 만들지 않는다 — US 46). 길에 필요하지 않은
 * 식별자를 목록이 먼저 내보내면, 그것을 쓰는 화면이 생기고 나서야 경계를 되묻게 된다.
 */
create or replace function public.my_readings()
returns table (
  kind text,
  /** `match` 는 `null` — 가는 길이 `match_id` 다 */
  person_a uuid,
  person_b uuid,
  /** `match` 만 */
  match_id uuid,
  /** `self` 는 `null`. `person`·`private` 은 내 엣지의 이름, `match` 는 상대의 별명 */
  label_a text,
  /** 두 사람짜리만 */
  label_b text,
  /** 궁합만. 사용자가 결과 화면에서 이미 본 값이라 목록에서 가리지 않는다 */
  score smallint,
  created_at timestamptz,
  /** 이 글을 만든 판본이 아직 지금 판본인가 — `match` 는 언제나 참이다 */
  from_current_revision boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.kind, l.person_a, l.person_b, l.match_id,
    l.label_a, l.label_b, l.score, l.created_at, l.from_current_revision
  from (
    /**
     * 내가 주인인 셋 — `self` · `person` · `private`.
     *
     * **이름이 붙는 근거가 곧 좁힘이다.** 엣지가 없으면 그 줄이 안 선다. 결과가 남아
     * 있어도 내가 그 사람을 목록에서 빼면 이 목록에서 사라진다 — 접근이 끊긴 사람의
     * 이름이 옛 결과를 통해 계속 보이지 않는 것이 요점이다(`my_private_readings` 와
     * 같은 규율). 그래서 `exists` 로 적는다: 붙이는 이름은 아래 스칼라 하위질의가
     * 내고, **줄이 서는가**는 여기서 정한다.
     */
    select
      r.kind,
      r.person_a,
      r.person_b,
      null::uuid as match_id,
      case when r.kind = 'self' then null else (
        select e.local_label from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_a
      ) end as label_a,
      (
        select e.local_label from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_b
      ) as label_b,
      r.score,
      r.created_at,
      /**
       * 한 사람짜리에서는 `pb` 가 없는 행이라 오른쪽이 `null is not distinct from null`
       * 로 참이 된다. 두 번째 사람을 따로 갈래 지어 세지 않는 것이 요점이다 — kind 로
       * 나누면 `person` 이 늘어난 날처럼 한 갈래만 안 고쳐진다.
       */
      r.revision_a = pa.current_revision_id
        and r.revision_b is not distinct from pb.current_revision_id as from_current_revision
    from public.reading r
    join public.person pa on pa.id = r.person_a
    left join public.person pb on pb.id = r.person_b
    where public.is_active_account()
      and r.owner_user_id = (select auth.uid())
      and exists (
        select 1 from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_a
      )
      and (
        r.person_b is null
        or exists (
          select 1 from public.user_person_access e
          where e.user_id = (select auth.uid()) and e.person_id = r.person_b
        )
      )

    union all

    /**
     * 함께 본 궁합 — **좁힘은 `visible_matches()` 가 이미 든다.**
     *
     * 중지된 계정도, 상대가 중지된 것도, 차단도 저 함수 안에 있다. 여기서 조건을 다시
     * 적으면 두 자리가 갈리고, 갈리는 날 이 목록이 결과 화면보다 넓어진다.
     *
     * **「이전 입력」이 없다.** 공유 결과는 매인 판본으로 나고 그 판본이 곧 동의한
     * 대상이라(ADR 0010), 「그 뒤에 고친 입력으로 다시 봐야 한다」는 말이 성립하지 않는다.
     */
    select
      r.kind,
      null::uuid,
      null::uuid,
      r.match_id,
      partner.nickname,
      null::text,
      r.score,
      r.created_at,
      true
    from public.reading r
    join public.visible_matches() m on m.id = r.match_id
    join public.discovery_profile partner
      on partner.user_id = case
        when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
    where r.kind = 'match'
  ) l (
    kind, person_a, person_b, match_id,
    label_a, label_b, score, created_at, from_current_revision
  )
  order by l.created_at desc;
$$;

revoke execute on function public.my_readings() from anon, public;
grant execute on function public.my_readings() to authenticated;
