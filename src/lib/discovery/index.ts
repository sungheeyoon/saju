import { ELEMENT_KO, type Element } from '../saju';

/**
 * `discovery-v0` — 아직 선택되지 않은 후보의 **노출 순서**.
 *
 * `match-v0` 와 **다른 정책이고 다른 일을 한다**(ADR 0003). 같은 숫자를 두 일에 쓰면
 * 한쪽이 만든 편향이 다른 쪽의 신뢰로 세탁된다. 그래서 네 축 중 둘을 일부러 뺐다.
 *
 * - `dataCompleteness` — 사람의 적합성이 아니라 **우리 자료의 완성도**다. 순위에
 *   넣으면 출생시간을 모르는 사람이 사주가 안 맞아서가 아니라 입력이 덜 차서 덜
 *   노출된다.
 * - `connectionDensity` — 관계 신호의 **양**이지 좋은 관계라는 뜻이 아니다. 위에 뜬
 *   사람은 사용자에게 「추천」으로 읽힌다.
 *
 * **정렬만 한다.** 사주 계산값에 문턱을 두어 사람을 지우지 않는다 — 안 보여준 사람은
 * 사용자가 존재조차 모르므로 틀렸다는 피드백이 영영 오지 않는다. 하드 제외는 사주와
 * 무관하고 근거가 또렷한 것뿐이고, 그 판정은 **여기가 아니라 DB 가 한다**(정책은
 * 후보가 왜 후보인지 모른다).
 *
 * 축의 값(`complement` · `combinedBalance`)도 여기서 계산하지 않는다. 후보의 오행
 * 요약 전체는 브라우저로 내려가지 않아야 하므로 두 축은 DB 안에서 나고
 * (`discovery_complement` · `discovery_combined_balance`), 이 모듈은 **가중치·섞기·문장**만 든다.
 *
 * ## 후보 카드는 **맛보기**다
 *
 * 추천 이유는 적극적으로 말한다 — 어느 오행이 무엇을 채우는지까지. 그것을 감추면
 * 「왜 이 사람인가」에 답하지 못하고, 답하지 못하는 추천은 궁금해지지도 않는다.
 * 감추는 것은 **상세 궁합과 원문**이다: 여덟 글자, 천간·지지, 십성·신살·형충회합,
 * 운, 그리고 생년월일시·출생지. 그 둘 사이의 경계가 이 정책의 `discloses` ·
 * `withholds` 이고, 형충회합과 상세 근거는 **서로 동의한 뒤**에 열린다.
 */

/**
 * 정책 — **축·가중치·탐색 비율·버전을 값으로 선언한다**(PRD).
 *
 * 가중치는 `match-v0` 의 두 축(0.35 · 0.30)을 남기고 합이 1이 되게 다시 나눈 값이다
 * (0.35/0.65 ≈ 0.54, 0.30/0.65 ≈ 0.46). **거기서 왔을 뿐 지금부터는 따로 산다** —
 * `match-v0` 의 가중치를 고쳐도 이 값은 움직이지 않는다. 움직이면 `discovery-v0` 라는
 * 이름이 가리키는 것이 조용히 바뀐다.
 */
