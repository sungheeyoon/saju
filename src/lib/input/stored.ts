import {
  CALENDARS,
  CITY_LONGITUDES,
  GENDERS,
  LunarConversionError,
  type Calendar,
  type CityName,
  type Gender,
  type LateNightRule,
  type Saju,
} from '../saju';

import { chartOf, isoOf, solarDateOf } from './chart';

import {
  DEFAULT_QUERY,
  LATE_NIGHT_RULES,
  TIME_BASES,
  type Query,
  type TimeBasis,
} from './query';

/**
 * 저장된 **입력 한 벌** — `person` 의 여덟 칸 그대로.
 *
 * 전부 `string` 인 것이 요점이다. DB 에 검사식이 걸려 있어도 여기 도착한 값의
 * **타입은 아무것도 약속하지 않는다.** 좁히는 일을 이 모듈이 한 번 한다.
 *
 * 얼린 생성 작업도 같은 모양을 든다(`reading_job.birth_a`). 출처가 `person` 행이
 * 아니어서 **읽는 문을 못 지나지만**, 세우는 문은 그대로 지난다 — 이 문이 행이 아니라
 * 값을 받는 이유다.
 */
export type StoredInput = {
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
 * 못 읽었을 때 **덧붙이는 한 줄** — 세 화면이 같은 것을 말한다.
 *
 * 결과의 `message` 는 **무엇을 못 읽었는지**를 말하고(모르는 출생지, 생년월일 형식이
 * 아님…), 이 줄은 **그것이 무슨 뜻인지**를 말한다. 둘은 언제나 함께 선다.
 *
 * 내 사주·저장한 사람·저장한 사람끼리의 궁합, 세 화면에 손으로 적혀 있었다. 입력을
 * 다루는 정책이 바뀌는 날 셋 중 하나는 안 고쳐지고, 그때 화면마다 다른 약속이 남는다.
 *
 * 공유 결과는 이 줄을 쓰지 않는다 — 거기서 그대로인 것은 저장된 값이 아니라 **두 분의
 * 동의**이고, 그것은 입력이 아니라 동의의 말이다(`MATCH_RESULT_CLOSED_NOTE`).
 */
export const UNREADABLE_INPUT_NOTE =
  '저장된 값은 그대로 있습니다. 지금 화면이 그 값을 읽지 못하는 것입니다.';

/**
 * 저장된 입력 한 벌을 **입력과 명식으로 세운 결과.**
 *
 * **「여덟 글자 스냅샷」이 아니다**(`person.current_chart`). 저쪽은 그때 보여 준 글자를
 * 베껴 둔 값이라 판정이 안 딸리고 다시 계산하지 않는다. 이쪽은 지금 엔진이 저장된
 * 입력에서 **방금 세운** 명식이고 판정이 전부 딸린다.
 *
 * ## 못 읽는 것은 값이고, 그 밖은 예외다
 *
 * 가르는 기준은 **사용자가 할 수 있는 일이 있는가**이지 어느 함수가 던졌는가가 아니다.
 * 모르는 출생지·바뀐 음력 표는 사용자가 입력을 고치면 풀린다 — 그래서 값으로 낸다.
 * 그 밖의 계산 오류는 사용자가 할 수 있는 것이 없다 — 그래서 던진다. **값으로 바꾸면
 * 화면이 「못 읽습니다」라고 얌전히 적고, 그 행이 어떻게 들어왔는지 아무도 영영 안 묻는다.**
 *
 * 함수 경계로 긋지 않는 이유가 있다. 「`queryOf` 가 던지면 값, `chartOf` 가 던지면
 * 예외」로 적어 두면 검증 한 줄이 언젠가 `chartOf` 쪽으로 옮겨가는 날 **뜻이 조용히
 * 바뀐다.**
 *
 * ## 그래서 실제로 무엇이 던져지나 — 재어 봤다
 *
 * `chartOf` 가 던질 수 있는 것은 둘인데 하나는 **이 경로에서 날 수 없다.**
 *
 * - `LunarConversionError` — `queryOf` 가 이미 **같은 입력으로 같은 변환을 돌려 보고**
 *   저장값과 대조했다(아래 「양력 대조」). `chartOf` 가 두 줄 뒤에 부르는 `solarDateOf` 는
 *   글자 그대로 같은 인자다. 통과한 적 있는 변환이 거기서 실패할 수 없다.
 * - `InvalidSajuInputError` — `computeSaju` 가 **항상** `assertValidSajuInput` 을 지난다.
 *   연도 1900~2100 밖, 없는 날짜, 모르는 성별에서 난다.
 *
 * 그 하나가 정말 예상 밖인지도 재어 봤다. 앱의 저장 문 **셋 전부**가 `missingAnswer` 로
 * 연도를 막고(양력 1900·음력 1912 ~ 2030, **엔진보다 좁다**), DB 는 날짜·시각을
 * `date`·`time` 으로 받아 2월 30일이나 25시를 애초에 안 들인다. **다만 DB 에 연도 범위
 * 검사식은 없다** — 앱 밖에서 쓴 행이라면 날 수 있고, 그것이 정확히 우리가 알아야 할
 * 일이다.
 */
export type StoredChartResult =
  | { readonly ok: true; readonly query: Query; readonly saju: Saju }
  | {
      readonly ok: false;
      readonly kind: 'unreadable-input';
      /**
       * 어느 칸이 문제인가 — **값으로 든다.**
       *
       * 문장을 다시 파싱해서 알아내게 하지 않는다. 운영 백필이 「왜 못 채웠나」를
       * 이 값으로 적고(`backfill-chart`), 시험도 문장이 아니라 이 칸을 잰다.
       */
      readonly field: keyof StoredInput;
      readonly message: string;
    };

/**
 * 지금 엔진으로는 읽을 수 없는 **저장된 입력**.
 *
 * **밖으로 안 나간다.** 이 모듈이 잡아서 값으로 바꾸므로 `instanceof` 로 받는 자리가
 * 하나도 없다 — 앞서는 호출부 일곱이 각자 여섯 모양으로 받았다.
 *
 * **기본값으로 메우지 않는다.** 모르는 출생지를 서울로 치면 저장할 때 본 사주와
 * 다른 사주가 같은 화면에 나온다. 값은 남아 있고 읽는 쪽이 못 읽는 것이므로,
 * 그렇게 말한다.
 */
class UnreadableInputError extends Error {
  readonly field: keyof StoredInput;

  constructor(field: keyof StoredInput, reason: string) {
    super(`저장된 출생 정보를 읽지 못했습니다 — ${reason}`);
    this.name = 'UnreadableInputError';
    this.field = field;
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(\d{2}):(\d{2})(:\d{2}(\.\d+)?)?$/;

/**
 * 저장된 입력 한 벌에서 **입력과 그 명식**을 세운다.
 *
 * 이름은 입력에 없다 — 부를 이름은 엣지(`user_person_access.local_label`)가 들고,
 * 부르는 쪽이 넘긴다. 세운을 어느 해부터 볼지도 없다. 그건 보기 설정이지 명식이
 * 아니라서, 저장된 값이 아니라 지금의 기본값이 든다.
 *
 * 명식을 여기서 함께 세우는 것이 요점이다. 입력만 내주면 `chartOf` 호출이 다시
 * 여섯 벌로 흩어지고, 그러면 **「저장된 것을 화면에 세우는 일」의 시험 가능한 자리가
 * 다시 없어진다.**
 */
export function storedChartOf(stored: StoredInput, localLabel: string): StoredChartResult {
  try {
    const query = queryOf(stored, localLabel);

    // 익명 화면과 **같은 함수**다. 여기서 따로 세면 저장하기 전에 본 사주와
    // 저장한 뒤에 보는 사주가 다를 자리가 생긴다.
    return { ok: true, query, saju: chartOf(query) };
  } catch (failure) {
    if (failure instanceof UnreadableInputError) {
      return {
        ok: false,
        kind: 'unreadable-input',
        field: failure.field,
        message: failure.message,
      };
    }

    // 사용자가 할 수 있는 것이 없는 오류 — 삼키지 않는다(위 「못 읽는 것은 값」).
    throw failure;
  }
}

function queryOf(stored: StoredInput, localLabel: string): Query {
  if (!(CALENDARS as readonly string[]).includes(stored.calendar)) {
    throw new UnreadableInputError('calendar', '모르는 달력 형식입니다');
  }

  for (const field of ['original_date', 'solar_date'] as const) {
    if (!DATE.test(stored[field])) {
      throw new UnreadableInputError(field, '생년월일 형식이 아닙니다');
    }
  }

  /**
   * **저장할 때 잡은 양력과 지금 표가 내는 양력이 같은가.**
   *
   * 저장된 입력은 고치지 않으므로 `solar_date` 가 그때의 사실이다. 그런데 화면은
   * 사용자가 적은 원본(`original_date`)을 되돌려 보여줘야 하고, 계산은 그 원본을
   * 다시 변환해서 한다 — 변환하는 자리를 하나로 두기 위해서다(`solarDateOf`).
   *
   * 그 둘이 갈리는 경우는 하나뿐이다: **변환표가 그 사이에 바뀐 것.** 그때 조용히
   * 새 값으로 계산하면 저장 전후의 사주가 달라지고, 조용히 옛 값을 쓰면 표가 왜
   * 바뀌었는지 아무도 모른다. 못 읽는 입력이라고 말하는 것이 맞다.
   *
   * **이 대조가 위의 증명을 떠받친다** — 여기를 지났다는 것이 곧 `chartOf` 안의
   * `solarDateOf` 가 같은 인자로 다시 실패하지 않는다는 뜻이다.
   */
  const restated = { ...DEFAULT_QUERY, calendar: stored.calendar as Calendar, date: stored.original_date };
  let derived: string;
  try {
    derived = isoOf(solarDateOf(restated));
  } catch (failure) {
    throw new UnreadableInputError(
      'original_date',
      failure instanceof LunarConversionError ? failure.message : '양력으로 바꾸지 못했습니다',
    );
  }

  if (derived !== stored.solar_date) {
    throw new UnreadableInputError(
      'solar_date',
      `저장할 때 잡은 양력(${stored.solar_date})과 지금 변환표의 답(${derived})이 다릅니다`,
    );
  }

  if (!(GENDERS as readonly string[]).includes(stored.gender)) {
    throw new UnreadableInputError('gender', '모르는 성별입니다');
  }

  if (!Object.hasOwn(CITY_LONGITUDES, stored.city)) {
    throw new UnreadableInputError('city', `모르는 출생지입니다 (${stored.city})`);
  }

  if (!(LATE_NIGHT_RULES as readonly string[]).includes(stored.late_night_rule)) {
    throw new UnreadableInputError('late_night_rule', '모르는 자시 규칙입니다');
  }

  if (!(TIME_BASES as readonly string[]).includes(stored.time_basis)) {
    throw new UnreadableInputError('time_basis', '모르는 시간 기준입니다');
  }

  const common = {
    ...DEFAULT_QUERY,
    name: localLabel,
    calendar: stored.calendar as Calendar,
    // 사용자가 적은 그대로 되돌린다. 양력 변환은 화면이 다시 한다 — 위에서 저장할
    // 때의 답과 같다는 것을 확인했다.
    date: stored.original_date,
    gender: stored.gender as Gender,
    city: stored.city as CityName,
    rule: stored.late_night_rule as LateNightRule,
    basis: stored.time_basis as TimeBasis,
  };

  /**
   * 시각을 모르는 것과 「아직 안 골랐다」는 다르다.
   *
   * 저장된 입력에 도착한 시점에는 이미 답한 것이므로 `hourKnown` 이 `null` 일 수
   * 없다. `null` 은 폼에만 있는 상태다.
   */
  if (stored.birth_time === null) {
    return { ...common, time: '', hourKnown: false };
  }

  const clock = TIME.exec(stored.birth_time);
  if (clock === null) {
    throw new UnreadableInputError('birth_time', '출생시각 형식이 아닙니다');
  }

  // 초는 버린다. 폼이 분까지만 받으므로 저장된 초가 있어도 되돌려 보일 자리가 없다.
  return { ...common, time: `${clock[1]}:${clock[2]}`, hourKnown: true };
}
