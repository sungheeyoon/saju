-- User · Person · revision — 저장의 뼈대
--
-- 명식은 저장하지 않는다(ADR 0001). 저장하는 것은 **입력**이고, 명식은 그 입력에서
-- 필요할 때 계산되는 파생 뷰다. 그래서 엔진을 고쳐도 과거 기록이 바뀌지 않는다.

-- ---------------------------------------------------------------------------
-- Person — 사람의 안정적인 식별자
-- ---------------------------------------------------------------------------

/**
 * Person 은 이름을 들지 않는다.
 *
 * 한 Person 을 누가 뭐라고 부르는지는 Person 의 속성이 아니라 **엣지**가 든다
 * (`user_person_access.local_label`). 같은 사람이 누군가에겐 「엄마」고 누군가에겐
 * 「배우자」다. 이름을 Person 에 두면 그 둘 중 하나를 진실로 못박게 된다.
 */
create table public.person (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
  -- current_revision_id 는 아래에서 붙인다 — revision 이 아직 없다
);

-- ---------------------------------------------------------------------------
-- User — 인증 주체에 얹힌 계정 상태
-- ---------------------------------------------------------------------------

create table public.app_user (
  -- auth 주체와 같은 id 를 쓴다. RLS 정책이 `auth.uid()` 를 그대로 비교할 수 있게
  -- 하려는 것이고, 그것이 Supabase 를 고른 이유다(ADR 0006).
  id uuid primary key references auth.users (id) on delete cascade,

  /**
   * 계정 상태 — 접근 회수는 초대 목록에서 지우는 것이 아니다(ADR 0006).
   *
   * `invite` 는 **들어오는 문**만 지킨다. 이미 들어온 계정을 막는 것은 별개의
   * 상태다 — 초대에서 지워도 이미 만들어진 세션은 살아 있기 때문이다.
   */
  status text not null default 'active' check (status in ('active', 'suspended')),

  /**
   * selfPerson — 이 User 가 자기 자신이라고 지정한 Person.
   *
   * Person 의 속성이 아니라 User 의 지정이다. 같은 사람이 다른 계정에서는
   * 「나」가 아니기 때문이다. 온보딩 중에는 비어 있고, 끝나면 정확히 하나다.
   */
  self_person_id uuid unique references public.person (id),

  created_at timestamptz not null default now()
);

