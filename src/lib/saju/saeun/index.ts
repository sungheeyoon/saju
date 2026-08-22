import type { Pillar, Stem } from '../constants';
import { ageOnDate, koreaDateOf } from '../age';
import type { CivilDate } from '../civilTime';
import type { Pillars } from '../pillars';
import { yearPillarOf } from '../pillars/year';
import {
  daeunCrossingsOf,
  type Daeun,
  type DaeunAbsence,
  type DaeunSpan,
} from '../daeun';
import { findRelationsAmong, type LabeledPillars, type Relation } from '../relations';
import { getSolarTerms, type SolarTerm } from '../solarTerms';
import { twelveSpiritOf, type SpiritBasis, type TwelveSpirit } from '../sinsal';
import { tenGodOf, tenGodOfBranch, type TenGod } from '../analysis/tenGods';
import {
  DEFAULT_YIN_REVERSE,
  twelveStageOf,
  type TwelveStage,
  type TwelveStageOptions,
} from '../stages';

/**
 * 세운(歲運) — 한 해의 간지.
 *
 * 대운이 십 년마다 갈아입는 옷이라면 세운은 한 해짜리다. 대운과 달리 성별로
 * 갈리지 않고 방향도 없다 — 그냥 그 해의 연주이므로 누구에게나 같다.
 * 갈리는 것은 그것이 **내 원국과 무엇을 하는가**뿐이다.
 *
 * **해의 경계는 입춘이다.** 1월 1일도 설날도 아니다. 2027년 1월에 태어난
 * 사람의 세운은 2026년(丙午)이지 2027년(丁未)이 아니다. 이미 연주 도출이
 * 그렇게 하고 있으므로(`yearPillarOf`) 같은 함수를 그대로 쓴다. 세운만
 * 따로 세면 언젠가 연주와 어긋난다.
 *
 * 세운은 기둥이 하나뿐이라 자리를 `'year'` 로 적는다 — 연간지라서다.
 * 원국의 년주와 구별되는 것은 `chartId`(`'annual:2027'`)다.
 *
 * 관계는 **원국과 그 해를 감싼 대운을 함께** 놓고 본다. 월운이 원국·세운을 함께
 * 놓는 것과 같은 방향이다 — 좁은 쪽이 넓은 쪽을 든다. 대운 칸이 반대로 못 드는
 * 이유는 산술이다(`DaeunEntry.relations`).
 */

/** 세운 한 해 */
export type SaeunEntry = {
  /** 입춘으로 판정한 사주년 */
  year: number;
  /** 관계 연산에서 이 해를 가리키는 이름 — 'annual:2027' */
  chartId: string;
  pillar: Pillar;
  /** @deprecated 세운 전체의 나이는 하나가 아니다. `ageAtStart`를 쓴다 */
  age: number;
  /** 이 세운이 시작되는 입춘 당일의 만 나이 */
  ageAtStart: number;
  /** 다음 입춘 직전의 만 나이 */
  ageAtEnd: number;
  /** 이 해가 시작되는 입춘 */
  startTerm: SolarTerm;
  /** 다음 세운이 시작되는 입춘 */
  nextStartTerm: SolarTerm;
  /** 일간에서 본 세운 천간·지지의 십성 */
  tenGods: { stem: TenGod; branch: TenGod };
  /** 일간이 세운 지지에서 어떤 상태인가 */
  stage: TwelveStage;
  /** 12신살 — 원국의 년지·일지 기준 각각 */
  spirits: Record<SpiritBasis, TwelveSpirit>;
  /**
   * 이 해가 원국·대운과 맺는 관계.
   *
   * 원국 안에서만 성립하는 관계는 빼고, 세운이 실제로 끼어든 것만 담는다 —
   * 원국 내부 관계는 `Saju.relations` 에 이미 있고 해마다 같다. 원국과 대운
   * 사이의 관계도 뺀다. 그쪽은 그 해가 없어도 성립하므로 대운 칸의 몫이다.
   *
   * 어느 판의 글자인지는 `participants[].chartId` 가 든다 — `'natal'`·`'annual:2027'`·
   * `'decade:4'`.
   */
  relations: Relation[];
  /**
   * 이 해에 걸친 대운 — **하나가 아닐 수 있다.**
   *
   * 한 해는 입춘에서 입춘까지라 생일을 반드시 한 번 넘고, 그 두 나이가 대운
   * 경계를 사이에 두면 한 해가 두 대운에 걸린다. 위 `relations` 는 걸린 대운
   * **전부**와 견준 결과라, 어느 대운과 걸린 것인지는 이 목록과 맞춰 읽는다.
   */
  daeunSpans: readonly DaeunSpan[];
  /**
   * 걸친 대운이 없으면 그 이유 — **둘을 가른다.**
   *
   * `before-first` 는 이 사람에 대한 사실이고 `beyond-table` 은 우리가 뽑은 칸
   * 수의 한계다. 비었다는 것만 남기면 남의 한계가 그 사람의 사실처럼 읽힌다.
   */
  daeunAbsence: DaeunAbsence | null;
};

export type Saeun = {
  entries: SaeunEntry[];
  /** 음간을 역행시켰는가 — 12운성이 어느 계통으로 나왔는지 */
  yinReverse: boolean;
};

