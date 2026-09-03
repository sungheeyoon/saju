import {
  CALENDARS,
  CITY_LONGITUDES,
  GENDERS,
  LUNAR_SUPPORTED_YEAR_RANGE,
  SUPPORTED_YEAR_RANGE,
  type Calendar,
  type CityName,
  type CompatSide,
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
  /**
   * 부를 이름 — **계산에 들어가지 않는다.**
   *
   * 궁합에서 관계 한 줄이 "민수 일지 卯 · 지영 년지 辰"처럼 적히려면 두 계산판을
   * 사람 이름으로 불러야 한다. `chartId` 는 `natal:a`·`natal:b` 라 화면에 그대로
   * 내놓을 수 없고, "첫 번째 사람"은 각자 자기 기준으로 읽을 수가 없다.
   *
   * 엔진에는 넘기지 않는다(`SajuInput` 에 이 필드가 없다). 여덟 글자를 바꾸지
   * 않는 값이 계산 입력에 섞이면 "이름을 고쳤더니 사주가 달라지나" 하는 의심을
   * 코드로 반박할 수 없게 된다 — 성별이 대운 방향을 바꾸는 것과 정반대다.
   */
  name: string;
  /**
   * 사용자가 아는 생일의 형식 — 양력인가, 음력 평달인가, 음력 윤달인가.
   *
   * 부모 세대는 생일을 음력으로 아는 경우가 흔한데, 폼이 양력만 받으면 음력
   * 날짜를 양력 칸에 그대로 적고 **틀린 사주가 나오는데 화면은 아무 말도 하지
   * 않는다**(ADR 0002). 그래서 형식을 묻는다.
   *
   * 평달과 윤달을 한 값으로 합치지 않는다. 「음력 1984년 10월 5일」은 두 날이
   * 실재하고 서로 한 달 떨어져 있다.
   */
  calendar: Calendar;
  /**
   * 사용자가 적은 생년월일 — **`calendar` 형식 그대로다.**
   *
   * 음력 입력이면 여기 담긴 것은 음력 날짜이고, 양력 변환은 이 값을 읽는
   * `chart.ts` 의 `solarDateOf` 한 곳에서 일어난다. 변환된 값을 함께 싣지
   * 않는 이유는 두 벌이 어긋날 자리를 만들지 않기 위해서다 — 저장된 판본만은
   * 그 시절의 변환을 붙들어야 해서 예외이고, 그 대조는 `revision.ts` 가 한다.
   */
  date: string;
  time: string;
  /**
   * 출생 시각을 아는가 — **고르지 않은 상태가 있다.**
   *
   * `null` 은 "아직 답하지 않았다"이고 `false` 는 "모른다고 답했다"다. 둘을
   * 하나로 묶으면 아무것도 고르지 않은 사람에게 "시각을 안다"를 기본값으로
   * 씌우게 되는데, 그것은 엔진이 정오를 채워 넣을 때 경계한 것과 같은 실수다 —
   * **모르는 것을 아는 것처럼 만들지 않는다**(`UNKNOWN_HOUR_PROXY`).
   *
   * `null` 은 이제 **주소에서만 온다.** 폼은 「시간 입력」에서 시작한다
   * (`DEFAULT_QUERY`) — 두 칸이 다 꺼져 있으면 사용자가 그것을 「고를 게 있다」가
   * 아니라 「잠긴 칸」으로 읽었다. 그래도 위험이 없는 것은, 켜진 쪽이 **모른다는
   * 답이 아니라 적으라는 요구**라서다: 시각을 안 적으면 버튼이 잠긴 채로 남는다.
   * 반대로 「시간 모름」을 기본으로 두면 아무 말 없이 시주 없는 명식이 나간다.
   *
   * `false` 여야만 엔진에 `hour: null` 이 간다. `null` 로는 계산을 시작하지
   * 않는다(`missingAnswer`).
   */
  hourKnown: boolean | null;
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
  name: '',
  calendar: 'solar',
  // 결과를 예시 명식으로 채우지 않는다. 사용자가 입력하기 전에는 빈 상태다.
  date: '',
  time: '',
  // 「시간 입력」에서 시작한다 — 위 `hourKnown` 참조. 시각 두 칸이 비어 있으면
  // 버튼은 그대로 잠겨 있으므로, 켜 둔다고 답을 대신 채우는 것이 아니다.
  hourKnown: true,
  gender: 'female',
  city: '서울',
  rule: 'jo',
  basis: 'localMean',
  // 현재 연도를 쓰지 않는다. 이 페이지는 빌드 때 미리 그려지므로 브라우저에서
  // 계산한 '올해'와 어긋나 하이드레이션이 깨진다. 고정값을 두고 사용자가 옮긴다.
  saeunFrom: 2026,
};

