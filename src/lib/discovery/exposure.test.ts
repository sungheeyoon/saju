import { describe, expect, it } from 'vitest';

import {
  combinedBalanceOf,
  complementOf,
  elementSummaryOf,
  type ElementSummary,
} from '../matching/elementAxes';
import { CITY_LONGITUDES, ELEMENTS, computeSaju, type Element } from '../saju';
import { DISCOVERY_POLICY_V0 } from './index';

/**
 * **노출 분포를 재어 남긴다** — 문턱을 옮기지는 않는다.
 *
 * `prd-archive` 가 첫 배포 전에 요구한 측정이다. 고정 표본에서 `discovery-v0` 로 줄을 세웠을 때
 * 노출이 **출생시간 미상 여부**나 **특정 오행 분포**에 쏠리는지 본다. 검증되지 않은
 * 가설이 사람을 보이지 않게 만드는 것이 이 단계에서 가장 걱정되는 일이기 때문이다.
 *
 * ## 이 시험이 **하지 않는** 것
 *
 * 문턱을 자동으로 옮기지 않는다. 분포가 기울었다는 것은 정책이 틀렸다는 뜻일 수도
 * 있고 표본이 치우쳤다는 뜻일 수도 있어서, 숫자 하나로 가중치를 움직이면 무엇을
 * 근거로 움직였는지 아무 데도 안 남는다. 여기 남는 것은 **그때 이랬다**는 기록이고,
 * 값이 달라지면 snapshot 이 깨져 사람이 한 번 본다.
 *
 * ## 여기서 재는 것은 **줄 세우기지 후보 자격이 아니다**
 *
 * 하드 제외(미참여·차단·제재·자기 자신)는 DB 가 한다. 탐색 후보 섞기도 SQL 이
 * 한다 — 그 자리는 상위 밖에서 뽑으므로 쏠림을 **줄이는** 쪽이고, 여기서 빼고 재면
 * 정책이 실제보다 더 기울어 보인다. 그래서 이 측정은 「섞기 전의 상위 열」이 어떻게
 * 생겼는가이고, 실제 노출은 이보다 고르다.
 *
 * ## 2026-08-26 첫 측정에서 나온 것
 *
 * **출생시간 유무는 거의 안 갈랐다** — 65% 대 67%. 입력 완성도를 순위에 안 쓰기로 한
 * 것이 실제로 지켜지고 있다는 뜻이다(`prd-archive` 가 감시하라고 한 바로 그 값이다).
 *
 * **오행 쏠림은 갈렸다** — 金 85% · 土 64% · 水 62% · 木 51%. 34%p 차이다. 보완을
 * 축으로 쓰면 **드문 오행을 가진 사람이 더 자주 불린다**는 것이 정책의 성질이므로
 * 놀랄 일은 아니지만, 표본이 열여섯이라 이 수 자체는 아직 가볍다. 문턱도 가중치도
 * 여기서 옮기지 않는다 — 옮기려면 테스터 표본에서 다시 재고, 무엇을 근거로 옮기는지
 * 별도 결정으로 적는다(`prd-archive`: 공개 전 반드시 다시 결정할 것).
 */

/**
 * 고정 표본 — **경계에 걸린 사람들을 일부러 넣는다.**
 *
 * 골고루 퍼진 표본만 재면 「쏠리지 않는다」가 표본 덕분인지 정책 덕분인지 못 가른다.
 * 시간 미상 넷, 한 오행이 아예 없는 사람 여럿, 치우친 사람과 고른 사람을 섞는다.
 */
const SAMPLE = [
  { name: '가', year: 1990, month: 5, day: 15, hour: 14, city: '서울', gender: 'male' },
  { name: '나', year: 1992, month: 3, day: 3, hour: 8, city: '부산', gender: 'female' },
  { name: '다', year: 1988, month: 11, day: 27, hour: null, city: '대구', gender: 'male' },
  { name: '라', year: 1995, month: 7, day: 7, hour: 23, city: '인천', gender: 'female' },
  { name: '마', year: 1983, month: 1, day: 19, hour: null, city: '광주', gender: 'male' },
  { name: '바', year: 1997, month: 9, day: 30, hour: 5, city: '대전', gender: 'female' },
  { name: '사', year: 1979, month: 6, day: 6, hour: 12, city: '서울', gender: 'male' },
  { name: '아', year: 2001, month: 2, day: 14, hour: null, city: '부산', gender: 'female' },
  { name: '자', year: 1986, month: 12, day: 2, hour: 19, city: '대구', gender: 'male' },
  { name: '차', year: 1993, month: 8, day: 21, hour: 3, city: '서울', gender: 'female' },
  { name: '카', year: 1975, month: 4, day: 11, hour: 16, city: '인천', gender: 'male' },
  { name: '타', year: 1999, month: 10, day: 8, hour: null, city: '광주', gender: 'female' },
  { name: '파', year: 1991, month: 2, day: 28, hour: 21, city: '대전', gender: 'male' },
  { name: '하', year: 1984, month: 9, day: 3, hour: 10, city: '서울', gender: 'female' },
  { name: '거', year: 2000, month: 5, day: 5, hour: 1, city: '부산', gender: 'male' },
  { name: '너', year: 1978, month: 7, day: 24, hour: 18, city: '대구', gender: 'female' },
] as const;

