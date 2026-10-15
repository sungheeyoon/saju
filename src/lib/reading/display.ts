import { endsWithBatchim } from '../saju/text/batchim';

/**
 * 모델 출력에는 내부 검토용 근거가 본문 뒤에 붙는다.
 *
 * 저장할 때는 그 근거까지 남겨야 품질을 되짚을 수 있지만, 사용자가 읽는 글은 여기서
 * 끝낸다. 화면마다 문자열을 따로 자르면 자기 풀이와 궁합 중 한쪽에서만 근거가 새므로
 * 자르는 규칙을 한 곳에 둔다.
 *
 * **제목은 `##` 도 `###` 도 받는다(2026-09-30, 운영자 답, ADR 0139).** 프롬프트는 `### 근거 (검사용)` 로 쓰라고 시키는데
 * 모델이 가끔 `## 근거 (검사용)` 로 쓴다 — 실호출 원문 33편 중 1편(2026-09-30 `person`), 운영 `reading_run` 의
 * `person` 실패 1건이 그 모양이었다. 무늬가 `###` 만 알던 때는 근거 절 전체가 본문으로 세어져
 * `evidence-path-leaked` · `non-korean-self-body` 로 풀이가 버려졌다. 프롬프트는 건드리지 않았다(실험 보류) —
 * 받는 쪽을 넓혔다. 줄 전체가 「근거」 또는 「근거 (검사용)」 이어야 걸리므로 「근거의 층」처럼 「근거」로
 * 시작하는 다른 제목은 안 걸린다. `#` 하나 · `####` 는 받지 않는다. DB 쪽 한 벌(`public.reading_user_body`)도
 * 같은 날 같은 무늬로 넓혔다.
 */
export const GROUNDING_HEADING = /^#{2,3}\s+근거(?:\s+\(검사용\))?\s*$/m;

/** 사용자에게 보여 줄 본문 — 내부 검토용 근거 절은 제외한다. */
export function readingBody(markdown: string): string {
  const grounding = GROUNDING_HEADING.exec(markdown);
  return (grounding === null ? markdown : markdown.slice(0, grounding.index)).trim();
}

/**
 * 잘라 낸 **뒤쪽** — 절마다 어디서 온 말인지 모델이 적어 둔 줄들.
 *
 * 이 값은 프롬프트가 시켜서 만들어졌고 DB 에 저장까지 되는데 **어디에도 안 서 있었다.**
 * 그러면 「이 문장이 왜 이렇게 나왔나」를 물을 때 답이 사람의 짐작이 된다 — 자료를
 * 다시 읽고 그럴듯한 경로를 되짚는 일은 검수가 아니라 재해석이다.
 *
 * 자르는 자리를 `readingBody` 와 **같은 정규식**으로 둔다. 두 자리에서 따로 자르면
 * 언젠가 갈리고, 갈리면 본문에서 뺀 줄이 여기에도 없는 날이 온다.
 *
 * @returns 근거 절이 없으면 `null` — 빈 문자열로 뭉개지 않는다. 모델이 안 쓴 것과
 *   비어 있는 것은 다른 사실이고, 안 썼다는 것 자체가 검수 대상이다.
 */
export function readingGrounding(markdown: string): string | null {
  const grounding = GROUNDING_HEADING.exec(markdown);
  if (grounding === null) return null;

  const from = grounding.index + grounding[0].length;
  // 제목만 있고 줄이 없으면 **안 쓴 것**이다. 제목 한 줄을 근거라고 내주지 않는다.
  return markdown.slice(from).trim() === '' ? null : markdown.slice(grounding.index).trim();
}

/**
 * **이 사람을 화면에서 뭐라고 부르나** — 이름 뒤에 `님` 을 붙인다.
 *
 * 처음에는 가족 호칭 목록을 두고 「엄마」·「형」 같은 말에는 안 붙였다. 프롬프트가
 * 본문에 대해 그렇게 시키고 있었기 때문이다(「부르는 말이 이미 호칭이면 겹쳐 붙이지 마라」).
 *
 * **사람이 그 목록을 걷기로 정했다.** 이유는 빈도다 — 이름표에 가족 호칭을 적는 것은
 * 흔하지만, 친구를 저장할 때는 이름 세 글자를 그대로 적는 일이 더 잦다. 목록이
 * 다루는 쪽이 예외이고, 예외를 위해 판정을 하나 두면 그 판정이 틀리는 날이 온다 —
 * 한국어의 호칭을 다 셀 수 없으므로 목록은 언제나 모자란다.
 *
 * 이름은 갈래를 나누지 않는다 — 「어머니」로 등록했으면 그것이 그 사람의 닉네임이다(운영자 2026-10-15).
 * 2026-10-15 부터는 궁합 본문의 호칭도 이 함수가 짓는다(`withNicknames`) — 머리와 본문이 같은 말로 부른다.
 *
 * 기계적으로 틀리는 셋만 막는다 — 이미 `님` 으로 끝나는 말(「어머님님」), 자기를
 * 가리키는 말(「나님」), 그리고 빈 이름(「님」 한 글자).
 */
export function calledName(name: string): string {
  const said = name.trim();
  if (said === '') return said;
  if (said === '나' || said === '저') return said;
  if (said.endsWith('님')) return said;

  return `${said}님`;
}

