import {
  COMPAT_POLICY,
  analyzeCompatibility,
  type CompatSide,
  type CompatWarningKind,
  type Compatibility,
} from '../compat';
import type { Daeun, DaeunEntry } from '../daeun';
import type { Saju } from '../index';
import { currentFortuneOf, type CurrentFortune } from '../now';
import { RELATION_POLICY, resolveRelation, type Relation, type ResolvedRelation } from '../relations';
import type { SaeunEntry } from '../saeun';
import {
  CLAIM_PATHS,
  CLAIM_STRENGTH_KO,
  CLAIM_STRENGTH_ORDER,
  COMPAT_CLAIM_PATHS,
  INCOMPLETE_INPUT_RULE,
  ceilingFor,
  type ClaimPath,
  type ClaimStrength,
} from '../text';
import type { WolunEntry } from '../wolun';

/**
 * L2 가 낸 것을 **밖으로 넘길 꼴로** 모은다 — 해석 이전까지.
 *
 * 이 저장소의 마지막 층은 문장이었다(L3). 문장은 사람이 읽으라고 만든 것이라
 * 계약이 「무엇까지 말할 자격이 있는가」를 정하고 조각이 그 상한 안에서 말한다.
 * **넘겨받는 쪽이 사람이 아니면 그 장치가 통째로 헛돈다** — 받는 쪽은 문장을
 * 다시 쓸 것이고, 그때 참고하는 것은 우리 조각이 아니라 우리가 넘긴 값이다.
 *
 * 그래서 값 옆에 계약을 함께 싣는다. 여기서 정한 넷:
 *
 * 1. **해석하지 않는다.** 문장도 점수도 길흉도 없다. `match-v0` 지표는 엔진 밖
 *    정책 모듈의 것이고 여기 오지 않는다.
 * 2. **강도는 항목이 적지 않는다.** 항목은 자기 이름(= `ClaimPath`)으로 서고,
 *    그 이름의 상한은 `claims` 표가 든다. 표는 `CLAIM_CEILING` 에서 유도된다.
 *    항목마다 `"strength": "fact"` 를 박으면 화면과 이 자료가 같은 값을 다른
 *    강도로 말하게 되고, 그것은 계약의 1번 원칙을 밖에서 되돌리는 일이다.
 * 3. **인덱스를 남기지 않는다.** `Relation.direction`·`cycle` 은 참여자 배열의
 *    인덱스이고 그 배열은 넣은 순서를 따라간다. 받는 쪽은 그 순서를 알 도리가
 *    없으므로 경계에서 글자로 푼다(`resolveRelation`).
 * 4. **`Date` 를 넘기지 않는다.** JSON 이 되면 어차피 문자열이 되는데, 타입이
 *    `Date` 인 채로 두면 넘어간 뒤의 모양을 아무 데도 안 적은 것이 된다.
 *    타입이 먼저 말하고(`Jsonified`) 값이 그대로 따라간다.
 *
 * 빼는 것도 값으로 든다(`EXCLUDED_PATHS`). 빠진 것과 안 실은 것은 받는 쪽에서
 * 구별되지 않는다.
 */

/**
 * 실지 않는 근거 — **왜 안 실었는지까지 적는다.**
 *
 * 목록이 비면 「전부 실었다」는 뜻이고, 그것도 값이다. 테스트가 양방향으로
 * 잠근다: 여기 없는 근거는 자료에 있어야 하고, 여기 있는 근거는 자료에 없어야 한다.
 */