const CITY_NAMES = Object.keys(CITY_LONGITUDES) as CityName[];
export const LATE_NIGHT_RULES: readonly LateNightRule[] = ['jo', 'ya'];

/** 시각을 모른다는 표시. 시각과 같은 칸을 쓰므로 "모름인데 14:30" 이 만들어지지 않는다 */
const HOUR_UNKNOWN = 'unknown';

const SAEUN_MIN = 1900;
const SAEUN_MAX = 2100;

/** 이름 길이 상한 — 관계 한 줄에 두 사람이 들어가므로 행이 감당할 만큼만 */
export const NAME_MAX = 12;

/**
 * 태어난 해로 받는 마지막 해 — **엔진이 셀 수 있는 범위와 다르다.**
 *
 * 엔진은 2100년까지 센다(`SUPPORTED_YEAR_RANGE`). 그 범위는 세운·대운처럼 **앞으로
 * 올 해**를 짚어야 해서 넓은 것이고, 태어난 해는 그럴 이유가 없다. 두 범위를 하나로
 * 합쳐 두면 생년 칸이 아직 오지 않은 80년을 받는다.
 *
 * **이 값이 좁아지면 그만큼의 사람이 거절된다.** 2020으로 두면 2021년 이후에 태어난
 * 사람이 이 폼으로 못 들어온다 — 자식의 사주를 보려는 부모가 실제로 걸린다. 그래서
 * 지금은 오늘보다 조금 넉넉한 쪽으로 두었다: 살아 있는 사람이 이 칸에서 거절당하는
 * 일이 없고, 그러면서도 엔진의 2100년만큼 아득하게 열려 있지는 않다.
 *
 * 손으로 적힌 자리는 여기뿐이다 — 폼이 여는 범위도, 거절하는 문장도, 그 문장을 재는
 * 시험도 전부 이 상수를 읽는다. 바꿀 때 고칠 곳은 이 한 줄이다.
 */
export const BIRTH_YEAR_MAX = 2030;

/**
 * 그 달력으로 받을 수 있는 해의 범위.
 *
 * 아래 끝은 자료가 정한다 — 절기·표준시는 1900년까지 닿지만 음력 표는 1912년부터다
 * (`LUNAR_SUPPORTED_YEAR_RANGE`). 위 끝은 제품이 정한다(`BIRTH_YEAR_MAX`). 둘을 한
 * 함수가 들고 있으므로 **폼이 여는 범위와 계산이 받는 범위가 갈릴 수 없다.**
 */
export function birthYearRangeOf(calendar: Calendar): { min: number; max: number } {
  return {
    min: calendar === 'solar' ? SUPPORTED_YEAR_RANGE.min : LUNAR_SUPPORTED_YEAR_RANGE.min,
    max: BIRTH_YEAR_MAX,
  };
}

/**
 * 범위 밖의 해를 거절하는 말 — 없으면 `null`.
 *
 * **거절은 조용하지 않다.** 폼이 그 값을 아예 못 만들게 막는 대신 받아 두고 이유를
 * 말하는 쪽을 고른 것은, 입력이 주소의 `#` 뒤에서도 들어오기 때문이다. 폼에서만
 * 막으면 링크로 들어온 1899년은 아무 말 없이 계산된다.
 */
export function birthYearRefusal(query: Query): string | null {
  // **네 자리가 다 적히기 전에는 해가 아니다.** `Number('')` 은 0 이라, 빈 날짜가
  // 「0년은 안 됩니다」로 거절당한다 — 아직 아무것도 어기지 않은 칸에 대고 하는 말이다.
  const digits = query.date.slice(0, 4);
  if (!/^\d{4}$/.test(digits)) return null;

  const year = Number(digits);
  const { min, max } = birthYearRangeOf(query.calendar);
  if (year >= min && year <= max) return null;

  return `${min}~${max}년에 태어난 분만 계산합니다: ${year}년`;
}

