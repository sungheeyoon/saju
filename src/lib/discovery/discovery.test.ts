import { describe, expect, it } from 'vitest';

import {
  DISCOVERY_DISCLOSURE,
  DISCOVERY_POLICY,
  DISCOVERY_TEASER,
  DISCOVERY_V1,
  SCORE_POLICIES,
  boardNotes,
  balanceLabelOf,
  cardTextFor,
  legacyPreviewScoreOf,
  previewScoreOf,
  previewSummaryFor,
  scoreAxesOf,
  scorePolicyOf,
  scoreSideOf,
  type BalanceBand,
} from './index';
import { combinedCountBalanceOf, mutualDeficitComplementOf } from './element-axes';

import { computeSaju, type Element } from '../saju';

/**
 * **줄 세우기는 여기서 재지 않는다.**
 *
 * 순서·탐색 배치·노출 기록은 `discovery_board()` 안에서 한 번에 일어나므로
 * `supabase/tests/09_discovery_board.test.sql` 이 잰다. 여기 남은 것은 정책의 선언과
 * 말이다 — 값(가중치·밴드 경계)은 SQL 에도 하나씩 있어서 양쪽이 같은 수를 든다.
 */
describe('v2-beta 는 정책을 값으로 든다', () => {
  /**
   * 사이로 가른 두 공식(ADR 0113). 연인용 40 · 40 · 20, 일반 60 · 40(운영자 2026-09-25).
   * 무게는 근거가 아니라 가설이라 **값으로 여기 붙든다** — 고치면 이 기대값이 깨져 사람이 한 번 본다.
   */
  it('연인용은 일주 40 · 보완 40 · 균형 20, 일반은 보완 60 · 균형 40 을 쓴다', () => {
    expect(DISCOVERY_POLICY.version).toBe('v2-beta');
    expect(DISCOVERY_POLICY.weights).toEqual({
      romantic: { dayPillar: 0.4, needComplement: 0.4, combinedBalance: 0.2 },
      general: { needComplement: 0.6, combinedBalance: 0.4 },
    });
    for (const policy of SCORE_POLICIES) {
      const sum = Object.values(DISCOVERY_POLICY.weights[policy]).reduce((total, w) => total + w, 0);
      expect(sum, policy).toBeCloseTo(1, 10);
    }

    // 뺀 둘이 값으로 적혀 있다 — 「안 쓴다」가 주석이 아니라 값이어야 한다.
    expect(DISCOVERY_POLICY.excluded).toContain('dataCompleteness');
    expect(DISCOVERY_POLICY.excluded).toContain('connectionDensity');
  });

  /** 옛 판은 저장된 옛 풀이를 읽는 자리에만 남는다 — 값은 그대로다 */
  it('옛 판 discovery-v1 은 균형 70 · 개수 보완 30 그대로 남는다', () => {
    expect(DISCOVERY_V1).toEqual({
      version: 'discovery-v1',
      weights: { complement: 0.3, combinedBalance: 0.7 },
    });
  });

  it('정렬만 한다 — 문턱이 없다', () => {
    expect(DISCOVERY_POLICY.behavior).toBe('rank-only');
    expect(DISCOVERY_POLICY.hardThreshold).toBe('none');
  });

  /** 무엇을 열고 무엇을 닫는지 값으로 든다. 주석으로 적으면 화면마다 조금씩 넓어진다 */
  it('공개 범위를 값으로 선언한다', () => {
    expect(DISCOVERY_POLICY.discloses).toContain('supplied-elements');
    expect(DISCOVERY_POLICY.discloses).toContain('preview-score');

    for (const closed of ['birth-input', 'pillars', 'relations', 'element-counts']) {
      expect(DISCOVERY_POLICY.withholds).toContain(closed);
    }
  });

  /**
   * 참여 화면·ADR·`prd-archive` 가 **같은 문장**을 들어야 한다. 세 곳에 따로 적으면 한 곳만
   * 고쳐지고, 그때 사용자가 읽은 약속과 실제 동작이 갈린다.
   */
  it('참여 전 고지가 실제로 나가는 것과 나가지 않는 것을 그대로 적는다', () => {
    const shown = DISCOVERY_DISCLOSURE.shown.join(' ');
    expect(shown).toContain('닉네임');
    // 사진이 나가기 시작했다(§5.1) — 고지가 그 사실을 적는지 여기서 붙든다
    expect(shown).toContain('프로필 사진');
    expect(shown).toContain('오행');

    const hidden = DISCOVERY_DISCLOSURE.hidden.join(' ');
    expect(hidden).toContain('생년월일시');
    expect(hidden).toContain('전체 명식');
    expect(hidden).toContain('개수표');
    expect(shown).toContain('예측 궁합 점수');
  });
});