export const EXCLUDED_PATHS = {
  /**
   * 해마다의 표는 안 싣는다.
   *
   * **한동안 `now` 를 빼고 이 표를 통째로 실었다.** 이유는 「보는 시각이 있어야
   * 나오는 값이라 만든 시각과 읽는 시각이 다르면 틀린다」였고, 그 말 자체는 맞다.
   * 틀린 것은 **그래서 표를 대신 실으면 된다**는 쪽이었다 — 해석에 쓰이는 것은
   * 열 해가 아니라 **지금 도는 한 해**이고, 표만 받은 쪽은 어느 칸이 지금인지
   * 알 수 없어 자기가 짚어야 한다. 그러면 우리가 안 하기로 한 판정을 받는 쪽에
   * 떠넘기는 것이 된다.
   *
   * 답은 표를 싣는 것이 아니라 **'지금'이 언제인지를 자료가 들고 나가는 것**이다
   * (`Evidence.viewedAt`). 그러면 하루 뒤에 읽어도 무엇을 기준으로 짚은 값인지
   * 알 수 있다.
   */
  saeun: '해마다의 표는 싣지 않는다 — 지금 도는 해는 `now.saeun` 이 든다',
  /** 위와 같다. 열두 달 중 해석에 쓰이는 것은 지금 도는 달이다 */
  wolun: '달마다의 표는 싣지 않는다 — 지금 도는 달은 `now.wolun` 이 든다',
} as const satisfies Partial<Record<ClaimPath, string>>;

export type ExcludedPath = keyof typeof EXCLUDED_PATHS;

/** 자료에 실리는 근거 — `CLAIM_PATHS` 에서 뺀 것만 뺀 나머지 */
export type IncludedPath = Exclude<ClaimPath, ExcludedPath>;

export const INCLUDED_PATHS: readonly IncludedPath[] = CLAIM_PATHS.filter(
  (path): path is IncludedPath => !Object.hasOwn(EXCLUDED_PATHS, path),
);

/**
 * 근거 하나가 허용하는 가장 센 말 — **두 방향을 다 낸다.**
 *
 * 「있다」와 「없다」의 상한이 다르다. 시주가 빠지면 흔들리는 근거는 있다는 쪽이
 * 한 칸 내려가고 없다는 쪽은 통째로 잠긴다(`ceilingFor`). 한 방향만 실으면
 * 받는 쪽이 「金이 없습니다」를 「金이 있습니다」와 같은 세기로 쓴다.
 */
export type ClaimNote = {
  /** 있다고 말할 때 */
  presence: ClaimStrength;
  /** 없다고 말할 때. `silent` 면 그 자리에서 없다는 말을 하지 않는다 */
  absence: ClaimStrength;
};

/**
 * JSON 을 건너면 `Date` 는 ISO 문자열이 된다 — **타입이 그것을 먼저 말한다.**
 *
 * `Saju` 에는 `Date` 가 여럿 있다(`meta.instant`·절기마다의 `date`·조후의 중기).
 * 그대로 실으면 타입은 `Date` 라고 적혀 있는데 받는 쪽에는 문자열이 도착한다.
 * 넘어간 뒤의 모양이 아무 데도 안 적힌 것이라, 이 자료의 타입이 곧 거짓말이 된다.
 */
export type Jsonified<T> = T extends Date
  ? string
  : T extends readonly (infer U)[]
    ? readonly Jsonified<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonified<T[K]> }
      : T;

/** `Date` 를 ISO 문자열로 바꾸며 그대로 옮긴다 */
function jsonify<T>(value: T): Jsonified<T> {
  if (value instanceof Date) return value.toISOString() as Jsonified<T>;
  if (Array.isArray(value)) return value.map(jsonify) as Jsonified<T>;

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, jsonify(inner)]),
    ) as Jsonified<T>;
  }

  return value as Jsonified<T>;
}

/** 관계를 인덱스 없는 꼴로 바꾼 칸 — 대운·세운·월운의 칸이 다 이 모양이다 */
type WithResolvedRelations<T> = Omit<T, 'relations'> & {
  relations: readonly ResolvedRelation[];
};

/**
 * 명식 한 벌 — `Saju` 그대로이되 관계는 풀렸고 `Date` 는 문자열이다.
 *
 * `Omit` 으로 덮어쓸 것만 덮어쓴다. L2 에 필드가 늘면 **자동으로 따라 들어오고**,
 * 근거를 안 정한 필드는 계약 쪽 시험이 먼저 잡는다.
 */
