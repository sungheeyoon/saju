import {
  CALENDARS,
  CHART_ENGINE_VERSION,
  CITY_LONGITUDES,
  GENDERS,
  LunarConversionError,
  chartSnapshotOf,
  type Calendar,
  type ChartSnapshot,
  type CityName,
  type Gender,
  type LateNightRule,
} from '../saju';

import { chartOf, isoOf, solarDateOf } from './chart';

import {
  LATE_NIGHT_RULES,
  TIME_BASES,
  type Query,
  type TimeBasis,
} from './query';

/**
 * 입력을 고치면 무엇이 달라지는가 — **화면마다 따로 적지 않는다.**
 *
 * ADR 0011 이 정한 그대로다. 자기 명식과 직접 관리하는 Person 의 수동 궁합은 **현재
 * 판본**으로 그때그때 계산한다. 과거 결과를 저장해 두지 않으므로, 입력을 고치면 어제
 * 본 화면과 오늘 보는 화면이 다르다.
 *
 * 그것은 고장이 아니라 그렇게 하기로 한 것이다. 미리 적어 두지 않으면 사용자는
 * 「내가 본 것이 사라졌다」로 읽는다. Match 의 공유 결과는 반대다 — 그쪽은 **매인
 * 판본**으로 나므로 움직이지 않는다(`MATCH_RESULT_PINNED_NOTE`).
 */
export const INPUT_EDIT_REPLACED_NOTE =
  '수정하면 현재 사주와 궁합은 새 입력으로 계산됩니다. 이전에 본 결과와 다를 수 있습니다.';

