-- 자기 자신은 계정 닉네임으로 부르고, 저장한 다른 사람만 사용자가 붙인 이름으로 부른다.

/**
 * selfPerson 의 localLabel 은 별도 이름이 아니다.
 *
 * 가입에서 이미 닉네임을 지었는데 내 사주 등록과 수정에서 이름을 다시 받으면, 같은
 * 사람에게 서로 다른 이름 둘이 생긴다. 엣지는 기존 읽기 경로가 계속 쓸 수 있게 남기되
 * selfPerson 에 한해서는 계정 닉네임의 사본으로 붙들어 둔다.
 */
create or replace function public.sync_self_label_from_nickname()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.self_person_id is not null and new.nickname is not null then
    update public.user_person_access
    set local_label = new.nickname
    where user_id = new.id and person_id = new.self_person_id;
  end if;
  return new;
end;
$$;

create trigger nickname_names_self_person
after update of nickname, self_person_id on public.app_user
for each row execute function public.sync_self_label_from_nickname();

/** 프로필이 아닌 출생 정보 수정으로 자기 이름을 바꾸려 해도 닉네임을 지킨다. */
create or replace function public.keep_self_label_as_nickname()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  self_nickname text;
begin
  select u.nickname into self_nickname
  from public.app_user u
  where u.id = new.user_id and u.self_person_id = new.person_id;

  if self_nickname is not null then
    new.local_label := self_nickname;
  end if;
  return new;
end;
$$;

create trigger self_person_has_no_second_name
before update of local_label on public.user_person_access
for each row execute function public.keep_self_label_as_nickname();

/** 이미 등록된 자기 사람도 배포하는 순간 현재 닉네임과 맞춘다. */
update public.user_person_access a
set local_label = u.nickname
from public.app_user u
where a.user_id = u.id
  and a.person_id = u.self_person_id
  and u.nickname is not null
  and a.local_label is distinct from u.nickname;

revoke execute on function public.sync_self_label_from_nickname() from anon, authenticated, public;
revoke execute on function public.keep_self_label_as_nickname() from anon, authenticated, public;
