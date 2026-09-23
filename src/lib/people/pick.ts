/**
 * 저장한 사람을 **이름으로 찾아 고르는** 판단 — 궁합의 두 칸과 사람 목록 위의 찾는 칸이 쓴다.
 *
 * ## 왜 `select` 가 아닌가
 *
 * 고르는 칸이 `select` 둘이던 동안 저장 한도 10 은 **목록이 읽히는 동안의 수**였다
 * (ADR 0032). 공개 출시에서 그 10 을 걷으므로(ADR 0102) 스물 · 백이 들어와도 읽히는
 * 칸이어야 한다 — 쳐서 좁히고 키보드로 오르내린다. 그 판단을 여기 두어 vitest 가 닿게
 * 하고, 화면(`app/person-combobox.tsx`)은 그리기만 한다.
 *
 * ## 무엇을 맞다고 보는가
 *
 * 이름의 어느 자리든 **이어진 글자**가 맞으면 선다. 띄어쓰기 · 영문 대소문자는 안 가른다.
 * 한글은 **초성만 쳐도** 맞는다(`ㅇㅁㄴ` → 어머니) — 휴대폰 자판에서 한 글자를 다 짓기
 * 전에도 좁혀지고, 치다 만 음절이 섞여도(`어ㅁ`) 같은 규칙으로 읽는다. 차례는 들어온
 * 그대로다 — 맞는 정도로 다시 세우면 칠 때마다 줄이 뛴다.
 */

export type Pickable = { readonly personId: string; readonly label: string };

/** 한글 음절의 첫소리 열아홉 — 유니코드 음절 표의 차례 그대로 */
const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const SYLLABLE_FIRST = 0xac00;
const SYLLABLE_LAST = 0xd7a3;
/** 첫소리 하나가 거느리는 음절 수 — 가운뎃소리 21 × 끝소리 28 */
const PER_CHOSEONG = 21 * 28;

const fold = (text: string): string => text.normalize('NFC').toLowerCase().replace(/\s+/g, '');

const choseongOf = (letter: string): string | null => {
  const code = letter.codePointAt(0) ?? 0;
  if (code < SYLLABLE_FIRST || code > SYLLABLE_LAST) return null;
  return CHOSEONG[Math.floor((code - SYLLABLE_FIRST) / PER_CHOSEONG)];
};

/** 친 글자 하나가 이름의 글자 하나에 맞는가 — 같은 글자이거나, 친 것이 그 음절의 첫소리다 */
const letterMatches = (typed: string, have: string): boolean =>
  typed === have || (CHOSEONG.includes(typed) && choseongOf(have) === typed);

export const matchesName = (label: string, typed: string): boolean => {
  const want = [...fold(typed)];
  if (want.length === 0) return true;

  const have = [...fold(label)];
  for (let start = 0; start + want.length <= have.length; start += 1) {
    if (want.every((letter, offset) => letterMatches(letter, have[start + offset]))) return true;
  }
  return false;
};

/** 칸에 설 사람 — 다른 칸에서 고른 사람(`taken`)은 빼고, 친 이름으로 좁힌다 */
export const pickable = <T extends Pickable>(
  people: readonly T[],
  typed: string,
  taken: string | null,
): T[] => people.filter((one) => one.personId !== taken && matchesName(one.label, typed));

export type Step = 'next' | 'previous' | 'first' | 'last';

/**
 * 키보드로 옮긴 뒤 설 자리. `-1` 은 아무 데도 안 선 것이다.
 *
 * 끝에서 한 번 더 누르면 반대 끝으로 돈다. 치는 동안 목록이 줄어 자리가 밖으로 밀려
 * 있으면 처음(아래로) · 끝(위로)부터 다시 센다.
 */
export const stepTo = (active: number, count: number, step: Step): number => {
  if (count === 0) return -1;
  const inside = active >= 0 && active < count;

  switch (step) {
    case 'first':
      return 0;
    case 'last':
      return count - 1;
    case 'next':
      return inside && active < count - 1 ? active + 1 : 0;
    case 'previous':
      return inside && active > 0 ? active - 1 : count - 1;
  }
};

/**
 * 사람 목록(`/me/people`) 위에 **찾는 칸이 서는 수** — 여섯부터다(ADR 0102, G-21).
 *
 * 2026-09-24 에 재 보니 카드 하나가 데스크톱 254px · 휴대폰 334px 이라 첫 화면에 온전히 서는
 * 카드는 수와 상관없이 **하나**였다. 끝의 사람까지 휴대폰에서 스물여섯이면 13화면, 백이면
 * 48화면을 내려야 닿았다. 다섯까지는 두세 화면이라 눈으로 찾고, 칸이 서면 그만큼 첫 카드가
 * 밀린다 — 그래서 궁합 칸이 한 번에 보이는 다섯 줄 반을 넘는 수에서 선다.
 */
export const FIND_FROM = 6;

export const findsInList = (count: number): boolean => count >= FIND_FROM;

/**
 * 찾는 칸이 결과를 말하는 모양 — 문구는 화면이 든다.
 *
 * 안 쳤으면 말하지 않는다(`idle`) — 치지도 않았는데 수를 말하면 화면낭독기가 목록을 열 때마다
 * 그 수를 읽는다. 쳤는데 없으면 없다고(`none`), 있으면 몇 명인지(`some`) 말한다.
 */
export type FindStatus = { kind: 'idle' } | { kind: 'none' } | { kind: 'some'; count: number };

export const findStatus = (typed: string, shown: number): FindStatus => {
  if (typed.trim() === '') return { kind: 'idle' };
  return shown === 0 ? { kind: 'none' } : { kind: 'some', count: shown };
};