/** 판본을 이루는 값 — **여덟 글자를 가르는 것 전부이고, 그 밖은 없다.** */
type ChartFields = {
  p_calendar: Calendar;
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
 * 원본과 변환값을 **둘 다** 넣는다(ADR 0002). 원본이 있어야 사용자가 나중에 자기
 * 입력을 알아보고, 변환값이 있어야 표가 바뀌었을 때 무엇이 달라졌는지 되짚을 수
 * 있다. 양력 입력이면 둘이 같고, DB 검사식이 양쪽 방향을 다 들고 있다
 * (`solar_input_needs_no_conversion` · `lunar_input_needs_conversion`).
 */
function chartFields(query: Query): ChartFields {
  return {
    p_calendar: query.calendar,
    p_original_date: query.date,
    p_solar_date: isoOf(solarDateOf(query)),
    // 모르는 것을 아는 것처럼 만들지 않는다 — 빈 칸으로 넣는다.
    p_birth_time: query.hourKnown === true ? query.time : null,
    p_gender: query.gender,
    p_city: query.city,
    p_late_night_rule: query.rule,
    p_time_basis: query.basis,
  };
}

/**
 * 저장하는 문에 함께 가는 **여덟 글자와 그것을 낸 판**(ADR 0071).
 *
 * **`chartFields` 에 안 넣는다.** 저것은 「두 입력이 같은 판본인가」를 키마다 `===` 로
 * 견주는 데 쓰이는데(`samePillarInput`), 거기에 객체가 끼면 같은 값을 넣어도 언제나
 * 다르다고 답한다 — 「같은 값으로 저장하면 판본을 쌓지 않는다」가 그 자리에서 무너진다.
 *
 * **던질 수 있다.** 이 모듈은 이미 그랬다 — `chartFields` 가 `solarDateOf` 를 부른다.
 * 달라지는 것은 의존의 넓이(달력 변환 → 엔진 전체)뿐이고, 네 호출부가 모두 앞에서
 * `unsupportedForSaving` 으로 막는다.
 */
type ChartArgs = { p_chart: ChartSnapshot; p_chart_engine_version: string };

const chartArgs = (query: Query): ChartArgs => ({
  // 화면이 그리는 것과 **같은 함수**로 센다. 여기서 따로 세면 저장 전과 후가 갈린다.
  p_chart: chartSnapshotOf(chartOf(query).pillars),
  p_chart_engine_version: CHART_ENGINE_VERSION,
});

/** `create_self_person` 이 받는 인자 한 벌 — 처음 등록할 때는 부를 이름도 함께 간다 */
type SelfPersonArgs = ChartFields & ChartArgs & { p_local_label: string };

export function selfPersonArgs(query: Query): SelfPersonArgs {
  return { p_local_label: query.name.trim(), ...chartFields(query), ...chartArgs(query) };
}

/** 메모 길이 상한 — DB 검사식과 같은 수. 두 곳에 적힌 값이라 한쪽만 고치면 갈린다 */
export const NOTE_MAX = 200;

/**
 * 메모는 **있거나 없다.**
 *
 * 빈 칸을 `''` 로 저장하면 「메모 없음」이 두 값이 되고, 화면이 그때그때 다른 것을
 * 묻게 된다. 없음은 `null` 하나다 — DB 검사식도 같은 것을 든다
 * (`note_is_absent_or_written`).
 */
export const noteOrNull = (note: string): string | null => note.trim() || null;

/**
 * `create_managed_person` 이 받는 인자 한 벌 — 메모가 하나 더 붙는다.
 *
 * 메모는 판본이 아니다(여덟 글자를 바꾸지 않는다). 그런데도 여기 함께 실리는 것은,
 * 등록이라는 **한 사건**에서 Person·엣지·판본이 한 트랜잭션에 들어가기 때문이다.
 *
 * 무슨 사이인가는 여기 없다. 그것은 사람이 아니라 **쌍**에 붙고, 묻는 자리도 사람을
 * 등록하는 곳이 아니라 궁합을 보는 곳이다.
 */
export type ManagedPersonArgs = SelfPersonArgs & { p_note: string | null };

export function managedPersonArgs(query: Query, note: string): ManagedPersonArgs {
  return { ...selfPersonArgs(query), p_note: noteOrNull(note) };
}

/**
 * 「고른 사람」 쪽에 보내는 **빈 한 벌** — 키가 위 빌더와 글자 하나까지 같다.
 *
 * **타입이 그것을 지킨다.** `ManagedPersonArgs` 에 칸이 하나 늘면 이 객체가 그 자리에서
 * 컴파일에 걸린다 — 사람이 기억할 일이 아니다.
 *
 * 기억에 맡겼다가 치른 값이 있다. A2 가 여덟 글자 둘을 빌더에 더했을 때 궁합 화면의
 * 「고른 사람」 가지는 손으로 적은 열 칸짜리였고, 한쪽만 직접 입력한 조합이 **26키**로
 * 나갔다. 24인자(옛)·28인자(새) 어느 서명에도 안 맞아 PostgREST 가 함수를 못 찾았고,
 * 그 화면은 운영에서 열리지 않았다.
 */
export type BlankPersonArgs = { [K in keyof ManagedPersonArgs]: null };

export const BLANK_PERSON_ARGS: BlankPersonArgs = {
  p_local_label: null,
  p_note: null,
  p_calendar: null,
  p_original_date: null,
  p_solar_date: null,
  p_birth_time: null,
  p_gender: null,
  p_city: null,
  p_late_night_rule: null,
  p_time_basis: null,
  p_chart: null,
  p_chart_engine_version: null,
};

/** `edit_person_input` 이 받는 인자 한 벌 */
type PersonInputArgs = ChartFields & ChartArgs & { p_person_id: string };

/**
 * **부를 이름이 없다.**
 *
 * 이름은 판본이 아니라 엣지가 들고, 여덟 글자를 바꾸지 않는다. 이름을 고쳤다고
 * 새 판본이 생기면 「이 판본은 무엇이 달라진 것인가」에 답할 수 없게 된다.
 */
export function personInputArgs(personId: string, query: Query): PersonInputArgs {
  return { p_person_id: personId, ...chartFields(query), ...chartArgs(query) };
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
  if (!(CALENDARS as readonly string[]).includes(query.calendar)) return '달력을 다시 골라 주세요.';
  // 변환이 안 되는 음력 날짜는 여기서 멈춘다. 그냥 두면 `chartFields` 가 던지고,
  // 서버 액션이 500 으로 죽어서 사용자는 아무 말도 못 듣는다.
  try {
    solarDateOf(query);
  } catch (error) {
    return error instanceof LunarConversionError ? error.message : '생년월일을 다시 확인해 주세요.';
  }
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
