begin;
select plan(21);

create temporary table pass_people (n integer, id uuid);
grant select on pass_people to authenticated;
do $$
declare u uuid; i integer;
begin
  for i in 0..22 loop
    u := tests.signup('pass-review-' || i || '@example.com');
    insert into pass_people values (i, u);
    perform set_config('request.jwt.claims', tests.claims(u), true);
    perform public.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean', tests.chart(), 'chart-for-tests');
    perform public.set_discovery_participation(true,
      '{"glyphCount":8,"counts":{"木":4,"火":4,"土":0,"金":0,"水":0},"ratios":{"木":0.5,"火":0.5,"土":0,"金":0,"水":0}}'::jsonb, tests.need());
  end loop;
end;
$$;
insert into public.discovery_passed (user_id, passed_user_id, passed_at)
select (select id from pass_people where n=0), id, now() - interval '25 hours' + n * interval '1 minute'
from pass_people where n>0;
select set_config('request.jwt.claims', tests.claims((select id from pass_people where n=0)), true);

select is((select count(*) from public.my_passed_connections()), 20::bigint, '최근 20명은 하루 뒤에도 보관된다');
select ok(not public.discovery_passed_active((select id from pass_people where n=0), (select id from pass_people where n=1)), '밀려난 기록은 마지막 넘김부터 24시간 후 제외가 풀린다');
update public.discovery_passed set passed_at = now() - interval '23 hours';
select ok(public.discovery_passed_active((select id from pass_people where n=0), (select id from pass_people where n=1)), '20명 밖도 마지막 넘김부터 24시간 안에는 제외된다');
select is((select count(*) from pass_people p where p.n>0 and public.discovery_passed_kept((select id from pass_people where n=0), p.id)), 20::bigint, '같은 시각에도 정확히 20명만 보관 순위 안이다');
select is((select count(*) from public.my_passed_connections()), 20::bigint, '동률인 목록도 같은 20명을 사용한다');

-- 한 사람이 비공개가 되어도 21번째를 대신 끌어와 보관 제외와 어긋나게 하지 않는다.
create temporary table kept as select candidate_user_id as id from public.my_passed_connections();
grant select on kept to authenticated;
update public.discovery_profile set prefer_gender='male' where user_id=(select id from kept limit 1);
select is((select count(*) from public.my_passed_connections()), 19::bigint, '상대 성별 조건이 바뀌면 보관 목록에서도 빠진다');
select ok(not public.may_see_photo((select id from kept limit 1)), '자격을 잃은 보관 대상의 사진도 닫힌다');
select throws_ok(format('select public.restore_passed_connection(%L)', (select id from kept limit 1)), '42501', null, '자격을 잃은 상대는 복원하지 못한다');
select is((select count(*) from public.discovery_passed where user_id=(select id from pass_people where n=0)), 22::bigint, '복원 거절 시 기록을 삭제하지 않는다');
update public.discovery_profile set prefer_gender='any' where user_id in (select id from kept);
select ok(public.may_see_photo((select id from kept limit 1)), '스냅샷 밖 보관 대상도 사진을 볼 수 있다');
update public.discovery_profile set prefer_gender='male' where user_id=(select id from pass_people where n=0);
select is((select count(*) from public.my_passed_connections()), 0::bigint, '내 성별 조건도 보관 조회에서 검사한다');
update public.discovery_profile set prefer_gender='any' where user_id=(select id from pass_people where n=0);

/**
 * **낡음을 말하는 방식이 바뀌었다**(ADR 0071 · #69). 앞서는 판본 id 를 남의 것으로
 * 바꿔 「지금 판본이 아니다」를 만들었다 — 이제 신선도는 **입력 버전과 엔진 판**이
 * 든다. 재려는 것은 그대로다: 요약이 낡으면 보관 목록에서도 빠지는가.
 */
create temporary table old_revision as
select user_id, element_input_version from public.discovery_profile where user_id=(select id from kept limit 1);
update public.discovery_profile set element_input_version = element_input_version + 1
where user_id=(select id from kept limit 1);
select is((select count(*) from public.my_passed_connections()), 19::bigint, '오래된 명식 요약은 보관 목록에서도 제외한다');
select ok(not public.may_see_photo((select id from kept limit 1)), '오래된 명식 요약의 사진도 열지 않는다');
select throws_ok(format('select public.restore_passed_connection(%L)', (select id from kept limit 1)), '42501', null, '오래된 요약을 복원하지 않는다');
update public.discovery_profile p set element_input_version=o.element_input_version from old_revision o where p.user_id=o.user_id;

-- 운영에서 쓰는 역할로 복원: 덱 밖의 인물도 현재 요약과 요청 근거를 받는다.
set local role authenticated;
select lives_ok(format('select public.restore_passed_connection(%L)', (select id from kept limit 1)), '실제 역할이 덱 밖 보관 대상을 복원한다');
select is((select candidate_user_id from public.my_discovery_board() order by seat limit 1), (select id from kept limit 1), '복원한 사람이 스냅샷 맨 앞에 선다');
select is((select count(*) from public.discovery_passed where passed_user_id=(select id from kept limit 1)), 0::bigint, '내 보관 기록이 해제된다');
select lives_ok(format('select public.request_match(%L)', (select id from kept limit 1)), '복원된 카드의 현재 노출 근거로 궁합을 요청할 수 있다');
select throws_ok(format('select public.restore_passed_connection(%L)', (select id from pass_people where n=0)), '42501', null, '임의의 상대를 복원으로 노출시키지 못한다');
reset role;

select ok(not has_function_privilege('anon', 'public.restore_passed_connection(uuid)', 'execute'), '익명에게 복원을 열지 않는다');
select ok(not has_function_privilege('authenticated', 'public.discovery_pair_eligible(uuid,uuid)', 'execute'), '내부 자격 함수는 직접 호출하지 못한다');
select * from finish();
rollback;
