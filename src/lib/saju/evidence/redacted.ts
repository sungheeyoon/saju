import { EVIDENCE_CONTRACT, type ChartEvidence, type Evidence, type Limitation } from '.';

/**
 * 모델에 넘길 꼴로 자료를 **자른다.**
 *
 * ADR 0008 이 정한 것을 값으로 옮긴 자리다 — 프롬프트 규칙(「입력 원문을 출력하지
 * 않는다」)으로 막지 않고 **안 넣어서** 막는다. 안 넣은 것은 못 낸다.
 *
 * **모든 Reading 에 적용한다.** 공유용만 자르면 「이 근거 보기가 무엇을 보장하는가」의
 * 답이 두 갈래가 되고, 그 구분은 화면에서 보이지 않는다. 자기 풀이라 해도 규율은 하나다.
 *
 * ## 무엇을 자르는가 — 세 갈래뿐이다
 *
 * 1. **원문 그대로인 값.** 입력한 생년월일시가 그 모양 그대로 들어 있는 자리.
 * 2. **출생지를 복원하는 값.** 경도 보정은 도시 스무 곳을 거의 그대로 가리킨다.
 * 3. **분 단위 정밀도.** 절입까지의 거리 같은 값은 공개된 절입 시각과 맞대면 출생
 *    시각이 분으로 떨어진다.
 *
 * ## 무엇을 자르지 **않는가** — 여덟 글자와 그 위의 사실
 *
 * 날짜 수준으로 좁혀지는 것까지 없애려 하지 않는다. 년주·월주·일주가 이미 그것을
 * 정하고, 그 글자를 빼면 해석할 것이 남지 않는다. Match 동의가 연 것이 정확히
 * 그 글자다(ADR 0012). 여기서 지키는 것은 **원문·출생지·분 단위**이고, 그 셋은
 * 여덟 글자에서 유도되지 않는다.
 *
 * 빼는 것은 이름과 이유로 자료에 실린다(`contract.redacted`). 빠진 것과 안 실은 것은
 * 받는 쪽에서 구별되지 않는다 — `EXCLUDED_PATHS` 와 같은 규율이다.
 */

/** 명식마다 잘리는 자리 — 이름과 **왜 잘랐는지** */
export const REDACTED_PATHS = {
  'meta.inputTime': '입력한 생년월일시 원문 그대로다',
  'meta.resolvedTime': '같은 값 — 시간 미상이면 정오로 채운 것뿐이다',
  'meta.instant': '같은 값을 절대 시각으로 적은 것이다',
  'meta.corrections': '경도 보정 항목이 출생지의 경도를 그대로 든다',
  'meta.totalCorrectionMinutes': '보정 총합은 경도의 다른 표기라 출생지를 좁힌다',
  'pillars.meta.civilTime': '보정된 생년월일시 — 원문에서 분 단위로 떨어져 있다',
  'pillars.meta.solarTimeOffsetMinutes': '지방시 보정값이라 출생지를 좁힌다',
  'daeun.daysToBoundary': '절입까지의 거리(소수 일)라 공개된 절입 시각과 맞대면 출생 시각이 분으로 떨어진다',
  'daeun.startAgeExact': '같은 값을 사흘에 한 살로 나눈 것이다',
} as const;

export type RedactedPath = keyof typeof REDACTED_PATHS;

/**
 * 글에 남은 분 단위 거리 — **값이 아니라 문장에 실려 나가는 자리.**
 *
 * 경계 경고는 「입하 절입 시각과 3분 차이입니다」라고 적는다. 절입 시각은 공개된
 * 값이라 이 한 줄이면 출생 시각이 분으로 떨어진다. 위에서 `daysToBoundary` 를 자른
 * 것과 **같은 값이 다른 꼴로 나가는 자리**라, 여기서도 뭉갠다.
 *
 * 경고 자체는 지우지 않는다. 「경계에 걸려 월주가 갈릴 수 있다」는 것은 해석이 반드시
 * 말해야 하는 한계이고(US 55), 그 사실은 분 수치 없이도 온전하다.
 */
export const BLURRED_DISTANCE = '경계에 아주 가깝습니다';

