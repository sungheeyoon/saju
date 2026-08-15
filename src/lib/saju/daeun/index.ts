import { STEM_INFO, pillarAt, type Pillar, type Stem } from '../constants';
import { InvalidSajuInputError, type Gender } from '../input';
import type { SolarTerm } from '../solarTerms';

/**
 * 대운(大運) — 10년씩 갈아입는 운의 간지.
 *
 * 사주 여덟 글자가 타고난 판이라면, 대운은 그 판이 놓이는 시기다. 월주에서
 * 출발해 60갑자를 한 칸씩 밟아 나가며, 한 칸이 10년을 맡는다.
 *
 * 세 가지를 정해야 한다.
 *   1. 방향   순행인가 역행인가        — 연간의 음양 × 성별
 *   2. 대운수 첫 대운이 몇 살에 오는가 — 절입까지의 거리 ÷ 3
 *   3. 간지   월주에서 그 방향으로 전진
 *
 * L1(만세력)에서 성별이 쓰이는 곳은 여기 하나뿐이다. 여덟 글자 자체는
 * 성별과 무관하다.
 */

export type DaeunDirection = 'forward' | 'backward';

export const DAEUN_DIRECTION_KO: Record<DaeunDirection, string> = {
  forward: '순행',
  backward: '역행',
};

/**
 * 대운수 계산에서 하루가 몇 년인가.
 *
 * 절입까지의 사흘을 한 해로 친다. 태양이 한 절기 구간(약 30일)을 지나는 것을
 * 한 대운(10년)에 대응시킨 비례이고, 그래서 3일 = 1년, 하루 = 4개월이 된다.
 */
export const DAYS_PER_YEAR = 3;

/** 대운 한 칸이 맡는 햇수 */
export const YEARS_PER_DAEUN = 10;

const DAY_MS = 86_400_000;

/**
 * 대운수를 정수로 만드는 방식 — 계통마다 다르다.
 *
 * - `'round'` 반올림. 나머지 2일이면 한 해를 채운 것으로 본다.
 * - `'floor'` 버림. 아직 오지 않은 해로 치지 않는다.
 *
 * 어느 쪽도 표준이 아니라서 옵션으로 둔다. 정확한 값은 `startAgeExact` 로
 * 함께 돌려주므로, 다른 방식이 필요하면 그 값에서 다시 만들면 된다.
 */
export type DaeunRounding = 'round' | 'floor';

/**
 * 대운수가 0으로 떨어질 때의 처리.
 *
 * - `'keep'` 0을 그대로 둔다. 이 프로젝트의 나이는 **만 나이(경과 연수)**라
 *   0이 성립한다 — 절입 직전에 태어나면 첫 대운이 사실상 출생과 함께 온다.
 * - `'raiseToOne'` 1로 올린다. "0이라는 나이는 없다"며 1로 적는 표가 흔한데,
 *   그것은 0세가 없는 세는나이 표기의 관행이다.
 *
 * 기본이 `'keep'` 인 이유: 우리가 만 나이로 적는다고 밝힌 이상, 0을 1로 올리면
 * 첫 대운을 한 해 늦게 말하는 셈이 된다. 세는나이 표기의 만세력과 맞춰볼 때만
 * 바꾸면 된다.
 */
export type DaeunZeroPolicy = 'keep' | 'raiseToOne';

export type DaeunOptions = {
  rounding?: DaeunRounding;
  zeroStartAge?: DaeunZeroPolicy;
  /** 뽑을 대운 개수 (기본 9 — 90년치) */
  count?: number;
};

export const DEFAULT_DAEUN_OPTIONS = {
  rounding: 'round',
  zeroStartAge: 'keep',
  count: 9,
} as const satisfies Required<DaeunOptions>;

const ROUNDINGS: readonly DaeunRounding[] = ['round', 'floor'];
const ZERO_POLICIES: readonly DaeunZeroPolicy[] = ['keep', 'raiseToOne'];

/** 대운 옵션도 조용히 흘려보내지 않는다 — 오타 하나로 다른 표가 나온다. */
function assertValidDaeunOptions(options: Required<DaeunOptions>): void {
  if (!ROUNDINGS.includes(options.rounding)) {
    throw new InvalidSajuInputError(
      'daeun',
      options.rounding,
      `rounding 은 'round' 또는 'floor' 여야 합니다: ${String(options.rounding)}`,
    );
  }
  if (!ZERO_POLICIES.includes(options.zeroStartAge)) {
    throw new InvalidSajuInputError(
      'daeun',
      options.zeroStartAge,
      `zeroStartAge 는 'keep' 또는 'raiseToOne' 이어야 합니다: ${String(options.zeroStartAge)}`,
    );
  }
  if (!Number.isInteger(options.count) || options.count < 1) {
    // 0이나 음수를 넘기면 빈 표가 조용히 나온다.
    throw new InvalidSajuInputError(
      'daeun',
      options.count,
      `count 는 1 이상의 정수여야 합니다: ${String(options.count)}`,
    );
  }
}

export type DaeunEntry = {
  /** 몇 번째 대운인가 (1부터) */
  index: number;
  /** 이 대운이 시작되는 나이 — 출생일로부터의 경과 연수(만 나이) */
  startAge: number;
  /** 이 대운이 끝나는 나이 (다음 대운 시작 직전) */
  endAge: number;
  /** 시작 양력 연도 — 출생 연도 + `startAge` (생일 기준 근사) */
  startYear: number;
  pillar: Pillar;
};