/**
 * 지금 도는 운 — 관계가 풀린 꼴.
 *
 * 세 칸(`daeun`·`saeun`·`wolun`)이 저마다 관계를 들고 있고 그것도 인덱스다.
 */
export type FortuneNow = Omit<
  CurrentFortune,
  'relations' | 'daeun' | 'firstDaeun' | 'saeun' | 'wolun'
> & {
  relations: readonly ResolvedRelation[];
  /** 못 짚으면 `null` 이고 이유는 `daeunAbsence` 가 든다 */
  daeun: WithResolvedRelations<DaeunEntry> | null;
  firstDaeun: WithResolvedRelations<DaeunEntry>;
  saeun: WithResolvedRelations<SaeunEntry>;
  wolun: WithResolvedRelations<WolunEntry>;
};

export type ChartEvidence = Jsonified<
  Omit<Saju, 'relations' | 'daeun' | 'saeun' | 'wolun'> & {
    /** 이 명식의 근거별 상한 — 아래 값들은 자기 이름으로 여기를 가리킨다 */
    claims: Record<IncludedPath, ClaimNote>;
    relations: readonly ResolvedRelation[];
    /**
     * 대운 — **표는 빼고 그 밖의 것만.**
     *
     * 대운수·방향·그 방향을 정한 근거·거리를 잰 절기는 칸이 아니라 이 사람에
     * 대한 사실이라 그대로 남는다. 열 칸의 목록은 빠진다 — 지금 도는 칸과 첫
     * 칸은 `now` 가 들고, 나머지 여덟 칸은 해석에 쓰이지 않는다.
     */
    daeun: Omit<Daeun, 'entries'>;
    /** 지금 도는 대운·세운·월운. `Evidence.viewedAt` 으로 짚었다 */
    now: FortuneNow;
  }
>;

/** 두 사람 사이 — `Compatibility` 그대로이되 관계는 풀렸다 */
export type CompatEvidence = Jsonified<
  Omit<Compatibility, 'relations' | 'combinedFormations'> & {
    /** 궁합 결과별 상한 — `COMPAT_CLAIM_PATHS` 가 가리키는 근거들에서 나온다 */
    claims: Record<keyof Compatibility, ClaimNote>;
    relations: readonly ResolvedRelation[];
    combinedFormations: readonly ResolvedRelation[];
  }
>;

/**
 * 좁게 읽어야 하는 사정 하나 — **어느 자리의 것인지 함께 든다.**
 *
 * 명식마다의 경고와 궁합의 경고가 한 목록에 섞이면 누구의 사정인지 사라진다.
 */
export type Limitation = {
  where: 'chart:a' | 'chart:b' | 'compatibility';
  /**
   * 종류. 궁합 경고는 값으로 들지만 시간 보정 경고는 **아직 문장뿐이다** —
   * `Saju.meta.warnings` 가 `string[]` 이라 걸러 쓸 이름이 없다. 여기서 지어내지
   * 않고 `null` 로 둔다. 지어낸 이름은 엔진이 안 낸 사실이 된다.
   */
  kind: CompatWarningKind | null;
  text: string;
};

/**
 * 이 자료가 무엇이고 **무엇을 하지 않는가** — 값과 함께 실린다.
 *
 * 받는 쪽이 우리 문서를 읽지 않는다는 것이 전제다. 강도 사다리도, 규칙 묶음의
 * 이름도, 불완전한 입력에서 무엇이 흔들리는지도 자료 안에 있어야 한다.
 */
