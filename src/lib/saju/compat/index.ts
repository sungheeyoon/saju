import {
  tenGodOf,
  type ElementRole,
  type TenGod,
  type UnresolvedFactor,
} from '../analysis';
import type { Element } from '../constants';
import type { Saju } from '../index';
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
  /** 오행 보완은 있고 없음만 센다 — 얼마나 좋은 궁합인지로 환산하지 않는다 */
  elementSupport: 'facts-only',
  /** 십성은 양방향을 모두 낸다 — A가 본 B와 B가 본 A는 다른 값이다 */
  tenGods: 'both-directions',
  /** 억부 부합은 각자의 억부 판정을 그대로 물려받는다 — 시험값이라는 딱지까지 */
  eokbu: 'inherits-experimental',
  /**
   * 일지↔일지(배우자 궁)는 엔진이 따로 내지 않는다.
   *
   * 여덟 글자에서 나오는 값이 아니라 자리에 붙은 관습적 의미라 궁성과 같은
   * 취급이다. 화면이 `relations` 를 자리로 거르면 된다 — 엔진이 `spouseSeat`
   * 를 만들면 "일지가 배우자"라는 해석을 계산 결과인 척 담게 된다.
   */
  spouseSeat: 'display-only',
} as const;

/**
 * 상대가 내 부족한 오행을 채우는가 — **있고 없음만 센다.**
 *
 * "얼마나 잘 맞는가"로 환산하지 않는다. 보완이 좋은 것인지부터가 계통 갈림이고
 * (부족을 채우는 쪽이 좋다는 읽기와, 용신에 맞는 오행이라야 한다는 읽기가 다르다)
 * 환산하는 순간 근거 없는 점수가 된다.
 */
export type ElementSupport = {
  /** 내 원국에 아예 없는 오행 */
  missing: Element[];
  /** 그중 상대가 가진 것 */
  supplied: Element[];
  /** 둘 다 없는 것 — 서로 채워 주지 못한다 */
  stillMissing: Element[];
  /** 내 최약 오행과, 그것이 상대 원국에서 차지하는 비중(0~1) */
  weakest: { element: Element; partnerRatio: number };
};

/**
 * 내 억부 후보를 상대가 갖고 있는가.
 *
 * **각자의 억부 판정을 그대로 물려받는다** — `status: 'experimental'` 도,
 * 아직 못 본 것들(`unresolved`)도 함께 옮긴다. 궁합으로 넘어오면서 딱지가
 * 떨어지면 근거 없는 확신이 결론으로 새어 나간다.
 */
export type EokbuMatch = {
  status: 'experimental';
  /** 내 억부 관점의 후보 오행 */
  element: Element;
  /** 그 오행이 내 일간에게 무엇인가 */
  role: ElementRole;
  /** 상대 원국에 그 오행이 있는가 */
  presentInPartner: boolean;
  /** 상대 원국에서 그 오행의 비중(0~1) */
  partnerRatio: number;
  /** 내 쪽 억부가 아직 판정하지 않은 것들 */
  unresolved: readonly UnresolvedFactor[];
};

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
  /** 서로가 서로의 부족한 오행을 채우는가 — 사람마다 한 벌씩 */
  elementSupport: Record<CompatSide, ElementSupport>;
  /**
   * 서로를 십성으로 무엇이라 보는가.
   *
   * **비대칭이라 양방향을 다 낸다.** 甲이 본 辛은 정관이지만 辛이 본 甲은
   * 정재다. 한 방향만 내면 누구 눈으로 본 것인지 잃어버린다.
   */
  tenGods: { aSeesB: TenGod; bSeesA: TenGod };
  /** 내 억부 후보를 상대가 갖고 있는가 — 사람마다 한 벌씩 */
  eokbuMatch: Record<CompatSide, EokbuMatch>;
  /**
   * 각자의 여덟 글자를 다 세었는가 — **'없다'를 읽기 전에 읽어야 하는 값.**
   *
   * 이 결과에는 「없다」고 말하는 자리가 넷이다: `elementSupport.missing` ·
   * `stillMissing` · `eokbuMatch.presentInPartner: false` · 그리고 관계 목록의
   * 전체성. 넷 다 여섯 글자로 세었으면 「없다」가 아니라 **「못 셌다」**이고,
   * 값만 보아서는 둘이 구별되지 않는다.
   *
   * 여태 이 사실은 `warnings` 의 문장 안에만 있었다. 화면은 그것으로 충분했다 —
   * 사람이 읽는다. **밖으로 내보내면 아니다**: 받는 쪽이 문장을 파싱해야 값의
   * 뜻을 알게 되고, 그러면 경고를 못 읽은 쪽은 「없다」를 그대로 믿는다.
   *
   * `Saju.meta.hourKnown` 과 같은 값이지만 여기 한 번 더 든다. 궁합 결과를 받는
   * 쪽은 원국을 받지 않기로 했고(L3 가 `Saju` 를 안 받는 규율이 그것이다),
   * 그 규율을 지키려면 이 값이 결과 안에 있어야 한다. **손으로 넘기던 자리였다** —
   * `CompatPerson.hourKnown` 이 그것이고, 호출부가 다른 명식의 값을 적어도
   * 아무것도 걸리지 않았다.
   */
  hourKnown: Record<CompatSide, boolean>;
  /** 결과를 좁게 읽어야 하는 사정 — 시간 미상처럼 관계가 덜 나오는 경우 */
  warnings: CompatWarning[];
};

