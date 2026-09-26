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

// ─── 쌍 모집단 — 오프라인 궁합 비교기(`src/lib/matching/formula-comparison`)가 쓴다 ─────────────

/**
 * 쌍을 뽑는 **시나리오.** 어느 것도 「그」 모집단이 아니다.
 *
 * `randomInputs` 를 둘씩 짝지으면 두 사람이 1900~2100 에서 따로 뽑혀 나이 차가 평균 수십 년이다 —
 * 년주 · 띠 관계와 오행 분포가 실제 짝과 다르다. 제품의 매칭에는 **나이 조건이 없으므로**
 * (`docs/prd.md` §6.1 「조건은 성별 하나다. 나이는 없다」) 실제 쌍의 나이 차는 사용자 구성에 달렸고,
 * 우리는 그 구성을 모른다. 그래서 하나를 고르지 않고 여섯을 나란히 둔다. 수는 전부 **가설**이다.
 *
 * - `adults` — 지금 제품: 나이 조건 없이 성인 둘을 따로 뽑는다. 평가일 2026-09-25 에 만 19~60 세.
 * - `romantic-5` · `romantic-10` — 연인 민감도: B 의 만 나이가 A ± 5 · ± 10 년 안(고르게, 성인 범위 안).
 * - `same-decade` — 같은 연대(1960 · 70 · 80 · 90 · 2000 년대)에 태어난 성인 둘.
 * - `parent-child` — 자녀(만 0~40 세)와 부모: 나이 차 20~40 년(고르게).
 * - `independent` — 옛 `randomInputs` 그대로(1900~2100, 시 늘 앎, 성별 반반). 참고로만 둔다.
 */
export type PairScenario =
  | 'adults'
  | 'romantic-5'
  | 'romantic-10'
  | 'same-decade'
  | 'parent-child'
  | 'independent';

/** 시나리오의 가설 값 — 한 자리에 모은다. 바꾸면 비교기의 잠긴 수가 움직인다 */
export const PAIR_POPULATION_HYPOTHESES = {
  /** 나이를 재는 날 — 「성인」과 「만 나이」가 이 날 기준이다 */
  evaluationDate: { year: 2026, month: 9, day: 25 },
  /** 성인 풀의 만 나이 범위. 60 은 가입자 분포를 모르는 채로 고른 윗선이다 */
  adultAge: { min: 19, max: 60 },
  /**
   * 성인 풀의 나이 무게 — 한 살마다의 상대 빈도. 데이팅 · 운세 앱 사용자가 20 · 30 대에 몰린다는
   * 흔한 말을 옮긴 **가설**이다(우리 가입자 분포는 아직 잴 만큼 없다). 25~34 가 가장 두껍다.
   */
  adultAgeWeights: [
    { from: 19, to: 24, weight: 1 },
    { from: 25, to: 34, weight: 1.5 },
    { from: 35, to: 44, weight: 1 },
    { from: 45, to: 60, weight: 0.5 },
  ],
  /** 성별 조건이 있는 시나리오(부모 · 자녀 · 옛 표본 밖)에서 같은 성별 짝의 몫. 제품은 같은 성별 선택을 막지 않는다 */
  sameGenderShare: 0.1,
  /** 출생 시를 모르는 사람의 몫 — 한 사람마다 따로 뽑는다(`independent` 는 0) */
  hourUnknownShare: 0.2,
  /** 부모 · 자녀 시나리오: 자녀의 만 나이와 두 사람의 나이 차 */
  childAge: { min: 0, max: 40 },
  parentGap: { min: 20, max: 40 },
} as const;

const HYPOTHESES = PAIR_POPULATION_HYPOTHESES;

type Random = () => number;
type Gender = 'female' | 'male';

const pickIn = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));

/** 평가일에 만 `age` 세인 생일 하나 — 생일이 평가일 뒤면 한 해 먼저 태어났다 */
function birthdayAtAge(random: Random, age: number): { year: number; month: number; day: number } {
  const { year, month, day } = HYPOTHESES.evaluationDate;
  const birthMonth = pickIn(random, 1, 12);
  const birthDay = pickIn(random, 1, 28);
  const hadBirthday = birthMonth < month || (birthMonth === month && birthDay <= day);
  return { year: year - age - (hadBirthday ? 0 : 1), month: birthMonth, day: birthDay };
}

/** 평가일의 만 나이 */
export function ageOnEvaluationDate(input: Pick<SajuInput, 'year' | 'month' | 'day'>): number {
  const { year, month, day } = HYPOTHESES.evaluationDate;
  const hadBirthday = input.month < month || (input.month === month && input.day <= day);
  return year - input.year - (hadBirthday ? 0 : 1);
}

