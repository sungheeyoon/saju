-- 가입 관문 — 초대되지 않은 사람은 계정이 만들어지기 전에 거부된다.
begin;
select plan(6);

insert into public.invite (email, note) values ('invited@example.com', '테스터 한 명');

select is(
  public.gate_signup_by_invite('{"user":{"email":"invited@example.com"}}'::jsonb),
  '{}'::jsonb,
  '초대된 이메일은 통과한다');

select is(
  public.gate_signup_by_invite('{"user":{"email":"Invited@Example.COM"}}'::jsonb),
  '{}'::jsonb,
  'Google 이 대문자로 줘도 같은 사람이다');

select is(
  public.gate_signup_by_invite('{"user":{"email":"stranger@example.com"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  '초대되지 않은 이메일은 거부한다');

select is(
  public.gate_signup_by_invite('{"user":{"email":"someone@example.com"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  '같은 도메인이라고 열리지 않는다 — 초대는 사람 단위다');

select is(
  public.gate_signup_by_invite('{"user":{}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  '이메일이 없으면 거부한다');

set local role authenticated;
select set_config('request.jwt.claims', tests.claims(gen_random_uuid()), true);

select throws_ok(
  'select * from public.invite',
  '42501',
  null,
  '사용자에게는 초대 명단이 아예 안 열린다');

reset role;
select * from finish();
rollback;