export const EVIDENCE_CONTRACT = {
  version: 'evidence-v0',
  /** 문장도 점수도 길흉도 내지 않는다 */
  interpretation: 'none',
  /** 궁합 점수를 안 내는 결정이 여기서도 그대로다 */
  scoring: COMPAT_POLICY.scoring,
  /** 항목은 자기 이름으로 서고 강도는 `claims` 표에서 나온다 */
  strength: 'derived-from-claim-ceiling',
  /** 관계는 참여자 배열의 인덱스를 남기지 않는다 */
  relations: 'index-free',
  /**
   * 운은 표가 아니라 **지금 도는 칸**으로 싣는다.
   *
   * 표를 통째로 실으면 어느 칸이 지금인지 받는 쪽이 짚어야 하고, 그것은 우리가
   * 안 하기로 한 판정을 떠넘기는 것이다. 기준은 `Evidence.viewedAt` 이다.
   */
  fortune: 'current-only',
  /**
   * 운끼리 걸리는 것은 **좁은 쪽 칸에 실린다.**
   *
   * 대운 한 칸은 열 해라 함께 놓을 세운이 하나가 아니어서, 대운이 세운·월운과
   * 걸리는 것을 대운 칸이 들 수 없다. 그래서 `now.saeun.relations` 와
   * `now.wolun.relations` 가 그것을 들고, `now.daeun.relations` 는 원국과 걸리는
   * 것만 든다. 어느 판의 글자인지는 참여자마다 `chartId` 가 든다.
   *
   * **두 자리의 틀이 다르다.** `now.saeun` 은 한 해라 대운 경계를 넘으면 두 대운을
   * 다 견주고, `now.relations` 는 한 순간이라 지금 도는 대운만 남긴다. 견주려면
   * `chartId` 를 보고 견준다.
   */
  crossedFortunes: 'narrower-chart-holds-the-wider',
  /** `Date` 는 ISO 8601 문자열로 실린다 */
  serialization: 'dates-as-iso-8601',
  /** 낮은 쪽이 먼저 — `claims` 의 값들이 이 사다리 위에 앉는다 */
  strengthLadder: CLAIM_STRENGTH_ORDER,
  strengthKo: CLAIM_STRENGTH_KO,
  /** 입력이 덜 찼을 때 무엇이 흔들리는가 */
  incompleteInput: INCOMPLETE_INPUT_RULE,
  ruleSets: {
    relations: RELATION_POLICY.ruleSet,
    compatibility: COMPAT_POLICY.ruleSet,
  },
  /** 안 실은 근거와 그 이유 */
  excluded: EXCLUDED_PATHS,
} as const;

export type Evidence = {
  contract: typeof EVIDENCE_CONTRACT;
  /**
   * 이 자료에서 **'지금'이 언제인가** — 운은 이 시각으로 짚었다.
   *
   * 자료가 스스로 날짜를 들고 나가야 하루 뒤에 읽어도 무엇을 기준으로 짚은
   * 값인지 알 수 있다. 엔진은 이 시각을 스스로 묻지 않는다
   * (`NOW_POLICY.viewingInstant`) — 넘겨받아서 그대로 적는다.
   */
  viewedAt: string;
  /** 한 사람이면 `b` 가 `null` 이다 — 키를 빼지 않는다 */
  charts: { a: ChartEvidence; b: ChartEvidence | null };
  /** 한 사람이면 `null` */
  compatibility: CompatEvidence | null;
  limitations: readonly Limitation[];
};

const claimsFor = (hourKnown: boolean): Record<IncludedPath, ClaimNote> =>
  Object.fromEntries(
    INCLUDED_PATHS.map((path) => [
      path,
      {
        presence: ceilingFor({ paths: [path], polarity: 'presence', hourKnown }),
        absence: ceilingFor({ paths: [path], polarity: 'absence', hourKnown }),
      },
    ]),
  ) as Record<IncludedPath, ClaimNote>;

/**
 * 궁합 결과별 상한.
 *
 * **시각은 둘 다 알아야 안다.** 한쪽만 몰라도 두 원국을 맞댄 값은 흔들리므로
 * 두 사람의 `hourKnown` 을 곱해서 묻는다.
 */
