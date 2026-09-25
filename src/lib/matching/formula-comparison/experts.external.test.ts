import { describe, expect, it } from 'vitest';
import { expertAgreement } from './experts';

/**
 * **전문가 판정 합치도**를 잠근다 — 정확도가 아니다. 사례 34 쌍 중 판정이 선 31 쌍(양성 19 · 음성 9 · 갈린 3)이고
 * 공신력은 전부 B 다(C 한 쌍은 「조금」 · 「섞임」 뿐이라 빠진다). 수가 움직이면 사례나 축이 바뀐 것이다.
 */
describe('필요 보완 축 × 전문가 판정 — 쌍 하나가 표본 하나', () => {
  const engine = expertAgreement('engine');
  const both = expertAgreement('both');

  it('기본 매개변수(포화 20% · 반대 신호 0.3)에서 AUC 0.684, 평균 차 11.5', () => {
    expect(engine.overall).toEqual({
      positivePairs: 19,
      negativePairs: 9,
      splitPairs: 3,
      auc: 0.684,
      meanDiff: 11.5,
      splitConcordance: 0.667,
    });
    expect(Object.keys(engine.byCredibility)).toEqual(['B']);
  });

  it('글쓴이 하나 빼고 맞추면 0.711, 모두로 맞추면 0.795(표본 안이라 부풀려진다)', () => {
    expect(engine.leaveOneAuthorOut.agreement.auc).toBe(0.711);
    expect(engine.fittedAll.params).toEqual({ supplyCap: 0.34, counterWeight: 0.6 });
    expect(engine.fittedAll.agreement.auc).toBe(0.795);
  });

  it('v2 세기(월지 ×2 · 60:30:10)에서도 AUC 는 거의 같다', () => {
    expect(both.overall.auc).toBe(0.687);
    expect(both.leaveOneAuthorOut.agreement.auc).toBe(0.684);
  });

  it('글쓴이 둘이 양성 · 음성을 다 가졌고 서로 다른 쪽을 가리킨다', () => {
    expect(engine.byAuthor['华人易'].auc).toBe(1);
    expect(engine.byAuthor['剑桥易学文化'].auc).toBe(0.6);
    expect(engine.byAuthor['조은(원리학당)'].auc).toBe(0);
  });
});
