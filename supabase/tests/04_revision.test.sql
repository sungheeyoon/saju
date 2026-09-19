-- 판본 — **없다.** 쌓던 표도, 쌓던 기계도 (ADR 0071 · #70).
--
-- 이 파일이 재던 것은 「같은 입력은 같은 지문을 낸다」와 「사용자는 판본을 못 고친다」
-- 였다. 그 표가 사라졌으므로 잴 것도 사라졌다 — 그래서 **없다는 것을 잰다.** 지운 것을
-- 아무도 안 세면, 되살리는 마이그레이션이 조용히 들어와도 아무 시험도 안 깨진다.
--
-- 마지막 하나는 판본과 상관이 없어서 그대로 남았다: **claim 이 편집권을 옮긴다.**
begin;
select plan(4);

create temporary table who as
select tests.signup('kim@example.com') as kim, tests.signup('lee@example.com') as lee;
-- 역할을 바꾼 뒤에도 읽어야 한다 — 임시 표는 만든 역할만 볼 수 있다.
grant select on who to authenticated;

-- ── 표가 없다 ────────────────────────────────────────────────────────────────

select hasnt_table('public', 'person_chart_revision', '판본 표는 없다');

select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and column_name like '%revision%'),
  0,
  '판본을 가리키던 칸도 한 칸도 안 남았다');

/**
 * **세던 문과 정리하던 문도 없다.**
 *
 * `revisions_in_use` 는 `pg_constraint` 를 훑어 FK 에서 참조를 읽던 잘 지은 장치였다.
 * 그것이 지키던 것은 「아무도 안 가리키는 이전 입력」이고, 이제 이전 입력을 안 쌓는다.
 */
select is(
  (select count(*)::int from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('revisions_in_use', 'retain_person_revisions', 'revision_birth',
                       'revision_fingerprint', 'set_revision_fingerprint',
                       'match_calculation_inputs')),
  0,
  '판본을 세고 놓고 내주던 문이 하나도 안 남았다');

-- ── claim 은 그대로다 ────────────────────────────────────────────────────────

/**
 * claim 이 편집권을 옮긴다 — 기존 관리자는 viewer 로 내려간다.
 *
 * 아직 아무도 자기 자신이라고 하지 않은 Person 을 kim 이 대신 관리하고 있다가,
 * 본인(lee)이 나타나 claim 하는 상황이다. 이 강등을 앱이 기억하게 두면 잊는 순간
 * 남이 남의 출생정보를 계속 고칠 수 있다.
 *
 * **사람은 온전하게 태어난다**(#70). 빈 행을 세우고 나중에 채우는 길이 없어져서,
 * 여기서도 입력과 여덟 글자를 함께 넣는다.
 */
with fresh as (
  insert into public.person (
    calendar, original_date, solar_date, birth_time, gender, city,
    late_night_rule, time_basis, input_version, current_chart, chart_engine_version)
  values (
    'solar', '1975-08-09', '1975-08-09', '11:05', 'female', '광주',
    'jo', 'localMean', 1, tests.chart('戊'), 'test-engine')
  returning id
)
select id as person_id into temporary table unclaimed from fresh;

insert into public.user_person_access (user_id, person_id, local_label, role)
values ((select kim from who), (select person_id from unclaimed), '아는 사람', 'editor'),
       ((select lee from who), (select person_id from unclaimed), '나', 'owner');

update public.app_user set self_person_id = (select person_id from unclaimed)
where id = (select lee from who);

select is(
  (select role from public.user_person_access
   where user_id = (select kim from who) and person_id = (select person_id from unclaimed)),
  'viewer',
  'claim 이 일어나면 기존 편집자는 viewer 로 내려간다');

select * from finish();
rollback;