const compatClaimsFor = (
  hourKnown: Record<CompatSide, boolean>,
): Record<keyof Compatibility, ClaimNote> => {
  const both = hourKnown.a && hourKnown.b;

  return Object.fromEntries(
    Object.entries(COMPAT_CLAIM_PATHS).map(([key, paths]) => [
      key,
      {
        presence: ceilingFor({ paths, polarity: 'presence', hourKnown: both }),
        absence: ceilingFor({ paths, polarity: 'absence', hourKnown: both }),
      },
    ]),
  ) as Record<keyof Compatibility, ClaimNote>;
};

const resolveEntry = <T extends { relations: readonly Relation[] }>(
  entry: T,
): WithResolvedRelations<T> => ({ ...entry, relations: entry.relations.map(resolveRelation) });

/**
 * 키 몇을 뺀 사본 — **뺀 것이 이름으로 남는다.**
 *
 * 구조 분해로 버리면(`const { saeun: _saeun, ...rest }`) 쓰지 않는 이름이 남고,
 * 무엇을 왜 뺐는지는 그 이름이 말해 주지 않는다. 여기서는 부르는 자리에 뺀 키가
 * 그대로 적힌다.
 */
function without<T extends object, K extends keyof T>(value: T, ...keys: readonly K[]): Omit<T, K> {
  const copy = { ...value } as Record<string, unknown>;
  for (const key of keys) delete copy[key as string];
  return copy as Omit<T, K>;
}

function chartEvidenceOf(saju: Saju, viewedAt: Date): ChartEvidence {
  const now = currentFortuneOf(saju, viewedAt);

  return jsonify({
    // 상한을 맨 앞에 둔다 — 아래 값들이 이 표를 가리킨다.
    claims: claimsFor(saju.meta.hourKnown),
    // 표 셋은 여기서 빠지고 지금 도는 칸이 `now` 로 간다(`EXCLUDED_PATHS`).
    ...without(saju, 'relations', 'daeun', 'saeun', 'wolun'),
    relations: saju.relations.map(resolveRelation),
    daeun: without(saju.daeun, 'entries'),
    now: {
      ...now,
      relations: now.relations.map(resolveRelation),
      daeun: now.daeun === null ? null : resolveEntry(now.daeun),
      firstDaeun: resolveEntry(now.firstDaeun),
      saeun: resolveEntry(now.saeun),
      wolun: resolveEntry(now.wolun),
    },
  });
}

function compatEvidenceOf(compat: Compatibility): CompatEvidence {
  return jsonify({
    claims: compatClaimsFor(compat.hourKnown),
    ...without(compat, 'relations', 'combinedFormations'),
    relations: compat.relations.map(resolveRelation),
    combinedFormations: compat.combinedFormations.map(resolveRelation),
  });
}

/**
 * 넘길 자료를 만든다 — 한 사람이면 `b` 없이 부른다.
 *
 * **궁합을 받지 않고 여기서 낸다.** 호출부가 `Compatibility` 를 따로 만들어
 * 넘기면 그것이 이 두 명식의 궁합인지 아무도 안 본다. 같은 이유로 `Saju` 는
 * 받는다 — 시간 보정 옵션은 호출부만 아는 것이라 여기서 다시 계산할 수 없다.
 */
export function evidenceOf({ a, b }: { a: Saju; b?: Saju }, viewedAt: Date): Evidence {
  const compat = b ? analyzeCompatibility(a, b) : null;

  const limitations: Limitation[] = [
    ...a.meta.warnings.map((text): Limitation => ({ where: 'chart:a', kind: null, text })),
    ...(b?.meta.warnings ?? []).map((text): Limitation => ({ where: 'chart:b', kind: null, text })),
    ...(compat?.warnings ?? []).map(
      (warning): Limitation => ({ where: 'compatibility', kind: warning.kind, text: warning.text }),
    ),
  ];

  return {
    contract: EVIDENCE_CONTRACT,
    viewedAt: viewedAt.toISOString(),
    charts: {
      a: chartEvidenceOf(a, viewedAt),
      b: b ? chartEvidenceOf(b, viewedAt) : null,
    },
    compatibility: compat ? compatEvidenceOf(compat) : null,
    limitations,
  };
}
