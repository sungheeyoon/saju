-- 앱을 안 보는 사람에게 새 메시지를 웹 푸시로 알린다 — 켠 기기에만, 방 하나에 대기 줄 하나 (ADR 0156)
--
-- DB 쪽은 표 둘과 문 다섯, 트리거 둘, 크론 둘이다. 보내는 손(VAPID 로 암호화해 푸시 서비스에 넘기는 것)은 앱의 배달 문
-- (`POST /api/push/dispatch`)이고, 그 문이 여기의 `claim_push_deliveries` · `settle_push_delivery` 를 열쇠로 부른다.
--
--   push_subscription  기기(브라우저)마다 하나 — endpoint 는 유일하고 계정에 매인다. 탈퇴 처분 때 cascade 로 간다
--   push_delivery      (구독 · 방)마다 대기 줄 하나. pending → sending → sent | gave_up | skipped
--
-- ## 정한 것 — ADR 0156 그대로
--
-- - **본문을 안 든다.** 배달 줄은 구독과 방만 가리킨다. 배달 문이 받는 것도 endpoint · 열쇠 · match_id · 시도 수뿐이다.
-- - **방 하나에 대기 줄 하나** — 같은 방의 다음 메시지는 대기 줄을 새로 만들지 않는다(부분 유일 색인). 보낸 뒤 60초 안에
--   다시 보내지 않는다 — 새 대기 줄의 기한은 그 구독 · 방의 마지막 보냄(또는 보내는 중) + 60초와 지금 중 늦은 쪽이다.
-- - **이미 읽었으면 안 보낸다** — 잡는 순간(`claim`) 받는 사람이 상대의 마지막 메시지까지 읽었으면 `skipped` 로 접는다.
--   방이 닫혔거나 구독의 주인이 그 방의 참여자가 아니어도(옮겨 간 endpoint) `skipped` 다.
-- - **다시 보내기** — 실패는 1분 · 5분 · 30분 · 2시간 뒤에 다시, 다섯 번째 실패에 `gave_up`. 404/410 은 구독을 지운다.
--   VAPID 열쇠가 없는 배포(`unconfigured`)는 시도 수를 안 올리고 5분 뒤로 미룬다 — 잃지 않는다.
-- - **깨우기** — 배달 줄이 서면 그 문장에서 한 번 `pg_net` 으로 배달 문을 POST 한다(요청은 커밋 뒤에 나간다). 크론
--   `push-dispatch` 가 1분마다, 기한이 된 줄이 있을 때만 같은 것을 한다. 주소 · 비밀은 Vault 의 `push_dispatch_url` ·
--   `push_dispatch_secret` 이고 **둘 중 하나라도 없으면 조용히 지나간다**(`wake_reading_recovery` 와 같은 결, ADR 0020).
--   크론의 실패와 밖으로 부른 요청의 실패는 `cron-watch` 가 이미 센다(`20261005090000`) — 따로 걸 것이 없다.
-- - **보존** — `sent` · `gave_up` · `skipped` 는 접힌 지 7일 뒤 하루 한 번 걷는다(`push-delivery-retention-purge`).
--
-- ## 이 파일이 정한 것 — ADR 에 없던 자리(보고에 적었다)
--
-- - **계정마다 구독 10개.** 브라우저는 endpoint 를 바꾸기도 하고 사람은 기기를 바꾼다 — 거절하면 정상 사용자가 언젠가
--   막히므로, 넘치면 가장 오래 안 쓰인 것을 지운다. 메시지 하나가 만드는 배달 줄의 상한이다.
-- - **보내는 중에 멈춘 줄**(5분 넘게 `sending`)을 다시 잡을 때는 실패 한 번으로 센다 — 배달 문이 그 줄에서 매번 죽으면
--   영영 돌지 않게.
-- - **받는 푸시 서비스만**(`push_endpoint_allowed`) — 알려진 호스트 넷과 시험용 Vault 값. 남기는 문과 잡는 문이 둘 다 본다.
-- - **묶음 마감** — 배달 문이 함수 한도 전에 남은 줄을 `release` 로 놓아준다. 시도 수를 안 올리고 다음 깨움에 다시 잡힌다.
-- - 보내는 중이던 줄을 `retry` · `unconfigured` · `release` 로 되돌리려는데 그 사이 같은 방의 새 대기 줄이 섰으면, 되돌리지 않고
--   `skipped` 로 접는다 — 새 줄이 같은 소식을 나른다.
--
-- 재는 자리는 `supabase/tests/83_push_delivery.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 정책의 수 — **원본은 여기다**
-- ---------------------------------------------------------------------------

/** 같은 구독 · 같은 방에 다시 보내기까지 — ADR 0156 */
create function public.push_room_quiet()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '60 seconds' $$;

/** 실패 몇 번째에 접나 — ADR 0156(「다섯 번 실패하면 접는다」) */
create function public.push_max_attempts()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

/** n 번째 실패 뒤 다시 보내기까지 — 1분 · 5분 · 30분 · 2시간 */
create function public.push_retry_delay(p_attempts integer)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_attempts
    when 1 then interval '1 minute'
    when 2 then interval '5 minutes'
    when 3 then interval '30 minutes'
    else interval '2 hours'
  end
$$;

/** 계정마다 둘 수 있는 구독 수 — 넘치면 가장 오래 안 쓰인 것을 지운다 */
create function public.push_subscription_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

/**
 * **받는 푸시 서비스인가** — endpoint 의 호스트가 알려진 넷 중 하나다(포트를 적지 않은 `https://<호스트>/…`).
 *
 *   fcm.googleapis.com             Chrome · 안드로이드 · Samsung Internet · Opera
 *   *.push.services.mozilla.com    Firefox
 *   *.notify.windows.com           Edge(WNS — wns2-*.notify.windows.com)
 *   *.push.apple.com               Safari · 홈 화면 웹 앱(Apple 이 허용하라고 적는 모양)
 *
 * 아무 `https:` 주소나 받으면 배달 문(Vercel)이 남이 고른 주소로 POST 한다 — 내부망을 두드리는 길(SSRF)이 되고, 일부러 느린
 * 서버가 배달 묶음을 붙든다. 앱도 같은 표를 든다(`src/lib/push` 의 `pushEndpointAllowed`).
 *
 * **시험용 호스트** — Vault 의 `push_extra_hosts`(쉼표 목록, 포트는 아무것이나)가 있으면 그것도 받는다. 로컬의 가짜 푸시
 * 서비스(`localhost`)를 위한 자리이고 **운영에는 넣지 않는다** — 없으면 닫혀 있다.
 */