/**
 * 가입하면 계정 행이 따라 생긴다.
 *
 * 앱 코드에서 만들면 「auth 에는 있는데 app_user 에는 없는」 사용자가 생긴다 —
 * 첫 요청이 실패하거나, 로그인 직후 앱을 닫거나, 경로가 하나 늘어나기만 해도
 * 그렇다. 관문을 DB 에 둔 것과 같은 이유로 여기도 DB 가 든다.
 */
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_user (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- revision — 출생정보 한 벌의 한 판본
-- ---------------------------------------------------------------------------

/**
 * 덮어쓰지 않고 쌓는다(ADR 0004).
 *
 * 어느 사건이 어느 사주를 대상으로 만들어졌는지 되짚으려면, 그 사건이 가리킨
 * 입력이 그대로 남아 있어야 한다. 수정이 과거 Reading 의 뜻을 바꾸면 안 된다.
 *
 * 여기 있는 값이 **명식을 가르는 값의 전부**다. 부를 이름은 없다 — 이름을 고쳤더니
 * 사주가 달라지나 하는 의심을 코드로 반박할 수 있어야 하기 때문이고, 세운을 어느
 * 해부터 보는지(`saeunFrom`)도 없다 — 그것은 보기 설정이지 명식이 아니다.
 */
create table public.person_chart_revision (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.person (id) on delete cascade,

  /**
   * 원본 생일 형식 — 사용자가 실제로 넣은 그대로.
   *
   * `lunar`·`lunar_leap` 은 컬럼으로만 있고 **아직 받지 않는다.** 음력 변환표를
   * 공식 자료와 대조하기 전에는 쓰기 경로가 거절한다. 자리를 미리 비워 두는 것은,
   * 나중에 켤 때 이미 쌓인 행을 「양력이었겠지」로 추측해 메우지 않으려는 것이다.
   */
  calendar text not null check (calendar in ('solar', 'lunar', 'lunar_leap')),
  original_date date not null,
  -- 엔진에 넘어가는 것은 언제나 양력이다. 변환은 경계에서 끝난다.
  solar_date date not null,

  /**
   * 출생 시각 — `null` 이면 **시간 미상**이다.
   *
   * 관례대로 정오를 채우지 않는다. 그러면 시주가 午시로 나와 버려서, 모르는 값이
   * 아는 값의 얼굴을 하고 나간다. 같은 칸을 쓰므로 「모름인데 14:30」 은 만들 수 없다.
   */
  birth_time time,

  -- 여덟 글자는 성별로 달라지지 않지만 대운의 방향이 달라진다. 그래서 필수다.
  gender text not null check (gender in ('female', 'male')),
  -- 국내 출생만 지원한다. 임의 timezone 필드를 두지 않는 것과 같은 결정이다.
  city text not null check (length(city) between 1 and 20),
  -- 자시 규칙 하나로 일주가 바뀐다. 기본값도 빼지 않고 적는다.
  late_night_rule text not null check (late_night_rule in ('jo', 'ya')),
  time_basis text not null check (time_basis in ('localMean', 'record', 'trueSolar')),

  /**
   * 같은 판본인지 한 값으로 묻기 위한 지문.
   *
   * pending 요청은 「그때 그 사주」에 대한 동의다. 무엇이 바뀌면 무효인지를 필드마다
   * 세어 보는 대신 이 한 값을 비교한다 — 세는 자리가 여럿이면 하나를 잊는다.
   */
  fingerprint text not null,

  created_at timestamptz not null default now(),
  created_by uuid not null references public.app_user (id),

  -- 양력으로 넣었으면 원본과 변환값이 같아야 한다. 다르면 어딘가에서 흘렸다는 뜻이다.
  constraint solar_input_needs_no_conversion
    check (calendar <> 'solar' or original_date = solar_date)
);

create index person_chart_revision_by_person on public.person_chart_revision (person_id, created_at desc);

/**
 * 지문은 손으로 적지 않는다.
 *
 * 호출부가 계산해 넣게 하면 잊을 수 있는 자리가 하나 생기고, 그 자리가 잊히는
 * 순간 「같은 판본」 판정이 조용히 틀린다. 날짜를 문자열로 굳힐 때 `to_char` 로
 * 형식을 못박는 것은 `DateStyle` 설정이 지문을 움직이지 못하게 하려는 것이다.
 */
create or replace function public.set_revision_fingerprint()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.fingerprint := encode(
    sha256(convert_to(concat_ws(
      '|',
      new.calendar,
      to_char(new.original_date, 'YYYY-MM-DD'),
      to_char(new.solar_date, 'YYYY-MM-DD'),
      coalesce(to_char(new.birth_time, 'HH24:MI'), 'unknown'),
      new.gender,
      new.city,
      new.late_night_rule,
      new.time_basis
    ), 'UTF8')),
    'hex'
  );
  return new;
end;
$$;

create trigger revision_fingerprint
before insert on public.person_chart_revision
for each row execute function public.set_revision_fingerprint();

-- 이제 Person 이 현재 판본을 가리킬 수 있다.
alter table public.person
  add column current_revision_id uuid unique references public.person_chart_revision (id);

-- ---------------------------------------------------------------------------
-- UserPersonAccess — 「내가 등록했다」는 접근 근거
-- ---------------------------------------------------------------------------

/**
 * 이 Person 을 왜 볼 수 있나의 답 **둘 중 하나**다.
 *
 * 다른 하나는 Match(우리가 합의했다)이고, 그것은 별개의 갈래로 온다. 값으로 갈라
 * 두지 않으면 나중에 「이 사람이 왜 내 목록에 있지」를 되짚을 수 없다.
 */
create table public.user_person_access (
  user_id uuid not null references public.app_user (id) on delete cascade,
  person_id uuid not null references public.person (id) on delete cascade,

  -- 이 User 가 그 Person 을 부르는 이름(「엄마」, 「전여친」). Person 이 아니라
  -- 엣지가 든다.
  local_label text not null check (length(btrim(local_label)) between 1 and 12),
  note text,

  /**
   * 접근 역할.
   *
   * `owner` 는 만든 사람, `editor` 는 출생정보를 고칠 수 있는 사람, `viewer` 는
   * 보기만 한다. claim 이 끝나면 그 Person 의 다른 관리자는 `viewer` 로 내려간다
   * (ADR 0004) — 그 강등은 정책과 트리거가 강제하지 사람이 기억하지 않는다.
   */
  role text not null check (role in ('owner', 'editor', 'viewer')),

  created_at timestamptz not null default now(),

  primary key (user_id, person_id)
);

/**
 * Person 한도 20 — 직접 등록해 관리하는 사람에게만 건다.
 *
 * selfPerson 은 세지 않는다. 「내가 관리하는 가족·친구」의 수를 재는 것이지 내
 * 계정에 사람이 몇이나 묶였는지를 재는 것이 아니다. 후보와 Match 상대는 애초에
 * 이 표에 들어오지 않으므로 세는 문제가 생기지 않는다.
 */
create or replace function public.enforce_person_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  managed integer;
begin
  select count(*) into managed
  from public.user_person_access a
  join public.app_user u on u.id = a.user_id
  where a.user_id = new.user_id
    and a.person_id is distinct from u.self_person_id;

  if managed > 20 then
    raise exception '등록할 수 있는 사람은 20명까지입니다.'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger person_limit
after insert on public.user_person_access
deferrable initially deferred
for each row execute function public.enforce_person_limit();
