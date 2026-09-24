-- 안내번호는 **두 표를 합쳐** 한 경고의 것이다 (ADR 0108 추기, G-57)
--
-- 2026-09-24 에 잰 값: `20261019090000` 은 안내번호(`warning_ref`)에 표마다 유일 제약을 두고, 뽑을 때 두 표(`public.report` ·
-- `retention.report`)를 함께 봤다. 표마다의 제약은 두 표 사이를 모른다 — 한 번호가 지금 계정의 신고에 하나, 떠난 사람의 신고에
-- 하나 설 수 있었다. 뽑을 때의 확인도 나란히 적는 두 세션에서는 서로의 커밋 전 줄을 못 봐 지나간다. 같은 씨앗으로 두 표에
-- 경고를 나란히 적으면 둘 다 같은 번호를 받고 둘 다 커밋됐다(`scripts/check-db-races.mjs` 의 6 — 붉음 셋). 한 세션에서도 번호를
-- 손으로 적으면 두 표에 같은 번호가 들었다(pgTAP `56_warning_ref_is_one` — 아홉 중 여덟이 붉음). 같은 날 운영 DB 의 경고는 0이다.
--
-- ## 대장 하나 — 번호 → 신고
--
-- `public.warning_reference` 가 번호마다 한 줄이고 그 번호의 신고 id 를 든다. 두 표의 `(warning_ref, 신고 id)` 는 이 대장의
-- 짝을 가리키는 외래키다 — 번호가 대장에 없거나 다른 신고의 것이면 DB 가 막는다. 떠날 때 줄이 `public.report` 에서
-- `retention.report` 로 옮겨져도 신고 id 가 같으므로 짝이 그대로이고, 한 트랜잭션 안에서 두 표에 잠깐 함께 서는 것도 같은 짝이다.
--
-- 대장에 적는 것은 두 표의 트리거 하나(`register_warning_ref`)다 — 검토 문 · 옮기는 트리거 · 손으로 고치는 SQL 이 다 지난다.
-- 번호가 이미 다른 신고의 것이면 `23505`. 번호를 뽑는 `new_warning_ref(신고 id)` 는 뽑은 번호를 **대장에 먼저 잡는다** —
-- 다른 세션이 같은 번호를 잡고 커밋 전이면 그 커밋을 기다리고, 잡혀 있으면 다음 번호를 뽑는다. 그래서 나란히 적는 두 경고가
-- 둘 다 선다(뒤가 넘어지지 않는다).
--
-- **대장의 줄은 지우지 않는다.** 신고가 파기돼도(떠난 사람의 신고는 처분일부터 6개월, ADR 0098) 번호는 남아 다시 안 쓰인다 —
-- 옛 이메일의 번호가 다른 사람의 경고를 가리키지 않는다. 남는 것은 번호와 신고 id 뿐이고, 파기 뒤의 신고 id 는 아무 줄도
-- 가리키지 않는다(개인을 가리키는 칸이 없다). 81만 개 중 하나씩이다.
--
-- 대장은 API 역할에 닫혀 있다(RLS 켬 · 정책 없음 · 권한 없음) — 앱은 이 표를 안 읽는다.

-- ── 대장 ────────────────────────────────────────────────────────────────────

create table public.warning_reference (
  /** 안내번호 — 두 표를 합쳐 하나 */
  ref text primary key constraint warning_ref_shape check (ref ~ '^W-[2-9A-HJKMNP-TV-Z]{4}$'),
  /** 그 번호가 붙은 신고 — `public.report.id` 이거나 옮겨진 뒤의 `retention.report.report_id`. 외래키가 아니다(두 표를 오간다) */
  report_id uuid not null,
  constraint warning_reference_pair unique (ref, report_id)
);

comment on table public.warning_reference is
  '안내번호 대장 — 번호 하나에 신고 하나, 두 표(public · retention 의 report)를 합쳐. 지우지 않는다 — 번호를 다시 안 쓴다 (ADR 0108)';

alter table public.warning_reference enable row level security;
revoke all on public.warning_reference from public, anon, authenticated, service_role;

-- 이미 붙은 번호를 옮겨 적는다 — 운영 DB 는 0줄이었다. 두 표에 다른 신고로 같은 번호가 있으면 여기서 멈춘다
insert into public.warning_reference (ref, report_id)
select r.warning_ref, r.id from public.report r where r.warning_ref is not null
union
select k.warning_ref, k.report_id from retention.report k where k.warning_ref is not null;

-- ── 두 표가 대장의 짝을 가리킨다 ─────────────────────────────────────────────

/** 대장에 적는다 — 없으면 이 신고의 것으로, 있으면 이 신고의 것인지 본다 */
create function public.register_warning_ref()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  report uuid;
begin
  if tg_table_schema = 'public' then
    report := new.id;
  else
    report := new.report_id;
  end if;

  insert into public.warning_reference (ref, report_id) values (new.warning_ref, report)
  on conflict (ref) do nothing;

  if not exists (select 1 from public.warning_reference w where w.ref = new.warning_ref and w.report_id = report) then
    raise exception 'warning: the reference % belongs to another report', new.warning_ref using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke execute on function public.register_warning_ref() from public, anon, authenticated, service_role;

create trigger warning_ref_is_registered
before insert or update of warning_ref on public.report
for each row when (new.warning_ref is not null)
execute function public.register_warning_ref();

create trigger warning_ref_is_registered
before insert or update of warning_ref on retention.report
for each row when (new.warning_ref is not null)
execute function public.register_warning_ref();

