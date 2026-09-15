import { describe, expect, it } from 'vitest';

import { readingEvidenceOf } from '.';
import {
  MATCH_INPUT_FIXTURES,
  aggregateMatchRuns,
  blindPacket,
  chartsOf,
  checkClaims,
  fixtureTraits,
  measureMatchRun,
  secretsOf,
} from './match-input-eval';

/**
 * **표본이 실험을 겨누는가 — 돈 없이 늘 잰다.** 엔진이 자라 짝의 성질이 바뀌면 부르기 전에
 * 여기서 빨간불이 난다.
 */
describe('인연 궁합 입력 비교의 표본', () => {
  const expected: Record<string, (t: ReturnType<typeof fixtureTraits>) => boolean> = {
    'internal-rival': (t) => t.internalRival && t.strengthSplit,
    'combined-formation': (t) => t.fullCombinedFormation && !t.internalRival,
    'day-branch-clash': (t) => t.dayBranchClash && t.eokbuSplit && !t.internalRival,
    'hour-unknown-one-side': (t) => t.hourUnknownOneSide && t.partialRelation,
  };

  it.each(MATCH_INPUT_FIXTURES)('$id 은 적힌 구조를 실제로 가진다', (fixture) => {
    const { a, b } = chartsOf(fixture);
    expect(expected[fixture.id](fixtureTraits(a, b))).toBe(true);
  });

  it('표본끼리 구조가 겹치지 않는다 — 넷이 다 다른 것을 본다', () => {
    expect(new Set(MATCH_INPUT_FIXTURES.map((fixture) => fixture.id)).size).toBe(4);
    expect(Object.keys(expected).sort()).toEqual(MATCH_INPUT_FIXTURES.map((f) => f.id).sort());
  });
});