describe('추천 이유 — 맛보기는 적극적으로 말한다', () => {
  it('0개는 없는 기운, 1개는 보완에 보탬이 되는 기운으로 나누어 말한다', () => {
    const { highlights } = cardTextFor({
      suppliedElements: ['木', '金'],
      balanceBand: 'even',
      viewerCounts: { 木: 0, 火: 2, 土: 3, 金: 1, 水: 2 },
    });

    expect(highlights).toEqual([
      {
        element: '木',
        // 0개일 때만 「부족한」이다 — 1개를 부족하다고 말하면 화면이 자료에 없는 것을 말한다
        text: '내게 부족한 목(木) 기운을 채워줘요.',
      },
      {
        element: '金',
        text: '내 사주에서 적은 금(金) 기운을 보완해 줘요.',
      },
    ]);
  });

  it('채우는 오행이 없으면 이유가 비고 균형만 남는다', () => {
    const card = cardTextFor({ suppliedElements: [], balanceBand: 'even' });

    expect(card.highlights).toEqual([]);
    expect(card.balanceLabel).toContain('균형이 고른 편');
  });

  /**
   * 82점과 79점은 절대적인 궁합 차이로 읽히지만 「고른 편」과 「대체로 고른 편」은
   * 그렇지 않다. 밖으로 나가는 것은 말이고, 그 말을 가르는 경계는 SQL 이 든다.
   */
  /**
   * **빈 카드를 지어 한 줄만 꺼내던 자리가 셋이었다.**
   *
   * 요청함·인연 결과는 채우는 오행을 안 묻는다 — 그런데도 `suppliedElements: []` 로
   * 카드를 지어 `balanceLabel` 만 꺼냈다. 빈 배열이 「없다」가 아니라 「안 물었다」라서
   * 읽는 사람이 카드의 규칙을 한 번 더 확인해야 했다. 두 문이 같은 말을 내는지 잠근다.
   */
  it('균형 한 줄만 꺼내는 문이 카드와 같은 말을 낸다', () => {
    for (const band of ['even', 'mixed', 'skewed'] as const) {
      expect(balanceLabelOf(band)).toBe(
        cardTextFor({ suppliedElements: [], balanceBand: band }).balanceLabel,
      );
    }
  });

  /** 못 알아보는 밴드는 가장 낮은 칸이다 — 부르는 쪽이 그 규칙을 다시 안 적는다 */
  it('모르는 밴드는 기우는 칸의 말로 나간다', () => {
    expect(balanceLabelOf('unknown-band')).toBe(
      cardTextFor({ suppliedElements: [], balanceBand: 'skewed' }).balanceLabel,
    );
  });

  it('균형은 세 칸의 말로만 나간다', () => {
    const labelOf = (band: 'even' | 'mixed' | 'skewed') =>
      cardTextFor({ suppliedElements: [], balanceBand: band }).balanceLabel;

    expect(labelOf('even')).toContain('균형이 고른 편');
    expect(labelOf('mixed')).toContain('대체로 균형이 맞아요');
    expect(labelOf('skewed')).toContain('한쪽으로 기우는 편');

    // 경계는 `discovery_balance_band` 와 같은 수여야 한다(pgTAP 이 같은 수를 잰다).
    expect(DISCOVERY_POLICY.balanceBands).toEqual({ even: 70, mixed: 50 });
  });
});

describe('목록이 함께 드는 말', () => {
  it('빠진 오행이 없는 사람에게는 그렇게 말한다', () => {
    expect(boardNotes({ viewerMissingCount: 0, hasExploration: false }).notice).toContain(
      '20%보다 적은 오행',
    );
    expect(boardNotes({ viewerMissingCount: 2, hasExploration: false }).notice).toBeNull();
  });

  /** 없는 것을 설명하지 않는다 — 탐색 자리가 없는 날 그 말이 서 있으면 없는 것을 찾게 된다 */
  it('탐색 후보가 실제로 섰을 때만 그 말이 붙는다', () => {
    expect(boardNotes({ viewerMissingCount: 2, hasExploration: true }).explorationNote).toContain(
      '색다른 인연',
    );
    expect(boardNotes({ viewerMissingCount: 2, hasExploration: false }).explorationNote).toBeNull();
  });

  /** 첫인상에서 상세 궁합으로 이어지는 버튼 이름을 그대로 쓴다. */
  it('상세 궁합 요청하기로 다음 단계를 안내한다', () => {
    expect(DISCOVERY_TEASER).toContain('상세 궁합 요청하기를 누르면');
    expect(DISCOVERY_TEASER).toContain('두 사람의 자세한 궁합');
  });

  /**
   * **이름은 세게, 면책은 작게.** 카드는 「예측 궁합 점수」라고 부르고, 그것이 오행
   * 구성만 본 참고 점수라는 말은 목록 머리의 이 한 줄이 든다 — 카드마다 되풀이하면
   * 열 장에 열 번 같은 말이 서고, 아예 없으면 수가 근거 없이 단정으로 읽힌다.
   */
  it('참고 점수라는 사실은 목록 머리에서 한 번만 말한다', () => {
    expect(DISCOVERY_TEASER).toContain('오행 구성을 바탕으로 계산한 참고 점수');
  });
});