/**
 * 아직 답하지 않은 칸 — **버튼을 잠그는 쪽과 계산하는 쪽이 같은 답을 본다.**
 *
 * 버튼의 `disabled` 조건을 화면에 따로 적으면 두 곳이 어긋나는 순간, 눌리는데
 * 계산은 거절하거나 반대로 잠겼는데 사실은 계산할 수 있는 상태가 만들어진다.
 * 검증을 엔진 한 곳에만 둔 것과 같은 이유다 — 판정하는 자리는 하나여야 한다.
 *
 * 기본값이 있는 칸(성별·출생지·자시 규칙·시간 기준·세운)은 여기 없다. 답이
 * 이미 있는 것을 다시 묻지 않는다. 여기 오는 것은 **아무도 대신 답할 수 없는
 * 셋**뿐이다 — 이름, 생년월일, 그리고 시각을 아는가.
 *
 * 돌려주는 것은 문장 꼬리라 궁합 화면이 앞에 이름을 붙일 수 있다
 * (`민수의 생년월일을 입력해 주세요`).
 */
export function missingForCalculation(query: Query): string | null {
  if (query.date === '') return '생년월일을 입력해 주세요.';
  // 범위 밖의 해는 **여기서** 걸린다 — 버튼을 잠그는 자리와 계산을 막는 자리가 하나다.
  const refused = birthYearRefusal(query);
  if (refused !== null) return refused;
  // 고르지 않은 것과 "모른다"고 답한 것은 다르다 — 위 `hourKnown` 참조.
  if (query.hourKnown === null) return '출생시각을 입력하거나 시간 모름을 골라 주세요.';
  if (query.hourKnown && query.time === '') return '출생시각을 입력해 주세요.';

  return null;
}

/**
 * 폼이 아직 답을 못 받은 칸 — **계산 조건에 이름이 하나 더 붙는다.**
 *
 * 두 질문이 진짜로 다르다. "이 입력으로 계산할 수 있는가"와 "이 폼을 제출해도
 * 되는가"는 **이름 하나만큼 다르다** — 이름은 계산에 들어가지 않으므로
 * (`Query.name`), 이름 없이 만들어진 옛 링크는 그대로 열려야 한다. 여기서 막으면
 * 이름 칸을 만든 날 이전에 나눠 준 링크가 전부 에러 화면이 된다.
 *
 * 대신 **둘이 서로 어긋날 수는 없다.** 위 함수를 그대로 부르고 이름 한 줄만
 * 얹기 때문이다 — 두 곳에 조건을 따로 적었을 때 생기는, 눌리는데 거절하거나
 * 잠겼는데 계산은 되는 상태가 여기서는 만들어지지 않는다.
 */
export function missingAnswer(query: Query): string | null {
  if (query.name.trim() === '') return '이름을 입력해 주세요.';

  return missingForCalculation(query);
}

/**
 * 접두사 — 한 주소에 입력 두 벌을 싣기 위한 것.
 *
 * 궁합은 두 사람을 함께 보므로 `a.date`·`b.date` 처럼 앞에 누구인지를 붙인다.
 * 원국 한 사람짜리 화면은 접두사가 없다(`date`) — 이미 나눠 준 링크가 그대로
 * 열려야 하기 때문이다.
 */
export type QueryPrefix = '' | 'a.' | 'b.';

/**
 * 어느 쪽이 어느 접두사인가 — **코덱 옆에 둔다.**
 *
 * 궁합 계산기 안에 있었다. 같은 링크를 읽는 자리가 둘이 되면서(`/evidence` 가
 * 결과 화면의 주소를 그대로 연다) 옮겼다 — 접두사를 읽는 쪽이 제 손으로 `'a.'` 를
 * 적으면, 접두사가 바뀌는 날 한쪽만 고쳐지고 그때 두 화면이 같은 주소에서 다른
 * 사람을 읽는다.
 */
export const PREFIX: Record<CompatSide, QueryPrefix> = { a: 'a.', b: 'b.' };

/**
 * 입력 한 벌을 주소창에 싣는다.
 *
 * **기본값이라고 빼지 않는다.** 자시 규칙 하나로 일주가 바뀌고 시간 기준으로
 * 시주가 바뀌므로, 빼고 나서 나중에 기본값을 옮기면 이미 나눠 준 링크가 조용히
 * 다른 사주를 가리키게 된다. 링크는 그때 본 것을 그대로 다시 보여줘야 한다.
 */
