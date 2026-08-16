import {
  CITY_LONGITUDES,
  GENDERS,
  type CityName,
  type Gender,
  type LateNightRule,
} from '@/src/lib/saju';

/**
 * 화면이 계산기에 넘기는 입력 한 벌과, 그것을 주소창에 싣는 방법.
 *
 * 결과를 링크로 주고받으려면 상태가 컴포넌트 안에만 있으면 안 된다. 그래서
 * **제출된 입력은 URL 이 들고 있고**(`?date=…`), 컴포넌트는 그것을 읽어 계산한다.
 * 타이핑 중인 값은 URL 에 넣지 않는다 — 반쪽 날짜로 계산하지 않는 것과 같은
 * 이유이고, 히스토리가 글자 수만큼 쌓이는 것도 막는다.
 *
 * 이 파일에 JSX 를 두지 않는다. 순수 함수라 노드에서 그대로 테스트한다.
 */

/**
 * 시간 기준 — 시주·일주를 어느 시계로 읽을 것인가.
 *
 * 세 값이 경도·균시차 두 스위치를 대신한다. 성립하지 않는 조합(경도 없이
 * 균시차만)을 애초에 만들 수 없게 하려는 것이다.
 */
export type TimeBasis = 'localMean' | 'record' | 'trueSolar';

export const TIME_BASES = ['localMean', 'record', 'trueSolar'] as const satisfies readonly TimeBasis[];

export const TIME_BASIS: Record<
  TimeBasis,
  {
    label: string;
    hint: string;
    useLongitude: boolean;
    useEquationOfTime: boolean;
    /** 고급 — 기본 화면에서는 접어둔다 */
    advanced?: boolean;
  }
> = {
  localMean: {
    label: '지방평균태양시',
    hint: '경도 보정 · 기본값',
    useLongitude: true,
    useEquationOfTime: false,
  },
  record: {
    label: '출생기록 시각',
    hint: '보정 없음',
    useLongitude: false,
    useEquationOfTime: false,
  },
  trueSolar: {
    label: '진태양시',
    hint: '경도 + 균시차 (±16분)',
    useLongitude: true,
    useEquationOfTime: true,
    advanced: true,
  },
};

export type Query = {
  date: string;
  time: string;
  /** 출생 시각을 모름 — 시주를 뽑지 않는다 */
  hourUnknown: boolean;
  /** 성별. 여덟 글자는 바꾸지 않고 대운의 방향만 정한다 */
  gender: Gender;
  city: CityName;
  rule: LateNightRule;
  /** 세운을 어느 해부터 볼지 */
  saeunFrom: number;
  /** 시간 기준 — 경도·균시차를 함께 정한다 */
  basis: TimeBasis;
};

export const DEFAULT_QUERY: Query = {
  // 결과를 예시 명식으로 채우지 않는다. 사용자가 입력하기 전에는 빈 상태다.
  date: '',
  time: '',
  hourUnknown: false,
  gender: 'female',
  city: '서울',
  rule: 'jo',
  basis: 'localMean',
  // 현재 연도를 쓰지 않는다. 이 페이지는 빌드 때 미리 그려지므로 브라우저에서
  // 계산한 '올해'와 어긋나 하이드레이션이 깨진다. 고정값을 두고 사용자가 옮긴다.
  saeunFrom: 2026,
};

const CITY_NAMES = Object.keys(CITY_LONGITUDES) as CityName[];
const LATE_NIGHT_RULES: readonly LateNightRule[] = ['jo', 'ya'];

/** 시각을 모른다는 표시. 시각과 같은 칸을 쓰므로 "모름인데 14:30" 이 만들어지지 않는다 */
const HOUR_UNKNOWN = 'unknown';

const SAEUN_MIN = 1900;
const SAEUN_MAX = 2100;

/**
 * 입력 한 벌을 주소창에 싣는다.
 *
 * **기본값이라고 빼지 않는다.** 자시 규칙 하나로 일주가 바뀌고 시간 기준으로
 * 시주가 바뀌므로, 빼고 나서 나중에 기본값을 옮기면 이미 나눠 준 링크가 조용히
 * 다른 사주를 가리키게 된다. 링크는 그때 본 것을 그대로 다시 보여줘야 한다.
 */
export function toSearchParams(query: Query): URLSearchParams {
  return new URLSearchParams({
    date: query.date,
    hour: query.hourUnknown ? HOUR_UNKNOWN : query.time,
    gender: query.gender,
    city: query.city,
    rule: query.rule,
    basis: query.basis,
    saeun: String(query.saeunFrom),
  });
}

const oneOf = <T extends string>(values: readonly T[], raw: string | null, fallback: T): T =>
  values.find((value) => value === raw) ?? fallback;

/**
 * 주소창에서 입력 한 벌을 읽는다. `date` 가 없으면 아직 아무것도 계산하지
 * 않은 상태다.
 *
 * 날짜·시각은 형식을 여기서 따지지 않고 그대로 넘긴다 — 검증은 엔진
 * (`input.ts`) 한 곳에만 두고, 사용자는 엔진이 내는 같은 메시지를 본다.
 * 반대로 열거값과 연도는 여기서 정상 범위로 되돌린다. 링크를 잘못 편집했다고
 * 빈 화면을 주는 것보다 무엇으로 계산했는지 화면에 그대로 보여주는 편이 낫다.
 */
export function queryFromSearchParams(params: URLSearchParams): Query | null {
  const date = params.get('date');
  if (date === null || date === '') return null;

  const hour = params.get('hour');
  const saeun = Number(params.get('saeun'));

  return {
    date,
    time: hour === null || hour === HOUR_UNKNOWN ? '' : hour,
    hourUnknown: hour === HOUR_UNKNOWN,
    gender: oneOf(GENDERS, params.get('gender'), DEFAULT_QUERY.gender),
    city: oneOf(CITY_NAMES, params.get('city'), DEFAULT_QUERY.city),
    rule: oneOf(LATE_NIGHT_RULES, params.get('rule'), DEFAULT_QUERY.rule),
    basis: oneOf(TIME_BASES, params.get('basis'), DEFAULT_QUERY.basis),
    saeunFrom: Number.isInteger(saeun)
      ? Math.min(Math.max(saeun, SAEUN_MIN), SAEUN_MAX)
      : DEFAULT_QUERY.saeunFrom,
  };
}
