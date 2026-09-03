import {
  CITY_LONGITUDES,
  computeSaju,
  solarFromLunar,
  type CivilDate,
  type Saju,
} from '@/src/lib/saju';

import { TIME_BASIS, missingForCalculation, type Query } from './query';

/**
 * 입력의 생년월일을 양력으로 — **음력을 양력으로 바꾸는 유일한 자리.**
 *
 * `computeSaju` 는 양력만 받는다(ADR 0002). 변환을 여기 하나로 모으는 이유는
 * 폼과 계산이 서로 다른 자리에서 바꾸면 「화면에 보이는 양력」과 「계산에 들어간
 * 양력」이 갈릴 수 있기 때문이다. 폼의 미리보기도 이 함수를 부른다.
 *
 * 표 밖이거나 없는 날이면 `LunarConversionError` 를 던진다 — 부르는 쪽이
 * `calculateChart` 면 그 문장이 그대로 화면에 선다.
 */
export function solarDateOf(query: Query): CivilDate {
  const [year, month, day] = query.date.split('-').map(Number);
  if (query.calendar === 'solar') return { year, month, day };

  return solarFromLunar({ year, month, day, leap: query.calendar === 'lunar_leap' });
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

export type ChartResult = { ok: true; saju: Saju } | { ok: false; message: string };

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

  // 엔진이 던지는 메시지를 그대로 보여준다. 검증 규칙을 UI에 복제하면
  // 두 곳이 어긋나는 순간 사용자만 헷갈린다.
  try {
    return { ok: true, saju: chartOf(query) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '계산에 실패했습니다.',
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
