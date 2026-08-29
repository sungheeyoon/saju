-- ---------------------------------------------------------------------------
-- 본 궁합을 **다시 찾아갈 수 있게** 한다
-- ---------------------------------------------------------------------------

/**
 * 비공개 궁합은 만들어 놓고 **다시 찾아갈 길이 없었다.**
 *
 * 결과가 사는 주소는 `?a=…&b=…` 이고, 그 둘은 불투명 uuid 다. 화면을 벗어나면
 * 주소가 사라지고, 사라진 주소를 사람이 기억할 수는 없다. 저장은 되어 있는데
 * **닿을 수 없는 것**이라, 사용자에게는 없는 것과 같다.
 *
 * 두 사람을 다시 고르면 같은 결과가 서기는 한다. 그러려면 **내가 누구와 누구를 봤는지**
 * 를 먼저 기억해야 하고, 사람이 스물이면 그것은 기억이 아니라 뒤지기다.
 *
 * ## 왜 앱이 아니라 여기인가
 *
 * `reading` 은 한 줄도 직접 안 보인다(정책 없이 RLS 만 켜져 있다). 그래서 목록도
 * definer 함수가 내준다 — **이 함수가 내주는 것이 곧 브라우저가 볼 수 있는 것**이다.
 *
 * 그래서 내주는 것을 좁힌다. 글도 근거도 점수를 만든 값도 여기서는 안 나간다. 나가는
 * 것은 **어느 쌍을 언제 봤는가**와 그 쌍을 다시 여는 데 필요한 id 둘뿐이다. 목록은
 * 결과를 읽는 자리가 아니라 결과로 가는 길이고, 길에 본문을 실으면 그 길이 곧 두 번째
 * 결과 화면이 된다.
 *
 * 이름은 함께 낸다. id 만 내주면 화면이 사람 목록을 따로 읽어 맞춰야 하고, 그러면
 * **차례를 맞추는 일이 화면 몫**이 된다. 짝짓는 자리가 둘이면 하나는 언젠가 어긋난다.
 *
 * ## 차례
 *
 * `person_a < person_b` 는 저장이 건 검사식이라(`private_is_two_people`) 여기서도
 * 참이다. 그 차례는 **uuid 의 차례이지 사람의 차례가 아니므로** 화면이 그것으로
 * 「첫 번째」를 말하면 안 된다. 목록은 이름을 그대로 들고, 누가 먼저인지는 말하지 않는다.
 */
create or replace function public.my_private_readings()
returns table (
  person_a uuid,
  person_b uuid,
  label_a text,
  label_b text,
  score smallint,
  created_at timestamptz,
  /** 이 결과를 만든 판본이 아직 지금 판본인가 — 목록에서도 「낡음」을 보인다 */
  from_current_revision boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.person_a,
    r.person_b,
    a.local_label,
    b.local_label,
    r.score,
    r.created_at,
    r.revision_a = pa.current_revision_id and r.revision_b = pb.current_revision_id
  from public.reading r
  /**
   * **이름은 내 것으로만 붙는다.** `user_person_access` 를 `auth.uid()` 로 좁히므로,
   * 결과가 남아 있어도 내가 그 사람을 더 이상 못 보면 이 목록에 안 선다 — join 이
   * 떨어진다. 접근이 끊긴 사람의 이름이 옛 결과를 통해 계속 보이지 않는 것이 요점이다.
   */
  join public.user_person_access a
    on a.person_id = r.person_a and a.user_id = (select auth.uid())
  join public.user_person_access b
    on b.person_id = r.person_b and b.user_id = (select auth.uid())
  join public.person pa on pa.id = r.person_a
  join public.person pb on pb.id = r.person_b
  where r.kind = 'private'
    and r.owner_user_id = (select auth.uid())
  order by r.created_at desc;
$$;

revoke execute on function public.my_private_readings() from anon, public;
grant execute on function public.my_private_readings() to authenticated;