export function toSearchParams(query: Query, prefix: QueryPrefix = ''): URLSearchParams {
  /**
   * 이름만은 비어 있으면 뺀다 — **위 규칙의 예외가 아니라 다른 종류의 값이라서다.**
   *
   * 기본값을 빼지 않는 이유는 나중에 기본값을 옮기면 이미 나눠 준 링크가 조용히
   * 다른 사주를 가리키기 때문인데, 이름은 여덟 글자를 바꾸지 않는다. 빈 이름을
   * 실어 두면 이름을 쓰지 않는 원국 링크마다 `name=` 이 붙는다.
   *
   * 반대로 **이름을 넣으면 주소에 그대로 실린다.** 링크를 나누면 이름도 함께
   * 나눠지므로, 그것이 곧 이 값을 주소에 두기로 한 대가다.
   */
  const named = query.name === '' ? {} : { [`${prefix}name`]: query.name };

  /**
   * 달력 형식은 **양력일 때 빼고 음력일 때만 싣는다.**
   *
   * 기본값이라고 빼지 않는다는 위 규칙의 예외로 보이지만 그렇지 않다. 여기서
   * 두려운 것은 「나중에 기본값을 옮기면 옛 링크가 다른 사주를 가리키는 것」인데,
   * 양력은 기본값이기 이전에 **`cal` 이 생기기 전에 나눠 준 모든 링크의 뜻**이다.
   * 그 뜻은 옮길 수 없으므로 실어 둘 이유도 없다.
   */
  const calendared = query.calendar === 'solar' ? {} : { [`${prefix}cal`]: query.calendar };

  return new URLSearchParams({
    ...named,
    ...calendared,
    [`${prefix}date`]: query.date,
    [`${prefix}hour`]: query.hourKnown === false ? HOUR_UNKNOWN : query.time,
    [`${prefix}gender`]: query.gender,
    [`${prefix}city`]: query.city,
    [`${prefix}rule`]: query.rule,
    [`${prefix}basis`]: query.basis,
    [`${prefix}saeun`]: String(query.saeunFrom),
  });
}

/** 여러 벌을 한 주소에 싣는다 — 순서는 준 순서 그대로다 */
export function mergeSearchParams(
  ...parts: readonly URLSearchParams[]
): URLSearchParams {
  const merged = new URLSearchParams();
  for (const part of parts) {
    for (const [key, value] of part) merged.set(key, value);
  }
  return merged;
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
export function queryFromSearchParams(
  params: URLSearchParams,
  prefix: QueryPrefix = '',
): Query | null {
  const at = (key: string) => params.get(`${prefix}${key}`);

  const date = at('date');
  if (date === null || date === '') return null;

  const hour = at('hour');
  const saeun = Number(at('saeun'));

  return {
    // 길이만 자른다. 이름은 계산에 안 쓰이므로 정상값으로 되돌릴 대상이 없고,
    // 대신 주소로 들어온 값이라 화면을 밀어내지 못할 만큼만 남긴다.
    name: (at('name') ?? '').slice(0, NAME_MAX),
    // `cal` 이 없으면 양력이다 — 이 칸이 생기기 전에 나눠 준 링크가 그 뜻이다.
    calendar: oneOf(CALENDARS, at('cal'), 'solar'),
    date,
    time: hour === null || hour === HOUR_UNKNOWN ? '' : hour,
    // 주소에 시각 칸이 아예 없으면 **고르지 않은 것**으로 읽는다. 손으로 고친
    // 링크에 정오를 채워 주는 것보다 무엇이 빠졌는지 묻는 편이 낫다.
    hourKnown: hour === HOUR_UNKNOWN ? false : hour === null || hour === '' ? null : true,
    gender: oneOf(GENDERS, at('gender'), DEFAULT_QUERY.gender),
    city: oneOf(CITY_NAMES, at('city'), DEFAULT_QUERY.city),
    rule: oneOf(LATE_NIGHT_RULES, at('rule'), DEFAULT_QUERY.rule),
    basis: oneOf(TIME_BASES, at('basis'), DEFAULT_QUERY.basis),
    saeunFrom: Number.isInteger(saeun)
      ? Math.min(Math.max(saeun, SAEUN_MIN), SAEUN_MAX)
      : DEFAULT_QUERY.saeunFrom,
  };
}
