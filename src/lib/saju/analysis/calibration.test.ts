import { beforeAll, describe, expect, it } from 'vitest';

import { computeSaju } from '../index';
import { randomInputs } from '../population';
import { TONGGWAN_POLICY } from './tonggwan';

/**
 * 모집단 보정값 — **한 바퀴로 다 잰다.**
 *
 * 통관·대조·서열이 저마다 3000건을 돌던 때가 있었다. 세 파일에 흩어져 있으니 한 번
 * 도는 값을 세 번 돌았고, 그 부하가 **남의 시험을 시간 초과로 밀어냈다** — 절입일
 * 경고를 1900~2100 전 구간에서 훑는 회귀 시험이 기본 5초를 넘겼다. 재는 값이 는 것이
 * 아니라 같은 값을 세 번 잰 것이 문제였다.
 *
 * 그래서 **한 자리에서 한 바퀴만 돈다.** 명식을 배열로 들고 있지도 않는다 — 3000개를
 * 쌓아 두면 수백 MB 가 되므로, 돌면서 세고 버린다.
 *
 * 여기 적힌 숫자는 정책 상수가 든 값과 같아야 한다. 갈리면 고칠 것은 시험이 아니라
 * 그 정책이다 — **계약이 죽은 값을 들고 있으면 그 값은 검증되지 않는다.**
 */

/** 3000건을 도는 값이라 기본 5초로는 모자란다 — 비용을 아는 자리에서 제 시간을 든다 */
const POPULATION_TIMEOUT_MS = 30_000;

const SAMPLE = 3000;

type Tally = {
  /** 가장 팽팽한 쌍의 가벼운 쪽 몫이 문턱 이상인 건수 */
  facingAtLeast: Map<number, number>;
  /** 통관신이 여덟 글자에 드러나지 않은 건수 */
  bridgeNotRevealed: number;
  /** 억부와 조후가 같은 것을 가리킨 건수 */
  aligned: number;
  /** 억부와 어긋나는 판정이 하나라도 있는 건수 */
  shaken: number;
};

const FLOORS = [0.15, 0.2, 0.25, 0.3, 0.35];

function tally(): Tally {
  const counted: Tally = {
    facingAtLeast: new Map(FLOORS.map((floor) => [floor, 0])),
    bridgeNotRevealed: 0,
    aligned: 0,
    shaken: 0,
  };

  for (const input of randomInputs(SAMPLE)) {
    const { tonggwan, yongsinAgreement, precedence } = computeSaju(input).analysis;
    const { tightest } = tonggwan;

    for (const floor of FLOORS) {
      if (tightest.facing >= floor) {
        counted.facingAtLeast.set(floor, counted.facingAtLeast.get(floor)! + 1);
      }
    }
    if (tightest.bridgePresence !== 'revealed') counted.bridgeNotRevealed += 1;
    if (yongsinAgreement.aligned) counted.aligned += 1;
    if (precedence.rows.some((row) => row.disagrees === true)) counted.shaken += 1;
  }

  return counted;
}

const share = (count: number) => Math.round((count / SAMPLE) * 1000) / 1000;

describe('모집단 보정값 (시드 20260821 · 3000건)', () => {
  let counted: Tally;

  /** 한 바퀴는 기본 5초를 넘으므로 이 훅이 제 시간을 든다 */
  beforeAll(() => {
    counted = tally();
  }, POPULATION_TIMEOUT_MS);

  /**
   * 문턱을 아직 안 골랐어도 바탕은 재어 둔다. 고르는 날 표본을 새로 만들면 여기 적힌
   * 것과 견줄 수 없다 — 종격이 「재현율이 올랐다」가 규칙 덕인지 문턱 덕인지 구별하지
   * 못했던 자리에서 배운 것이다.
   */
  it('통관 — 가장 팽팽한 쌍의 분포가 정책이 적은 값과 같다', () => {
    const measured = TONGGWAN_POLICY.calibration;

    for (const [floor, expected] of Object.entries(measured.facingAtLeast)) {
      expect(share(counted.facingAtLeast.get(Number(floor))!), `facing ≥ ${floor}`).toBe(expected);
    }
    expect(share(counted.bridgeNotRevealed)).toBe(measured.bridgeNotRevealed);
  });

  /**
   * **어긋나는 쪽이 드물지 않다** — 억부·조후 대조를 화면에 세운 까닭이다. 나머지
   * 43.2% 에서는 두 칸이 서로 다른 것을 권하고 있었고 아무도 그 사실을 말하지 않았다.
   */
  it('대조 — 억부와 조후가 같은 것을 가리키는 비율', () => {
    expect(share(counted.aligned)).toBe(0.568);
  });

  /**
   * **서열 표가 서야 하는 이유를 수로 남긴다.** 억부와 어긋나는 판정이 하나라도 있는
   * 명식이 절반을 넘는다 — 서열 없이 자료를 내보내는 것은 그만큼 자주 받는 쪽을
   * 흔드는 일이다.
   */
  it('서열 — 어긋남이 하나라도 있는 명식의 비율', () => {
    expect(share(counted.shaken)).toBe(0.545);
  });
});