const DISTANCE = /(?:\d+(?:\.\d+)?분|1분 미만) 차이입니다/g;

/** 분 단위 거리를 뭉갠다 — 여러 자리(경고·한계)가 같은 문장을 든다 */
export const blurDistance = (text: string): string => text.replace(DISTANCE, BLURRED_DISTANCE);

type ChartMeta = ChartEvidence['meta'];
type PillarsMeta = ChartEvidence['pillars']['meta'];
type DaeunEvidence = ChartEvidence['daeun'];

export type RedactedChartEvidence = Omit<ChartEvidence, 'meta' | 'pillars' | 'daeun'> & {
  meta: Omit<
    ChartMeta,
    'inputTime' | 'resolvedTime' | 'instant' | 'corrections' | 'totalCorrectionMinutes'
  >;
  pillars: Omit<ChartEvidence['pillars'], 'meta'> & {
    meta: Omit<PillarsMeta, 'civilTime' | 'solarTimeOffsetMinutes'>;
  };
  daeun: Omit<DaeunEvidence, 'daysToBoundary' | 'startAgeExact'>;
};

/**
 * 모델에 넘기는 자료 — **계약이 무엇을 잘랐는지까지 든다.**
 *
 * `Evidence` 와 같은 모양이되 위 자리들이 없다. 타입이 먼저 말하므로, 잘린 값을
 * 읽으려는 코드는 컴파일에서 막힌다.
 */
export type RedactedEvidence = Omit<Evidence, 'contract' | 'charts'> & {
  contract: typeof EVIDENCE_CONTRACT & {
    /** 잘라 낸 자리와 그 이유 */
    redacted: typeof REDACTED_PATHS;
    /** 문장 안의 분 단위 거리를 어떻게 했는가 */
    blurred: string;
  };
  charts: { a: RedactedChartEvidence; b: RedactedChartEvidence | null };
};

/** 키 몇을 뺀 사본 — 뺀 키가 부르는 자리에 이름으로 남는다(`evidence/index.ts` 와 같다) */
function without<T extends object, K extends keyof T>(value: T, ...keys: readonly K[]): Omit<T, K> {
  const copy = { ...value } as Record<string, unknown>;
  for (const key of keys) delete copy[key as string];
  return copy as Omit<T, K>;
}

function redactChart(chart: ChartEvidence): RedactedChartEvidence {
  return {
    ...without(chart, 'meta', 'pillars', 'daeun'),
    meta: {
      ...without(
        chart.meta,
        'inputTime',
        'resolvedTime',
        'instant',
        'corrections',
        'totalCorrectionMinutes',
      ),
      warnings: chart.meta.warnings.map(blurDistance),
    },
    pillars: {
      ...without(chart.pillars, 'meta'),
      meta: {
        ...without(chart.pillars.meta, 'civilTime', 'solarTimeOffsetMinutes'),
        warnings: chart.pillars.meta.warnings.map(blurDistance),
      },
    },
    daeun: without(chart.daeun, 'daysToBoundary', 'startAgeExact'),
  };
}

const redactLimitation = (limitation: Limitation): Limitation => ({
  ...limitation,
  text: blurDistance(limitation.text),
});

/**
 * 넘길 자료를 자른다.
 *
 * **받는 것이 `Evidence` 다.** 입력에서 다시 만들지 않는다 — 두 자리에서 만들면
 * 화면이 보는 근거와 모델이 받은 근거가 갈릴 수 있고, 그때 근거 보기는 모델이 못 본
 * 사실을 보여 주게 된다(ADR 0008).
 */
export function redactEvidence(evidence: Evidence): RedactedEvidence {
  return {
    ...evidence,
    contract: {
      ...EVIDENCE_CONTRACT,
      redacted: REDACTED_PATHS,
      blurred: `boundary-distance-blurred-to-"${BLURRED_DISTANCE}"`,
    },
    charts: {
      a: redactChart(evidence.charts.a),
      b: evidence.charts.b === null ? null : redactChart(evidence.charts.b),
    },
    limitations: evidence.limitations.map(redactLimitation),
  };
}
