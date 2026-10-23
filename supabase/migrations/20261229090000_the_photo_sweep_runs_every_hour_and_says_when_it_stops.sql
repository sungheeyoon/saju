-- 사진 청소는 매시간 돌고, 못 지우면 첫 번부터 알리며, 멈추거나 줄이 남으면 감시가 알린다 (G-120, ADR 0205)
--
-- 운영자 결정(2026-10-23): 사진 저장소의 청소(`app/api/cron/photo-sweep`)를 하루 한 번에서 **매시간**으로 바꾼다. 깨우는 쪽은
-- 복구기와 같은 **Supabase pg_cron → pg_net**(`20260901210000`)이고, 주소와 비밀은 Vault 에서 읽는다. Vercel 의 하루 한 번 크론은
-- pg_cron 이 멈췄을 때의 예비로 남는다 — 그래서 둘이 겹쳐 돌아도 안전해야 한다.
--
-- ## 1. 겹쳐 돌면 하나만 — 임대 한 줄(`photo_sweep_state`)
--
-- 청소 한 번은 트랜잭션 여럿에 걸친다(남은 표 → 받기 → 저장소 → 적기). 반출(`20261014090000`)과 같은 꼴로, 시작할 때 임대를 잡고
-- (`photo_sweep_begin`) 끝에 놓는다(`photo_sweep_finish`). 임대가 살아 있으면 뒤 실행은 아무것도 안 하고 「도는 중」으로 끝난다.
-- 라우트의 최대 실행은 60초라 5분 임대는 넉넉하고, 죽은 실행의 임대는 5분 뒤 저절로 풀린다. 놓는 것은 쥔 실행뿐이다.
--
-- **임대 없이도 결과 적기는 두 번 받아도 같다** — 지운 줄을 걷는 것은 두 번 해도 같고, 못 지운 줄은 차례가 온 줄만 다시 둔다
-- (`next_try_at <= now()`). 같은 실패를 두 실행이 적어도 시도 수가 한 번만 는다.
--
-- ## 2. 못 지우면 다음 시간에 다시, 첫 실패부터 알린다
--
-- 전에는 간격을 늘려(1 · 2 · 4 … 시간, 길어야 이레) 다시 두고 다섯 번째부터 알렸다. 이제 못 지운 줄은 **30분 뒤**에 차례가 온다 —
-- 다음 매시 실행(한 시간 뒤)이 반드시 줍는 간격이다(꼭 한 시간이면 다음 실행이 몇 초 일러 한 시간을 거른다). 알림은 **첫 실패에**
-- `photo-trash-failed` 로 낸다 — 이미 있는 길(`notify_ops` → Vault 의 `ops_alert_url`, 종류마다 하루 한 줄)이다. 옛 종류
-- `photo-trash-stuck` 은 더는 안 낸다.
--
-- ## 3. 매시간 깨운다 — Vault 주소가 없으면 아무것도 안 한다
--
-- `wake_photo_sweep()` 은 Vault 의 `photo_sweep_url` 이 있을 때만 부른다. 비밀은 새로 두지 않고 복구기의 `reading_recovery_secret`
-- (= Vercel 의 `CRON_SECRET`, 청소 라우트가 견주는 그 값)을 함께 쓴다 — 같은 값의 사본을 Vault 에 둘 두면 교체 때 하나를 잊는다.
-- 이 마이그레이션은 주소를 넣지 않는다 — **DB 반영만으로 청소 호출이 시작되지 않는다.** 켜는 날 운영자가 넣는다
-- (`docs/ops/runbook/photo-store.md`).
-- 매시 33분 — 탈퇴 처분(`account-disposal`, 매시 23분)이 지운 계정의 열쇠를 10분 뒤에 줍는다.
--
-- ## 4. 감시 둘 — 매시 53분, 켜진 뒤에만
--
--   - `photo-sweep-stale` — 끝까지 돈 청소가 **3시간** 넘게 없다(매시 실행 셋을 연달아 걸렀다). 기준은 마지막으로 끝난 실행과
--     Vault 주소를 넣은 때 중 늦은 쪽 — 켠 직후 「한 번도 안 돌았다」로 울리지 않는다
--   - `photo-trash-lingering` — 지울 줄에 **12시간** 넘게 남은 줄이 있다
--
--   둘 다 Vault 의 `photo_sweep_url` 이 있을 때만 본다 — 저장소가 꺼진 동안(지금 운영) 거짓 알림이 없다. 문턱의 근거는 ADR 0205:
--   탈퇴 계정의 열쇠는 처분(신청 뒤 24 ~ 25시간, `20261004090000`)에 지울 줄에 들고 처리방침의 기한은 신청 뒤 72시간이라 줄이 선
--   뒤 남는 틈은 약 47시간이다. 12시간이면 사람이 조치할 시간이 35시간쯤 남고, 그 사이 매시 재시도가 열두 번 실패했으니 지나가는
--   흔들림이 아니다. 같은 종류는 하루 한 번이라 다음 날 다시 울린다.
--
-- **「재시도하면 3일 안에 반드시 끝난다」를 이 마이그레이션은 약속하지 않는다** — 저장소 권한 · 버킷 사고처럼 사람이 고쳐야 하는
-- 실패는 몇 번을 다시 해도 같다. 그때의 복구 절차는 `docs/ops/runbook/photo-store.md` 「청소가 멈췄을 때 · 못 지운 줄이 쌓일 때」.
--
-- ## 그대로인 것
--
-- `photo_trash_settle` 의 서명(옛 앱이 부르는 꼴) · `photo_sweep_tickets` · `photo_trash_batch` · 지울 줄의 모양. 새 표는 RLS 를
-- 켜고 아무에게도 안 연다. 재는 자리는 `supabase/tests/99_photo_sweep_hourly.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 임대와 마지막 실행 — 한 줄
-- ---------------------------------------------------------------------------

create table public.photo_sweep_state (
  one boolean primary key default true check (one),
  /** 지금 도는 실행 — 놓으면 비운다 */
  holder uuid,
  held_until timestamptz,
  /** 끝까지 돈 마지막 실행(지운 수 · 못 지운 수와 함께) — 감시의 기준 */
  last_finished_at timestamptz,
  last_deleted integer check (last_deleted >= 0),
  last_failed integer check (last_failed >= 0),
  constraint photo_sweep_state_lease check ((holder is null) = (held_until is null))
);

comment on table public.photo_sweep_state is
  '사진 청소의 임대(겹쳐 돌면 하나만)와 끝까지 돈 마지막 실행 — 한 줄. 청소 문(photo_sweep_begin · photo_sweep_finish)만 쓴다 (G-120)';

insert into public.photo_sweep_state (one) values (true);

alter table public.photo_sweep_state enable row level security;
revoke all on public.photo_sweep_state from anon, authenticated;

/** 끝까지 돈 청소가 이만큼 없으면 알린다 — 매시 실행 셋을 연달아 걸렀다(ADR 0205) */
create function public.photo_sweep_stale_after()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '3 hours' $$;

/** 지울 줄에 이만큼 넘게 남으면 알린다 — 처리방침의 「3일 안 파기」 전에 사람이 조치할 틈(ADR 0205) */
create function public.photo_trash_linger_after()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '12 hours' $$;

revoke execute on function public.photo_sweep_stale_after() from public, anon, authenticated, service_role;
revoke execute on function public.photo_trash_linger_after() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. 청소 실행을 여닫는 문 — 열쇠(service_role)에만
-- ---------------------------------------------------------------------------

/**
 * 임대를 잡는다 — 비었거나 만료됐으면 새 실행 id 를, 살아 있으면 `null`(「도는 중」)을 낸다.
 *
 * 한 줄의 갱신이라 겹친 두 부름은 줄 자물쇠에서 줄을 서고, 뒤는 앞이 커밋한 임대를 보고 빈손으로 돌아간다.
 */
create function public.photo_sweep_begin()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run uuid := gen_random_uuid();
begin
  update public.photo_sweep_state s
  set holder = run, held_until = now() + interval '5 minutes'
  where s.one and (s.held_until is null or s.held_until < now());

  if not found then
    return null;
  end if;
  return run;
end;
$$;

/** 끝까지 돈 실행을 적고 임대를 놓는다 — 쥔 실행만. 임대를 잃은 실행이면 아무것도 안 적고 거짓 */
create function public.photo_sweep_finish(p_holder uuid, p_deleted integer, p_failed integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.photo_sweep_state s
  set holder = null, held_until = null,
      last_finished_at = now(),
      last_deleted = greatest(coalesce(p_deleted, 0), 0),
      last_failed = greatest(coalesce(p_failed, 0), 0)
  where s.one and s.holder = p_holder;

  return found;
end;
$$;

revoke execute on function public.photo_sweep_begin() from public, anon, authenticated;
revoke execute on function public.photo_sweep_finish(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.photo_sweep_begin() to service_role;
grant execute on function public.photo_sweep_finish(uuid, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 3. 결과 적기 — 다음 시간에 다시, 첫 실패부터 알린다
-- ---------------------------------------------------------------------------

/**
 * 지운 결과를 적는다 — 지운 것은 걷고, 못 지운 것은 **30분 뒤**(다음 매시 실행이 줍는다)에 다시 둔다. 차례가 온 줄만 다시 두므로
 * 같은 실패를 두 번 적어도 시도 수는 한 번 는다. 이번에 못 지운 줄이 있으면 **첫 실패부터** 운영 알림 — 종류마다 하루 한 줄이다.
 *
 * 서명은 `20261227090000` 그대로다(옛 앱이 같은 꼴로 부른다).
 *
 * @returns 이번에 알렸으면 참
 */
create or replace function public.photo_trash_settle(p_deleted text[], p_failed text[], p_error_class text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  marked integer;
  waiting integer;
  oldest_hours integer;
begin
  delete from public.photo_object_trash t where t.object_key = any(coalesce(p_deleted, '{}'));

  update public.photo_object_trash t
  set attempts = t.attempts + 1,
      next_try_at = now() + interval '30 minutes',
      last_error = coalesce(nullif(p_error_class, ''), 'unknown')
  where t.object_key = any(coalesce(p_failed, '{}'))
    and t.next_try_at <= now();
  get diagnostics marked = row_count;

  if marked = 0 then
    return false;
  end if;

  select count(*)::integer, floor(extract(epoch from now() - min(t.queued_at)) / 3600)::integer
  into waiting, oldest_hours
  from public.photo_object_trash t;

  return public.notify_ops(
    'photo-trash-failed',
    format('지울 사진 객체 %s개를 못 지웠다(분류 %s) — 다음 매시 청소가 다시 한다. 지울 줄 %s개, 가장 오래된 줄 %s시간. docs/ops/runbook/photo-store.md 「청소가 멈췄을 때 · 못 지운 줄이 쌓일 때」',
           marked, coalesce(nullif(p_error_class, ''), 'unknown'), waiting, oldest_hours));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. 매시간 깨운다 — 주소 · 비밀은 Vault
-- ---------------------------------------------------------------------------

/**
 * 청소 주소를 한 번 두드린다.
 *
 *   select vault.create_secret('https://<운영 주소>/api/cron/photo-sweep', 'photo_sweep_url');
 *
 * 비밀은 복구기의 `reading_recovery_secret`(= `CRON_SECRET`)이다 — 이미 운영 Vault 에 있다(`docs/ops/runbook/jobs.md`).
 *
 * **주소가 없으면(또는 비밀이 없으면) 조용히 지나간다** — 지금 운영 · 로컬. 주소가 없다는 것은 매시 청소가 아직 안 켜졌다는 뜻이다. 답을 기다리지
 * 않는다(`pg_net` 은 큐에 넣고 돌아온다). 라우트는 60초까지 돌므로 문턱을 그보다 넉넉히 준다 — 2xx 가 아니면 `cron-watch` 가
 * 「밖으로 부른 요청의 실패」로 센다. `pg_net` 은 `net` 에 산다(`20260909090000`).
 */
create function public.wake_photo_sweep()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
  secret text;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'photo_sweep_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'reading_recovery_secret';

  if url is null or secret is null then
    return;
  end if;

  perform net.http_get(
    url := url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 70000);
end;
$$;

revoke execute on function public.wake_photo_sweep() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. 감시 — 멈춘 청소 · 남은 줄
-- ---------------------------------------------------------------------------

/**
 * 매시간 둘을 본다(머리말 4). Vault 의 `photo_sweep_url` 이 없으면 아무것도 안 본다 — 매시 청소가 안 켜졌다.
 *
 * `p_now` 는 시험이 시계를 앞으로 돌리는 자리다(`audit.watch_export` 와 같은 꼴). 크론은 인자 없이 부른다.
 *
 * @returns 이번에 새로 알린 수
 */
create function public.watch_photo_sweep(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  switched_on timestamptz;
  finished timestamptz;
  since timestamptz;
  lingering integer;
  oldest_hours integer;
  errors text;
  told integer := 0;
begin
  select s.updated_at into switched_on
  from vault.decrypted_secrets s
  where s.name = 'photo_sweep_url' and s.decrypted_secret is not null;

  if switched_on is null then
    return 0;
  end if;

  -- 1. 멈춘 청소 — 끝까지 돈 마지막 실행(없으면 켠 때)부터
  select s.last_finished_at into finished from public.photo_sweep_state s where s.one;
  since := greatest(coalesce(finished, switched_on), switched_on);

  if since < p_now - public.photo_sweep_stale_after()
     and public.notify_ops(
       'photo-sweep-stale',
       format('사진 청소가 %s시간 넘게 끝까지 돌지 않았다(마지막 %s) — 탈퇴 · 바꾼 사진이 저장소에 남는다. docs/ops/runbook/photo-store.md 「청소가 멈췄을 때 · 못 지운 줄이 쌓일 때」',
              floor(extract(epoch from p_now - since) / 3600)::integer,
              coalesce(to_char(finished at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') || ' KST', '켠 뒤 없음')))
  then
    told := told + 1;
  end if;

  -- 2. 남은 줄 — 개수 · 가장 오래된 줄의 나이 · 분류만(열쇠에는 계정 id 가 들어 있어 안 싣는다)
  select count(*)::integer,
         floor(extract(epoch from p_now - min(t.queued_at)) / 3600)::integer,
         string_agg(distinct coalesce(t.last_error, '아직 시도 없음'), ', ')
  into lingering, oldest_hours, errors
  from public.photo_object_trash t
  where t.queued_at < p_now - public.photo_trash_linger_after();

  if lingering > 0
     and public.notify_ops(
       'photo-trash-lingering',
       format('지울 사진 객체 %s개가 지울 줄에 %s시간 넘게 남았다(가장 오래된 줄 %s시간, 분류 %s) — 처리방침의 「3일 안 파기」 전에 고친다. docs/ops/runbook/photo-store.md 「청소가 멈췄을 때 · 못 지운 줄이 쌓일 때」',
              lingering, extract(epoch from public.photo_trash_linger_after())::integer / 3600, oldest_hours, errors))
  then
    told := told + 1;
  end if;

  return told;
end;
$$;

revoke execute on function public.watch_photo_sweep(timestamptz) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. 잡 둘 — 이름으로 지우고 다시 건다(두 번 돌려도 하나)
-- ---------------------------------------------------------------------------

/** 매시 33분 — `account-disposal`(23분)의 10분 뒤. 다른 잡(매분 · 1·6·11… · 5·15… · 10분마다 · 23 · 47)과 안 겹친다 */
select cron.unschedule('photo-sweep-wake')
where exists (select 1 from cron.job where jobname = 'photo-sweep-wake');

select cron.schedule('photo-sweep-wake', '33 * * * *', 'select public.wake_photo_sweep()');

/** 매시 53분 — 깨운 실행(60초 안)이 끝난 뒤 본다 */
select cron.unschedule('photo-sweep-watch')
where exists (select 1 from cron.job where jobname = 'photo-sweep-watch');

select cron.schedule('photo-sweep-watch', '53 * * * *', 'select public.watch_photo_sweep()');