create function public.push_endpoint_allowed(p_endpoint text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[] := regexp_match(coalesce(p_endpoint, ''), '^https://([A-Za-z0-9.-]+)(:[0-9]{1,5})?/');
  host text;
  extra text;
begin
  if parts is null then
    return false;
  end if;

  host := lower(parts[1]);

  if parts[2] is null and (
       host = 'fcm.googleapis.com'
       or host like '_%.push.services.mozilla.com'
       or host like '_%.notify.windows.com'
       or host like '_%.push.apple.com') then
    return true;
  end if;

  select decrypted_secret into extra from vault.decrypted_secrets where name = 'push_extra_hosts';

  return extra is not null and host in (
    select lower(btrim(h)) from unnest(string_to_array(extra, ',')) as h where btrim(h) <> '');
end;
$$;

revoke execute on function public.push_endpoint_allowed(text) from public, anon, authenticated, service_role;

revoke execute on function public.push_room_quiet() from public, anon, authenticated, service_role;
revoke execute on function public.push_max_attempts() from public, anon, authenticated, service_role;
revoke execute on function public.push_retry_delay(integer) from public, anon, authenticated, service_role;
revoke execute on function public.push_subscription_limit() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. 표
-- ---------------------------------------------------------------------------

/**
 * 웹 푸시 구독 — 기기(브라우저)마다 하나.
 *
 * `endpoint` 는 푸시 서비스가 준 주소이고 **유일하다** — 한 브라우저에서 다른 계정이 켜면 그 계정으로 옮긴다(앞 사람의
 * 메시지 통보를 받지 않게, ADR 0156). `p256dh` · `auth` 는 페이로드 암호화 열쇠다. 셋 다 새로 받는 개인정보다 —
 * 끄거나 · 로그아웃하거나 · 404/410 이거나 · 탈퇴 처분 때 지운다(`app_user` 에 cascade).
 *
 * 어느 역할에도 표를 열지 않는다 — 브라우저 문 셋과 배달 문 둘로만 만진다.
 */
create table public.push_subscription (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,

  constraint push_endpoint_is_https check (endpoint ~ '^https://' and length(endpoint) <= 2048),
  constraint push_keys_are_base64url check (
    p256dh ~ '^[A-Za-z0-9_-]+=*$' and length(p256dh) <= 256
    and auth ~ '^[A-Za-z0-9_-]+=*$' and length(auth) <= 256)
);

comment on table public.push_subscription is
  '웹 푸시 구독 — 기기마다 하나, endpoint 는 유일하고 계정에 매인다(ADR 0156)';

create index push_subscription_by_user on public.push_subscription (user_id);

/**
 * 배달 줄 — (구독 · 방)마다 **대기 줄 하나.**
 *
 * 메시지를 가리키지 않는다 — 「이 방에 새 메시지가 있다」 하나를 나르고, 그 사이의 메시지는 한 배달로 묶인다.
 *
 *   pending   기한(`due_at`)이 오면 배달 문이 잡는다
 *   sending   잡혔다(`claimed_at`). 5분 넘게 안 끝나면 다시 잡힌다 — 실패 한 번으로 센다
 *   sent      보냈다(`sent_at`) — 같은 방의 다음 배달은 이 시각 + 60초 뒤다
 *   gave_up   다섯 번 실패했다
 *   skipped   잡는 순간 이미 읽었거나 방이 닫혔다
 *
 * 뒤의 셋은 `settled_at` 을 든다 — 7일 보존의 시작이다.
 */
create table public.push_delivery (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscription (id) on delete cascade,
  room_id uuid not null references public.chat_room (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'gave_up', 'skipped')),
  due_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  settled_at timestamptz,

  constraint push_delivery_state_has_its_time check (
    (status = 'sending') = (claimed_at is not null)
    and (status = 'sent') = (sent_at is not null)
    and (status in ('sent', 'gave_up', 'skipped')) = (settled_at is not null))
);

