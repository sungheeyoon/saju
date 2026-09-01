-- ---------------------------------------------------------------------------
-- 조용히 지나가는 길도 물어볼 수는 있어야 한다 (ADR 0020)
-- ---------------------------------------------------------------------------

/**
 * `wake_reading_recovery` 는 Vault 에 값이 없으면 **조용히 지나간다.** 1분마다 예외를
 * 쌓으면 그 소음이 진짜 실패를 덮기 때문이고, 그 판단은 그대로다.
 *
 * 그런데 그렇게 두니 **배선이 끝났는지 알 길이 없다.** 이름을 한 글자 틀려도 겉보기는
 * 똑같다 — 아무 일도 안 일어난다. 배포하고 나서 「왜 복구가 안 도나」를 물으려면 그때야
 * 알게 되고, 그때는 이미 결과 하나가 만료로 닫힌 뒤다.
 *
 * 그래서 **있는지만** 묻는 문을 연다. 값은 안 낸다 — 물어보는 것과 읽는 것은 다르고,
 * 읽는 문을 열면 열쇠를 든 코드가 그 값을 밖으로 옮길 수 있다.
 */
create or replace function public.reading_recovery_configured()
returns table (has_url boolean, has_secret boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from vault.decrypted_secrets where name = 'reading_recovery_url'),
    exists (select 1 from vault.decrypted_secrets where name = 'reading_recovery_secret');
$$;

revoke execute on function public.reading_recovery_configured() from anon, public, authenticated;
grant execute on function public.reading_recovery_configured() to service_role;