export const DISCOVERY_POLICY_V0 = {
  version: 'discovery-v0',
  status: 'beta',
  /** 정렬만 하고 사람을 지우지 않는다 */
  behavior: 'rank-only',
  hardThreshold: 'none',
  weights: {
    complement: 0.54,
    combinedBalance: 0.46,
  },
  /** 순위에 쓰지 않는 것 — 뺀 이유는 위 주석과 ADR 0003 에 있다 */
  excluded: [
    'dataCompleteness',
    'connectionDensity',
    'eokbu',
    'following-pattern',
    'structure',
    'johu-conditions',
  ] as const,
  /** 목록의 이만큼은 상위가 아닌 자리에서 뽑아 섞는다 */
  explorationRatio: 0.2,
  /** 한 번에 보여주는 후보 수 */
  pageSize: 10,

  /**
   * 균형 값을 말로 바꾸는 문턱.
   *
   * **숫자를 보여주지 않으므로 이 두 수가 곧 사용자가 보는 차이다.** 82점과 79점은
   * 절대적인 궁합 차이로 읽히지만 「고른 편」과 「대체로 고른 편」은 그렇지 않다.
   * 그래서 숫자 대신 이 경계를 값으로 적어 둔다.
   */
  balanceBands: { even: 70, mixed: 50 },

  /**
   * 후보 카드가 **말해도 되는 것**과 **말하지 않는 것**.
   *
   * 경계를 값으로 든다. 주석으로 적으면 아무것도 잠그지 않고, 화면마다 조금씩
   * 넓어진다. 오른쪽은 서로 동의한 뒤에 열리는 것들이고, 생년월일시와 출생지는
   * 그때도 열리지 않는다(ADR 0008).
   */
  discloses: ['supplied-elements', 'element-meaning', 'balance-label'] as const,
  withholds: [
    'birth-input',
    'birth-place',
    'pillars',
    'stems-and-branches',
    'ten-gods',
    'sinsal',
    'relations',
    'luck',
    'evidence',
    'element-counts',
    'score',
  ] as const,
} as const;

/**
 * 오행 한 글자가 사람에게 무엇으로 읽히는가 — **관습적 의미이지 계산 결과가 아니다.**
 *
 * 엔진이 낸 사실이 아니므로 강도 딱지가 붙지 않는다. 후보 카드가 「왜 이 사람인가」를
 * 사람 말로 옮길 때만 쓰고, 사실을 말하는 자리에서는 쓰지 않는다.
 */
export const ELEMENT_MEANING: Record<Element, string> = {
  木: '성장과 확장',
  火: '열정과 표현',
  土: '중심과 포용',
  金: '안정감과 결단력',
  水: '유연함과 통찰',
};

export type DiscoveryAxisKey = keyof typeof DISCOVERY_POLICY_V0.weights;

/**
 * DB 가 내주는 후보 한 줄 — **오행 요약 전체는 오지 않는다.**
 *
 * 두 축은 이미 값으로 계산돼 있고, 함께 오는 것은 **추천 이유에 직접 쓰이는 오행들**
 * 뿐이다. 상대의 전체 구성(오행별 개수표)은 오지 않는다 — 그것까지 받아 오면 화면에서
 * 접어 봐야 소용없고(개발자 도구 한 번에 다 보인다), 카드가 말해야 하는 것도 아니다.
 */
export type CandidateFacts = {
  /** 후보를 가리키는 불투명 식별자. 정책은 이것이 누구인지 모른다 */
  id: string;
  /** 오행 보완 0~100 — 서로가 서로의 없는 오행을 채우는가(양방향 평균) */
  complement: number;
  /** 함께 놓은 오행 균형 0~100 */
  combinedBalance: number;
  /** 내게 없는 오행 중 **이 후보가 가진 것** — 카드가 이름을 부르고 뜻을 붙인다 */
  suppliedForViewer: readonly Element[];
};

/** 이 후보가 내게 채우는 오행 하나와 그 뜻, 그리고 그것을 사람 말로 옮긴 한 줄 */
export type CandidateHighlight = {
  element: Element;
  meaning: string;
  text: string;
};

export type RankedCandidate = {
  id: string;
  /** 0부터. 노출 기록이 드는 자리이자 화면의 차례다 */
  position: number;
  /** 상위가 아닌데 일부러 섞은 자리인가 */
  exploration: boolean;
  /** 정렬에만 쓰는 값 — 궁합의 좋고 나쁨이 아니다. **경계가 여기서 잘라 낸다** */
  score: number;
  axes: Record<DiscoveryAxisKey, number>;
  /** 추천 이유 — 없을 수도 있다(채우는 오행이 없으면 균형만 말한다) */
  highlights: CandidateHighlight[];
  /** 함께 놓았을 때의 균형을 숫자 대신 말로 */
  balanceLabel: string;
};