function adultAge(random: Random): number {
  const bands = HYPOTHESES.adultAgeWeights;
  const total = bands.reduce((sum, band) => sum + (band.to - band.from + 1) * band.weight, 0);
  let at = random() * total;
  for (const band of bands) {
    const mass = (band.to - band.from + 1) * band.weight;
    if (at < mass) return band.from + Math.floor(at / band.weight);
    at -= mass;
  }
  return HYPOTHESES.adultAge.max;
}

function personAt(random: Random, age: number, gender: Gender): SajuInput {
  const date = birthdayAtAge(random, age);
  const hour = pickIn(random, 0, 23);
  return random() < HYPOTHESES.hourUnknownShare
    ? { ...date, hour: null, gender }
    : { ...date, hour, minute: 0, second: 0, gender };
}

const anyGender = (random: Random): Gender => (random() < 0.5 ? 'female' : 'male');

/** 성별 조건이 있는 짝 — 대개 다른 성별, `sameGenderShare` 만큼 같은 성별 */
const partnerGender = (random: Random, gender: Gender): Gender =>
  random() < HYPOTHESES.sameGenderShare ? gender : gender === 'female' ? 'male' : 'female';

/** 성인 범위 안에서 `age ± spread` — 벗어나면 다시 뽑는다 */
function adultAgeNear(random: Random, age: number, spread: number): number {
  for (;;) {
    const near = age + pickIn(random, -spread, spread);
    if (near >= HYPOTHESES.adultAge.min && near <= HYPOTHESES.adultAge.max) return near;
  }
}

const decadeOf = (birthYear: number) => Math.floor(birthYear / 10);

/** `randomInputs` 의 한 사람 — 같은 규칙을 이 시나리오의 난수열에서 */
function independentPerson(random: Random): SajuInput {
  return {
    year: pickIn(random, 1900, 2100),
    month: pickIn(random, 1, 12),
    day: pickIn(random, 1, 28),
    hour: pickIn(random, 0, 23),
    minute: 0,
    second: 0,
    gender: anyGender(random),
  };
}

/**
 * 한 시나리오의 **첫 사람**(보는 쪽)과, 그 사람에게 붙는 **짝 하나**를 뽑는 두 함수.
 *
 * 쌍 표본은 둘을 이어 부르고, 한 사람의 후보 목록(보는 사람 × 후보 200)은 첫 사람을 한 번 뽑고
 * 짝을 여러 번 뽑는다 — 같은 가설이 두 표본에 같이 걸린다. `parent-child` 의 첫 사람은 자녀다.
 */
export function scenarioDraw(
  scenario: PairScenario,
  seed: number,
): { first: () => SajuInput; partnerOf: (first: SajuInput) => SajuInput } {
  const random = mulberry32(seed);
  const genderOf = (input: SajuInput): Gender => input.gender ?? anyGender(random);

  if (scenario === 'independent') {
    return { first: () => independentPerson(random), partnerOf: () => independentPerson(random) };
  }
  if (scenario === 'parent-child') {
    const { childAge, parentGap } = HYPOTHESES;
    return {
      first: () => personAt(random, pickIn(random, childAge.min, childAge.max), anyGender(random)),
      partnerOf: (child) =>
        personAt(
          random,
          ageOnEvaluationDate(child) + pickIn(random, parentGap.min, parentGap.max),
          anyGender(random),
        ),
    };
  }

  const partnerAge = (first: SajuInput): number =>
    scenario === 'romantic-5'
      ? adultAgeNear(random, ageOnEvaluationDate(first), 5)
      : scenario === 'romantic-10'
        ? adultAgeNear(random, ageOnEvaluationDate(first), 10)
        : adultAge(random);

  return {
    first: () => personAt(random, adultAge(random), anyGender(random)),
    partnerOf: (first) => {
      // 같은 연대는 뽑고 거른다 — 연대마다 성인 나이 무게가 그대로 걸리게
      for (;;) {
        const partner = personAt(random, partnerAge(first), partnerGender(random, genderOf(first)));
        if (scenario !== 'same-decade' || decadeOf(partner.year) === decadeOf(first.year)) {
          return partner;
        }
      }
    },
  };
}

/** 시나리오의 쌍 `count` 개 — 시드가 같으면 같은 쌍이다 */
export function scenarioPairs(
  scenario: PairScenario,
  count: number,
  seed = 20260925,
): (readonly [SajuInput, SajuInput])[] {
  const draw = scenarioDraw(scenario, seed);
  return Array.from({ length: count }, () => {
    const first = draw.first();
    return [first, draw.partnerOf(first)] as const;
  });
}