type Participant = {
  name: string;
  summary: ElementSummary;
  /** 시각을 모르면 여섯 글자로 센다 — 노출이 그 차이를 따라가는지 보려는 값 */
  hourKnown: boolean;
  /** 가장 많은 오행. 쏠림을 오행별로 묶어 보는 자리 */
  dominant: Element;
};

const participants: Participant[] = SAMPLE.map((one) => {
  /** 시간 미상은 `hour: null` 이고, 그때는 분·초를 함께 넘길 수 없다(엔진의 계약) */
  const input =
    one.hour === null
      ? { year: one.year, month: one.month, day: one.day, hour: null, gender: one.gender }
      : {
          year: one.year,
          month: one.month,
          day: one.day,
          hour: one.hour,
          minute: 0,
          second: 0,
          gender: one.gender,
        };

  const saju = computeSaju(input, {
    longitude: CITY_LONGITUDES[one.city],
    useLongitude: true,
  });

  const summary = elementSummaryOf(saju.analysis.elements);
  const dominant = ELEMENTS.reduce((best, element) =>
    summary.counts[element] > summary.counts[best] ? element : best,
  );

  return { name: one.name, summary, hourKnown: one.hour !== null, dominant };
});

/** `discovery-v0` 의 점수 — SQL 이 하는 셈과 같은 두 축·같은 가중치 */
function scoreFor(viewer: ElementSummary, candidate: ElementSummary): number {
  const { complement, combinedBalance } = DISCOVERY_POLICY_V0.weights;
  return (
    complementOf(viewer, candidate) * complement +
    combinedBalanceOf(viewer, candidate) * combinedBalance
  );
}

/** 저마다의 상위 열에 누가 서는가 — 하드 제외는 자기 자신뿐이다(정책은 지우지 않는다) */
function timesShown(): Map<string, number> {
  const shown = new Map(participants.map((one) => [one.name, 0]));

  for (const viewer of participants) {
    const ranked = participants
      .filter((one) => one.name !== viewer.name)
      .map((one) => ({ name: one.name, score: scoreFor(viewer.summary, one.summary) }))
      // 동점은 이름으로 가른다 — 입력 순서에 기대면 표본을 섞을 때 값이 흔들린다.
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, DISCOVERY_POLICY_V0.pageSize);

    for (const row of ranked) shown.set(row.name, (shown.get(row.name) ?? 0) + 1);
  }

  return shown;
}

const rate = (names: readonly string[], shown: Map<string, number>): number => {
  const chances = participants.length - 1;
  const total = names.reduce((sum, name) => sum + (shown.get(name) ?? 0), 0);
  return Math.round((total / (names.length * chances)) * 100);
};

describe('discovery-v0 의 노출 분포 — 재어서 남긴다', () => {
  const shown = timesShown();

  it('아무도 목록에서 사라지지 않는다', () => {
    /*
      **정책은 정렬만 한다.** 사주 계산값에 하드 threshold 를 두어 후보를 지우지
      않기로 했으므로(`prd-archive`), 표본이 한 화면에 들어가는 크기일 때 한 번도 안 서는
      사람이 있으면 그것은 정렬이 아니라 배제다.
    */
    const never = participants.filter((one) => (shown.get(one.name) ?? 0) === 0);
    expect(never.map((one) => one.name)).toEqual([]);
  });

  it('출생시간 유무에 따른 노출 격차를 값으로 남긴다', () => {
    const known = participants.filter((one) => one.hourKnown).map((one) => one.name);
    const unknown = participants.filter((one) => !one.hourKnown).map((one) => one.name);

    /*
      **입력 완성도는 순위에 쓰지 않기로 했다**(`prd-archive`·ADR 0003). 그래도 격차는 날 수
      있다 — 여섯 글자는 여덟 글자보다 「없는 오행」이 많아 보완 점수가 달라지기
      때문이다. 그 격차가 얼마인지를 여기서 값으로 든다.
    */
    expect({
      시각을_아는_사람: known.length,
      시각을_모르는_사람: unknown.length,
      아는_쪽_노출률: rate(known, shown),
      모르는_쪽_노출률: rate(unknown, shown),
    }).toMatchInlineSnapshot(`
      {
        "모르는_쪽_노출률": 65,
        "시각을_모르는_사람": 4,
        "시각을_아는_사람": 12,
        "아는_쪽_노출률": 67,
      }
    `);
  });

  it('오행 쏠림에 따른 노출 분포를 값으로 남긴다', () => {
    const byElement = Object.fromEntries(
      ELEMENTS.map((element) => {
        const names = participants
          .filter((one) => one.dominant === element)
          .map((one) => one.name);
        return [element, names.length === 0 ? null : rate(names, shown)];
      }),
    );

    expect(byElement).toMatchInlineSnapshot(`
      {
        "土": 64,
        "木": 51,
        "水": 62,
        "火": null,
        "金": 85,
      }
    `);
  });
});