comment on table public.push_delivery is
  '웹 푸시 배달 줄 — (구독, 방)마다 대기 줄 하나, 본문 없음(ADR 0156)';

create unique index push_delivery_one_waiting
  on public.push_delivery (subscription_id, room_id) where status = 'pending';
create index push_delivery_by_subscription_room on public.push_delivery (subscription_id, room_id);
create index push_delivery_by_room on public.push_delivery (room_id);
create index push_delivery_due on public.push_delivery (due_at) where status = 'pending';
create index push_delivery_in_flight on public.push_delivery (claimed_at) where status = 'sending';
create index push_delivery_settled on public.push_delivery (settled_at) where settled_at is not null;

revoke all on public.push_subscription, public.push_delivery from anon, authenticated;
alter table public.push_subscription enable row level security;
alter table public.push_delivery enable row level security;

-- ---------------------------------------------------------------------------
-- 3. 브라우저 문 셋 — 내 기기의 구독만
-- ---------------------------------------------------------------------------

/**
 * 이 기기의 구독을 남긴다 — 설정의 「새 메시지 알림」을 켤 때.
 *
 * 같은 endpoint 가 **다른 계정에** 있으면 그 줄을 지우고(그 계정 몫의 배달 줄도 cascade 로 간다) 이 계정으로 세운다.
 * 내 것이면 열쇠만 바꾼다. 계정마다 `push_subscription_limit()` 개를 넘으면 가장 오래 안 쓰인 것부터 지운다.
 *
 * 정지 · 탈퇴 대기 · 베타 종료 뒤의 계정은 거절한다(`is_active_account()`) — 그 사람의 방은 이미 닫혀 있다.
 */
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 2048 then
    raise exception 'push: the endpoint is not an https url' using errcode = '22023';
  end if;

  if not public.push_endpoint_allowed(p_endpoint) then
    raise exception 'push: the endpoint is not a known push service' using errcode = '22023';
  end if;

  if p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]+=*$' or length(p_p256dh) > 256
     or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]+=*$' or length(p_auth) > 256 then
    raise exception 'push: the keys are not base64url' using errcode = '22023';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  delete from public.push_subscription s
  where s.endpoint = p_endpoint and s.user_id <> actor;

  insert into public.push_subscription (user_id, endpoint, p256dh, auth)
  values (actor, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
  set user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      updated_at = now();

  delete from public.push_subscription s
  where s.user_id = actor
    and s.id in (
      select k.id from public.push_subscription k
      where k.user_id = actor
      order by greatest(k.updated_at, coalesce(k.last_success_at, k.updated_at)) desc, k.id
      offset public.push_subscription_limit());
end;
$$;

/**
 * 이 기기의 구독을 지운다 — 알림을 끌 때 · 로그아웃할 때. **내 것만** 지운다 — 남의 endpoint 를 주면 아무것도 안 한다.
 *
 * 정지된 계정에도 열려 있다 — 제 기기를 끄는 것은 남에게 해가 없다(`cancel_match_request` 와 같은 결).
 *
 * @returns 지웠으면 참
 */
create function public.remove_push_subscription(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  delete from public.push_subscription s
  where s.endpoint = p_endpoint and s.user_id = actor;

  return found;
end;
$$;

/** 이 기기가 **내 계정에** 구독돼 있나 — 설정 화면이 스위치의 자리를 정한다. 남의 것이면 거짓이다 */
create function public.push_subscription_registered(p_endpoint text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.push_subscription s
    where s.endpoint = p_endpoint and s.user_id = (select auth.uid()));
$$;

revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
revoke execute on function public.remove_push_subscription(text) from public, anon;
revoke execute on function public.push_subscription_registered(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;
grant execute on function public.push_subscription_registered(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 배달 문 둘 — 열쇠(`service_role`)만
-- ---------------------------------------------------------------------------

/**
 * 기한이 된 배달 줄을 잡는다 — 배달 문이 부른다.
 *
 * 잡는 것은 기한이 된 `pending` 과 5분 넘게 `sending` 인 줄이다(앞 배달 문이 죽었다 — 실패 한 번으로 세고, 그것이
 * 다섯 번째면 `gave_up`). `for update skip locked` 라 배달 문 둘이 겹쳐 돌아도 한 줄을 둘이 안 잡는다.
 *
 * 잡은 줄 가운데 **보낼 까닭이 없는 것은 `skipped` 로 접고 내주지 않는다** — 받는 사람이 상대의 마지막 메시지까지
 * 이미 읽었다, 방이 닫혔다, 구독의 주인이 그 방의 참여자가 아니다(옮겨 간 endpoint), endpoint 가 받는 푸시 서비스가
 * 아니다(`push_endpoint_allowed` — 시험용 호스트를 걷은 뒤 남은 줄).
 *
 * @returns 보낼 줄 — endpoint · 열쇠 · match_id(이동할 방) · 지금까지의 시도 수. 본문은 없다
 */
create function public.claim_push_deliveries(p_limit integer default 50)
returns table (
  delivery_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  match_id uuid,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select d.id
    from public.push_delivery d
    where (d.status = 'pending' and d.due_at <= now())
       or (d.status = 'sending' and d.claimed_at < now() - interval '5 minutes')
    order by d.due_at
    limit least(greatest(coalesce(p_limit, 50), 1), 500)
    for update skip locked
  ), judged as (
    select
      d.id,
      d.status as was,
      d.attempts + case when d.status = 'sending' then 1 else 0 end as tries,
      s.endpoint, s.p256dh, s.auth, r.match_id,
      (r.closed_at is not null
       or not public.push_endpoint_allowed(s.endpoint)
       or (s.user_id is distinct from r.user_low and s.user_id is distinct from r.user_high)
       or coalesce(k.last_read_seq, 0) >= coalesce(last.seq, 0)) as needless
    from picked p
    join public.push_delivery d on d.id = p.id
    join public.push_subscription s on s.id = d.subscription_id
    join public.chat_room r on r.id = d.room_id
    left join public.chat_read k on k.room_id = r.id and k.user_id = s.user_id
    left join lateral (
      select max(m.seq) as seq from public.chat_message m
      where m.room_id = r.id and m.sender_user_id is distinct from s.user_id
    ) last on true
  ), moved as (
    update public.push_delivery d
    set status = case
          when j.needless then 'skipped'
          when j.tries >= public.push_max_attempts() then 'gave_up'
          else 'sending' end,
        attempts = j.tries,
        claimed_at = case when j.needless or j.tries >= public.push_max_attempts() then null else now() end,
        settled_at = case when j.needless or j.tries >= public.push_max_attempts() then now() else null end
    from judged j
    where d.id = j.id
    returning d.id, d.status
  )
  select j.id, j.endpoint, j.p256dh, j.auth, j.match_id, j.tries
  from judged j
  join moved m on m.id = j.id
  where m.status = 'sending';
end;
$$;

/**
 * 잡은 줄 하나의 결과를 적는다 — 배달 문이 보낸 뒤에 부른다.
 *
 *   sent          보냈다. 구독의 `last_success_at` 도 적는다
 *   gone          404/410 — 구독을 지운다(배달 줄도 cascade 로 간다)
 *   retry         429 · 5xx · 연결 실패 — 시도 수를 올리고 1분 · 5분 · 30분 · 2시간 뒤로. 다섯 번째면 `gave_up`
 *   unconfigured  VAPID 열쇠가 없는 배포 — 시도 수 그대로 5분 뒤로
 *   release       보내지 않았다 — 배달 문의 묶음 마감이 지났다. 시도 수 그대로 지금 기한으로(다음 깨움에 다시 잡힌다)
 *
 * `sending` 이 아닌 줄(이미 적혔다 · 5분이 지나 다시 잡혔다)은 건드리지 않고 지금 상태를 돌려준다. 없는 줄(구독이
 * 지워졌다)은 `missing` 이다.
 *
 * @returns 적은 뒤의 상태 — `sent` · `gone` · `pending` · `gave_up` · `skipped` · `missing`
 */
create function public.settle_push_delivery(p_delivery_id uuid, p_result text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.push_delivery;
  tries integer;
  waiting boolean;
begin
  if p_result is null or p_result not in ('sent', 'gone', 'retry', 'unconfigured', 'release') then
    raise exception 'push: unknown result %', p_result using errcode = '22023';
  end if;

  select * into d from public.push_delivery x where x.id = p_delivery_id for update;

  if not found then
    return 'missing';
  end if;

  if d.status <> 'sending' then
    return d.status;
  end if;

  if p_result = 'sent' then
    update public.push_delivery x
    set status = 'sent', sent_at = now(), settled_at = now(), claimed_at = null
    where x.id = d.id;

    update public.push_subscription s set last_success_at = now() where s.id = d.subscription_id;
    return 'sent';
  end if;

  if p_result = 'gone' then
    delete from public.push_subscription s where s.id = d.subscription_id;
    return 'gone';
  end if;

  tries := d.attempts + case when p_result = 'retry' then 1 else 0 end;

  if tries >= public.push_max_attempts() then
    update public.push_delivery x
    set status = 'gave_up', attempts = tries, claimed_at = null, settled_at = now()
    where x.id = d.id;
    return 'gave_up';
  end if;

  select exists (
    select 1 from public.push_delivery x
    where x.subscription_id = d.subscription_id and x.room_id = d.room_id and x.status = 'pending'
  ) into waiting;

  if waiting then
    update public.push_delivery x
    set status = 'skipped', attempts = tries, claimed_at = null, settled_at = now()
    where x.id = d.id;
    return 'skipped';
  end if;

  update public.push_delivery x
  set status = 'pending',
      attempts = tries,
      claimed_at = null,
      due_at = now() + case p_result
        when 'retry' then public.push_retry_delay(tries)
        when 'release' then interval '0 seconds'
        else interval '5 minutes' end
  where x.id = d.id;

  return 'pending';
end;
$$;

revoke execute on function public.claim_push_deliveries(integer) from public, anon, authenticated;
revoke execute on function public.settle_push_delivery(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(integer) to service_role;
grant execute on function public.settle_push_delivery(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. 깨우기 — 배달 문을 POST 한다. 주소 · 비밀은 Vault
-- ---------------------------------------------------------------------------

/**
 * 배달 문을 한 번 두드린다.
 *
 *   select vault.create_secret('https://<운영 주소>/api/push/dispatch', 'push_dispatch_url');
 *   select vault.create_secret('<Vercel 의 PUSH_DISPATCH_SECRET 과 같은 값>', 'push_dispatch_secret');
 *
 * **아직 안 넣었으면 조용히 지나간다** — 로컬 · 배선 전 운영. 값이 없다는 것은 배선이 안 끝났다는 뜻이지 실패가 아니다
 * (`wake_reading_recovery` 와 같은 결). 답을 기다리지 않는다 — `pg_net` 은 요청을 큐에 넣고 돌아오고, 그 큐는 커밋된
 * 뒤에 나간다. 배달 문은 50건씩 차례로 보내므로 문턱을 넉넉히 준다 — 끊기면 `cron-watch` 가 「밖으로 부른 요청의 실패」로
 * 센다.
 */
create function public.wake_push_dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
  secret text;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'push_dispatch_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_dispatch_secret';

  if url is null or secret is null then
    return;
  end if;

  perform net.http_post(
    url := url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || secret,
      'Content-Type', 'application/json'),
    timeout_milliseconds := 30000);
end;
$$;

/** 크론이 1분마다 — 기한이 된 줄이나 멈춘 줄이 있을 때만 두드린다. 없으면 아무 요청도 안 나간다 */
create function public.wake_push_dispatch_when_due()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.push_delivery d
    where (d.status = 'pending' and d.due_at <= now())
       or (d.status = 'sending' and d.claimed_at < now() - interval '5 minutes')
  ) then
    perform public.wake_push_dispatch();
    return true;
  end if;

  return false;
end;
$$;

revoke execute on function public.wake_push_dispatch() from public, anon, authenticated, service_role;
revoke execute on function public.wake_push_dispatch_when_due() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. 트리거 — 메시지가 서면 대기 줄, 대기 줄이 서면 깨우기
-- ---------------------------------------------------------------------------

/**
 * 메시지가 섰다 → **받는 사람**(보낸 사람이 아닌 참여자, 떠났으면 없음)의 구독마다 대기 줄. 이미 기다리는 줄이 있으면
 * 안 만든다 — 그 줄이 이 메시지도 나른다. 기한은 그 구독 · 방의 마지막 보냄(보내는 중이면 잡은 시각) + 60초와 지금 중
 * 늦은 쪽이다.
 *
 * 실패를 삼킨다 — 통보는 부속이다. 메시지는 저장돼야 한다.
 */
create function public.queue_push_for_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.push_delivery (subscription_id, room_id, due_at)
  select s.id, t.room_id,
         greatest(now(), coalesce((
           select max(coalesce(d.sent_at, d.claimed_at)) from public.push_delivery d
           where d.subscription_id = s.id and d.room_id = t.room_id and d.status in ('sent', 'sending')
         ) + public.push_room_quiet(), now()))
  from (
    select distinct a.room_id,
           case when a.sender_user_id = r.user_low then r.user_high else r.user_low end as recipient
    from added a
    join public.chat_room r on r.id = a.room_id
  ) t
  join public.push_subscription s on s.user_id = t.recipient
  where t.recipient is not null
  on conflict (subscription_id, room_id) where status = 'pending' do nothing;

  return null;
exception when others then
  raise warning 'queue_push_for_chat_message: % %', sqlstate, sqlerrm;
  return null;
end;
$$;

create trigger chat_message_queues_a_push
after insert on public.chat_message
referencing new table as added
for each statement execute function public.queue_push_for_chat_message();

/** 대기 줄이 섰다 → 그 문장에서 한 번 배달 문을 깨운다. 실패를 삼킨다 — 크론이 1분 안에 다시 깨운다 */
create function public.wake_push_dispatch_on_queue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from added a where a.status = 'pending') then
    perform public.wake_push_dispatch();
  end if;

  return null;
exception when others then
  raise warning 'wake_push_dispatch_on_queue: % %', sqlstate, sqlerrm;
  return null;
end;
$$;

create trigger push_delivery_wakes_the_dispatch
after insert on public.push_delivery
referencing new table as added
for each statement execute function public.wake_push_dispatch_on_queue();

revoke execute on function public.queue_push_for_chat_message() from public, anon, authenticated, service_role;
revoke execute on function public.wake_push_dispatch_on_queue() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. 보존 — 접힌 배달 줄은 7일 뒤 걷는다
-- ---------------------------------------------------------------------------

/** 접힌 배달 줄을 남기는 기간 — ADR 0156 */
create function retention.push_delivery_period()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '7 days' $$;

/**
 * 접힌(`sent` · `gave_up` · `skipped`) 지 7일이 지난 배달 줄을 지운다. 여러 번 돌아도 안전하다.
 *
 * @returns 이번에 지운 수
 */
create function retention.purge_settled_push_deliveries()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  gone integer;
begin
  with purged as (
    delete from public.push_delivery d
    where d.settled_at is not null
      and d.settled_at < now() - retention.push_delivery_period()
    returning 1
  )
  select count(*)::integer into gone from purged;
  return gone;
end;
$$;

revoke execute on function retention.push_delivery_period() from public, anon, authenticated, service_role;
revoke execute on function retention.purge_settled_push_deliveries() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. 크론 — 이름으로 지우고 다시 건다(두 번 돌아도 일정이 하나다)
-- ---------------------------------------------------------------------------

/** 1분마다 — 기한이 된 줄이 있을 때만 배달 문을 깨운다(다시 보내기 · 깨우기를 놓친 줄) */
select cron.unschedule('push-dispatch')
where exists (select 1 from cron.job where jobname = 'push-dispatch');

select cron.schedule('push-dispatch', '* * * * *', 'select public.wake_push_dispatch_when_due()');

/** 매일 04:43 UTC — 다른 잡(04:37 · 04:53 · 06:29 · 매시 7 · 23 · 47분 · 5분 · 10분마다 · 매분)과 안 겹친다 */
select cron.unschedule('push-delivery-retention-purge')
where exists (select 1 from cron.job where jobname = 'push-delivery-retention-purge');

select cron.schedule('push-delivery-retention-purge', '43 4 * * *',
  'select retention.purge_settled_push_deliveries()');
