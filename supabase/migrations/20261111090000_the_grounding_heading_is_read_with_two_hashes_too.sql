-- 인연 궁합의 근거 절 제목을 `##` 로 써도 본문 조회에서 잘린다 (2026-09-30, 운영자 답, ADR 0139)
--
-- 프롬프트는 맨 끝 검사용 근거 절을 `### 근거 (검사용)` 로 쓰라고 시키는데 모델이 가끔 `## 근거 (검사용)` 로
-- 쓴다 — 실호출 원문 33편 중 1편, 운영 `reading_run` 의 `person` 실패 1건이 그 모양이었다. 운영자는 「검사기와
-- 화면이 `##` 도 근거 절로 받는다」로 정했고 프롬프트는 건드리지 않았다.
--
-- 앱의 `src/lib/reading/display.ts`(`GROUNDING_HEADING`)가 같은 날 `/^#{2,3}\s+근거(?:\s+\(검사용\))?\s*$/m` 로
-- 넓어졌다. 이 함수는 그 규칙의 **DB 쪽 한 벌**이고 인연 궁합에서는 마지막 문이라(20260922090000), 앱만
-- 넓히면 `my_reading` 을 직접 부르는 길에서 `##` 근거 절이 상대에게 그대로 나간다. 같은 무늬로 맞춘다.
--
-- 바뀌는 것은 정규식의 `#` 개수 하나다 — `###` 는 전과 같이 자르고, `#` 하나 · `####` 는 여전히 안 자른다.
-- 줄 전체가 「근거」 또는 「근거 (검사용)」 이어야 하므로 「## 근거의 층」 같은 본문 제목은 안 걸린다.
-- 서명 · 권한은 그대로다(`create or replace` 는 grant 를 지키고, revoke 도 다시 적어 둔다).

create or replace function public.reading_user_body(p_output text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_output is null then null
    when pos = 0 then p_output
    else btrim(left(p_output, pos - 1), E' \t\r\n')
  end
  from (
    select coalesce(
      regexp_instr(p_output, '^#{2,3}[[:space:]]+근거([[:space:]]+\(검사용\))?[[:space:]]*$', 1, 1, 0, 'n'),
      0) as pos
  ) found;
$$;

revoke execute on function public.reading_user_body(text) from anon, public, authenticated;
