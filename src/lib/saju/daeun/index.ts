import { STEM_INFO, pillarAt, type Pillar, type Stem } from '../constants';
import { InvalidSajuInputError, type Gender } from '../input';
import { tenGodOf, tenGodOfBranch, type TenGod } from '../analysis/tenGods';
import type { Pillars } from '../pillars';
import { findRelationsAmong, type LabeledPillars, type Relation } from '../relations';
import { twelveSpiritOf, type SpiritBasis, type TwelveSpirit } from '../sinsal';
import type { SolarTerm } from '../solarTerms';
import {
  DEFAULT_YIN_REVERSE,
  twelveStageOf,
  type TwelveStage,
  type TwelveStageOptions,
} from '../stages';

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
  /** 12운성 계통 — 세운·월운과 같은 값을 받아야 화면 안에서 갈리지 않는다 */
  stages?: TwelveStageOptions;
};

export const DEFAULT_DAEUN_OPTIONS = {
  rounding: 'round',
  zeroStartAge: 'keep',
  count: 9,
} as const satisfies Required<Omit<DaeunOptions, 'stages'>>;

/** 대운 한 칸의 계산판 이름 — 몇 번째인가로 가른다 */
export const daeunChartId = (index: number): string => `decade:${index}`;

/**
 * `index` 번째 대운의 간지 — **월주 자신은 대운이 아니다.**
 *
 * 순행은 한 칸 뒤, 역행은 한 칸 앞부터 시작한다. 60갑자 끝에서는 `pillarAt` 이
 * 되감으므로(甲子 역행 → 癸亥) 여기서 따로 나머지를 세지 않는다.
 *
 * `computeDaeun` 안에 두지 않고 꺼낸 이유가 있다. 대운 칸이 십성·운성·신살·관계를
 * 들게 되면서 `computeDaeun` 이 **명식 전체**를 요구하는데, 되감김을 보려면 월주를
 * 甲子 로 못박아야 하고 甲子월은 오호둔에서 나오지 않는 조합이다. 명식을 지어내
 * 확인하면 그 명식이 실재하지 않는다는 사실이 테스트에 남는다 —
 * `chartConstruction: 'unrealizable'` 로 세어 온 것과 같은 문제다. 간지 순서만
 * 따로 뽑아 쓰면 지어낼 것이 없다.
 *
 * @param index 몇 번째 대운인가 (1부터)
 */
export function daeunPillarAt(
  monthPillar: Pillar,
  direction: DaeunDirection,
  index: number,
): Pillar {
  const step = direction === 'forward' ? 1 : -1;
  return pillarAt(monthPillar.index + step * index);
}

const ROUNDINGS: readonly DaeunRounding[] = ['round', 'floor'];
const ZERO_POLICIES: readonly DaeunZeroPolicy[] = ['keep', 'raiseToOne'];

