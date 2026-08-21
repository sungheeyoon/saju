import type { SajuInput } from './input';

/**
 * **무작위 모집단** — 이 저장소가 「3000건에서 몇 %」라고 말할 때의 그 3000건.
 *
 * 강약·종격·억부의 주석에 모집단 발화율이 여럿 적혀 있는데(1.9% · 10.6% · 17.6%
 * …) 그 표본을 만드는 코드는 **재는 자리마다 따로 있었다.** 시드와 날짜 범위가
 * 같은지 아무도 보증하지 않는 채로 숫자들이 나란히 비교되고 있었다는 뜻이다.
 * 여기 한 벌을 두고, 새로 재는 것은 이것을 쓴다.
 *
 * 시험에서만 부른다. 앱은 이 파일을 import 하지 않는다.
 */

/**
 * 고정 시드 난수 — 시드를 박아두어야 실패를 재현할 수 있다.
 * (mulberry32: 32비트 상태 하나로 도는 작은 PRNG)
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 날짜를 28일까지만 뽑는다 — **달마다 길이를 따지지 않으려는 것이 아니다.**
 *
 * 29~31일을 뽑으면 달에 따라 존재하지 않는 날짜가 나오고, 그것을 걸러 내면
 * 표본 크기가 달마다 달라진다. 월말 경계는 절입 경계와 다른 축이라 여기서
 * 섞지 않는다 — 경계는 골든이 따로 든다(`golden/cases.ts`).
 */
export function randomInputs(count: number, seed = 20260821): SajuInput[] {
  const random = mulberry32(seed);
  const pick = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

  return Array.from({ length: count }, () => ({
    year: pick(1900, 2100),
    month: pick(1, 12),
    day: pick(1, 28),
    hour: pick(0, 23),
    minute: 0,
    second: 0,
    gender: random() < 0.5 ? ('female' as const) : ('male' as const),
  }));
}

/**
 * 같은 사람의 **시간 미상 짝.**
 *
 * 시간 미상 입력은 분·초 자리를 아예 비워야 한다(`SajuInput` 이 그것을
 * 요구한다). 부르는 쪽마다 손으로 털어 내면 언젠가 한 곳이 빼먹고, 그러면
 * 타입이 잡아 주기는 하되 시험 코드가 지저분해진다.
 */
export function withoutHour(input: SajuInput): SajuInput {
  const { year, month, day, gender } = input;

  return { year, month, day, hour: null, gender };
}
