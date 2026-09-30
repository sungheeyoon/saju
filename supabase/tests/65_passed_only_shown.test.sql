-- 지나칠 수 있는 사람은 내게 카드로 선 적이 있는 사람뿐이다 (`20261031090000`)
--
-- 옛 정책은 `user_id = auth.uid()` 만 물었다. 그래서 덱에 선 적 없는 사람의 id 를 `discovery_passed` 에 직접 넣으면
-- 복원 문이 그 사람을 덱 맨 앞에 세우고 노출 기록을 쓰고, 요청이 그 기록으로 지나갔다. 여기서는 **운영의 역할
-- (`authenticated`)로** 그 길의 첫 걸음이 막히는지, 앱이 밟는 길(덱의 카드를 넘기고 다시 넘기고 되살리기)은 그대로인지 잰다.
--
-- 옛 정책을 되살리면 1 · 3 · 5 · 6 이 붉다.
begin;
select plan(9);

create temporary table ppl (n integer, id uuid);
grant select on ppl to authenticated;

do $$
declare u uuid; i integer;
begin
  -- 덱은 여섯이다 — 여섯보다 많아야 덱에 안 선 사람이 남는다
  for i in 0..12 loop
    u := tests.signup('passed-shown-' || i || '@example.com');
    insert into ppl values (i, u);
    perform set_config('request.jwt.claims', tests.claims(u), true);
    perform tests.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo',
      'localMean', tests.chart(), 'chart-for-tests');
    perform tests.set_discovery_participation(true,
      '{"glyphCount":8,"counts":{"木":4,"火":4,"土":0,"金":0,"水":0},"ratios":{"木":0.5,"火":0.5,"土":0,"金":0,"水":0}}'::jsonb,
      tests.need());
  end loop;
end;
$$;

select set_config('request.jwt.claims', tests.claims((select id from ppl where n = 0)), true);

-- 첫 사람의 덱을 세운다 — 노출 기록이 이때 난다
create temporary table deck as select candidate_user_id as id from public.my_discovery_board();
grant select on deck to authenticated;

/** 이 파일이 만든 사람 가운데 첫 사람에게 한 번도 안 선 사람 하나 */
create temporary table stranger as
select p.id from ppl p
where p.n > 0
  and not exists (select 1 from public.discovery_impression i
                  where i.viewer_user_id = (select id from ppl where n = 0) and i.candidate_user_id = p.id)
limit 1;
grant select on stranger to authenticated;

create temporary table seen as select id from deck limit 1;
grant select on seen to authenticated;

set local role authenticated;

select throws_ok(
  format('insert into public.discovery_passed (passed_user_id) values (%L)', (select id from stranger)),
  '42501', null,
  '1. 내게 선 적 없는 사람은 지나침에 못 넣는다');

select lives_ok(
  format('insert into public.discovery_passed (user_id, passed_user_id, passed_at) values (%L, %L, now())
          on conflict (user_id, passed_user_id) do update set passed_at = excluded.passed_at',
         (select id from ppl where n = 0), (select id from seen)),
  '2. 덱에 선 카드는 앱과 같은 upsert 로 넘긴다');

select throws_ok(
  format('update public.discovery_passed set passed_user_id = %L where passed_user_id = %L',
         (select id from stranger), (select id from seen)),
  '42501', null,
  '3. 내 행의 상대를 선 적 없는 사람으로 바꾸지 못한다');

select lives_ok(
  format('insert into public.discovery_passed (user_id, passed_user_id, passed_at) values (%L, %L, now())
          on conflict (user_id, passed_user_id) do update set passed_at = excluded.passed_at',
         (select id from ppl where n = 0), (select id from seen)),
  '4. 같은 사람을 다시 넘기면 맨 위로 옮긴다(옮기기 정책)');

select is(
  (select count(*) from public.discovery_passed where passed_user_id = (select id from stranger)),
  0::bigint,
  '5. 선 적 없는 사람의 지나침 행은 하나도 없다');

-- 문장까지 맞춘다 — 같은 42501 이 「자격이 없다」 갈래에서도 나므로, 막힌 까닭이 보관 행이 없어서인지 가른다
select throws_ok(
  format('select public.restore_passed_connection(%L)', (select id from stranger)),
  '42501', '이미 복원되었거나 보관 중인 인연이 아닙니다. 목록을 새로 열어 주세요.',
  '6. 그래서 선 적 없는 사람을 복원으로 덱 맨 앞에 못 세운다');

select lives_ok(
  format('select public.restore_passed_connection(%L)', (select id from seen)),
  '7. 넘긴 카드는 되살린다');

select is(
  (select candidate_user_id from public.my_discovery_board() order by seat limit 1),
  (select id from seen),
  '8. 되살린 카드가 덱 맨 앞에 선다');

reset role;

select ok(
  not has_function_privilege('anon', 'public.discovery_shown_to_me(uuid)', 'execute'),
  '9. 익명은 노출 여부를 묻지 못한다');

select * from finish();
rollback;