/**
 * **점수를 말로 옮기는 자리.**
 *
 * 카드에 적히는 수 바로 옆에 서는 문장이라, 여기서 갈리면 사용자는 같은 카드에서
 * 서로 다른 말을 두 번 읽는다.
 */
describe('previewSummaryFor 는 점수를 말로 옮긴다', () => {
  const verdictAt = (previewScore: number) =>
    previewSummaryFor({ previewScore, suppliedElements: ['木'], balanceBand: 'even' }).verdict;

  /**
   * **경계는 분포를 일곱으로 나눈 자리다** — 좋은 궁합의 객관적 경계가 아니다. `v2-beta` 연인용 점수(중앙값 56 ·
   * sd 11.3)를 옛 `discovery-v1` 경계가 받던 몫대로 잘랐다(`adults` 5000 쌍). 점수 계산을 고치면 이 일곱 수도
   * 다시 재야 하므로, 경계를 값으로 여기 붙든다.
   */
  it('일곱 구간을 분포에 맞춘 경계로 가른다', () => {
    expect(verdictAt(100)).toBe('아주 좋은 궁합일 수 있어요.');
    expect(verdictAt(75)).toBe('아주 좋은 궁합일 수 있어요.');
    expect(verdictAt(74)).toBe('좋은 궁합에 가까워요.');
    expect(verdictAt(66)).toBe('좋은 궁합에 가까워요.');
    expect(verdictAt(65)).toBe('꽤 잘 맞는 편이에요.');
    expect(verdictAt(58)).toBe('꽤 잘 맞는 편이에요.');
    expect(verdictAt(57)).toBe('무난하게 어울리는 편이에요.');
    expect(verdictAt(50)).toBe('무난하게 어울리는 편이에요.');
    expect(verdictAt(49)).toBe('조금 엇갈리는 부분이 있어요.');
    expect(verdictAt(43)).toBe('조금 엇갈리는 부분이 있어요.');
    expect(verdictAt(42)).toBe('잘 맞지 않는 부분이 있는 편이에요.');
    expect(verdictAt(33)).toBe('잘 맞지 않는 부분이 있는 편이에요.');
    expect(verdictAt(32)).toBe('서로 다른 부분이 많은 편이에요.');
    expect(verdictAt(0)).toBe('서로 다른 부분이 많은 편이에요.');
  });

  /**
   * **확정 판정은 이 제품이 낼 수 있는 말이 아니다.** 78점을 「아주 좋은 궁합이에요」로
   * 닫으면 오행 구성 하나로 두 사람 사이를 단정한 것이 된다. 허용하는 종결은 넷뿐이고
   * — 가능성(「-일 수 있어요」) · 근접(「-에 가까워요」) · 경향(「-편이에요」) ·
   * 부분(「부분이 있어요」) — 일곱 칸이 모두 그 안에 드는지 여기서 붙든다. 한 칸만
   * 단정형으로 새도 나머지 여섯의 조심이 무너진다.
   */
  it('일곱 칸 모두 단정하지 않는 꼴로 닫는다', () => {
    for (const score of [100, 75, 66, 58, 50, 43, 33, 0]) {
      expect(verdictAt(score), String(score)).toMatch(
        /(일 수 있어요|에 가까워요|편이에요|부분이 있어요)\.$/,
      );
    }
  });

  /**
   * **접속사가 곧 설명이다.** 두 축이 같은 말을 하면 「-고 …도」, 갈리면 「-지만 …은」.
   *
   * 전에는 이 자리에 균형 문장 하나만 섰다 — 점수를 만든 두 축 중 뒤 축만 말하는
   * 문장이라, 34점 옆에 「균형이 고른 편이에요」가 서고 **낮은 점수를 만든 축은 화면에
   * 한 번도 안 나왔다.**
   */
  it('두 축이 같은 방향이면 이어 붙이고, 갈리면 뒤집는 접속으로 든다', () => {
    const reasonOf = (suppliedElements: readonly Element[], balanceBand: BalanceBand) =>
      previewSummaryFor({ previewScore: 50, suppliedElements, balanceBand }).reason;

    expect(reasonOf(['木'], 'even')).toBe(
      '내게 적은 오행을 보완하는 데 보탬이 되고, 두 사람의 오행도 고르게 어우러져요.',
    );
    expect(reasonOf(['木'], 'skewed')).toBe(
      '내게 적은 오행을 보완하는 데 보탬이 되지만, 두 사람의 오행은 한쪽으로 기우는 편이에요.',
    );
    expect(reasonOf([], 'mixed')).toBe(
      '내게 적은 오행을 크게 보완하지는 않지만, 두 사람의 오행은 대체로 어우러져요.',
    );
    expect(reasonOf([], 'skewed')).toBe(
      '내게 적은 오행을 크게 보완하지 않고, 두 사람의 오행도 한쪽으로 기우는 편이에요.',
    );
  });
});

