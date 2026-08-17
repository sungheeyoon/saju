import { ageOnDate, koreaDateOf } from '../age';
import { BRANCH_INFO } from '../constants';
import type { CivilDate, CivilDateTime } from '../civilTime';
import { daeunAtAge, type DaeunEntry } from '../daeun';
import type { Saju } from '../index';
import { findMonthTerm } from '../pillars/month';
import type { Relation } from '../relations';
import { computeSaeun, type SaeunEntry } from '../saeun';
import type { SolarTerm } from '../solarTerms';
import { computeWolun, type WolunEntry } from '../wolun';

/**
 * 현재운 — **지금 이 순간의 대운·세운·월운.**
 *
 * 세운·월운·대운은 이미 표로 다 있었다. 없던 것은 "그중 어느 칸이 지금인가"이고,
 * 그것은 여덟 글자에서 나오지 않는다 — **보는 시각**에서 나온다. 이 모듈이 그
 * 하나를 더한다.
 *
 * ## 시계가 하나 더 생긴다
 *
 * L1 에 시계가 둘 있다. 절기(연주·월주)는 절대 시각으로 읽고 일주·시주는 보정된
 * 지방시로 읽는다. 둘은 **태어난 순간**을 두 방식으로 읽은 것이다. 여기서 세
 * 번째가 붙는데, 앞의 둘과 종류가 다르다 — 읽는 방식이 아니라 **읽는 순간**이
 * 다르다. 그래서 셋이 각자 다른 경계를 본다.
 *
 * | 무엇이 갈리는가 | 무엇으로 재는가 |
 * | --- | --- |
 * | 세운 | 입춘 — **절대 시각** 비교 |
 * | 월운 | 절입 열둘 — **절대 시각** 비교 |
 * | 대운 | 만 나이 — **한국 달력 날짜** 비교 |
 *
 * 대운만 달력으로 재는 것은 대운 칸의 경계가 정수 나이(`DaeunEntry.startAge`)라서다.
 * 절대 시각의 차이를 365.25 로 나누면 생일 당일이 하루 어긋나고, 그 하루가 경계에
 * 걸리면 어느 대운 안에 있는지가 뒤집힌다.
 *
 * ## 지금을 엔진이 스스로 묻지 않는다
 *
 * `Date.now()` 를 이 파일 안에서 부르지 않는다. 이유가 둘이고 둘 다 무겁다.
 *
 * 1. **순수 함수가 아니게 된다.** 같은 입력에 같은 답이 나오지 않으면 골든
 *    스냅샷을 찍을 수 없고, 이 저장소에서 규칙이 지켜지는 방법이 골든이다.
 * 2. **하이드레이션이 깨진다.** 결과 페이지는 빌드 때 미리 그려지므로 서버에서
 *    센 '지금'과 브라우저에서 센 '지금'이 다르다. `DEFAULT_QUERY.saeunFrom` 이
 *    연도를 하드코딩하고 있는 이유가 정확히 이것이다.
 *
 * 그래서 `viewedAt` 은 성별처럼 **넘겨받는 값**이다. 화면이 클라이언트에서 한 번
 * 정해 넘기고, 넘기지 않으면 현재운은 아예 없다. 정오를 채워 넣지 않는 것과 같은
 * 규율이다 — 모르는 것을 아는 것처럼 만들지 않는다.
 *
 * ## 아무것도 새로 세지 않는다
 *
 * 간지도, 절입도, 관계도 여기서 계산하지 않는다. `computeSaeun`·`computeWolun`·
 * `daeunAtAge` 가 이미 하는 일을 부르기만 한다. 따로 세면 표의 칸과 현재운 카드가
 * 어긋나고, 어긋난 날 어느 쪽이 맞는지 알 방법이 없다.
 *
 * 그래서 관계도 **옮겨 담기만 한다**(`RESTATED_RELATIONS`). 세운 칸이 원국과의
 * 관계를, 월운 칸이 원국·세운과의 관계를 이미 낸다. **대운의 관계는 아무도 세지
 * 않으므로 여기에도 없다** — `UNCOVERED_NOW_FACTS` 가 그것을 값으로 든다.
 */

