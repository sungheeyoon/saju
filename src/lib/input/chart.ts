import {
  CITY_LONGITUDES,
  LunarConversionError,
  computeSaju,
  lunarMonthsOf,
  solarFromLunar,
  type CivilDate,
  type Saju,
} from '../saju';

import { TIME_BASIS, dateEntryRefusal, missingForCalculation, type DatePart, type Query } from './query';

/**
 * 입력의 생년월일을 양력으로 — **음력을 양력으로 바꾸는 유일한 자리.**
 *
 * `computeSaju` 는 양력만 받는다(ADR 0002). 변환을 여기 하나로 모으는 이유는
 * 폼과 계산이 서로 다른 자리에서 바꾸면 「화면에 보이는 양력」과 「계산에 들어간
 * 양력」이 갈릴 수 있기 때문이다. 폼의 미리보기도 이 함수를 부른다.
 *
 * 표 밖이거나 없는 날이면 `LunarConversionError` 를 던진다. 그 문장은 엔진의 것이라 화면에 세우지 않는다 —
 * 사람에게 하는 말은 `dateRefusal` 이 짓는다.
 */
export function solarDateOf(query: Query): CivilDate {
  const [year, month, day] = query.date.split('-').map(Number);
  if (query.calendar === 'solar') return { year, month, day };

  return solarFromLunar({ year, month, day, leap: query.calendar === 'lunar_leap' });
}

/**
 * 다 적힌 생년월일이 **어느 칸에서 거절되는가** — 자리 범위(`dateEntryRefusal`) 다음에 음력 표가 본다. 없으면 `null`.
 *
 * 폼이 그 칸을 붉히고 버튼 곁 · 계산 · 저장이 같은 문장을 쓴다. 음력의 갈래(없는 윤달 · 그 달에 없는 날 · 표 밖의 해)는
 * 엔진이 값으로 내고(`LunarConversionError.reason`), 문장은 여기서 양력 쪽(`dateEntryRefusal`)과 같은 말투로 짓는다 — 엔진의
 * 문장은 합쇼체에 디버그 꼬리(「…29일까지입니다: 31일」)라 화면에 세우지 않는다(대장 42).
 */
export function dateRefusal(query: Query): { part: DatePart; message: string } | null {
  const entry = dateEntryRefusal(query);
  if (entry !== null || query.calendar === 'solar' || query.date === '') return entry;

  try {
    solarDateOf(query);
    return null;
  } catch (error) {
    if (!(error instanceof LunarConversionError)) throw error;
    return lunarRefusalOf(query, error);
  }
}

/** 음력 표가 거절한 갈래를 사람의 말로 — 숫자는 표에서 읽는다(`lunarMonthsOf`) */
function lunarRefusalOf(query: Query, error: LunarConversionError): { part: DatePart; message: string } {
  const [year, month, day] = query.date.split('-').map(Number);
  // 받는 해는 표보다 좁아 `dateEntryRefusal` 이 먼저 걸린다 — 여기 오는 것은 숫자가 아닌 해뿐이다.
  if (error.reason === 'out-of-range') return { part: 'year', message: '생년월일을 다시 확인해 주세요.' };

  const months = lunarMonthsOf(year);
  if (error.reason === 'no-such-leap-month') {
    const leap = months.find((one) => one.leap);
    return {
      part: 'month',
      message: leap === undefined ? `${year}년에는 윤달이 없어요.` : `${year}년 윤달은 윤${leap.month}월이에요.`,
    };
  }

  const leap = query.calendar === 'lunar_leap';
  const days = months.find((one) => one.month === month && one.leap === leap)?.days;
  // 평달 1~12 는 해마다 있고 윤달이 없으면 위에서 갈렸다 — 달을 못 찾으면 표나 변환의 버그다.
  if (days === undefined) throw error;
  const name = `음력 ${leap ? '윤' : ''}${month}월`;
  return { part: 'day', message: day < 1 ? `${name}은 1일부터 ${days}일까지예요.` : `${name}은 ${days}일까지예요.` };
}

/**
 * `CivilDate` 를 `YYYY-MM-DD` 로 — **한 자리에서 만든다.**
 *
 * 저장하는 쪽(`p_solar_date`), 저장된 입력을 되읽는 쪽(양력 대조), 화면에 적는 쪽
 * (「계산에 쓴 양력 날짜」)이 같은 글자를 만들어야 한다. 세 벌로 적혀 있었고 그중
 * 하나라도 자리수를 다르게 채우면 **대조가 조용히 틀린다** — 비교하는 값이지
 * 보여주기만 하는 값이 아니다.
 */