/**
 * **진입점은 하나다**(ADR 0113) — 사이로 가른 두 공식이 흩어진 두 함수가 아니다.
 *
 * 수를 손으로 적지 않는다. 엔진의 세기(월지 배수 · 지장간 몫)가 바뀌면 필요 대상이 바뀌어 점수가 움직이므로,
 * 기대값은 같은 축에서 무게만 곱해 짓는다.
 */
describe('previewScoreOf 는 정책을 받아 한 자로 잰다', () => {
  const chartOf = (year: number, month: number, day: number, hour: number | null) =>
    computeSaju(
      hour === null
        ? { year, month, day, hour: null, gender: 'female' }
        : { year, month, day, hour, minute: 0, second: 0, gender: 'female' },
    );
  const pairs = [
    [chartOf(1990, 5, 17, 14), chartOf(1992, 11, 3, 8)],
    [chartOf(1985, 1, 9, null), chartOf(1988, 7, 21, 23)],
    [chartOf(2000, 2, 29, 6), chartOf(1999, 12, 31, 12)],
  ] as const;

  it('연인용은 세 축에 40 · 40 · 20, 일반은 두 축에 60 · 40 을 곱한다', () => {
    for (const [a, b] of pairs) {
      const axes = scoreAxesOf(scoreSideOf(a), scoreSideOf(b));
      expect(previewScoreOf(scoreSideOf(a), scoreSideOf(b), { policy: 'romantic' })).toBe(
        Math.round(0.4 * axes.dayPillar + 0.4 * axes.needComplement + 0.2 * axes.combinedBalance),
      );
      expect(previewScoreOf(scoreSideOf(a), scoreSideOf(b), { policy: 'general' })).toBe(
        Math.round(0.6 * axes.needComplement + 0.4 * axes.combinedBalance),
      );
    }
  });

  /** 두 사람에게 같은 수를 낸다 — 보완 축이 두 방향의 평균이라서다 */
  it('두 사람의 차례를 바꿔도 같은 수다', () => {
    for (const [a, b] of pairs) {
      for (const policy of SCORE_POLICIES) {
        expect(previewScoreOf(scoreSideOf(a), scoreSideOf(b), { policy })).toBe(
          previewScoreOf(scoreSideOf(b), scoreSideOf(a), { policy }),
        );
      }
    }
  });

  it('옛 판의 수는 균형 70 · 개수 보완 30 으로만 난다', () => {
    for (const [a, b] of pairs) {
      const x = a.analysis.elements;
      const y = b.analysis.elements;
      expect(legacyPreviewScoreOf(x, y)).toBe(
        Math.round(0.7 * combinedCountBalanceOf(x, y) + 0.3 * mutualDeficitComplementOf(x, y)),
      );
    }
  });
});

describe('사이 → 점수 정책은 한 자리에서 정한다', () => {
  it('성립한 인연과 연인 · 배우자는 연인용, 가족 · 친구 · 동료 · 모름은 일반이다', () => {
    expect(scorePolicyOf({ matched: true, relation: null })).toBe('romantic');
    expect(scorePolicyOf({ matched: true, relation: 'family' })).toBe('romantic');
    expect(scorePolicyOf({ matched: false, relation: 'partner' })).toBe('romantic');
    expect(scorePolicyOf({ matched: false, relation: 'family' })).toBe('general');
    expect(scorePolicyOf({ matched: false, relation: 'friend' })).toBe('general');
    expect(scorePolicyOf({ matched: false, relation: null })).toBe('general');
  });

  /** 모르는 이름을 연인으로 눕히지 않는다 — 연인 근거를 모든 관계에 쓰지 않는다(ADR 0113) */
  it('모르는 사이는 일반으로 눕힌다', () => {
    for (const raw of ['', 'other', '연인']) {
      expect(scorePolicyOf({ matched: false, relation: raw }), raw).toBe('general');
    }
  });
});
