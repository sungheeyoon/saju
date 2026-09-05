import type { EokbuAssessment, YongsinAgreement } from './yongsin';
import { YONGSIN_POLICY } from './yongsin';
import { FOLLOWING_PATTERN_POLICY, type FollowingAssessment } from './followingPatterns';
import { STRUCTURE_POLICY, type Structure } from './structure';
import { TONGGWAN_POLICY, type TonggwanCandidacy } from './tonggwan';
import { JOHU_POLICY, type JohuAssessment } from './johu';

/**
 * 판정 사이의 서열 — **어긋날 때 무엇이 이기는가.**
 *
 * 이 엔진은 한 명식에 대해 서로 다른 답을 낼 수 있는 판정을 여럿 낸다. 억부는 「木을
 * 쓰라」 하고, 조후는 다른 글자를 권하고, 종격은 아예 반대편을 보라 하고, 격국은 또
 * 다른 것을 상신으로 잡는다. **그 넷의 관계는 여태 정책 상수에만 있었다** —
 * `eokbuOverride: 'disabled'` 는 `FOLLOWING_PATTERN_POLICY` 안에 적혀 있고, 밖으로
 * 나가는 자료에는 그 줄이 없었다.
 *
 * 그래서 받는 쪽(AI·화면)은 **서열 없이 답 넷을 나란히 받는다.** 「가종 후보」와
 * 「억부 木」을 함께 받은 모델이 어느 쪽으로 쓸지는 그때그때 다르고, 그것은 우리가
 * 정하지 않은 것이 아니라 **정해 놓고 안 알려 준 것**이다.
 *
 * ## 프롬프트가 아니라 값이다
 *
 * 프롬프트에 「억부를 우선하라」고 적을 수도 있다. 그러면 어느 날 누가 프롬프트를
 * 고치는 순간 서열이 사라지고, 그 사실은 자료 어디에도 안 남는다. **값으로 두면
 * 그 값과 같이 다닌다** — 판정을 읽는 쪽은 서열도 함께 읽는다.
 *
 * ## 스위치를 다시 적지 않는다
 *
 * 각 줄의 `overrides` 는 **그 판정의 정책 상수를 그대로 읽는다.** 손으로 옮겨 적으면
 * 언젠가 정책만 바뀌고 이 표가 안 따라온다 — 이 저장소가 되풀이해 겪은 실패이고,
 * 방금도 화면이 종격 대조 성적을 손으로 적고 있다가 v1 의 숫자에 멈춰 있었다.
 *
 * 판정이 하나 늘면 이 표에 줄이 하나 선다. 그 줄이 없으면 시험이 걸린다
 * (`precedence.test.ts`).
 */

/** 서열에 서는 판정들 — 억부와 다른 답을 낼 수 있는 것만 */
export type JudgementKey = 'eokbu' | 'johu' | 'following' | 'structure' | 'tonggwan';

export const JUDGEMENT_KO: Record<JudgementKey, string> = {
  eokbu: '억부',
  johu: '조후',
  following: '종격',
  structure: '격국',
  tonggwan: '통관',
};

/**
 * 왜 이 판정이 억부를 안 뒤집는가 — **이유마다 무게가 다르다.**
 *
 * 「재어 봤는데 모자란다」와 「아직 안 재 봤다」와 「판정 자체가 없다」는 사다리의 같은
 * 칸에 앉을 수 없다. 상한 표가 종격과 격국을 같은 `candidate` 에 앉히면서 그 까닭을
 * 값으로 남긴 것과 같은 자리다(`CLAIM_CEILING['analysis.structure']`).
 */
export type PrecedenceReason =
  /** 이 판정이 기준이다 */
  | 'primary'
  /** 외부 대조를 했고 게이트를 못 열었다 */
  | 'external-check-not-passed'
  /** 외부 대조가 아직 0건이다 */
  | 'no-external-check'
  /** 조건을 자동 판정하지 않는 참고표다 */
  | 'conditions-not-evaluated'
  /** 판정 자체가 없다 — 뒤집을 것이 없다 */
  | 'no-verdict';

export const PRECEDENCE_REASON_KO: Record<PrecedenceReason, string> = {
  primary: '기준이 되는 판정',
  'external-check-not-passed': '외부 대조 게이트를 못 열었음',
  'no-external-check': '외부 대조가 0건',
  'conditions-not-evaluated': '조건을 자동 판정하지 않는 참고표',
  'no-verdict': '판정이 없음',
};

export type PrecedenceRow = {
  key: JudgementKey;
  ko: string;
  /** 억부와 어긋날 때 이 판정이 이기는가 */
  overrides: boolean;
  reason: PrecedenceReason;
  /** 그 스위치가 어느 정책의 어느 줄인가 — 되짚을 자리를 값으로 든다 */
  policy: string;
  /**
   * **지금 이 명식에서** 억부와 다른 것을 가리키는가.
   *
   * `null` 은 「어긋나지 않는다」가 아니라 **견줄 수 없다**는 뜻이다. 격국은 상신을
   * 오행으로 내지 않아 억부 후보와 같은 자로 잴 수 없고, 통관은 판정이 없다.
   */
  disagrees: boolean | null;
};