/** 무엇 때문에 좁게 읽어야 하는가 */
export type CompatWarningKind =
  /** 시주가 빠져 사이 관계가 실제보다 적게 나온다 */
  | 'hour-unknown-relations'
  /** 여섯 글자로 세어 없는 오행이 실제보다 많아 보인다 */
  | 'hour-unknown-elements';

/**
 * 좁게 읽어야 하는 사정 하나 — **종류를 값으로 든다.**
 *
 * 문장만 들면 이것을 걸러 쓰는 쪽이 문자열로 알아내야 한다. 실제로 그런 곳이
 * 생겼다 — 화면이 L3 발화를 함께 놓으면서 같은 말이 두 번 나오게 됐고, 지우자니
 * **나중에 생길 다른 경고까지 조용히 사라진다.** 종류가 있으면 아는 것만 빼고
 * 모르는 것은 그대로 나온다.
 *
 * **이 문장들은 사람을 이름으로 못 부른다.** 이름은 계산에 들어가지 않기로 했고
 * (`SajuInput` 에 필드가 없다) 그래서 여기서 부를 수 있는 말이 '첫 번째 사람'
 * 까지다. 이름을 아는 것은 L3 뿐이고(`CompatPerson.label`), 그것이 화면에서
 * 이 경고 대신 발화를 놓게 된 이유다.
 */
export type CompatWarning = {
  kind: CompatWarningKind;
  text: string;
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

function warningsOf(hourKnown: Record<CompatSide, boolean>): CompatWarning[] {
  const unknown = COMPAT_SIDES.filter((side) => !hourKnown[side]);
  if (unknown.length === 0) return [];

  const who = unknown.length === 2 ? '두 사람 모두' : `${unknown[0] === 'a' ? '첫' : '두'} 번째 사람의`;

  return [
    {
      kind: 'hour-unknown-relations',
      text: `${who} 출생 시각을 몰라 시주가 빠졌습니다. 시주가 걸린 관계는 나오지 않으므로 실제보다 적게 보입니다.`,
    },
    // 없는 오행은 "시주를 몰라 못 센 것"일 수 있다. 보완을 읽기 전에 알아야 한다.
    {
      kind: 'hour-unknown-elements',
      text: `${who} 여섯 글자로만 세었으므로 없는 오행이 실제보다 많아 보일 수 있습니다.`,
    },
  ];
}

/** 상대가 내 부족을 채우는지 — 두 사람의 오행 분포를 맞대 본다 */
function elementSupportOf(mine: Saju['analysis'], partner: Saju['analysis']): ElementSupport {
  const partnerHas = (element: Element) => partner.elements.counts[element] > 0;

  return {
    missing: [...mine.elements.missing],
    supplied: mine.elements.missing.filter(partnerHas),
    stillMissing: mine.elements.missing.filter((element) => !partnerHas(element)),
    weakest: {
      element: mine.elements.weakest,
      partnerRatio: partner.elements.ratios[mine.elements.weakest],
    },
  };
}

/** 내 억부 후보를 상대가 갖고 있는지 — 판정은 각자의 것을 그대로 옮긴다 */
function eokbuMatchOf(mine: Saju['analysis'], partner: Saju['analysis']): EokbuMatch {
  const { suggestedElement, role, status, unresolved } = mine.eokbu;

  return {
    status,
    element: suggestedElement,
    role,
    presentInPartner: partner.elements.counts[suggestedElement] > 0,
    partnerRatio: partner.elements.ratios[suggestedElement],
    unresolved,
  };
}

/**
 * 두 사주의 궁합을 낸다 — 1단계는 사이 관계까지.
 *
 * 오행 보완·십성 관계·용신 부합은 다음 단계에서 이 결과에 얹는다.
 */
export function analyzeCompatibility(a: Saju, b: Saju): Compatibility {
  const hourKnown: Record<CompatSide, boolean> = {
    a: a.meta.hourKnown,
    b: b.meta.hourKnown,
  };

  const relations = findCompatRelations(a.pillars, b.pillars);

  return {
    relations,
    combinedFormations: relations.filter(
      (relation) => relation.scope === 'combinedFormation',
    ),
    elementSupport: {
      a: elementSupportOf(a.analysis, b.analysis),
      b: elementSupportOf(b.analysis, a.analysis),
    },
    tenGods: {
      aSeesB: tenGodOf(a.pillars.dayMaster, b.pillars.dayMaster),
      bSeesA: tenGodOf(b.pillars.dayMaster, a.pillars.dayMaster),
    },
    eokbuMatch: {
      a: eokbuMatchOf(a.analysis, b.analysis),
      b: eokbuMatchOf(b.analysis, a.analysis),
    },
    hourKnown,
    warnings: warningsOf(hourKnown),
  };
}