export type DiscoveryPage = {
  policyVersion: typeof DISCOVERY_POLICY_V0.version;
  status: typeof DISCOVERY_POLICY_V0.status;
  entries: RankedCandidate[];
  /** 화면이 반드시 함께 세우는 말 — 상위가 정답이 아니라는 것 */
  caveat: string;
  /** 여기서 멈추고 무엇이 다음인지 — 상세 궁합은 서로 동의한 뒤다 */
  teaser: string;
  /** 탐색 후보가 목록에 있을 때만 서는 말 */
  explorationNote: string | null;
  /** 빠진 오행이 없는 사람에게 하는 말 — 보완으로 견줄 것이 없다 */
  notice: string | null;
};

export type RankOptions = {
  /**
   * 같은 씨앗이면 같은 목록이 나온다.
   *
   * 탐색 후보를 무작위로 뽑되 **재현 가능해야** 한다(PRD). 새로고침마다 목록이
   * 뒤집히면 사용자는 방금 본 사람을 다시 찾지 못하고, 노출 기록도 무엇을 잰
   * 것인지 말할 수 없게 된다.
   */
  seed: string;
  /** 내 원국에 아예 없는 오행의 수 — 문장이 쓴다 */
  viewerMissingCount: number;
  limit?: number;
};

const CAVEAT =
  '노출 순서는 궁합의 좋고 나쁨이 아닙니다. 오행 보완과 함께 놓은 균형 두 축으로 줄을 세울 뿐이고, 사주 점수가 낮다는 이유로 사라지는 후보는 없습니다.';

/** 여기서 멈추는 이유와 다음 — **상세 궁합은 서로 동의한 뒤에 열린다** */
const TEASER =
  '서로 동의하면 형충회합과 상세 궁합을 확인할 수 있습니다. 지금 보이는 것은 오행으로 본 맛보기이고, 여덟 글자와 구체적인 근거는 아직 열리지 않습니다.';

const EXPLORATION_NOTE =
  '탐색 후보는 상위가 아닌 자리에서 일부러 섞은 사람입니다. 한 정책이 같은 유형만 되풀이해 보여주면, 그 정책이 틀렸을 때 신호가 오지 않습니다.';

const NO_MISSING_NOTICE =
  '당신의 원국에는 빠진 오행이 없어 보완으로 견줄 것이 없습니다. 아래 순서는 함께 놓았을 때의 오행 균형으로 섰습니다.';

const round = (value: number): number => Math.round(value * 10) / 10;

/** 문자열 하나를 32비트 씨앗으로 — 같은 문자열이면 언제나 같은 수 */
function seedOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32 — 씨앗 하나에서 같은 수열이 난다 */
function randomFrom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 씨앗대로 섞는다 — 같은 입력이면 같은 순서다 */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const scoreOf = (candidate: CandidateFacts): number =>
  candidate.complement * DISCOVERY_POLICY_V0.weights.complement +
  candidate.combinedBalance * DISCOVERY_POLICY_V0.weights.combinedBalance;

/**
 * 추천 이유 — **어느 오행이 무엇을 채우는지까지 말한다.**
 *
 * 이름을 감추면 「왜 이 사람인가」에 답할 수 없고, 답 못 하는 추천은 궁금해지지도
 * 않는다. 여기서 부르는 것은 **내게 없는 오행 중 상대가 가진 것**뿐이다 — 상대의
 * 전체 구성도, 개수표도, 여덟 글자도 아니다. 그 경계가 정책의 `discloses`·`withholds`
 * 이고, 참여를 켜는 화면이 켜기 전에 같은 말을 적는다.
 */
function highlightsFor(candidate: CandidateFacts): CandidateHighlight[] {
  return candidate.suppliedForViewer.map((element) => ({
    element,
    meaning: ELEMENT_MEANING[element],
    text: `당신에게 부족한 ${ELEMENT_KO[element]}(${element}) 기운을 채워 ${ELEMENT_MEANING[element]}을 돕는 조합입니다.`,
  }));
}

/**
 * 함께 놓은 균형을 **숫자 대신 말로.**
 *
 * 82점과 79점은 절대적인 궁합 차이로 읽히지만 「고른 편」과 「대체로 고른 편」은
 * 그렇지 않다. 경계는 정책이 값으로 든다(`balanceBands`).
 */