export type JudgementPrecedence = {
  /** 정책을 옮겨 담고 명식에서 어긋남만 센다 — 새로 고른 것이 없다 */
  status: 'fact';
  /** 어긋날 때 이기는 판정 */
  primary: JudgementKey;
  rows: readonly PrecedenceRow[];
};

type PrecedenceInput = {
  eokbu: EokbuAssessment;
  johu: JohuAssessment;
  agreement: YongsinAgreement;
  following: FollowingAssessment;
  structure: Structure;
  tonggwan: TonggwanCandidacy;
};

/**
 * 대조 건수를 **수로 읽는다.**
 *
 * 정책 상수가 `as const` 라 `35` 는 타입이 35 다. 그대로 `=== 0` 을 쓰면 「겹치지 않는
 * 비교」로 걸린다 — 지금 값에서는 맞는 말이지만, 이 자리가 묻는 것은 **그 값이 무엇이든
 * 0 인가**이다. 수로 받아 두면 자료가 늘거나 줄 때 이 줄이 따라온다.
 */
const casesOf = (count: number): number => count;

export function judgementPrecedenceOf(input: PrecedenceInput): JudgementPrecedence {
  const rows: PrecedenceRow[] = [
    {
      key: 'eokbu',
      ko: JUDGEMENT_KO.eokbu,
      overrides: true,
      reason: 'primary',
      policy: 'YONGSIN_POLICY.methods',
      disagrees: false,
    },
    {
      key: 'johu',
      ko: JUDGEMENT_KO.johu,
      // 견주기만 한다 — 우선순위를 정하려면 한난조습을 재는 자리가 먼저 있어야 한다.
      overrides: YONGSIN_POLICY.johuAgainstEokbu !== 'compared-not-ranked',
      reason: 'conditions-not-evaluated',
      policy: 'YONGSIN_POLICY.johuAgainstEokbu',
      /** 조후가 권한 글자 중에 억부가 권한 오행이 하나도 없으면 어긋난 것이다 */
      disagrees: !input.agreement.aligned,
    },
    {
      key: 'following',
      ko: JUDGEMENT_KO.following,
      overrides: FOLLOWING_PATTERN_POLICY.eokbuOverride !== 'disabled',
      /*
        재어 봤는데 모자란 것과 아직 안 재 본 것을 가른다. 게이트가 열리는 날에는
        이 자리에 새 값이 필요하고, 그때 시험이 먼저 걸린다 — 「기준이 아닌데 이긴다」는
        줄은 설 수 없게 잠가 두었다(`precedence.test.ts`).
      */
      reason:
        casesOf(FOLLOWING_PATTERN_POLICY.dominance.externalCheck.cases) === 0
          ? 'no-external-check'
          : 'external-check-not-passed',
      policy: 'FOLLOWING_PATTERN_POLICY.eokbuOverride',
      /**
       * 종이 서면 억부와 **반대 방향**을 본다 — 억부는 모자란 쪽을 돕고 종은 대세를
       * 따른다. 「종격 아님」이 아닌 모든 판정이 그 자리다(후보도 포함한다 — 후보라는
       * 것은 「그쪽으로 볼 수도 있다」는 말이고, 받는 쪽에서 흔들리는 것은 같다).
       */
      disagrees: input.following.verdict !== 'not-following',
    },
    {
      key: 'structure',
      ko: JUDGEMENT_KO.structure,
      overrides: STRUCTURE_POLICY.yongsinOverride !== 'disabled',
      reason:
        casesOf(STRUCTURE_POLICY.externalCheck.cases) === 0
          ? 'no-external-check'
          : 'external-check-not-passed',
      policy: 'STRUCTURE_POLICY.yongsinOverride',
      /**
       * **견줄 수 없다.** 격국은 상신(相神)을 오행으로 내지 않는다 — 격의 종류와
       * 성패 조건만 낸다. 같은 자로 잴 수 없는 것을 「어긋나지 않는다」로 적으면
       * 안 재 본 것이 잰 것처럼 보인다.
       */
      disagrees: null,
    },
    {
      key: 'tonggwan',
      ko: JUDGEMENT_KO.tonggwan,
      overrides: TONGGWAN_POLICY.eokbuOverride !== 'disabled',
      reason: TONGGWAN_POLICY.verdict === 'none' ? 'no-verdict' : 'no-external-check',
      policy: 'TONGGWAN_POLICY.eokbuOverride',
      /** 판정이 없으므로 어긋날 것도 없다 — 재료만 있다 */
      disagrees: null,
    },
  ];

  return { status: 'fact', primary: 'eokbu', rows };
}

/** 조후 참고표의 상태를 서열 표가 읽는다는 것을 값으로 남긴다 */
export const PRECEDENCE_POLICY = {
  ruleSet: 'judgement-precedence-v1',
  status: 'fact',
  /** 스위치를 다시 적지 않고 각 정책에서 읽는다 */
  source: 'read-from-each-policy',
  primary: 'eokbu',
  /** 억부가 기준인 까닭 — 유일하게 외부 명조와 대조된 용신 판정이다 */
  why: 'only-externally-checked-yongsin-path',
  johuConditionEvaluation: JOHU_POLICY.conditionEvaluation,
} as const;
