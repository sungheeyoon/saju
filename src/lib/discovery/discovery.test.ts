import { describe, expect, it } from 'vitest';

import {
  DISCOVERY_DISCLOSURE,
  DISCOVERY_POLICY,
  DISCOVERY_TEASER,
  boardNotes,
  cardTextFor,
  previewSummaryFor,
  type BalanceBand,
} from './index';

import type { Element } from '../saju';

/**
 * **줄 세우기는 여기서 재지 않는다.**
 *
 * 순서·탐색 배치·노출 기록은 `discovery_board()` 안에서 한 번에 일어나므로
 * `supabase/tests/09_discovery_board.test.sql` 이 잰다. 여기 남은 것은 정책의 선언과
 * 말이다 — 값(가중치·밴드 경계)은 SQL 에도 하나씩 있어서 양쪽이 같은 수를 든다.
 */
describe('discovery-v1 는 정책을 값으로 든다', () => {
  /**
   * `match-v0` 의 두 축(0.35 · 0.30)을 남기고 합이 1이 되게 다시 나눈 값이다.
   * **거기서 왔을 뿐 지금부터는 따로 산다** — `match-v0` 가 가중치를 고치면 이 기대값은
   * 그대로 두고 `discovery-v1` 을 만들지 말지를 따로 정한다.
   */
  it('균형 70%, 상호보완 30%를 쓴다', () => {
    expect(DISCOVERY_POLICY.weights).toEqual({ complement: 0.3, combinedBalance: 0.7 });
    expect(DISCOVERY_POLICY.weights.complement + DISCOVERY_POLICY.weights.combinedBalance).toBe(1);
    expect(DISCOVERY_POLICY.version).toBe('discovery-v1');

    // 뺀 둘이 값으로 적혀 있다 — 「안 쓴다」가 주석이 아니라 값이어야 한다.
    expect(DISCOVERY_POLICY.excluded).toContain('dataCompleteness');
    expect(DISCOVERY_POLICY.excluded).toContain('connectionDensity');
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
  it('상세 궁합 보기로 다음 단계를 안내한다', () => {
    expect(DISCOVERY_TEASER).toContain('상세 궁합 보기를 선택하면');
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
   * **경계는 분포에서 왔다.** 이 점수는 중앙값 65 언저리에 몰리고 80 을 넘는 쌍이
   * 서른에 하나다 — 90·80·70 에 금을 그으면 맨 위 두 칸이 영영 안 뜬다. 점수 계산을
   * 고치면 이 일곱 수도 다시 재야 하므로, 경계를 값으로 여기 붙든다.
   */
  it('일곱 구간을 분포에 맞춘 경계로 가른다', () => {
    expect(verdictAt(100)).toBe('아주 좋은 궁합일 수 있어요.');
    expect(verdictAt(78)).toBe('아주 좋은 궁합일 수 있어요.');
    expect(verdictAt(77)).toBe('좋은 궁합에 가까워요.');
    expect(verdictAt(72)).toBe('좋은 궁합에 가까워요.');
    expect(verdictAt(71)).toBe('꽤 잘 맞는 편이에요.');
    expect(verdictAt(66)).toBe('꽤 잘 맞는 편이에요.');
    expect(verdictAt(65)).toBe('무난하게 어울리는 편이에요.');
    expect(verdictAt(60)).toBe('무난하게 어울리는 편이에요.');
    expect(verdictAt(59)).toBe('조금 엇갈리는 부분이 있어요.');
    expect(verdictAt(54)).toBe('조금 엇갈리는 부분이 있어요.');
    expect(verdictAt(53)).toBe('잘 맞지 않는 부분이 있는 편이에요.');
    expect(verdictAt(46)).toBe('잘 맞지 않는 부분이 있는 편이에요.');
    expect(verdictAt(45)).toBe('서로 다른 부분이 많은 편이에요.');
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
    for (const score of [100, 78, 72, 66, 60, 54, 46, 0]) {
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