/** 대운 옵션도 조용히 흘려보내지 않는다 — 오타 하나로 다른 표가 나온다. */
function assertValidDaeunOptions(options: Required<Omit<DaeunOptions, 'stages'>>): void {
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

/**
 * 대운 한 칸 — **세운·월운 칸과 같은 모양이다.**
 *
 * 한동안 간지와 나이만 들고 있었다. 세운 칸이 십성·운성·신살·관계를 다 드는데
 * 대운 칸이 안 드는 것은 근거 있는 차이가 아니라 **먼저 만든 쪽이 뒤에 만든 쪽을
 * 못 따라간 것**이었고, 현재운이 "대운이 낀 관계는 아직 세지 않아 이 목록에
 * 없습니다"를 산문으로 고지하게 만들었다. 이제 셋이 같은 모양이다.
 */
export type DaeunEntry = {
  /** 몇 번째 대운인가 (1부터) */
  index: number;
  /** 관계 연산에서 이 칸을 가리키는 이름 — 'decade:4' */
  chartId: string;
  /** 이 대운이 시작되는 나이 — 출생일로부터의 경과 연수(만 나이) */
  startAge: number;
  /** 이 대운이 끝나는 나이 (다음 대운 시작 직전) */
  endAge: number;
  /** 시작 양력 연도 — 출생 연도 + `startAge` (생일 기준 근사) */
  startYear: number;
  pillar: Pillar;
  /** 일간에서 본 대운 천간·지지의 십성 */
  tenGods: { stem: TenGod; branch: TenGod };
  /** 일간이 대운 지지에서 어떤 상태인가 */
  stage: TwelveStage;
  /** 12신살 — 원국의 년지·일지 기준 각각 */
  spirits: Record<SpiritBasis, TwelveSpirit>;
  /**
   * 이 대운이 원국과 맺는 관계.
   *
   * **원국만 놓고 본다.** 월운이 원국·세운을 함께 놓고 보는 것과 갈리는데, 이유는
   * 규칙이 아니라 산술이다 — 대운 한 칸은 열 해라 **함께 놓을 세운이 하나가 아니다.**
   * 그래서 대운과 세운·월운 사이의 관계는 여기가 아니라 **좁은 쪽이 든다**
   * (`SaeunEntry.relations`·`WolunEntry.relations`). 한 해는 자기를 감싼 대운을
   * 가리킬 수 있고, 대운 한 칸은 자기가 감싼 열 해를 하나로 가리킬 수 없다.
   */
  relations: Relation[];
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
  /** 음간을 역행시켰는가 — 12운성이 어느 계통으로 나왔는지 */
  yinReverse: boolean;
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

/**
 * 대운을 뽑는 데 필요한 것.
 *
 * **명식 전체를 받는다.** 한동안 `yearStem`·`monthPillar`·`monthTerm`·`nextTerm` 네
 * 값을 따로 받았는데 넷 모두 `Pillars` 안에 이미 있었다 — 따로 받으면 서로 어긋난
 * 조합을 넘길 수 있고(연간과 월간이 오호둔에 맞지 않는 조합은 실재하지 않는다),
 * 칸마다 십성·신살·관계를 내려면 어차피 여덟 글자가 다 필요하다.
 */
export type DaeunInput = {
  pillars: Pillars;
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
  const { pillars, instant, birthYear, gender } = input;

  const yearStem: Stem = pillars.year.stem;
  const dayMaster: Stem = pillars.dayMaster;
  const direction = daeunDirectionOf(yearStem, gender);

  // 순행은 앞으로 올 절입까지, 역행은 지나온 절입까지의 거리를 잰다.
  const boundaryTerm =
    direction === 'forward' ? pillars.meta.nextTerm : pillars.meta.monthTerm;
  const daysToBoundary =
    Math.abs(boundaryTerm.date.getTime() - instant.getTime()) / DAY_MS;

  const startAgeExact = daysToBoundary / DAYS_PER_YEAR;
  const rounded = rounding === 'floor' ? Math.floor(startAgeExact) : Math.round(startAgeExact);
  const startAge = rounded === 0 && zeroStartAge === 'raiseToOne' ? 1 : rounded;

  const natal: LabeledPillars = { chartId: 'natal', pillars };

  const entries: DaeunEntry[] = Array.from({ length: count }, (_, i) => {
    const from = startAge + i * YEARS_PER_DAEUN;
    const index = i + 1;
    const pillar = daeunPillarAt(pillars.month, direction, index);
    const chartId = daeunChartId(index);

    // 대운도 기둥이 하나뿐이다. 자리는 월주에서 옮긴 것이라 'month' 로 적는다 —
    // 자리 이름은 판 안에서만 뜻이 있고 판을 가르는 것은 `chartId` 다(원국 년주와
    // 세운 년주가 둘 다 'year' 인 것과 같다).
    const decade: LabeledPillars = {
      chartId,
      pillars: { year: null, month: pillar, day: null, hour: null },
    };

    return {
      index,
      chartId,
      startAge: from,
      endAge: from + YEARS_PER_DAEUN - 1,
      startYear: birthYear + from,
      pillar,
      tenGods: {
        stem: tenGodOf(dayMaster, pillar.stem),
        branch: tenGodOfBranch(dayMaster, pillar.branch),
      },
      stage: twelveStageOf(dayMaster, pillar.branch, options.stages),
      spirits: {
        year: twelveSpiritOf(pillars.year.branch, pillar.branch),
        day: twelveSpiritOf(pillars.day.branch, pillar.branch),
      },
      // 이 대운이 낀 것만. 원국 안에서 닫힌 관계는 칸마다 같으므로 뺀다.
      relations: findRelationsAmong([natal, decade]).filter((relation) =>
        relation.participants.some((participant) => participant.chartId === chartId),
      ),
    } satisfies DaeunEntry;
  });

  return {
    direction,
    directionReason: directionReasonOf(yearStem, gender, direction),
    boundaryTerm,
    daysToBoundary,
    startAge,
    startAgeExact,
    entries,
    yinReverse: options.stages?.yinReverse ?? DEFAULT_YIN_REVERSE,
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

/**
 * 대운을 못 짚는 두 가지 이유 — **성질이 다르다.**
 *
 * 앞은 이 사람에 대한 사실이고 뒤는 우리가 뽑은 칸 수의 한계다. 하나로 묶으면
 * 우리 표의 한계를 그 사람의 사실인 것처럼 말하게 된다.
 */
export type DaeunAbsence =
  /** 첫 대운이 아직 오지 않았다. 대운수가 7이면 만 6세까지는 대운이 없다 */
  | 'before-first'
  /** 대운 표가 짧아 그 나이가 표 밖이다 — `DaeunOptions.count`(기본 9칸)의 한계다 */
  | 'beyond-table';

/**
 * 나이 구간에 걸친 대운 칸들 — **하나가 아닐 수 있다.**
 *
 * `daeunAtAge` 는 한 순간을 묻고 이쪽은 한 구간을 묻는다. 세운 한 해는 입춘에서
 * 입춘까지라 생일을 반드시 한 번 넘고, 그래서 **언제나 두 나이에 걸친다**
 * (`ageAtStart`·`ageAtEnd`). 그 두 나이가 대운 경계를 사이에 두면 한 해가 두
 * 대운에 걸린다 — 열 해에 한 번꼴이라 드물지 않다.
 *
 * 걸친 것을 하나로 반올림하지 않는다. 어느 쪽을 고르든 그 해의 절반은 틀린
 * 대운과 견주게 되고, 틀렸다는 사실이 값 어디에도 남지 않는다.
 */
export function daeunSpanningAges(
  daeun: Daeun,
  fromAge: number,
  toAge: number,
): DaeunEntry[] {
  return daeun.entries.filter(
    (entry) => entry.startAge <= toAge && fromAge < entry.startAge + YEARS_PER_DAEUN,
  );
}

/**
 * 어느 대운이 이 구간을 덮는가 — **칸을 통째로 싣지 않는다.**
 *
 * `DaeunEntry` 를 그대로 끼워 넣으면 그 안의 관계·십성·신살이 세운 칸마다 한 벌씩
 * 복사되어 밖으로 나가는 자료가 부풀고, 같은 값이 두 곳에 있어 언젠가 어긋난다.
 * 가리키는 이름(`chartId`)과 덮는 구간만 남기고 나머지는 대운 표에서 찾는다.
 */
export type DaeunSpan = {
  /** 관계 연산에서 이 칸을 가리키는 이름 — 'decade:4' */
  chartId: string;
  index: number;
  /** 이 구간 안에서 이 대운이 덮는 만 나이 */
  fromAge: number;
  toAge: number;
};

/**
 * 세운·월운 칸이 자기를 감싼 대운과 맺는 관계.
 *
 * **좁은 쪽이 넓은 쪽을 든다.** 월운이 세운을 함께 놓고 보는 것과 같은 방향이고,
 * 대운 칸이 이것을 들 수 없는 이유는 위(`DaeunEntry.relations`)에 적었다.
 *
 * 이미 놓인 판(`context` — 세운이면 원국, 월운이면 원국·세운)을 함께 넘겨받아
 * **세 글자 구조까지 본다.** 원국의 亥와 대운의 卯와 세운의 未가 만나 木局이 서는
 * 것은 두 판만 놓고는 영영 안 보인다.
 *
 * 걸린 대운이 둘이면 판마다 따로 센다. 둘을 한 번에 놓으면 **동시에 있지 않은 두
 * 대운 사이의 관계**가 생겨 버린다 — 3대운과 4대운은 서로 만나는 일이 없다.
 */
export function daeunCrossingsOf(
  daeun: Daeun,
  ages: { fromAge: number; toAge: number },
  context: readonly LabeledPillars[],
  own: LabeledPillars,
): { spans: DaeunSpan[]; relations: Relation[]; absence: DaeunAbsence | null } {
  const entries = daeunSpanningAges(daeun, ages.fromAge, ages.toAge);

  const spans = entries.map((entry) => ({
    chartId: entry.chartId,
    index: entry.index,
    fromAge: Math.max(entry.startAge, ages.fromAge),
    toAge: Math.min(entry.endAge, ages.toAge),
  }));

  const relations = entries.flatMap((entry) => {
    // 대운도 기둥이 하나뿐이다 — 대운 표를 뽑을 때와 같은 자리('month')를 쓴다.
    const decade: LabeledPillars = {
      chartId: entry.chartId,
      pillars: { year: null, month: entry.pillar, day: null, hour: null },
    };

    // 이 칸과 그 대운이 **둘 다** 낀 것만. 한쪽만 낀 것은 이미 다른 곳에 있다 —
    // 원국↔대운은 대운 칸이, 원국↔세운은 세운 칸이 벌써 들고 있다.
    return findRelationsAmong([...context, decade, own]).filter(
      (relation) =>
        relation.participants.some((p) => p.chartId === own.chartId) &&
        relation.participants.some((p) => p.chartId === entry.chartId),
    );
  });

  return {
    spans,
    relations,
    absence:
      spans.length > 0
        ? null
        : ages.toAge < daeun.entries[0].startAge
          ? 'before-first'
          : 'beyond-table',
  };
}
