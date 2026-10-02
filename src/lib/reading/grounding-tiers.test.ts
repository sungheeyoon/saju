import { describe, expect, it } from 'vitest';

import { CITY_LONGITUDES, computeSaju } from '../saju';
import { groundingTiers, readingEvidenceOf } from '.';

/** 근거 칸의 층 검사(#427) — 실호출 시험이 보고만 하는 잣대를 모델 없이 잰다 */
const VIEWED_AT = new Date('2026-08-23T04:00:00Z');
const A = computeSaju(
  { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, gender: 'male' },
  { longitude: CITY_LONGITUDES.부산, useLongitude: true },
);
const HOURLESS = computeSaju({ year: 1991, month: 6, day: 2, hour: null, gender: 'female' });
const solo = readingEvidenceOf('self', { a: A }, VIEWED_AT).evidence;
const hourless = readingEvidenceOf('self', { a: HOURLESS }, VIEWED_AT).evidence;

const BODY = '## 성향\n\n본문입니다.\n\n';
const withGrounding = (cells: readonly string[], heading = '### 근거 (검사용)') =>
  `${BODY}${heading}\n${cells.map((cell, at) => `- 절 ${at + 1} — 결론 「…」 | 자료: ${cell} | 넘어간 것: 없음`).join('\n')}\n`;
const overrunsOf = (markdown: string, evidence: Parameters<typeof groundingTiers>[1] = solo) =>
  groundingTiers(markdown, evidence).overruns.map((one) => `${one.polarity} ${one.path} ${one.tier}>${one.key}=${one.ceiling}`);

describe('근거 칸의 층 검사', () => {
  it('상한 표에 직접 있는 경로가 상한보다 센 층을 적으면 잡는다', () => {
    const report = groundingTiers(withGrounding(['analysis.eokbu [사실] · pillars [사실]']), solo);

    expect(report.counts).toEqual({ direct: 2, sub: 0, contract: 0, limitations: 0, unlisted: 0 });
    expect(overrunsOf(withGrounding(['analysis.eokbu [사실] · pillars [사실]']))).toEqual([
      'presence analysis.eokbu fact>analysis.eokbu=candidate',
    ]);
  });

  it('상한 안의 층이면 아무것도 안 잡는다', () => {
    expect(overrunsOf(withGrounding(['analysis.eokbu [후보] · analysis.strength [유도]']))).toEqual([]);
  });

  it('하위 경로는 부모의 상한을 물려받는다', () => {
    const markdown = withGrounding(['analysis.following.facts [사실]']);

    expect(groundingTiers(markdown, solo).counts.sub).toBe(1);
    expect(overrunsOf(markdown)).toEqual(['presence analysis.following.facts fact>analysis.following=candidate']);
  });

  it('부모가 여럿이면 가장 긴 키의 상한을 물려받는다', () => {
    const claims = {
      analysis: { presence: 'fact', absence: 'fact' },
      'analysis.following': { presence: 'candidate', absence: 'candidate' },
    } as const;
    const evidence = { charts: { a: { claims }, b: null }, compatibility: null };

    expect(overrunsOf(withGrounding(['analysis.following.facts [사실]']), evidence)).toEqual([
      'presence analysis.following.facts fact>analysis.following=candidate',
    ]);
    expect(overrunsOf(withGrounding(['analysis.strength [사실]']), evidence)).toEqual([]);
  });

  it('띄어 이어 적은 낱말은 앞 경로 아래의 경로 하나로 더 편다', () => {
    expect(overrunsOf(withGrounding(['analysis.following facts [사실]']))).toEqual([
      'presence analysis.following fact>analysis.following=candidate',
      'presence analysis.following.facts fact>analysis.following=candidate',
    ]);
  });

  it('상한 표에 없는 경로는 판정하지 않고 센다', () => {
    const markdown = withGrounding(['stars [사실] · claims.analysis.eokbu.presence [사실] · direction [사실]']);
    const report = groundingTiers(markdown, solo);

    expect(report.counts.unlisted).toBe(3);
    expect(report.overruns).toEqual([]);
  });

  it('contract 와 limitations 는 판정하지 않고 센다', () => {
    const markdown = withGrounding(['contract.strengthLadder [사실] · limitations [사실] · contract [사실]']);
    const report = groundingTiers(markdown, solo);

    expect(report.counts).toEqual({ direct: 0, sub: 0, contract: 2, limitations: 1, unlisted: 0 });
    expect(report.overruns).toEqual([]);
  });

  it('경로와 층의 수가 같으면 차례로 짝짓는다', () => {
    expect(overrunsOf(withGrounding(['analysis.eokbu·strength [사실·유도]']))).toEqual([
      'presence analysis.eokbu fact>analysis.eokbu=candidate',
    ]);
  });

  /* 차례로 짝지었다면 eokbu 가 [사실] 을 받아 잡혔을 것이다 — 어느 층이 어느 경로의 것인지 모르면 잡지 않는다 */
  it('경로와 층의 수가 다르면 가장 낮은 층을 모두에 준다', () => {
    expect(overrunsOf(withGrounding(['analysis.eokbu·strength [사실·유도·후보]']))).toEqual([]);
  });

  it('이름이 부재를 말하는 경로는 absence 상한과도 견준다', () => {
    const report = groundingTiers(withGrounding(['analysis.elements.missing [유도]']), hourless);

    expect(report.absenceChecked).toBe(1);
    expect(overrunsOf(withGrounding(['analysis.elements.missing [유도]']), hourless)).toEqual([
      'absence analysis.elements.missing derived>analysis.elements=silent',
    ]);
  });

  it('괄호 없는 `## 근거` 제목도 근거 절로 읽는다', () => {
    const report = groundingTiers(withGrounding(['analysis.eokbu [사실]'], '## 근거'), solo);

    expect(report.grounding).toBe(true);
    expect(report.overruns).toHaveLength(1);
  });

  it('「근거의 층」 제목은 근거 절이 아니다', () => {
    const report = groundingTiers(withGrounding(['analysis.eokbu [사실]'], '### 근거의 층'), solo);

    expect(report.grounding).toBe(false);
    expect(report.overruns).toEqual([]);
  });

  it('근거 절이 없으면 아무것도 안 세고 없다고 말한다', () => {
    expect(groundingTiers(`${BODY}analysis.eokbu [사실]`, solo)).toEqual({
      grounding: false,
      counts: { direct: 0, sub: 0, contract: 0, limitations: 0, unlisted: 0 },
      absenceChecked: 0,
      overruns: [],
    });
  });

  it('층을 안 적은 토막은 세지 않는다', () => {
    expect(groundingTiers(withGrounding(['analysis.eokbu · pillars']), solo).counts.direct).toBe(0);
  });

  it('두 사람 자료는 charts.b 를 b 의 표로, 궁합 이름을 궁합 표로 잰다', () => {
    const B = computeSaju({ year: 1992, month: 3, day: 8, hour: 9, minute: 0, second: 0, gender: 'female' });
    const pair = readingEvidenceOf('private', { a: A, b: B }, VIEWED_AT).evidence;
    const report = groundingTiers(
      withGrounding(['charts.b.analysis.eokbu [사실] · compatibility.tenGods.aSeesB·bSeesA [사실·사실] · eokbuMatch [사실]']),
      pair,
    );

    expect(report.counts).toEqual({ direct: 2, sub: 2, contract: 0, limitations: 0, unlisted: 0 });
    expect(report.overruns.map((one) => one.path)).toEqual(['charts.b.analysis.eokbu', 'eokbuMatch']);
  });
});