/** 지금 대운을 못 짚는 두 가지 이유 — 성질이 다르다 */
export type DaeunAbsence =
  /**
   * 첫 대운이 아직 오지 않았다. **이 사람에 대한 사실이다** — 대운수가 7이면
   * 만 6세까지는 대운이 없다.
   */
  | 'before-first'
  /**
   * 대운 표가 짧아 지금이 그 밖이다. **이 사람에 대한 사실이 아니라 우리가 뽑은
   * 칸 수(`DaeunOptions.count`, 기본 9칸 = 90년)의 한계다.** 그래서 문장이 아니라
   * 화면·정책이 들 몫이고, 발화하지 않는다.
   */
  | 'beyond-table';

export type CurrentFortune = {
  /**
   * 이 값을 낸 기준 시각 — **문장이 이것을 슬롯으로 든다.**
   *
   * 들고 있어야 하는 이유는 링크 때문이다. 결과 화면은 주소로 나눠 줄 수 있고
   * (`app/query.ts`), 받은 사람이 내일 열면 '지금'이 다른 지금이다. 문장이 기준
   * 시각을 적지 않으면 어제 찍은 스크린샷이 오늘의 운인 것처럼 읽힌다.
   */
  viewedAt: Date;
  /**
   * 그 시각의 한국 달력 시각 — 날짜만이 아니다.
   *
   * 절입일에는 **시각이 달을 가른다.** 경칩 당일 아침은 인월이고 저녁은 묘월이라,
   * 문장이 날짜만 적으면 같은 날짜에 두 답이 있는 것처럼 보인다.
   */
  viewedOn: CivilDateTime;
  /** 그 시각의 만 나이 */
  age: number;
  /** 그 시각이 속한 사주년 — 입춘에서 갈린다 */
  sajuYear: number;
  /** 그 시각이 속한 절기 구간의 시작 절기 */
  monthTerm: SolarTerm;
  /**
   * 지금 도는 대운. 못 짚으면 `null` 이고 이유는 `daeunAbsence` 가 든다.
   *
   * 대운은 여덟 글자에서 곧장 세어지는 값이 **아니다.** 대운수는 절입까지의
   * 거리를 사흘에 한 살로 세어 정수로 만든 값이고, 정수화 방식(`DaeunRounding`)은
   * 어느 쪽도 표준이 아니라 옵션으로 두었다. 그래서 문장 상한이 세운·월운과
   * 갈린다(`CLAIM_CEILING.daeun`).
   */
  daeun: DaeunEntry | null;
  daeunAbsence: DaeunAbsence | null;
  /**
   * 첫 대운 — **아직 오지 않았을 때 무엇이 오는지 말하기 위한 것.**
   *
   * `saju.daeun.entries[0]` 을 옮겨 담기만 한다. L3 가 `Saju` 를 받지 않기로 했으니
   * (`findNowUtterances`) 이 한 칸이 여기 있어야 "만 2세인 지금은 첫 대운 丁巳
   * 앞이다" 를 말할 수 있다. 넘겨주지 않으면 문장 층이 `Saju` 를 다시 받게 되고,
   * 그 순간 화면의 운과 문장의 운이 갈릴 길이 열린다.
   */
  firstDaeun: DaeunEntry;
  /**
   * 대운수가 채워 넣은 정오에서 나왔는가.
   *
   * `Daeun.approximate` 를 그대로 옮긴다. `true` 면 대운수가 ±2개월쯤 흔들리고,
   * 반올림 경계에 걸리면 **지금이 어느 대운인지가 한 칸 어긋난다.** 그래서 대운이
   * 시주에 걸리는 근거가 되고(`HOUR_SENSITIVE_PATHS`) 세운·월운은 걸리지 않는다.
   */
  daeunApproximate: boolean;
  saeun: SaeunEntry;
  wolun: WolunEntry;
  /**
   * 지금의 대운·세운·월운이 원국과 맺는 관계 — **세 칸에서 옮겨 담기만 한다.**
   *
   * 대운 칸은 원국과의 관계를, 세운 칸도 원국과의 관계를, 월운 칸은 원국·세운과의
   * 관계를 이미 낸다. 여기서 `findRelationsAmong` 을 다시 부르면 같은 형충회합을 두
   * 곳에서 세는 것이 되고, 표의 관계 칸과 현재운 카드가 어긋나는 날 어느 쪽이
   * 맞는지 알 수 없다.
   *
   * **아직 없는 것은 운끼리의 관계다** — 대운↔세운, 대운↔월운. 어느 칸도 그것을
   * 세지 않으므로 여기에도 없고, `UNCOVERED_NOW_FACTS` 가 그것을 값으로 든다.
   */
  relations: Relation[];
  /** 원국을 시주까지 보고 셌는가 — 문장의 강도가 여기에 걸린다 */
  hourKnown: boolean;
};