function balanceLabelFor(combinedBalance: number): string {
  const { even, mixed } = DISCOVERY_POLICY_V0.balanceBands;

  if (combinedBalance >= even) return '함께 놓으면 오행 균형이 고르게 잡히는 편입니다.';
  if (combinedBalance >= mixed) return '함께 놓으면 오행이 대체로 고른 편입니다.';
  return '함께 놓아도 오행이 한쪽으로 기우는 편입니다.';
}

/**
 * 후보를 줄 세우고 탐색 후보를 섞는다.
 *
 * 하드 제외는 이미 끝난 상태로 들어온다 — 이 함수는 **아무도 빼지 않는다.** 들어온
 * 후보 수보다 `limit` 이 작을 때만 뒤가 잘리고, 그 자리는 다음 판에 탐색으로 올라올
 * 수 있다.
 */
export function rankCandidates(
  candidates: readonly CandidateFacts[],
  { seed, viewerMissingCount, limit = DISCOVERY_POLICY_V0.pageSize }: RankOptions,
): DiscoveryPage {
  // 점수가 같으면 id 로 가른다 — 그러지 않으면 입력 순서가 순위인 척 따라 나간다.
  const ordered = [...candidates].sort((a, b) => {
    const gap = scoreOf(b) - scoreOf(a);
    return gap !== 0 ? gap : a.id.localeCompare(b.id);
  });

  const random = randomFrom(seedOf(`${DISCOVERY_POLICY_V0.version}:${seed}`));

  /**
   * 탐색 후보는 **상위 밖에서만** 뽑는다.
   *
   * 상위 안에서 뽑으면 어차피 보일 사람을 탐색이라 부르는 것이라 아무것도 탐색하지
   * 않는다. 뽑을 사람이 없으면 탐색 자리도 없다 — 자리를 비워 두지 않고 상위로 채운다.
   */
  const wanted = Math.min(limit, ordered.length);
  /**
   * 비율은 **실제로 채워지는 자리**에 건다.
   *
   * `limit` 에 걸면 후보가 둘뿐인 날 목록이 통째로 탐색이 된다 — 그때 「상위」는 아무
   * 자리도 못 받고, 정렬했다는 말이 화면에서 거짓이 된다.
   */
  const topCount = wanted - Math.floor(wanted * DISCOVERY_POLICY_V0.explorationRatio);
  const pool = ordered.slice(topCount);
  const explorers = shuffled(pool, random).slice(0, wanted - topCount);

  const top = ordered.slice(0, topCount);

  /**
   * 섞는 자리는 고르게 벌린다.
   *
   * 뒤에 붙이면 아무도 거기까지 안 내려가고, 앞에 몰면 목록의 첫인상이 탐색이 된다.
   */
  const slots = new Set(
    explorers.map((_, index) => Math.floor(((index + 1) * wanted) / (explorers.length + 1)) - 1),
  );

  const entries: RankedCandidate[] = [];
  let nextTop = 0;
  let nextExplorer = 0;

  for (let position = 0; position < wanted; position += 1) {
    const exploration = slots.has(position) && nextExplorer < explorers.length;
    const candidate = exploration ? explorers[nextExplorer++] : top[nextTop++];

    // 자리가 어긋나면 상위가 먼저 떨어진다 — 그럴 리 없지만 조용히 비우지 않는다.
    if (candidate === undefined) break;

    entries.push({
      id: candidate.id,
      position,
      exploration,
      score: round(scoreOf(candidate)),
      axes: {
        complement: round(candidate.complement),
        combinedBalance: round(candidate.combinedBalance),
      },
      highlights: highlightsFor(candidate),
      balanceLabel: balanceLabelFor(candidate.combinedBalance),
    });
  }

  return {
    policyVersion: DISCOVERY_POLICY_V0.version,
    status: DISCOVERY_POLICY_V0.status,
    entries,
    caveat: CAVEAT,
    teaser: TEASER,
    // 없는 것을 설명하지 않는다 — 탐색 후보가 목록에 있을 때만 그 말이 선다.
    explorationNote: entries.some((entry) => entry.exploration) ? EXPLORATION_NOTE : null,
    notice: viewerMissingCount === 0 ? NO_MISSING_NOTICE : null,
  };
}
