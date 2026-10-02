import { CLAIM_STRENGTH_KO, CLAIM_STRENGTH_ORDER, type ClaimStrength } from '../saju/text/policy';
import { readingGrounding } from './display';

/**
 * **근거 칸의 층 검사** — 근거 절이 적은 층(`[사실]` · `[유도]` …)이 그 자료의 `claims` 상한을 넘는가를 잰다(#427).
 *
 * 저장 검사(`checkReading`)가 아니다. 실호출 시험이 원문과 함께 떨구는 **보고**이고, 운영 파이프라인은 이것을 안
 * 부른다 — 저장을 막지도 다시 부르지도 않는다(2026-10-02 운영자 확정). 근거 칸은 모델이 손으로 적는 목록이라
 * 경로 표기가 매번 조금씩 다르고, 이 파서는 그중 **확실히 읽히는 것만** 판정한다.
 *
 * 2026-10-02 에 잰 값: 로컬 실호출 원문 33편에서 경로 1,325 — ① 상한 표에 직접 959 · ② 하위 경로 335 ·
 * ③ `contract` 6 · ④ `limitations` 5 · ⑤ 표에 없음 20, 초과는 ① 6 · ② 4. 운영 35편(비식별 집계)은 ① 5 · ② 1 ·
 * 확인 가능한 absence 3 이었고, 지금 판(v15 · v17) 8편은 0 이었다. 그 집계를 낸 SQL 과 같은 규칙을 옮겼다.
 *
 * 규칙:
 * - 근거 절은 화면이 자르는 자리와 같은 제목으로 찾는다(`readingGrounding`). 못 찾으면 `grounding: false`.
 * - 줄마다 `자료:` 뒤 · `| 넘어간` 앞이 칸이다. 칸은 ` · ` 에서 끊되 한글로 이어지는 꼬리(`축진파 · 술미파 [사실]`)는
 *   앞 토막에 붙는다. 토막 끝의 `[층]` 이 없으면 그 토막은 안 센다.
 * - 경로는 펼친다 — 형제(`compatibility.tenGods.aSeesB·bSeesA` → `….bSeesA`), 하위(`analysis.structure breakingFactors`
 *   → `analysis.structure.breakingFactors`), 옛 표기(`분석.` → `analysis.`, `charts.a 분석.…` → `charts.a.analysis.…`).
 * - 경로와 층의 수가 같으면 차례로 짝짓고, 다르면 **가장 낮은 층**을 모두에 준다 — 확실한 초과만 센다.
 * - 상한은 가장 긴 키를 찾는다 — 하위 경로는 가장 가까운 부모의 상한을 물려받는다.
 * - `contract.*` · `limitations` 는 프롬프트가 근거 절에서 읽게 하는 검수용 경로라(`parts.ts` CLOSING) 판정하지 않고 센다.
 *   표에 없는 경로(`stars` · `claims…` · `direction` …)도 판정하지 않고 센다.
 * - 견주는 칸은 `presence` 다 — 근거 칸에 있다/없다 표기가 없다. 다만 이름만으로 부재 주장이 분명한 경로(마지막 이름이
 *   `missing` · `stillMissing`)는 부모 칸의 `absence` 상한과도 견준다.
 */

type ClaimNote = { readonly presence: string; readonly absence: string };
type Claims = Readonly<Record<string, ClaimNote | undefined>>;

/** 실호출이 넘기는 자료 — 자기 풀이 · 궁합 · 공유 판 어느 것이든 `claims` 표만 읽는다 */
type TieredEvidence = {
  readonly charts: {
    readonly a: { readonly claims?: Claims } | null;
    readonly b: { readonly claims?: Claims } | null;
  };
  readonly compatibility: { readonly claims?: Claims } | null;
};

type PathClass = 'direct' | 'sub' | 'contract' | 'limitations' | 'unlisted';

type TierOverrun = {
  readonly path: string;
  readonly tier: ClaimStrength;
  /** 상한을 든 `claims` 의 키 — 하위 경로면 부모다 */
  readonly key: string;
  readonly ceiling: ClaimStrength;
  readonly polarity: 'presence' | 'absence';
  readonly pathClass: 'direct' | 'sub';
};

export type GroundingTierReport = {
  /** 근거 절을 찾았는가 */
  readonly grounding: boolean;
  readonly counts: Readonly<Record<PathClass, number>>;
  /** 이름만으로 부재 주장이 분명해 `absence` 상한과도 견준 경로 수 */
  readonly absenceChecked: number;
  readonly overruns: readonly TierOverrun[];
};

const TIER_OF: Readonly<Record<string, ClaimStrength>> = {
  ...Object.fromEntries(CLAIM_STRENGTH_ORDER.map((tier) => [tier, tier])),
  ...Object.fromEntries(CLAIM_STRENGTH_ORDER.map((tier) => [CLAIM_STRENGTH_KO[tier], tier])),
};
const TIER_WORD = Object.keys(TIER_OF).join('|');
const TRAILING_TIERS = new RegExp(`\\[\\s*((?:${TIER_WORD})[^\\[\\]]*)\\]\\s*$`);
const ITEM_SPLIT = /(?<=\])\s+·\s+|\s+·\s+(?=[A-Za-z])/;
const PATH_PIECE = /^[a-z][A-Za-z0-9.]*$/;
const LITERALS = new Set(['true', 'false', 'null']);

