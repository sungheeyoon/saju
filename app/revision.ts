import { CITY_LONGITUDES, GENDERS, type CityName, type Gender, type LateNightRule } from '@/src/lib/saju';

import {
  DEFAULT_QUERY,
  LATE_NIGHT_RULES,
  TIME_BASES,
  type Query,
  type TimeBasis,
} from './query';

/**
 * DB 가 내주는 판본 한 줄 — `person_chart_revision` 의 컬럼 그대로.
 *
 * 전부 `string` 인 것이 요점이다. DB 에 검사식이 걸려 있어도 여기 도착한 값의
 * **타입은 아무것도 약속하지 않는다.** 좁히는 일을 이 자리에서 한 번 한다.
 */
export type StoredRevision = {
  calendar: string;
  original_date: string;
  solar_date: string;
  /** `null` 이면 시간 미상. Postgres 는 `HH:MM:SS` 로 준다 */
  birth_time: string | null;
  gender: string;
  city: string;
  late_night_rule: string;
  time_basis: string;
};

/**
 * 지금 엔진으로는 읽을 수 없는 판본.
 *
 * **기본값으로 메우지 않는다.** 모르는 출생지를 서울로 치면 저장할 때 본 사주와
 * 다른 사주가 같은 화면에 나온다 — 판본을 고치지 않기로 한 이유가 그대로 무너진다.
 * 판본은 남아 있고 읽는 쪽이 못 읽는 것이므로, 그렇게 말한다.
 */
export class UnreadableRevisionError extends Error {
  readonly field: keyof StoredRevision;
  readonly value: unknown;