export type SaeunOptions = {
  /** 몇 해부터. 기본은 출생한 사주년 */
  fromYear?: number;
  /** 몇 해치. 기본 10 */
  count?: number;
  stages?: TwelveStageOptions;
};

export const DEFAULT_SAEUN_COUNT = 10;

/** 세운 한 해의 계산판 이름 */
export const saeunChartId = (year: number): string => `annual:${year}`;

export class InvalidSaeunRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSaeunRangeError';
  }
}

type SaeunInput = {
  pillars: Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'>;
  /** 출생 시각이 속한 사주년 — 기본 세운 시작 */
  birthSajuYear: number;
  /** 세운 구간 안에서 생일 전후의 실제 만 나이를 계산한다 */
  birthDate: CivilDate;
  /**
   * 그 해를 감싼 대운을 찾을 표.
   *
   * **선택값으로 두지 않는다.** 잊으면 대운과 걸리는 관계가 조용히 사라지는데,
   * 사라진 자리에 아무 표시도 남지 않아 「없다」와 구별되지 않는다.
   */
  daeun: Daeun;
};

/**
 * 그 사주년이 시작되는 입춘.
 *
 * 간지는 `yearPillarOf` 가 사주년 번호에서 곧장 낸다. 입춘 시각은 "이 세운이
 * 언제부터인가"를 화면에 적기 위해 따로 구한다 — 1월 20일에 일어난 일은
 * 아직 전 해의 세운이라는 것이 세운에서 가장 자주 틀리는 지점이다.
 */
function startTermOf(year: number): SolarTerm {
  const found = getSolarTerms(year).find((term) => term.name === '입춘');
  if (!found) {
    throw new InvalidSaeunRangeError(`${year}년의 입춘을 구할 수 없습니다`);
  }
  return found;
}

export function computeSaeun(input: SaeunInput, options: SaeunOptions = {}): Saeun {
  const { pillars, birthSajuYear, birthDate } = input;
  const from = options.fromYear ?? birthSajuYear;
  const count = options.count ?? DEFAULT_SAEUN_COUNT;

  if (!Number.isInteger(count) || count < 1) {
    throw new InvalidSaeunRangeError(`세운 개수는 1 이상의 정수여야 합니다: ${count}`);
  }
  if (!Number.isInteger(from)) {
    throw new InvalidSaeunRangeError(`시작 연도는 정수여야 합니다: ${from}`);
  }

  const dayMaster: Stem = pillars.dayMaster;
  const natal: LabeledPillars = { chartId: 'natal', pillars };
  const { daeun } = input;

  const entries = Array.from({ length: count }, (_, index) => {
    const year = from + index;
    const pillar = yearPillarOf(year);
    const startTerm = startTermOf(year);
    const nextStartTerm = startTermOf(year + 1);
    const chartId = saeunChartId(year);
    const ageAtStart = ageOnDate(birthDate, koreaDateOf(startTerm.date));
    const ageAtEnd = ageOnDate(
      birthDate,
      koreaDateOf(new Date(nextStartTerm.date.getTime() - 1)),
    );

    // 세운은 기둥이 하나뿐이다. 나머지 세 자리는 비워 둔다 — 없는 글자로
    // 관계를 만들지 않는 것은 시간 미상 시주와 같은 규칙이다.
    const annual: LabeledPillars = {
      chartId,
      pillars: { year: pillar, month: null, day: null, hour: null },
    };

    // 이 해를 감싼 대운과 견준다. 원국을 함께 넘기므로 원국·대운·세운 세 판에
    // 걸쳐 서는 삼합·방합까지 잡힌다 — 두 판만 놓고는 안 보이는 것들이다.
    const crossing = daeunCrossingsOf(
      daeun,
      { fromAge: ageAtStart, toAge: ageAtEnd },
      [natal],
      annual,
    );

    return {
      year,
      chartId,
      pillar,
      age: ageAtStart,
      ageAtStart,
      ageAtEnd,
      startTerm,
      nextStartTerm,
      tenGods: {
        stem: tenGodOf(dayMaster, pillar.stem),
        branch: tenGodOfBranch(dayMaster, pillar.branch),
      },
      stage: twelveStageOf(dayMaster, pillar.branch, options.stages),
      spirits: {
        year: twelveSpiritOf(pillars.year.branch, pillar.branch),
        day: twelveSpiritOf(pillars.day.branch, pillar.branch),
      },
      // 세운이 낀 것만. 원국 안에서만 닫힌 관계는 해마다 같으므로 뺀다.
      // 대운과 걸리는 것은 따로 세어 뒤에 붙인다 — 넓은 것부터 좁은 것 순서다.
      relations: [
        ...findRelationsAmong([natal, annual]).filter((relation) =>
          relation.participants.some((participant) => participant.chartId === chartId),
        ),
        ...crossing.relations,
      ],
      daeunSpans: crossing.spans,
      daeunAbsence: crossing.absence,
    } satisfies SaeunEntry;
  });

  return { entries, yinReverse: options.stages?.yinReverse ?? DEFAULT_YIN_REVERSE };
}
