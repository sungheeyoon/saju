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
 * 요약은 브라우저로 내려가지 않아야 하므로 두 축은 DB 안에서 나고(`discovery_complement`
 * · `discovery_combined_balance`), 이 모듈은 **가중치·섞기·문장**만 든다.
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
} as const;

export type DiscoveryAxisKey = keyof typeof DISCOVERY_POLICY_V0.weights;

/**
 * DB 가 내주는 후보 한 줄 — **오행 요약 자체는 오지 않는다.**
 *
 * 두 축은 이미 값으로 계산돼 있고, 여기 오는 것은 그 결과와 문장에 필요한 개수뿐이다.
 * 벡터를 받아 왔다면 그것을 화면에서 접어 봐야 소용없다 — 개발자 도구 한 번에 다
 * 보인다(ADR 0008).
 */
export type CandidateFacts = {
  /** 후보를 가리키는 불투명 식별자. 정책은 이것이 누구인지 모른다 */
  id: string;
  /** 오행 보완 0~100 — 서로가 서로의 없는 오행을 채우는가(양방향 평균) */
  complement: number;
  /** 함께 놓은 오행 균형 0~100 */
  combinedBalance: number;
  /** 내게 없는 오행 중 이 후보가 가진 개수 — 문장이 쓸 수 */
  suppliedForViewer: number;
};

export type RankedCandidate = {
  id: string;
  /** 0부터. 노출 기록이 드는 자리이자 화면의 차례다 */
  position: number;
  /** 상위가 아닌데 일부러 섞은 자리인가 */
  exploration: boolean;
  /** 정렬에만 쓰는 값 — 궁합의 좋고 나쁨이 아니다 */
  score: number;
  axes: Record<DiscoveryAxisKey, number>;
  /** 제한된 설명 한 줄 — 상대의 명식을 적지 않는다 */
  reason: string;
};

export type DiscoveryPage = {
  policyVersion: typeof DISCOVERY_POLICY_V0.version;
  status: typeof DISCOVERY_POLICY_V0.status;
  entries: RankedCandidate[];
  /** 화면이 반드시 함께 세우는 말 — 상위가 정답이 아니라는 것 */
  caveat: string;
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
 * 제한된 설명 — **상대의 명식을 적지 않는다.**
 *
 * 무엇이 채워지는지는 「내게 없는 오행 몇 개 중 몇 개」로만 말한다. 어느 오행인지
 * 이름을 부르면 동의하지 않은 사람의 오행 구성이 후보 카드에 적히는 셈이다
 * (ADR 0008 이 그 공개를 동의 화면에 묶어 뒀다). 개수는 참여할 때 고지한 요약의
 * 범위 안이다.
 */
function reasonFor(
  candidate: CandidateFacts,
  { exploration, viewerMissingCount }: { exploration: boolean; viewerMissingCount: number },
): string {
  if (exploration) {
    return '탐색 후보입니다 — 상위가 아닌 자리에서 일부러 섞었습니다. 한 정책이 같은 유형만 되풀이해 보여주지 않게 하려는 것입니다.';
  }

  if (viewerMissingCount === 0) {
    return '당신의 원국에는 빠진 오행이 없어 보완으로 견줄 것이 없습니다. 함께 놓았을 때의 오행 균형으로 섰습니다.';
  }

  if (candidate.suppliedForViewer === 0) {
    return `당신에게 없는 오행 ${viewerMissingCount}개를 채우지는 않습니다. 함께 놓았을 때의 오행 균형으로 섰습니다.`;
  }

  return `당신에게 없는 오행 ${viewerMissingCount}개 중 ${candidate.suppliedForViewer}개를 채웁니다.`;
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
      reason: reasonFor(candidate, { exploration, viewerMissingCount }),
    });
  }

  return {
    policyVersion: DISCOVERY_POLICY_V0.version,
    status: DISCOVERY_POLICY_V0.status,
    entries,
    caveat: CAVEAT,
  };
}