/**
 * **자리 호칭** — 두 사람 글에서 `charts.a`·`charts.b` 를 부르는 말.
 *
 * **프롬프트에는 사람의 닉네임이 실리지 않는다**(운영자 2026-10-15). 내 궁합의 이름표(`local_label`) · 인연 궁합의
 * 닉네임 · 나 자신, 어느 갈래든 모델은 이 두 말만 받고 이 두 말로 쓴다. 화면이 이 말을 찾아 지금 그 자리의
 * 닉네임으로 바꾼다(`withNicknames`) — 그래서 이름표를 고치면 이미 받은 글의 호칭도 새 이름으로 선다.
 *
 * 프롬프트가 이 값을 읽고(`namingBlock`) 이 파일이 다시 찾는다. 한때 두 자리가 각자 글자를 들고 있어 한쪽만
 * 고치면 화면이 자리 이름을 그대로 내보냈다(G-44) — 말은 여기 하나에 두고, 지시 본문에 손으로 적은 자리
 * 이름까지 `display.test.ts` 가 프롬프트를 통째로 되읽어 잰다. 방향은 이쪽이다 — 화면이 부르는 이 파일이
 * 프롬프트 몸통을 끌고 가지 않는다.
 */
export const SEAT_NAMES = { first: '첫번째님', second: '두번째님' } as const;

/**
 * 화면이 찾는 꼴 — **새 호칭과 옛 호칭 둘 다.**
 *
 * 2026-10-15 전 풀이는 「첫 번째 분」·「두 번째 분」으로 났다(이름을 몰랐던 글 · 옛 공유 궁합). 그 글도 지금의
 * 닉네임으로 서야 하므로 옛 말을 계속 받는다. 띄어쓰기는 흔들려도 받는다(「첫 번째님」·「첫번째 분」).
 */
const SEAT_PATTERN = { first: '첫\\s?번째\\s?(?:님|분)', second: '두\\s?번째\\s?(?:님|분)' } as const;

/**
 * 호칭 뒤에 붙은 조사 — 두 호칭이 다 받침(`님` · `분`)으로 끝나므로 모델은 받침 쪽 조사를 쓴다.
 * 긴 것이 앞이어야 「이에요」가 「이」로 잘리지 않는다.
 */
const PARTICLE = '(이에요|이랑|으로|에게|께서|은|이|을|과|의|도|만|께)?';

/** 받침 없이 끝나는 이름(「나」·「저」)이 서면 받침 쪽 조사를 이쪽으로 옮긴다 */
const WITHOUT_BATCHIM: Readonly<Record<string, string>> = {
  이에요: '예요',
  이랑: '랑',
  으로: '로',
  은: '는',
  이: '가',
  을: '를',
  과: '와',
};

/** 두 자리의 닉네임 — `first` 가 `charts.a`, `second` 가 `charts.b` 다 */
export type SeatNicknames = { readonly first: string; readonly second: string };

/**
 * 부르는 화면이 아는 꼴 — 내 궁합은 두 자리를 바로 안다(`pairSeatsOf`). 인연 궁합은 **보는 사람 쪽에서** 안다 —
 * 누가 `charts.a` 인지는 그 글이 든다(`CurrentReading.viewerIsFirst`).
 */
export type PairNicknames = SeatNicknames | { readonly viewer: string; readonly partner: string };

export const seatNicknamesOf = (names: PairNicknames, viewerIsFirst: boolean): SeatNicknames =>
  'first' in names
    ? names
    : viewerIsFirst
      ? { first: names.viewer, second: names.partner }
      : { first: names.partner, second: names.viewer };

/**
 * 내 궁합의 두 사람을 **자리 차례로** 세운다 — `charts.a` 는 Person id 가 작은 쪽이다.
 *
 * 차례를 정하는 것은 DB 다(`reading_scope_for` 의 `least`·`greatest`). 그 차례를 화면에 돌려주는 칸이 없어서
 * 같은 비교를 여기서 한다 — Postgres 의 `uuid` 비교는 16바이트를 앞에서부터 견주고, 그것은 소문자 표기의
 * 사전 순과 같다(하이픈 자리가 같고 `0-9` < `a-f`). 대문자로 온 id 도 같은 답이 되게 소문자로 견준다.
 */
export function pairSeatsOf(
  one: { readonly personId: string; readonly name: string },
  other: { readonly personId: string; readonly name: string },
): SeatNicknames {
  return one.personId.toLowerCase() < other.personId.toLowerCase()
    ? { first: one.name, second: other.name }
    : { first: other.name, second: one.name };
}

/**
 * 모델이 쓴 글의 자리 호칭을 **지금 그 자리의 닉네임**으로 바꾼다 — 본문 · 한 줄 요약, 모델 글이 서는 자리 전부.
 *
 * 부르는 말은 `calledName` 이 정한다(공유본의 제목과 같은 규칙). 호칭이 없는 글(옛 이름이 박힌 풀이)은 그대로
 * 돌아간다. 닉네임이 비었으면 그 자리는 안 바꾼다 — 조사만 남은 문장보다 호칭이 낫다.
 */
export function withNicknames(text: string, nicknames: SeatNicknames): string {
  const replace = (source: string, pattern: string, name: string) => {
    const called = calledName(name);
    if (called === '') return source;
    const moved = endsWithBatchim(called) ? {} : WITHOUT_BATCHIM;

    return source.replace(
      new RegExp(`${pattern}${PARTICLE}`, 'g'),
      (_, suffix: string | undefined) => `${called}${suffix === undefined ? '' : (moved[suffix] ?? suffix)}`,
    );
  };

  return replace(replace(text, SEAT_PATTERN.first, nicknames.first), SEAT_PATTERN.second, nicknames.second);
}
