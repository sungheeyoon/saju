import { describe, expect, it } from 'vitest';
import { expertAgreement } from './experts';

/**
 * **전문가 판정 합치도**를 잠근다 — 정확도가 아니다. 사례 34 쌍 중 판정이 선 31 쌍(양성 19 · 음성 9 · 갈린 3)이고
 * 공신력은 전부 B 다(C 한 쌍은 「조금」 · 「섞임」 뿐이라 빠진다). 수가 움직이면 사례나 축이 바뀐 것이다.
 *
 * 엔진 기본이 월지 ×2 · 60:30:10 이 된 뒤로(ADR 0114) `engine` 은 v2 세기이고 옛 기본은 `legacy` 다. 옛 값(0.684 ·
 * 0.711 · 0.795)이 `legacy` 에서 한 자리도 안 틀리고 선다. AUC 옆의 구간은 부트스트랩 95%(양성 · 음성 따로 2000 번)다.
 */
describe('필요 보완 축 × 전문가 판정 — 쌍 하나가 표본 하나', () => {
  const engine = expertAgreement('engine');
  const legacy = expertAgreement('legacy');

  it('기본 매개변수(포화 20% · 반대 신호 0.3), 엔진 세기에서 AUC 0.687 [0.465, 0.901], 평균 차 12.3', () => {
    expect(engine.overall).toEqual({
      positivePairs: 19,
      negativePairs: 9,
      splitPairs: 3,
      auc: 0.687,
      aucInterval: { low: 0.465, high: 0.901 },
      meanDiff: 12.3,
      splitConcordance: 0.333,
    });
    expect(Object.keys(engine.byCredibility)).toEqual(['B']);
  });

  /** 구간이 0.5 를 품는다 — 31 쌍으로는 이 축이 판정을 가른다고 말할 힘이 없다 */
  it('구간은 0.5 를 품는다 — 표본 안에서 맞춘 값만 0.5 위로 올라간다(부풀려진 것)', () => {
    expect(engine.overall.aucInterval.low).toBeLessThan(0.5);
    expect(engine.leaveOneAuthorOut.agreement.aucInterval).toEqual({ low: 0.485, high: 0.868 });
    expect(engine.fittedAll.agreement.aucInterval.low).toBeGreaterThan(0.5);
  });

  it('글쓴이 하나 빼고 맞추면 0.684, 모두로 맞추면 0.801(표본 안이라 부풀려진다)', () => {
    expect(engine.leaveOneAuthorOut.agreement.auc).toBe(0.684);
    expect(engine.fittedAll.params).toEqual({ supplyCap: 0.34, counterWeight: 0.6 });
    expect(engine.fittedAll.agreement.auc).toBe(0.801);
  });

  it('옛 세기(legacy)는 옛 값 그대로다 — 0.684 · 0.711 · 0.795', () => {
    expect(legacy.overall.auc).toBe(0.684);
    expect(legacy.overall.aucInterval).toEqual({ low: 0.462, high: 0.901 });
    expect(legacy.leaveOneAuthorOut.agreement.auc).toBe(0.711);
    expect(legacy.fittedAll.agreement.auc).toBe(0.795);
  });

  it('글쓴이 둘이 양성 · 음성을 다 가졌고 서로 다른 쪽을 가리킨다', () => {
    expect(engine.byAuthor['华人易'].auc).toBe(1);
    expect(engine.byAuthor['剑桥易学文化'].auc).toBe(0.6);
    expect(engine.byAuthor['조은(원리학당)'].auc).toBe(0);
  });
});