describe('재는 법', () => {
  const fixture = MATCH_INPUT_FIXTURES[0];
  const reading = readingEvidenceOf('match', chartsOf(fixture), new Date('2026-08-26T04:00:00Z'), 'limited-v1');
  if (reading.kind !== 'match') throw new Error('인연 궁합이 아니다');
  const relation = reading.evidence.compatibility.relations[0];

  const markdown = [
    '## 서로를 보는 자리',
    '',
    '첫 번째 분은 두 번째 분에게 기대는 편이에요. 일지에서 맞물립니다.',
    '',
    '첫 번째 분은 건강을 챙겨야 해요.',
    '',
    '### 근거 (검사용)',
    '',
    `서로 — 결론 「기댄다」 | 자료: relations ${relation.ko} [사실] · relations 없는충 [사실] · analysis.eokbu [후보] | 넘어간 것: 없음`,
    '흔들리는 것 — relations 반합·반방합의 의미는 갈래가 있다',
  ].join('\n');

  const metrics = measureMatchRun({
    evidence: reading.evidence,
    output: { markdown, score: reading.baseline + 3, metaphor: '한 사람이 기대고 다른 사람이 받친다' },
    baseline: reading.baseline,
    secrets: secretsOf(fixture),
  });

  it('여러 낱말로 된 관계 이름을 한 이름으로 읽는다 — 「인묘 반방합」', () => {
    const multi = reading.evidence.compatibility.relations.find((r) => r.ko.includes(' '));
    if (multi === undefined) return;
    const one = measureMatchRun({
      evidence: reading.evidence,
      output: { markdown: `본문\n\n### 근거 (검사용)\n\n줄 | 자료: relations ${multi.ko} [사실]`, score: null, metaphor: '요약' },
      baseline: reading.baseline,
      secrets: secretsOf(fixture),
    });
    expect(one.unknownRelations).toEqual([]);
    expect(one.relationCoverage.cited).toBe(1);
  });

  it('「관계 …」·「… 2건」으로 적어도 같은 이름으로 읽는다', () => {
    const name = reading.evidence.compatibility.relations[0].ko;
    const one = measureMatchRun({
      evidence: reading.evidence,
      output: { markdown: `본문\n\n### 근거 (검사용)\n\n줄 | 자료: 관계 ${name} 2건 [사실]`, score: null, metaphor: '요약' },
      baseline: reading.baseline,
      secrets: secretsOf(fixture),
    });
    expect(one.relationCoverage.cited).toBe(1);
  });

  it('자료에 없는 관계 이름과 경로를 근거 오류 후보로 센다', () => {
    expect(metrics.unknownRelations).toEqual(['없는충']);
    expect(metrics.absentPaths).toEqual(['analysis.eokbu']);
    expect(metrics.relationCoverage.cited).toBe(1);
  });

  it('자리 문장·이탈 낱말·한쪽 문단·점수 차를 따로 든다', () => {
    expect(metrics.seatSentences.some((sentence) => sentence.includes('일지'))).toBe(true);
    expect(metrics.personalDrift.terms).toEqual({ 건강: 1 });
    expect(metrics.personalDrift).toMatchObject({ oneSidedParagraphs: 1, namedParagraphs: 2 });
    expect(metrics.scoreDelta).toBe(3);
  });

  /** 맞는 설명은 안 걸리고, 넓힌 설명만 검토 후보로 잡힌다 */
  it('검토 후보 — 「겉글자에 토가 없다」는 안 세고 「토 기운이 전혀 없다」는 센다', () => {
    const run = (text: string) =>
      measureMatchRun({
        evidence: reading.evidence,
        output: { markdown: text, score: null, metaphor: '요약' },
        baseline: reading.baseline,
        secrets: secretsOf(fixture),
      }).reviewCandidates;

    expect(run('두 분 모두 겉으로 드러난 글자에는 토가 없어요.')).toEqual({});
    expect(Object.keys(run('두 분에게는 토 기운이 전혀 없어요.'))).toEqual(['오행 부재 확대']);
    expect(Object.keys(run('두 글자가 만나 물로 변했어요.'))).toEqual(['합화 단정']);
    expect(run('그 기준이 다가오면 방어적으로 변해요.')).toEqual({});
    expect(Object.keys(run('자료상 이 판단은 후보예요.'))).toEqual(['내부 용어']);
    expect(Object.keys(run('이 조언 자체는 자료 밖의 생활 조언이에요.'))).toEqual(['내부 용어']);
    expect(Object.keys(run('이번 자료에는 올해 흐름이 들어 있지 않아요.'))).toEqual(['내부 용어']);
    expect(Object.keys(run('첫 번째 분은 행동하는 사람이에요.'))).toEqual(['역할 배정']);
    /* 부정문은 확대가 아니다 — 대신 규칙 문장이 샌 꼴로 센다 */
    expect(Object.keys(run('토가 전혀 없다는 뜻이 아니라 드러난 글자에 없다는 뜻이에요.'))).toEqual(['범위 해설']);
  });

  it('모으면 표본 × 판마다 한 줄이고 선호는 섞이지 않는다', () => {
    const rows = aggregateMatchRuns([
      { fixture: 'x', variant: 'A', rep: 1, ok: true, metrics },
      { fixture: 'x', variant: 'A', rep: 2, ok: true, metrics: { ...metrics, score: metrics.score! + 2 } },
      { fixture: 'x', variant: 'B', rep: 1, ok: false, failure: 'timeout' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ calls: 2, scoreRange: [metrics.score, metrics.score! + 2] });
    expect(rows[1]).toMatchObject({ calls: 1, failedCalls: 1, scoreMean: null });
    expect(Object.keys(rows[0])).not.toContain('preference');
  });

  it('블라인드 묶음은 판 이름·점수·근거 절을 가리고 열쇠를 따로 준다', () => {
    const runs = ['A', 'B'].map((variant) => ({ fixture: fixture.id, variant, rep: 1, markdown, metaphor: '요약' }));
    const packet = blindPacket(runs, 7);

    expect(packet.markdown).not.toMatch(/\bA\b|\bB\b|근거 \(검사용\)/);
    expect(packet.key.map((entry) => entry.variant).sort()).toEqual(['A', 'B']);
    expect(blindPacket(runs, 7).key).toEqual(packet.key);
  });
});

describe('주장 목록 대조', () => {
  const fixture = MATCH_INPUT_FIXTURES.find((one) => one.id === 'day-branch-clash')!;
  const reading = readingEvidenceOf('match', chartsOf(fixture), new Date('2026-08-26T04:00:00Z'), 'limited-v1');
  if (reading.kind !== 'match') throw new Error('인연 궁합이 아니다');
  const { elementSupport, relations, tenGods } = reading.evidence.compatibility;

  it('경로·값·사람이 맞으면 문제가 없다', () => {
    const result = checkClaims(reading.evidence, [
      {
        subject: '첫 번째 분',
        statement: '드러난 글자에 없는 오행이 있다',
        evidence: [{ path: 'compatibility.elementSupport.a.missing', value: JSON.stringify(elementSupport.a.missing) }],
        reach: 'direct',
      },
      {
        subject: '두 사람',
        statement: '일지끼리 부딪힌다',
        evidence: [
          { path: `compatibility.relations[${relations.findIndex((r) => r.kind === 'branchClash')}].ko`, value: relations.find((r) => r.kind === 'branchClash')!.ko },
          { path: 'compatibility.tenGods.aSeesB', value: tenGods.aSeesB },
        ],
        reach: 'narrowed',
      },
    ]);
    expect(result.problems).toEqual([]);
    expect(result).toMatchObject({ claims: 2, direct: 1 });
  });

  it('없는 경로·다른 값·사람 바뀜을 잡는다', () => {
    const result = checkClaims(reading.evidence, [
      {
        subject: '두 번째 분',
        statement: '없는 오행이 있다',
        evidence: [
          { path: 'compatibility.elementSupport.a.missing', value: JSON.stringify(elementSupport.a.missing) },
          { path: 'compatibility.tenGods.aSeesB', value: '"아무거나"' },
          { path: 'analysis.eokbu', value: '{}' },
        ],
        reach: 'direct',
      },
    ]);
    expect(result.problems.map((p) => p.code).sort()).toEqual(['path-missing', 'subject-side-mismatch', 'value-mismatch']);
  });

  it('사람-오행 엇갈림 후보 — 두 번째 분에게 없다고 한 오행이 그 사람 missing 에 없으면 후보다', () => {
    const [absentA] = elementSupport.a.missing;
    const word = { 木: '나무', 火: '불기운', 土: '흙', 金: '쇠', 水: '물기운' }[absentA as '木']!;
    const run = (sentence: string) =>
      measureMatchRun({
        evidence: reading.evidence,
        output: { markdown: sentence, score: null, metaphor: '요약' },
        baseline: reading.baseline,
        secrets: secretsOf(fixture),
      }).reviewCandidates['사람-오행 엇갈림'] ?? [];

    expect(run(`첫 번째 분에게는 ${word}이 드러난 글자에 없어요.`)).toEqual([]);
    expect(run(`두 번째 분에게는 ${word}이 드러난 글자에 없어요.`)).toHaveLength(1);
  });
});