/**
 * 관계를 어디서 가져오는지 — 값으로 적어 둔다.
 *
 * 역마·도화·화개를 신살 표에 적되 값은 12신살에서 옮겨 담기만 한 것과 같은
 * 표시다(`SINSAL_POLICY.travelPeachCanopy`). 나중에 여기서 직접 세고 싶어지면
 * 이 값이 먼저 걸린다.
 */
export const RESTATED_RELATIONS = 'restated-from-daeun-saeun-and-wolun' as const;

/**
 * 현재운이 아직 내지 않는 사실.
 *
 * `UNCOVERED_FACTS` 와 같은 구실이다 — 발화하지 않는 이유가 **고른 것이 아니라
 * 아무도 세지 않은 것**임을 값으로 남긴다.
 *
 * **한 줄이 지워졌고 좁아진 줄이 남았다.** 대운 칸이 관계·십성·운성·신살을 들게 되면서
 * 두 줄이 사라졌는데(`DaeunEntry`), 그 자리에서 더 좁은 공백이 드러났다 — 세 칸이 저마다
 * **원국과의** 관계를 낼 뿐 **운끼리는** 아무도 안 본다. 월운만 세운을 함께 놓고 보므로
 * 대운↔세운·대운↔월운이 비어 있다.
 *
 * 그것을 여기서 세지 않는 이유는 규칙이 아니라 산술이다. 대운 한 칸은 열 해라 함께 놓을
 * 세운이 하나가 아니므로 **대운 칸이 들 수 없고**, 세운 칸이 자기를 감싼 대운을 함께 놓는
 * 것이 맞는 모양이다(월운이 세운을 놓는 것과 같은 방향). 그것은 세운의 일이다.
 */
export const UNCOVERED_NOW_FACTS: readonly string[] = [
  'saeun × daeun (그 해를 감싼 대운과의 관계 — 월운이 세운을 놓는 것과 같은 방향인데 비어 있다)',
  'wolun × daeun (그 달을 감싼 대운과의 관계)',
  'stages · sinsal (세 칸이 이미 계산해 두었으나 주제가 없다)',
];

/**
 * 지금이 어느 대운·세운·월운인지 짚는다.
 *
 * `Saju` 를 통째로 받는다 — L2 분석이므로 원국 전체가 재료다(`analyzeCompatibility`
 * 와 같은 자리). 이 값을 먹는 L3 는 반대로 `Saju` 를 안 받고 `CurrentFortune` 만
 * 받는다. 문장이 다시 계산할 길을 열어 두면 화면의 운과 문장의 운이 언젠가 어긋난다.
 *
 * @param viewedAt 결과를 보는 절대 시각. 엔진은 이것을 스스로 묻지 않는다
 */
