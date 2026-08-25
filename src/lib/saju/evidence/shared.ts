import type { ChartEvidence } from '.';
import type { RedactedChartEvidence, RedactedEvidence } from './redacted';

/**
 * Match 동의 범위로 **한 번 더 자른** 자료.
 *
 * `redactEvidence` 와 자르는 이유가 다르다. 그쪽은 **모델에게 넘기지 않기로 한 것**
 * (출생 원문·출생지)을 뺐고, 여기는 **두 사람이 서로 열지 않기로 한 것**을 뺀다
 * (ADR 0012). 두 컷은 겹치지 않으므로 따로 선다 — 합치면 어느 규칙이 무엇을 막고
 * 있는지 나중에 되짚을 수 없다.
 *
 * ## 왜 프롬프트 규칙으로 하지 않는가
 *
 * ADR 0012 는 「모델은 필요 없이 여덟 글자를 나열하거나 그 글자로 상대 원국의 새
 * 판정을 만들지 않는다」고 적었다. 그 말을 지키는 길이 둘인데, 하나는 프롬프트에
 * 적는 것이고 하나는 **안 넣는 것**이다. ADR 0008 이 출생 원문에 대해 고른 쪽이
 * 뒤의 것이고, 같은 이유가 여기서도 그대로 참이다 — **안 넣은 것은 못 낸다.**
 *
 * 그래서 상대의 십성·신살·신강신약·억부·조후·격국·종격·원국 안의 형충회합·운은
 * 모델에게도 가지 않는다. 남는 것은 **여덟 글자와 두 원국 사이의 사실**이고, 그것이
 * 동의 화면이 열린다고 적은 그 목록이다(`MATCH_DISCLOSURE`).
 *
 * ## 무엇이 남는가
 *
 * 궁합 자체는 통째로 남는다. `compatibility` 는 오행 보완과 억부 후보를 사실상
 * 드러내지만 그것은 궁합 그 자체라 뺄 수 없고, 동의 화면이 그렇게 적었다(ADR 0008).
 */

/** 공유 자료에서 빠지는 자리 — 이름과 **왜 빠지는지** */
export const WITHHELD_PATHS = {
  analysis: '상대 원국 하나에 대한 판정이다 — 십성·오행 세력·신강신약·억부·조후·격국·종격',
  relations: '원국 **안에서** 닫힌 형충회합이다. 두 원국 **사이**의 것은 `compatibility` 가 든다',
  stages: '12운성 — 원국 하나의 판정이다',
  sinsal: '공망·12신살·신살 — 원국 하나의 판정이다',
  daeun: '대운은 동의 범위 밖이다',
  now: '지금 도는 운도 마찬가지다',
} as const satisfies Partial<Record<keyof ChartEvidence, string>>;

export type WithheldPath = keyof typeof WITHHELD_PATHS;

/**
 * 공유 결과가 드는 명식 — **여덟 글자와 그 글자를 읽는 데 필요한 것만.**
 *
 * `claims` 도 남는 자리만큼만 든다. 없는 근거의 상한을 적어 두면 그 표가 자료에 있는
 * 것을 가리키지 않게 되고, 낱말은 참인 자리에서만 서야 한다.
 */
export type SharedChartEvidence = {
  claims: Pick<RedactedChartEvidence['claims'], 'pillars' | 'meta'>;
  pillars: RedactedChartEvidence['pillars'];
  meta: RedactedChartEvidence['meta'];
};

export type SharedEvidence = Omit<RedactedEvidence, 'charts' | 'contract'> & {
  contract: RedactedEvidence['contract'] & {
    /** 동의 범위 밖이라 빠진 자리와 그 이유 */
    withheld: typeof WITHHELD_PATHS;
    scope: 'match-consent';
  };
  /** 둘 다 선다 — 공유 결과는 한 사람짜리가 없다 */
  charts: { a: SharedChartEvidence; b: SharedChartEvidence };
  /** 궁합은 통째로 남는다 — 이 자료의 본론이다 */
  compatibility: NonNullable<RedactedEvidence['compatibility']>;
};

const shareChart = (chart: RedactedChartEvidence): SharedChartEvidence => ({
  claims: { pillars: chart.claims.pillars, meta: chart.claims.meta },
  pillars: chart.pillars,
  meta: chart.meta,
});

/**
 * 공유 결과의 자료를 만든다 — **두 사람이 다 있어야 한다.**
 *
 * @returns 궁합이 없거나 한 사람뿐이면 `null`. 그런 자료로 공유 결과를 만들 수 없다.
 */
export function shareEvidence(evidence: RedactedEvidence): SharedEvidence | null {
  const { b } = evidence.charts;
  if (b === null || evidence.compatibility === null) return null;

  return {
    ...evidence,
    contract: { ...evidence.contract, withheld: WITHHELD_PATHS, scope: 'match-consent' },
    charts: { a: shareChart(evidence.charts.a), b: shareChart(b) },
    compatibility: evidence.compatibility,
  };
}
