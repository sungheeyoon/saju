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
 * 기계적으로 틀리는 둘만 막는다 — 이미 `님` 으로 끝나는 말(「어머님님」)과 빈 이름(「님」 한 글자).
 *
 * **예외가 없다**(운영자 2026-10-15). 본인도 상대도 「닉네임님」이고, 닉네임이 「나」 · 「저」여도 「나님」 · 「저님」이다 —
 * 글자를 보고 본인을 가리는 갈래도, 본인 자리를 「나」로 부르는 갈래도 두지 않는다.
 */
export function calledName(name: string): string {
  const said = name.trim();
  if (said === '') return said;
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
 *
 * **낱말의 앞머리는 안 먹는다** — 「첫 번째 분석」 · 「두 번째 분기점」 · 「첫 번째 분야」의 「분」은 호칭이 아니다. 호칭 뒤에는
 * 조사가 오거나, 한글 음절이 아닌 글자(띄어쓰기 · 문장 부호)가 오거나, 글이 끝나야 한다(`SEAT_END`).
 */
const PARTICLE_AFTER = '은|는|이|가|을|를|과|와|의|도|만|에|께|으로|로|처럼|보다|부터|까지|한테|랑|하고|마저|조차|뿐';
const SEAT_END = `(?=(?:${PARTICLE_AFTER})|[^가-힣]|$)`;
const SEAT_PATTERN = {
  first: `첫\\s?번째\\s?(?:님|분)${SEAT_END}`,
  second: `두\\s?번째\\s?(?:님|분)${SEAT_END}`,
} as const;

/** 두 자리의 닉네임 — `first` 가 `charts.a`, `second` 가 `charts.b` 다 */
export type SeatNicknames = { readonly first: string; readonly second: string };

/**
 * 부르는 화면이 아는 꼴 — 내 궁합은 두 자리를 바로 안다(`pairSeatsOf`). 인연 궁합은 **보는 사람 쪽에서** 안다 —
 * 누가 `charts.a` 인지는 그 글이 든다(`CurrentReading.viewerIsFirst`). 보는 사람도 자기 닉네임으로 부른다.
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
 * 인연 궁합에서 **내가 첫 자리인가** — `match.user_low` 가 나인가.
 *
 * 결과 화면은 이 값을 `my_reading` 의 `viewer_is_first` 로 받는다. 목록 문(`my_readings`)은 그 칸이 없어 같은 비교를
 * 여기서 한다 — `match` 표가 `user_low < user_high` 를 검사식으로 들고(`pair_is_ordered`), `uuid` 비교는 소문자 표기의
 * 사전 순과 같다(`pairSeatsOf` 와 같은 까닭).
 */
export const viewerIsFirstOf = (myUserId: string, partnerUserId: string): boolean =>
  myUserId.toLowerCase() < partnerUserId.toLowerCase();

/** 글에 자리 호칭(새 · 옛)이 남아 있는가 */
export const hasSeatName = (text: string): boolean =>
  new RegExp(`${SEAT_PATTERN.first}|${SEAT_PATTERN.second}`).test(text);

/**
 * 목록에 서는 두 사람 글의 한 줄 요약 — **호칭을 날것으로 세우지 않는다.**
 *
 * 두 자리의 닉네임을 알면 바꾸고, 모르는데(읽기가 실패했다 · 짝을 못 찾았다) 호칭이 남아 있으면 요약을 안 세운다(`null`) —
 * 「첫번째님은…」이 그대로 서는 것보다 요약 없는 표지가 낫다. 호칭이 없는 요약은 그대로다.
 */
export function listedPairSummary(summary: string | null, seats: SeatNicknames | null): string | null {
  if (summary === null) return null;
  const named = seats === null ? summary : withNicknames(summary, seats);
  /* 닉네임이 비어 바꾸지 못한 자리도 같다 */
  return hasSeatName(named) ? null : named;
}

/**
 * 모델이 쓴 글의 자리 호칭을 **지금 그 자리의 닉네임**으로 바꾼다 — 본문 · 한 줄 요약, 모델 글이 서는 자리 전부.
 *
 * 부르는 말은 늘 `calledName`(「닉네임님」)이라 받침(`님`)으로 끝난다 — 호칭(`님` · `분`)도 받침으로 끝나서 모델이 쓴 받침 쪽
 * 조사(은 · 이 · 을 · 과 · 으로)가 그대로 맞으므로 조사는 손대지 않는다. 호칭이 없는 글(옛 이름이 박힌 풀이)은 그대로 돌아간다.
 * 닉네임이 비었으면 그 자리는 안 바꾼다 — 조사만 남은 문장보다 호칭이 낫다.
 *
 * **두 자리를 정규식 하나로 한 번에, 콜백으로 바꾼다**(외부 검토 2026-10-15). 차례로 두 번 바꾸면 첫째 닉네임이 「두번째님」일 때
 * 둘째 치환이 그것까지 먹고, 닉네임을 치환 **문자열**로 넘기면 「$&」 · 「$1」 같은 특수 패턴이 풀린다. 콜백이 돌려준 글은 그대로
 * 들어가고, 이미 바꾼 자리는 다시 안 본다.
 */
export function withNicknames(text: string, nicknames: SeatNicknames): string {
  const called = { first: calledName(nicknames.first), second: calledName(nicknames.second) };

  return text.replace(
    new RegExp(`(${SEAT_PATTERN.first})|(${SEAT_PATTERN.second})`, 'g'),
    (seat: string, first: string | undefined) => {
      const name = first !== undefined ? called.first : called.second;
      return name === '' ? seat : name;
    },
  );
}
