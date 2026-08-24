-- 초대 allowlist 와 가입 관문
--
-- ADR 0006: 성인만 들어오는 것은 인증이 보장하는 것이 아니라 운영자가 초대 범위로
-- 통제한다. Google OAuth 는 성년인증이 아니다(ADR 0005).
--
-- 앱 코드에서 거르지 않는 이유는 ADR 0004 와 같다 — 잊을 수 있는 자리에 두면
-- 「가입은 됐는데 아무것도 못 하는 계정」이 남는다. 계정이 만들어지기 **전에**
-- 거부해야 그런 계정이 애초에 생기지 않는다.

create table public.invite (
  -- 정확한 이메일 하나. 도메인 단위로 열지 않는다 — 「내가 아는 성인」이 범위이므로
  -- 도메인은 그 범위를 표현하지 못한다.
  email text primary key check (email = lower(email)),
  -- 누구인지 운영자가 알아볼 메모. 초대 범위가 사람 단위라 이름이 남아야 한다.
  note text,
  created_at timestamptz not null default now()
);

-- 정책을 하나도 만들지 않는다. RLS 를 켜고 비워 두면 사용자 JWT 로는 한 줄도
-- 읽히지 않는다 — 초대 목록은 누가 초대받았는지를 그대로 드러내는 명단이다.
alter table public.invite enable row level security;

/**
 * 가입 관문 — Before User Created Auth Hook.
 *
 * auth 가 계정을 만들기 직전에 부른다. `{}` 를 돌려주면 통과, `error` 를 돌려주면
 * 그 자리에서 거부되고 `auth.users` 에 아무것도 남지 않는다.
 *
 * `security definer` 인 것은 `invite` 가 RLS 로 닫혀 있기 때문이다. 소유자
 * (postgres)로 돌아 그 테이블을 읽되, 실행 권한은 `supabase_auth_admin` 에만 준다.
 */
create or replace function public.gate_signup_by_invite(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Google 이 주는 이메일의 대소문자는 신뢰하지 않는다. 저장도 비교도 소문자다.
  signup_email text := lower(event -> 'user' ->> 'email');
begin
  if signup_email is not null
     and exists (select 1 from public.invite i where i.email = signup_email)
  then
    return '{}'::jsonb;
  end if;

  -- 왜 거부됐는지 말한다. 「초대 명단에 있는지」는 명단을 흘리는 것이 아니라
  -- 본인 이메일 하나에 대한 답이고, 이유를 안 알려주면 로그인 버튼이 아무 일도
  -- 일어나지 않는 버튼이 된다.
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', '초대된 이메일이 아닙니다. 초대받은 주소로 로그인해 주세요.'
    )
  );
end;
$$;

-- 사용자 JWT 로는 조회 자체가 거절된다. RLS 만으로도 빈 결과가 나오지만, 권한을
-- 먼저 닫아 두면 「정책 하나 지웠더니 명단이 열렸다」가 성립하지 않는다.
revoke all on public.invite from anon, authenticated;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.gate_signup_by_invite(jsonb) to supabase_auth_admin;
revoke execute on function public.gate_signup_by_invite(jsonb) from anon, authenticated, public;