const rank = (tier: string): number => CLAIM_STRENGTH_ORDER.indexOf(tier as ClaimStrength);
const lowest = (tiers: readonly ClaimStrength[]): ClaimStrength =>
  tiers.reduce((low, tier) => (rank(tier) < rank(low) ? tier : low));

/** `자료:` 칸 — 첫 `자료:` 뒤에서 다음 `자료:` 앞까지, 그 안에서 `| 넘어간` 앞까지 */
const cellOf = (line: string): string => line.split('자료:')[1].split('| 넘어간')[0];

const tiersOf = (item: string): ClaimStrength[] | null => {
  const found = TRAILING_TIERS.exec(item);
  if (found === null) return null;
  return found[1]
    .split(/\s*[·/,]\s*/)
    .flatMap((word) => (word in TIER_OF ? [TIER_OF[word]] : []));
};

/** 토막 하나의 경로들 — 앞 경로에 기대는 형제 · 하위 표기를 펼친다 */
const pathsOf = (item: string): string[] => {
  const head = item
    .replace(/\[[^[\]]*\]/g, ' ')
    .replaceAll('분석.', 'analysis.')
    .replace(/(charts\.[ab])\s+(?=[a-z])/g, '$1.')
    .trim();
  const paths: string[] = [];
  for (const word of head.split(/\s+/)) {
    word.split('·').forEach((piece, at) => {
      if (!PATH_PIECE.test(piece) || LITERALS.has(piece)) return;
      const previous = paths.at(-1);
      if (previous === undefined || piece.includes('.') || piece === 'charts' || piece === 'compatibility') {
        paths.push(piece);
      } else if (at > 0 && previous.includes('.')) {
        paths.push(`${previous.slice(0, previous.lastIndexOf('.'))}.${piece}`);
      } else if (at === 0) {
        paths.push(`${previous}.${piece}`);
      } else {
        paths.push(piece);
      }
    });
  }
  return paths;
};

/** 경로가 가리키는 상한 표와, 표 안에서 찾을 이름 */
const claimsOf = (path: string, evidence: TieredEvidence): { bare: string; claims: Claims } => {
  const bare = path.replace(/^(charts\.[ab]|compatibility)\./, '');
  const a = evidence.charts.a?.claims ?? {};
  const b = evidence.charts.b?.claims ?? {};
  const compat = evidence.compatibility?.claims ?? {};
  if (path.startsWith('charts.b.')) return { bare, claims: b };
  if (path.startsWith('charts.a.')) return { bare, claims: a };
  if (path.startsWith('compatibility.')) return { bare, claims: compat };
  if (path.split('.')[0] in compat) return { bare, claims: compat };
  return { bare, claims: a };
};

/** 가장 긴 키 — 하위 경로는 가장 가까운 부모의 상한을 물려받는다 */
const nearestKey = (bare: string, claims: Claims): string | null =>
  Object.keys(claims)
    .filter((key) => bare === key || bare.startsWith(`${key}.`))
    .reduce<string | null>((best, key) => (best === null || key.length > best.length ? key : best), null);

export function groundingTiers(output: string, evidence: TieredEvidence): GroundingTierReport {
  const counts: Record<PathClass, number> = { direct: 0, sub: 0, contract: 0, limitations: 0, unlisted: 0 };
  const overruns: TierOverrun[] = [];
  let absenceChecked = 0;

  const grounding = readingGrounding(output);
  if (grounding === null) return { grounding: false, counts, absenceChecked, overruns };

  for (const line of grounding.split('\n').filter((one) => one.includes('자료:'))) {
    for (const item of cellOf(line).split(ITEM_SPLIT)) {
      const tiers = tiersOf(item);
      if (tiers === null || tiers.length === 0) continue;
      const paths = pathsOf(item);

      paths.forEach((path, at) => {
        const tier = tiers.length === paths.length ? tiers[at] : lowest(tiers);
        const { bare, claims } = claimsOf(path, evidence);

        if (bare === 'contract' || bare.startsWith('contract.')) {
          counts.contract++;
          return;
        }
        if (bare === 'limitations' || bare.startsWith('limitations.')) {
          counts.limitations++;
          return;
        }
        const key = nearestKey(bare, claims);
        const note = key === null ? undefined : claims[key];
        if (key === null || note === undefined) {
          counts.unlisted++;
          return;
        }

        const pathClass = key === bare ? 'direct' : 'sub';
        counts[pathClass]++;
        if (rank(tier) > rank(note.presence)) {
          overruns.push({ path, tier, key, ceiling: note.presence as ClaimStrength, polarity: 'presence', pathClass });
        }
        if (/\.(missing|stillMissing)$/.test(bare)) {
          absenceChecked++;
          if (rank(tier) > rank(note.absence)) {
            overruns.push({ path, tier, key, ceiling: note.absence as ClaimStrength, polarity: 'absence', pathClass });
          }
        }
      });
    }
  }

  return { grounding: true, counts, absenceChecked, overruns };
}