export function currentFortuneOf(saju: Saju, viewedAt: Date): CurrentFortune {
  const viewedOn = koreaDateOf(viewedAt);
  const { resolvedTime, hourKnown } = saju.meta;

  const birthDate: CivilDate = {
    year: resolvedTime.year,
    month: resolvedTime.month,
    day: resolvedTime.day,
  };

  const age = ageOnDate(birthDate, viewedOn);

  // 사주년과 절기 구간을 한 번에 얻는다. 월주 도출이 쓰는 그 함수라 세운의 해와
  // 월운의 달이 같은 곳에서 갈린다 — 입춘·절입을 여기서 다시 찾으면 그 둘이
  // 어긋날 수 있다.
  const { sajuYear, term: monthTerm } = findMonthTerm(viewedAt, viewedOn.year);

  const daeun = daeunAtAge(saju.daeun, age);
  const first = saju.daeun.entries[0];

  const saeun = saeunEntryOf(saju, sajuYear, birthDate);
  const wolun = wolunEntryOf(saju, sajuYear, monthTerm);

  return {
    viewedAt,
    viewedOn,
    age,
    sajuYear,
    monthTerm,
    daeun,
    // 못 짚은 이유가 둘이고 성질이 다르다 — 앞은 이 사람의 사실이고 뒤는 우리가
    // 뽑은 칸 수의 한계다. 하나로 묶으면 문장이 남의 한계를 사실처럼 말한다.
    daeunAbsence: daeun !== null ? null : age < first.startAge ? 'before-first' : 'beyond-table',
    firstDaeun: first,
    daeunApproximate: saju.daeun.approximate,
    saeun,
    wolun,
    // 겹치지 않는다. 세 칸이 저마다 **자기가 낀 것만** 남기고, 대운 칸은 원국만,
    // 세운 칸은 원국만, 월운 칸은 원국·세운을 놓고 세었기 때문이다. 순서는 넓은
    // 것부터 — 대운이 열 해, 세운이 한 해, 월운이 한 달을 맡는다.
    relations: [
      ...(daeun?.relations ?? []),
      ...saeun.relations,
      ...wolun.relations,
    ],
    hourKnown,
  };
}

/**
 * 그 사주년의 세운 칸.
 *
 * 표 안에 이미 있으면 그것을 쓴다. 없으면 같은 함수로 한 칸만 더 뽑는다 —
 * **다른 함수로 뽑지 않는 것**이 요점이다. 12운성 계통(`yinReverse`)까지 표에서
 * 그대로 물려받으므로 새로 뽑은 칸이 표의 칸과 다른 계통으로 나오지 않는다.
 */
function saeunEntryOf(saju: Saju, sajuYear: number, birthDate: CivilDate): SaeunEntry {
  const found = saju.saeun.entries.find((entry) => entry.year === sajuYear);
  if (found) return found;

  return computeSaeun(
    { pillars: saju.pillars, birthSajuYear: saju.pillars.meta.sajuYear, birthDate },
    { fromYear: sajuYear, count: 1, stages: { yinReverse: saju.saeun.yinReverse } },
  ).entries[0];
}

/** 그 절기 구간의 월운 칸. 위와 같은 규율이다 */
function wolunEntryOf(saju: Saju, sajuYear: number, monthTerm: SolarTerm): WolunEntry {
  const monthOrder = BRANCH_INFO[monthTerm.branch].monthOrder;

  const wolun =
    saju.wolun.year === sajuYear
      ? saju.wolun
      : computeWolun(
          { pillars: saju.pillars, year: sajuYear },
          { stages: { yinReverse: saju.wolun.yinReverse } },
        );

  const found = wolun.entries.find((entry) => entry.monthOrder === monthOrder);

  // 열두 절이 한 해를 빈틈없이 덮으므로 여기 오는 일은 없다. 그래도 던지는 것은
  // `undefined` 가 흘러 내려가 "월운 없음"으로 조용히 읽히는 쪽이 더 나쁘기 때문이다.
  if (!found) {
    throw new Error(`${sajuYear}년의 ${monthOrder}번째 사주월을 찾지 못했습니다`);
  }

  return found;
}

export const NOW_POLICY = {
  ruleSet: 'current-fortune-v1',
  /** 지금을 엔진이 묻지 않는다 — 넘겨받는다. 순수성과 하이드레이션 둘 다의 이유 */
  viewingInstant: 'passed-in-never-read-from-the-clock',
  /** 세운·월운은 절대 시각으로, 대운은 만 나이로 경계를 잰다 */
  boundaries: 'terms-by-instant-daeun-by-age',
  /** 간지·절입·관계를 새로 세지 않는다. 표를 내는 함수를 그대로 부른다 */
  counting: 'reuses-saeun-wolun-daeun',
  /** 관계는 세운·월운 칸에서 옮겨 담기만 한다 */
  relations: RESTATED_RELATIONS,
  /** 대운을 못 짚는 두 이유를 구분한다 — 이 사람의 사실과 우리 표의 한계 */
  daeunAbsence: 'before-first-vs-beyond-table',
  /** 대운수는 정수화 계통을 우리가 골랐다 — 세운·월운과 상한이 갈리는 까닭 */
  daeunIsChosen: 'rounding-is-a-lineage-choice',
} as const;
