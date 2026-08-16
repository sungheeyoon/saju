import type { Saju } from '../index';
import type { Pillars } from '../pillars';
import {
  findRelationsAmong,
  type Relation,
  type RelationInput,
  type RelationScope,
} from '../relations';

/**
 * 궁합(宮合) 1단계 — 두 원국 **사이에** 성립하는 관계.
 *
 * L2 의 2단계다. 1단계(원국 관계)와 같은 규칙을 따른다: 표를 새로 두지 않고
 * `findRelationsAmong` 이 낸 것을 계산판 기준으로 거를 뿐이다. 같은 형충회합을
 * 궁합용으로 다시 구현하면 원국 카드와 궁합 카드가 언젠가 어긋난다.
 *
 * **점수를 내지 않는다**(`COMPAT_POLICY.scoring: 'not-scored'`). 이 저장소는
 * 신강·신약에 등급 이름조차 붙이지 않았고(근거 있는 구간 경계가 없어서), 억부는
 * 시험값, 종격은 문서화만 한 상태다. 궁합 점수는 그보다 근거가 약하다 — 맞춰볼
 * 외부 정답이 아예 없다. 그래서 여기서는 "무엇과 무엇이 어떻게 걸렸는가"만 내고,
 * 가중치를 얹는 일은 그 가중치를 화면에 전부 드러낼 수 있을 때 따로 한다.
 *
 * 두 사람을 가리키는 이름은 `'natal:a'`·`'natal:b'` 다. 원국 하나짜리 계산의
 * `'natal'` 과 달라야 한다 — 두 원국을 같은 이름으로 넣으면 `Participant` 의
 * `position` 만으로는 누구의 일지인지 알 수 없다. 세운을 붙일 때 `chartId` 를
 * 만든 이유가 그대로 여기에 적용된다.
 */

export type CompatSide = 'a' | 'b';

export const COMPAT_SIDES = ['a', 'b'] as const satisfies readonly CompatSide[];

export const COMPAT_CHART_ID: Record<CompatSide, string> = {
  a: 'natal:a',
  b: 'natal:b',
};

/** `chartId` 가 어느 쪽 사람인지 — 관계 하나를 화면에 놓을 때 쓴다 */
export function compatSideOf(chartId: string): CompatSide | null {
  return COMPAT_SIDES.find((side) => COMPAT_CHART_ID[side] === chartId) ?? null;
}

export const COMPAT_POLICY = {
  ruleSet: 'compat-facts-v1',
  /**
   * 점수·등급을 내지 않는다. 사실 목록만 낸다.
   *
   * 되돌리기 전에 읽을 것: 궁합 점수는 외부 대조 대상이 없어서 맞는지 틀리는지
   * 알 방법이 없다. 내려면 가중치 표를 화면에 전부 드러내고 총점 대신 항목별
   * 기여로 내야 한다.
   */
  scoring: 'not-scored',
  /** 두 사람 글자가 합쳐 이룬 삼합·방합·삼형도 내되 쌍 관계와 구분해 표시한다 */
  combinedFormation: 'included-and-marked',
  /** 관계 검출 규칙 자체는 원국과 같은 것을 쓴다 — RELATION_POLICY 참조 */
  detection: 'shared-with-natal-relations',
} as const;

export type Compatibility = {
  /**
   * 두 원국에 걸친 관계만. 각자의 원국 안에서 닫힌 관계는 빠진다 —
   * 그것은 각자의 원국 카드가 이미 보여준 사실이라 궁합의 몫이 아니다.
   *
   * 계산판이 섞이므로 `distance`·`adjacent` 는 **언제나 `null`** 이다. 두 사람의
   * 기둥 사이에는 선형 거리라는 것이 없다. 화면은 거리 대신 자리로 말해야 한다.
   */
  relations: Relation[];
  /**
   * 두 사람의 글자가 **합쳐서** 세 글자 구조를 이룬 것.
   *
   * `relations` 안에도 들어 있고 여기에 한 번 더 모아 둔다. 쌍 관계와 무게가
   * 다르고, 이것을 인정할지 자체가 계통 선택이라 화면에서 섞이면 안 된다.
   */
  combinedFormations: Relation[];
  /** 결과를 좁게 읽어야 하는 사정 — 시간 미상처럼 관계가 덜 나오는 경우 */
  warnings: string[];
};

/** 궁합 계산에 필요한 것은 네 기둥과 "시각을 알았는가" 뿐이다 */
type CompatInput = {
  pillars: Pick<Pillars, 'year' | 'month' | 'day' | 'hour'>;
  hourKnown: boolean;
};

const BETWEEN_SCOPES: readonly RelationScope[] = ['betweenCharts', 'combinedFormation'];

/**
 * 두 원국 사이의 관계만 찾는다.
 *
 * `Saju` 전체가 아니라 기둥만 받으므로 테스트에서 간지 여덟 글자로 부를 수 있다.
 */
export function findCompatRelations(a: RelationInput, b: RelationInput): Relation[] {
  return findRelationsAmong([
    { chartId: COMPAT_CHART_ID.a, pillars: a },
    { chartId: COMPAT_CHART_ID.b, pillars: b },
  ]).filter((relation) => BETWEEN_SCOPES.includes(relation.scope));
}

function warningsOf(a: CompatInput, b: CompatInput): string[] {
  const unknown = COMPAT_SIDES.filter((side) => !(side === 'a' ? a : b).hourKnown);
  if (unknown.length === 0) return [];

  const who = unknown.length === 2 ? '두 사람 모두' : `${unknown[0] === 'a' ? '첫' : '두'} 번째 사람의`;

  return [
    `${who} 출생 시각을 몰라 시주가 빠졌습니다. 시주가 걸린 관계는 나오지 않으므로 실제보다 적게 보입니다.`,
  ];
}

/**
 * 두 사주의 궁합을 낸다 — 1단계는 사이 관계까지.
 *
 * 오행 보완·십성 관계·용신 부합은 다음 단계에서 이 결과에 얹는다.
 */
export function analyzeCompatibility(a: Saju, b: Saju): Compatibility {
  const sides: Record<CompatSide, CompatInput> = {
    a: { pillars: a.pillars, hourKnown: a.meta.hourKnown },
    b: { pillars: b.pillars, hourKnown: b.meta.hourKnown },
  };

  const relations = findCompatRelations(sides.a.pillars, sides.b.pillars);

  return {
    relations,
    combinedFormations: relations.filter(
      (relation) => relation.scope === 'combinedFormation',
    ),
    warnings: warningsOf(sides.a, sides.b),
  };
}