  constructor(field: keyof StoredRevision, value: unknown, reason: string) {
    super(`저장된 판본을 읽지 못했습니다 — ${reason}`);
    this.name = 'UnreadableRevisionError';
    this.field = field;
    this.value = value;
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(\d{2}):(\d{2})(:\d{2}(\.\d+)?)?$/;

/**
 * 저장된 판본을 화면·엔진이 쓰는 입력 한 벌로 바꾼다.
 *
 * 이름은 판본에 없다 — 부를 이름은 엣지(`user_person_access.local_label`)가 든다.
 * 세운을 어느 해부터 볼지도 없다. 그건 보기 설정이지 명식이 아니라서, 저장된 값이
 * 아니라 지금의 기본값이 든다.
 */
export function queryFromRevision(revision: StoredRevision, localLabel: string): Query {
  if (revision.calendar !== 'solar') {
    throw new UnreadableRevisionError(
      'calendar',
      revision.calendar,
      '음력 판본은 변환표를 대조한 뒤에 읽습니다',
    );
  }

  if (!DATE.test(revision.solar_date)) {
    throw new UnreadableRevisionError('solar_date', revision.solar_date, '생년월일 형식이 아닙니다');
  }

  if (!(GENDERS as readonly string[]).includes(revision.gender)) {
    throw new UnreadableRevisionError('gender', revision.gender, '모르는 성별입니다');
  }

  if (!Object.hasOwn(CITY_LONGITUDES, revision.city)) {
    throw new UnreadableRevisionError('city', revision.city, `모르는 출생지입니다 (${revision.city})`);
  }

  if (!(LATE_NIGHT_RULES as readonly string[]).includes(revision.late_night_rule)) {
    throw new UnreadableRevisionError(
      'late_night_rule',
      revision.late_night_rule,
      '모르는 자시 규칙입니다',
    );
  }

  if (!(TIME_BASES as readonly string[]).includes(revision.time_basis)) {
    throw new UnreadableRevisionError('time_basis', revision.time_basis, '모르는 시간 기준입니다');
  }

  /**
   * 시각을 모르는 것과 「아직 안 골랐다」는 다르다.
   *
   * 판본에 도착한 시점에는 이미 답한 것이므로 `hourKnown` 이 `null` 일 수 없다.
   * `null` 은 폼에만 있는 상태다.
   */
  if (revision.birth_time === null) {
    return {
      ...DEFAULT_QUERY,
      name: localLabel,
      date: revision.solar_date,
      time: '',
      hourKnown: false,
      gender: revision.gender as Gender,
      city: revision.city as CityName,
      rule: revision.late_night_rule as LateNightRule,
      basis: revision.time_basis as TimeBasis,
    };
  }

  const clock = TIME.exec(revision.birth_time);
  if (clock === null) {
    throw new UnreadableRevisionError('birth_time', revision.birth_time, '출생시각 형식이 아닙니다');
  }

  return {
    ...DEFAULT_QUERY,
    name: localLabel,
    date: revision.solar_date,
    // 초는 버린다. 폼이 분까지만 받으므로 저장된 초가 있어도 되돌려 보일 자리가 없다.
    time: `${clock[1]}:${clock[2]}`,
    hourKnown: true,
    gender: revision.gender as Gender,
    city: revision.city as CityName,
    rule: revision.late_night_rule as LateNightRule,
    basis: revision.time_basis as TimeBasis,
  };
}

/** 판본을 이루는 값 — **여덟 글자를 가르는 것 전부이고, 그 밖은 없다.** */
export type ChartFields = {
  p_calendar: 'solar';
  p_original_date: string;
  p_solar_date: string;
  p_birth_time: string | null;
  p_gender: Gender;
  p_city: CityName;
  p_late_night_rule: LateNightRule;
  p_time_basis: TimeBasis;
};

/**
 * 폼이 든 입력에서 판본이 될 부분만 꺼낸다.
 *
 * `original_date` 와 `solar_date` 가 같다. 지금은 양력만 받기 때문이고, 그래서
 * DB 검사식도 「양력이면 둘이 같아야 한다」로 걸려 있다. 음력을 켜는 날 갈리는
 * 것은 이 함수 하나다.
 */
function chartFields(query: Query): ChartFields {
  return {
    p_calendar: 'solar',
    p_original_date: query.date,
    p_solar_date: query.date,
    // 모르는 것을 아는 것처럼 만들지 않는다 — 빈 칸으로 넣는다.
    p_birth_time: query.hourKnown === true ? query.time : null,
    p_gender: query.gender,
    p_city: query.city,
    p_late_night_rule: query.rule,
    p_time_basis: query.basis,
  };
}

/** `create_self_person` 이 받는 인자 한 벌 — 처음 등록할 때는 부를 이름도 함께 간다 */
export type SelfPersonArgs = ChartFields & { p_local_label: string };

export function selfPersonArgs(query: Query): SelfPersonArgs {
  return { p_local_label: query.name.trim(), ...chartFields(query) };
}

/** `add_person_revision` 이 받는 인자 한 벌 */
export type RevisionArgs = ChartFields & { p_person_id: string };

/**
 * **부를 이름이 없다.**
 *
 * 이름은 판본이 아니라 엣지가 들고, 여덟 글자를 바꾸지 않는다. 이름을 고쳤다고
 * 새 판본이 생기면 「이 판본은 무엇이 달라진 것인가」에 답할 수 없게 된다.
 */
export function revisionArgs(personId: string, query: Query): RevisionArgs {
  return { p_person_id: personId, ...chartFields(query) };
}

/**
 * 두 입력이 **같은 판본인가.**
 *
 * 이름과 세운 시작 연도는 빼고 본다 — 둘 다 여덟 글자를 바꾸지 않는다. DB 도 지문으로
 * 같은 것을 묻고 있으므로(`revision_fingerprint`), 화면이 「이름만 고쳤다」를 미리
 * 말해 줄 수 있는 것은 여기가 그 답을 알기 때문이다.
 */
export function samePillarInput(a: Query, b: Query): boolean {
  const fields = chartFields(a);
  const other = chartFields(b);
  return (Object.keys(fields) as (keyof ChartFields)[]).every((key) => fields[key] === other[key]);
}

/**
 * 저장하기 전에 거절할 입력 — **기본값으로 고쳐 넣지 않는다.**
 *
 * 서버 액션은 브라우저가 보내는 것을 그대로 받는다. 주소창 코덱은 모르는 값을 만나면
 * 기본값으로 눕히는데(옛 링크를 안 깨뜨리려는 것이다), 저장하는 자리에서 그러면
 * **사용자가 고른 적 없는 값이 판본으로 굳는다.** 판본은 고치지 않으므로 되돌릴 수도 없다.
 *
 * DB 검사식이 결국 막긴 한다. 다만 그때 나오는 말은 제약 위반 문장이라, 어느 칸이
 * 문제인지 사람이 읽을 수 있게 여기서 한 번 본다.
 */
export function unsupportedForSaving(query: Query): string | null {
  if (!(GENDERS as readonly string[]).includes(query.gender)) return '성별을 다시 골라 주세요.';
  if (!Object.hasOwn(CITY_LONGITUDES, query.city)) return '출생지를 다시 골라 주세요.';
  if (!(LATE_NIGHT_RULES as readonly string[]).includes(query.rule)) {
    return '자시 규칙을 다시 골라 주세요.';
  }
  if (!(TIME_BASES as readonly string[]).includes(query.basis)) {
    return '시간 기준을 다시 골라 주세요.';
  }
  return null;
}
