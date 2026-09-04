import { describe, expect, it } from 'vitest';

import {
  DISCOVERY_DISCLOSURE,
  DISCOVERY_POLICY_V0,
  DISCOVERY_TEASER,
  ELEMENT_MEANING,
  boardNotes,
  cardTextFor,
} from './index';

/**
 * **줄 세우기는 여기서 재지 않는다.**
 *
 * 순서·탐색 배치·노출 기록은 `discovery_board()` 안에서 한 번에 일어나므로
 * `supabase/tests/09_discovery_board.test.sql` 이 잰다. 여기 남은 것은 정책의 선언과
 * 말이다 — 값(가중치·밴드 경계)은 SQL 에도 하나씩 있어서 양쪽이 같은 수를 든다.
 */
describe('discovery-v0 는 정책을 값으로 든다', () => {
  /**
   * `match-v0` 의 두 축(0.35 · 0.30)을 남기고 합이 1이 되게 다시 나눈 값이다.
   * **거기서 왔을 뿐 지금부터는 따로 산다** — `match-v0` 가 가중치를 고치면 이 기대값은
   * 그대로 두고 `discovery-v1` 을 만들지 말지를 따로 정한다.
   */
  it('가중치는 match-v0 의 남은 두 축을 다시 나눈 비율이다', () => {
    expect(DISCOVERY_POLICY_V0.weights).toEqual({ complement: 0.54, combinedBalance: 0.46 });
    expect(DISCOVERY_POLICY_V0.weights.complement + DISCOVERY_POLICY_V0.weights.combinedBalance).toBe(1);

    // 뺀 둘이 값으로 적혀 있다 — 「안 쓴다」가 주석이 아니라 값이어야 한다.
    expect(DISCOVERY_POLICY_V0.excluded).toContain('dataCompleteness');
    expect(DISCOVERY_POLICY_V0.excluded).toContain('connectionDensity');
  });

  it('정렬만 한다 — 문턱이 없다', () => {
    expect(DISCOVERY_POLICY_V0.behavior).toBe('rank-only');
    expect(DISCOVERY_POLICY_V0.hardThreshold).toBe('none');
  });

  /** 무엇을 열고 무엇을 닫는지 값으로 든다. 주석으로 적으면 화면마다 조금씩 넓어진다 */
  it('공개 범위를 값으로 선언한다', () => {
    expect(DISCOVERY_POLICY_V0.discloses).toContain('supplied-elements');
    expect(DISCOVERY_POLICY_V0.discloses).toContain('element-meaning');

    for (const closed of ['birth-input', 'pillars', 'relations', 'element-counts', 'score']) {
      expect(DISCOVERY_POLICY_V0.withholds).toContain(closed);
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
    expect(shown).toContain('뜻');

    const hidden = DISCOVERY_DISCLOSURE.hidden.join(' ');
    expect(hidden).toContain('생년월일시');
    expect(hidden).toContain('전체 명식');
    expect(hidden).toContain('개수표');
    expect(hidden).toContain('숫자 점수');
  });
});

describe('추천 이유 — 맛보기는 적극적으로 말한다', () => {
  it('어느 오행을 채우는지 이름과 뜻을 말한다', () => {
    const { highlights } = cardTextFor({ suppliedElements: ['木', '金'], balanceBand: 'even' });

    expect(highlights).toEqual([
      {
        element: '木',
        meaning: ELEMENT_MEANING.木,
        text: '당신에게 부족한 목(木) 기운을 채워 성장과 확장을 돕는 조합입니다.',
      },
      {
        element: '金',
        meaning: ELEMENT_MEANING.金,
        text: '당신에게 부족한 금(金) 기운을 채워 안정감과 결단력을 돕는 조합입니다.',
      },
    ]);
  });

  it('채우는 오행이 없으면 이유가 비고 균형만 남는다', () => {
    const card = cardTextFor({ suppliedElements: [], balanceBand: 'even' });

    expect(card.highlights).toEqual([]);
    expect(card.balanceLabel).toContain('고르게 잡히는 편');
  });

  /**
   * 82점과 79점은 절대적인 궁합 차이로 읽히지만 「고른 편」과 「대체로 고른 편」은
   * 그렇지 않다. 밖으로 나가는 것은 말이고, 그 말을 가르는 경계는 SQL 이 든다.
   */
  it('균형은 세 칸의 말로만 나간다', () => {
    const labelOf = (band: 'even' | 'mixed' | 'skewed') =>
      cardTextFor({ suppliedElements: [], balanceBand: band }).balanceLabel;

    expect(labelOf('even')).toContain('고르게 잡히는 편');
    expect(labelOf('mixed')).toContain('대체로 고른 편');
    expect(labelOf('skewed')).toContain('한쪽으로 기우는 편');

    // 경계는 `discovery_balance_band` 와 같은 수여야 한다(pgTAP 이 같은 수를 잰다).
    expect(DISCOVERY_POLICY_V0.balanceBands).toEqual({ even: 70, mixed: 50 });
  });
});

describe('목록이 함께 드는 말', () => {
  it('빠진 오행이 없는 사람에게는 그렇게 말한다', () => {
    expect(boardNotes({ viewerMissingCount: 0, hasExploration: false }).notice).toContain(
      '빠진 오행이 없어',
    );
    expect(boardNotes({ viewerMissingCount: 2, hasExploration: false }).notice).toBeNull();
  });

  /** 없는 것을 설명하지 않는다 — 탐색 자리가 없는 날 그 말이 서 있으면 없는 것을 찾게 된다 */
  it('탐색 후보가 실제로 섰을 때만 그 말이 붙는다', () => {
    expect(boardNotes({ viewerMissingCount: 2, hasExploration: true }).explorationNote).toContain(
      '새로운 추천',
    );
    expect(boardNotes({ viewerMissingCount: 2, hasExploration: false }).explorationNote).toBeNull();
  });

  /** 여기서 멈추는 이유와 다음 — 상세 궁합은 서로 동의한 뒤다(US 36) */
  it('상세 궁합은 서로 동의한 뒤라고 말한다', () => {
    expect(DISCOVERY_TEASER).toContain('서로 동의하면');
    expect(DISCOVERY_TEASER).toContain('형충회합');
  });
});