export type Daeun = {
  direction: DaeunDirection;
  /** 방향을 그렇게 정한 근거 — 화면에 그대로 쓸 수 있는 문장 */
  directionReason: string;
  /** 거리를 잰 절기. 순행이면 다음 절입, 역행이면 직전 절입 */
  boundaryTerm: SolarTerm;
  /** 그 절입까지의 거리(일). 소수점 그대로 */
  daysToBoundary: number;
  /** 대운수 — 첫 대운이 시작되는 나이(정수, 만 나이) */
  startAge: number;
  /** 반올림하기 전의 값(년). 계통이 다르면 여기서 다시 만들면 된다 */
  startAgeExact: number;
  entries: DaeunEntry[];
  /**
   * 출생 시각을 몰라 정오로 계산했는가.
   *
   * `true` 면 대운수가 최대 ±0.5일 ÷ 3 ≈ ±2개월 흔들리고, 반올림 경계에
   * 걸리면 한 살 차이로 나타난다.
   *
   * 출생일이 절입일이기까지 하면 흔들리는 것이 대운수만이 아니다. 월주 자체가
   * 갈리므로 첫 대운의 간지와 거리를 재는 절기가 통째로 달라진다. 그 경우는
   * `Saju.meta.warnings` 가 "월주를 확정할 수 없다"고 따로 알린다.
   */
  approximate: boolean;
};

export type DaeunInput = {
  /** 사주년의 천간 — 방향을 정한다 */
  yearStem: Stem;
  /** 대운의 출발점 */
  monthPillar: Pillar;
  /** 출생이 속한 절기 구간 */
  monthTerm: SolarTerm;
  nextTerm: SolarTerm;
  /** 출생의 절대 시각 */
  instant: Date;
  /** 출생 양력 연도 — 대운 시작 연도를 셀 기준 */
  birthYear: number;
  gender: Gender;
  /** 시각을 모르고 정오로 계산했는가 */
  approximate?: boolean;
};

/**
 * 대운의 방향 — 양남음녀 순행, 음남양녀 역행.
 *
 * 연간이 양간인 남자와 음간인 여자는 절기를 따라 앞으로 가고, 나머지는
 * 거슬러 올라간다. 즉 "연간의 음양"과 "성별"이 같은 편이면 순행이다.
 */
export function daeunDirectionOf(yearStem: Stem, gender: Gender): DaeunDirection {
  const yang = STEM_INFO[yearStem].yinYang === '陽';
  const male = gender === 'male';
  return yang === male ? 'forward' : 'backward';
}

function directionReasonOf(yearStem: Stem, gender: Gender, direction: DaeunDirection): string {
  const yang = STEM_INFO[yearStem].yinYang === '陽';
  return `연간 ${yearStem}(${STEM_INFO[yearStem].ko})이 ${yang ? '양간' : '음간'}이고 ${
    gender === 'male' ? '남자' : '여자'
  }라 ${DAEUN_DIRECTION_KO[direction]}합니다.`;
}

/**
 * 대운을 도출한다.
 *
 * 대운수는 절입까지의 **절대 시각** 거리로 잰다. 경도·균시차 보정은 시주를
 * 읽는 시계만 옮길 뿐 절대 시각을 옮기지 않으므로, 여기에는 영향이 없다.
 */
export function computeDaeun(input: DaeunInput, options: DaeunOptions = {}): Daeun {
  const resolved = { ...DEFAULT_DAEUN_OPTIONS, ...options };
  assertValidDaeunOptions(resolved);

  const { rounding, zeroStartAge, count } = resolved;
  const { yearStem, monthPillar, monthTerm, nextTerm, instant, birthYear, gender } = input;

  const direction = daeunDirectionOf(yearStem, gender);

  // 순행은 앞으로 올 절입까지, 역행은 지나온 절입까지의 거리를 잰다.
  const boundaryTerm = direction === 'forward' ? nextTerm : monthTerm;
  const daysToBoundary =
    Math.abs(boundaryTerm.date.getTime() - instant.getTime()) / DAY_MS;

  const startAgeExact = daysToBoundary / DAYS_PER_YEAR;
  const rounded = rounding === 'floor' ? Math.floor(startAgeExact) : Math.round(startAgeExact);
  const startAge = rounded === 0 && zeroStartAge === 'raiseToOne' ? 1 : rounded;

  const step = direction === 'forward' ? 1 : -1;

  const entries: DaeunEntry[] = Array.from({ length: count }, (_, i) => {
    const from = startAge + i * YEARS_PER_DAEUN;
    return {
      index: i + 1,
      startAge: from,
      endAge: from + YEARS_PER_DAEUN - 1,
      startYear: birthYear + from,
      // 월주 자신은 대운이 아니다. 한 칸 옮긴 자리가 첫 대운이다.
      pillar: pillarAt(monthPillar.index + step * (i + 1)),
    };
  });

  return {
    direction,
    directionReason: directionReasonOf(yearStem, gender, direction),
    boundaryTerm,
    daysToBoundary,
    startAge,
    startAgeExact,
    entries,
    approximate: input.approximate ?? false,
  };
}

/**
 * 주어진 나이에 해당하는 대운. 첫 대운 이전이거나 마지막 대운 이후면 `null`.
 *
 * 구간은 반열림(`startAge` 이상, 다음 대운 시작 미만)이다. `endAge` 로 닫으면
 * 만 16.5세처럼 해를 반쯤 지난 나이가 어느 대운에도 속하지 않게 된다 —
 * `endAge` 는 "마지막으로 온전히 지나는 해"를 적어 보여주기 위한 값이다.
 */
export function daeunAtAge(daeun: Daeun, age: number): DaeunEntry | null {
  return (
    daeun.entries.find(
      (entry) => age >= entry.startAge && age < entry.startAge + YEARS_PER_DAEUN,
    ) ?? null
  );
}