export function isoOf({ year, month, day }: CivilDate): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * 입력 한 벌을 명식으로 바꾸는 **한 자리.**
 *
 * 원국 화면과 궁합 화면이 각자 들고 있었다. 그러면 한쪽만 고쳐져서 「같은 값을
 * 넣었는데 다른 사주가 나오는」 상태가 만들어진다 — 폼을 한 자리에 둔 것과 같은
 * 이유다(`birth-form.tsx`).
 *
 * 이제 서버도 여기를 부른다. 저장된 판본으로 계산할 때 브라우저와 다른 코드를 쓰면,
 * 「저장하기 전에 본 사주」와 「저장한 뒤에 보는 사주」가 달라질 자리가 생긴다.
 * 엔진이 순수 TypeScript 라(React·Next 의존성이 없다) 양쪽에서 그대로 돈다.
 */

export function chartOf(query: Query): Saju {
  const { year, month, day } = solarDateOf(query);
  const [hour, minute] = query.time.split(':').map(Number);
  const { useLongitude, useEquationOfTime } = TIME_BASIS[query.basis];

  return computeSaju(
    query.hourKnown === false
      ? { year, month, day, hour: null, gender: query.gender }
      : { year, month, day, hour, minute, second: 0, gender: query.gender },
    {
      lateNightRule: query.rule,
      longitude: CITY_LONGITUDES[query.city],
      useLongitude,
      useEquationOfTime,
      saeun: { fromYear: query.saeunFrom, count: 10 },
      // useDst 는 넘기지 않는다 — 엔진 기본값이 '되돌린다'이고,
      // 그것이 물어볼 일 없는 사실이기 때문이다.
    },
  );
}

type ChartResult = { ok: true; saju: Saju } | { ok: false; message: string };

/** 못 계산할 입력을 문장으로 돌려준다 — 던지지 않는다. 화면이 그대로 보여준다. */
export function calculateChart(query: Query): ChartResult {
  // 버튼을 잠그는 쪽과 같은 함수를 본다. 여기서 조건을 다시 적으면 두 곳이
  // 어긋나는 순간 눌리는데 거절하거나 잠겼는데 계산은 되는 상태가 생긴다.
  //
  // 이름은 빼고 본다 — 계산에 들어가지 않으므로 이름 칸이 생기기 전에 나눠 준
  // 링크가 그대로 열려야 한다(`missingAnswer` ↔ `missingForCalculation`).
  const missing = missingForCalculation(query);
  if (missing !== null) return { ok: false, message: missing };

  const parts = query.date.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return { ok: false, message: '생년월일을 입력해 주세요.' };
  }

  // 음력 표의 거절은 폼이 칸을 붉히는 것과 같은 문장이다 — 엔진의 문장을 세우지 않는다.
  const refused = dateRefusal(query);
  if (refused !== null) return { ok: false, message: refused.message };

  // 그 밖에 엔진이 던지는 메시지는 그대로 보여준다. 검증 규칙을 UI에 복제하면
  // 두 곳이 어긋나는 순간 사용자만 헷갈린다.
  try {
    return { ok: true, saju: chartOf(query) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '사주를 계산하지 못했어요. 입력을 다시 확인해 주세요.',
    };
  }
}

/**
 * 같은 사람인지 견주는 값 — **여덟 글자와 「시각을 아는가」.**
 *
 * 이름도 메모도 출생지도 안 든다. 서울에서 났다고 적었든 부산이라 적었든, 나온 명식이
 * 같으면 우리가 아는 한 같은 명식이다 — 견주는 것은 **입력이 아니라 결과**여야 한다.
 * 같은 사람을 양력으로 한 번, 음력으로 한 번 넣는 것이 정확히 사용자가 자기가 이미
 * 저장한 줄 모르는 경우이고, 원문으로 견주면 그 경우를 못 잡는다.
 *
 * **시각을 모르는 여섯 글자는 여덟 글자와 다른 명식이다.** 같다고 하면 시주가 있는 쪽의
 * 풀이를 없는 쪽에 붙이게 된다. `pillars.hour` 가 `null` 인 것이 그 사실이라 따로 실을
 * 값이 없다.
 *
 * 저장해 두지 않는다. 엔진이 바뀌면 저장된 지문은 **조용히 낡고**, 낡은 지문은 「다른
 * 사람」이라고 조용히 답한다. 견줄 때 계산하면 언제나 지금 엔진의 답이다.
 */
export function chartFingerprint(saju: Saju): string {
  const { year, month, day, hour } = saju.pillars;
  return [year.name, month.name, day.name, hour?.name ?? '시각모름'].join('/');
}