/** 외래키의 앞 칼럼 — `49_foreign_key_indexes` */
create index report_warning_ref_pair on public.report (warning_ref, id) where warning_ref is not null;
create index retention_report_warning_ref_pair on retention.report (warning_ref, report_id) where warning_ref is not null;

alter table public.report
  add constraint warning_ref_is_registered foreign key (warning_ref, id)
    references public.warning_reference (ref, report_id);

alter table retention.report
  add constraint warning_ref_is_registered foreign key (warning_ref, report_id)
    references public.warning_reference (ref, report_id);

comment on column public.report.warning_ref is
  '안내번호 W-XXXX — 안내와 이메일에 싣고 운영자가 이것으로 찾는다. 처음 경고일 때 붙고 남는다. 두 표를 합쳐 하나 — warning_reference (ADR 0108)';

-- ── 번호를 뽑으며 잡는다 ─────────────────────────────────────────────────────

drop function public.new_warning_ref();

/**
 * 새 안내번호를 뽑아 이 신고의 것으로 대장에 잡는다 — `W-` + 네 글자(30⁴ = 81만), 헷갈리는 0 · 1 · I · L · O · U 를 뺐다.
 * 다른 세션이 같은 번호를 잡고 커밋 전이면 그 커밋을 기다리고, 잡혀 있으면 다음 번호를 뽑는다. 스무 번 안에 못 찾으면 던진다.
 */
create function public.new_warning_ref(p_report_id uuid)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  letters constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  ref text;
  taken text;
begin
  for attempt in 1..20 loop
    ref := 'W-' || (
      select string_agg(substr(letters, 1 + floor(random() * length(letters))::integer, 1), '')
      from generate_series(1, 4));
    insert into public.warning_reference (ref, report_id) values (ref, p_report_id)
    on conflict on constraint warning_reference_pkey do nothing
    returning warning_reference.ref into taken;
    if taken is not null then
      return taken;
    end if;
  end loop;
  raise exception 'warning: no free reference' using errcode = '23505';
end;
$$;

revoke execute on function public.new_warning_ref(uuid) from public, anon, authenticated, service_role;

/**
 * `20261019090000` 의 것에서 안내번호를 뽑는 두 자리만 `new_warning_ref(신고 id)` 로 바꿨다 — 나머지는 한 글자도 안 바꿨다.
 *
 * @returns 적은 표 — `report`(지금 계정의 신고) · `retention`(떠난 사람의 신고)
 */
create or replace function public.review_report(
  p_report_id uuid,
  p_reviewer uuid,
  p_outcome text,
  p_note text,
  p_sanctioned_user_id uuid default null,
  p_warning_category text default null
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  written text;
  warning constant boolean := p_outcome is not distinct from 'warning';
begin
  if p_reviewer is null or not exists (select 1 from public.operator o where o.user_id = p_reviewer) then
    raise exception 'review: the reviewer is not an operator' using errcode = '42501';
  end if;

  if p_outcome is null then
    raise exception 'review: an outcome is required' using errcode = '22023';
  end if;

  if p_warning_category is not null and not warning then
    raise exception 'review: a category goes with a warning only' using errcode = '22023';
  end if;

  update public.report r
  set reviewed_at = now(),
      reviewed_by = p_reviewer,
      review_outcome = p_outcome,
      review_note = p_note,
      sanctioned_user_id = p_sanctioned_user_id,
      sanctioned_by = case when p_sanctioned_user_id is not null then p_reviewer end,
      warning_category = case when warning then coalesce(p_warning_category, r.reason) end,
      warning_ref = case when warning then coalesce(r.warning_ref, public.new_warning_ref(r.id)) else r.warning_ref end,
      -- 경고로 **들어오면** 새 안내다 — 확인과 발송을 비운다. 경고를 경고로 다시 적거나 경고에서 나가면 그대로 둔다
      warning_acknowledged_at = case when warning and r.review_outcome is distinct from 'warning' then null
                                     else r.warning_acknowledged_at end,
      warning_emailed_at = case when warning and r.review_outcome is distinct from 'warning' then null
                                else r.warning_emailed_at end,
      warning_email_result = case when warning and r.review_outcome is distinct from 'warning' then null
                                  else r.warning_email_result end
  where r.id = p_report_id;

  if found then
    written := 'report';
  else
    update retention.report k
    set reviewed_at = now(),
        reviewed_by = p_reviewer,
        review_outcome = p_outcome,
        review_note = p_note,
        sanctioned_user_id = p_sanctioned_user_id,
        sanctioned_by = case when p_sanctioned_user_id is not null then p_reviewer end,
        warning_category = case when warning then coalesce(p_warning_category, k.reason) end,
        warning_ref = case when warning then coalesce(k.warning_ref, public.new_warning_ref(k.report_id)) else k.warning_ref end,
        warning_acknowledged_at = case when warning and k.review_outcome is distinct from 'warning' then null
                                       else k.warning_acknowledged_at end,
        warning_emailed_at = case when warning and k.review_outcome is distinct from 'warning' then null
                                  else k.warning_emailed_at end,
        warning_email_result = case when warning and k.review_outcome is distinct from 'warning' then null
                                    else k.warning_email_result end
    where k.report_id = p_report_id;

    if not found then
      raise exception 'review: no such report' using errcode = 'P0002';
    end if;
    written := 'retention';
  end if;

  -- 이용 정지 결정은 같은 트랜잭션에서 계정을 정지한다 — 여기서 실패하면 위의 기록도 되감긴다
  if p_outcome = 'suspension' then
    update public.app_user a set status = 'suspended' where a.id = p_sanctioned_user_id;
    if not found then
      raise exception 'review: the sanctioned account is gone' using errcode = 'P0002';
    end if;
  end if;

  return written;
end;
$$;
