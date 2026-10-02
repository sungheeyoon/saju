import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import { CHART_ENGINE_VERSION } from '../saju/version';

import { readingEvidenceOf } from '.';
import { HAND_SAMPLE } from './taste-run-sample';
import {
  TASTE_TOPICS,
  normalizeClaim,
  tasteClaimPathsOf,
  tasteRunShapeOf,
  checkTasteRun,
  tasteEvidenceOf,
  tasteFingerprintOf,
  tasteFingerprintSourceOf,
  tasteRunPromptOf,
  type TasteRunOutput,
} from './taste-run';

const VIEWED_AT = new Date('2026-10-03T03:00:00Z');
const HOURLESS = { year: 1991, month: 6, day: 2, hour: null, gender: 'female' } as const;

const redactedOf = (input: Parameters<typeof computeSaju>[0], viewedAt: Date = VIEWED_AT) => {
  const built = readingEvidenceOf('self', { a: computeSaju(input) }, viewedAt);
  if (built.kind !== 'self') throw new Error('한 사람의 근거가 아니다');
  return built.evidence;
};

/** 근거 안의 키 전부 — 깊이 훑는다 */
const keysOf = (value: unknown, out: string[] = []): string[] => {
  if (value !== null && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      out.push(key);
      keysOf(inner, out);
    }
  }
  return out;
};

const ISO_DATE = /\d{4}-\d{2}-\d{2}/;
/** 해 숫자 — 비율(`0.2007`)의 소수 자리는 빼고 센다 */
const YEAR_NUMBER = /(?<![\d.])(19|20)\d{2}(?!\d)/;

describe('맛보기 근거는 해 · 나이 · 날짜를 들지 않는다', () => {
  it.each([
    ['1992-05-14 09:30 여성 (손 견본)', HAND_SAMPLE.input],
    ['1991-06-02 시간 모름 여성', HOURLESS],
  ])('%s — sajuYear · 나이 · 절기 날짜 · 지금 도는 때가 없다', (_label, input) => {
    const taste = tasteEvidenceOf(redactedOf(input));
    const chartKeys = new Set(keysOf(taste.chart));

    for (const key of ['now', 'daeun', 'sajuYear', 'age', 'startAge', 'endAge', 'startYear', 'date', 'viewedAt', 'viewedOn']) {
      expect(chartKeys.has(key), `chart 에 ${key} 가 남았다`).toBe(false);
    }
    expect(Object.keys(taste)).not.toContain('viewedAt');
    const text = JSON.stringify({ chart: taste.chart, limitations: taste.limitations });
    expect(text).not.toMatch(ISO_DATE);
    expect(text).not.toMatch(YEAR_NUMBER);
    /* 계약 칸까지 — 해 숫자가 어디에도 안 실린다 */
    expect(JSON.stringify(taste)).not.toMatch(YEAR_NUMBER);
  });

  it('자기 풀이 근거에는 그 값들이 있다 — 부재로 지나는 시험이 아니다', () => {
    const redacted = redactedOf(HAND_SAMPLE.input);
    const text = JSON.stringify(redacted);
    expect(redacted.charts.a.pillars.meta.sajuYear).toBe(1992);
    expect(redacted.charts.a.now.age).toBe(34);
    expect(text).toMatch(ISO_DATE);
    expect(text).toMatch(YEAR_NUMBER);
  });

  it('여덟 글자와 판정은 그대로 남는다 · 받은 근거를 고치지 않는다', () => {
    const redacted = redactedOf(HAND_SAMPLE.input);
    const before = JSON.stringify(redacted);
    const taste = tasteEvidenceOf(redacted);

    expect(JSON.stringify(redacted)).toBe(before);
    expect(taste.chart.pillars.year.name).toBe(redacted.charts.a.pillars.year.name);
    expect(taste.chart.pillars.meta.monthTerm.name).toBe(redacted.charts.a.pillars.meta.monthTerm.name);
    expect(taste.chart.analysis.structure).toEqual(redacted.charts.a.analysis.structure);
    expect(taste.chart.analysis.strength).toEqual(redacted.charts.a.analysis.strength);
    expect(Object.keys(taste.chart.claims)).not.toContain('now');
    expect(Object.keys(taste.chart.claims)).toContain('analysis.structure');
  });

  it('두 사람짜리 근거는 받지 않는다', () => {
    const pair = readingEvidenceOf('private', { a: computeSaju(HAND_SAMPLE.input), b: computeSaju(HOURLESS) }, VIEWED_AT);
    expect(() => tasteEvidenceOf(pair.evidence as never)).toThrow('한 사람');
  });
});

describe('근거 지문', () => {
  const fingerprintOf = (input: Parameters<typeof computeSaju>[0], viewedAt?: Date) =>
    tasteFingerprintOf(tasteEvidenceOf(redactedOf(input, viewedAt)));

  it('여덟 글자 · 성별 · 시간 앎 · 엔진 판으로만 짓는다 — 해 숫자는 원문에도 없다', () => {
    const source = tasteFingerprintSourceOf(tasteEvidenceOf(redactedOf(HAND_SAMPLE.input)));
    expect(source).toBe(`taste-fingerprint-v1|${CHART_ENGINE_VERSION}|壬申乙巳庚寅庚辰|female|hour`);
    expect(source).not.toContain('1992');
  });

  it('부른 시각이 달라도 같다 · 64자 16진', async () => {
    const one = await fingerprintOf(HAND_SAMPLE.input);
    expect(one).toMatch(/^[0-9a-f]{64}$/);
    expect(await fingerprintOf(HAND_SAMPLE.input, new Date('2027-03-01T00:00:00Z'))).toBe(one);
  });

  it('성별 · 시간 앎이 다르면 다르다', async () => {
    const one = await fingerprintOf(HAND_SAMPLE.input);
    expect(await fingerprintOf({ ...HAND_SAMPLE.input, gender: 'male' })).not.toBe(one);
    expect(await fingerprintOf({ year: 1992, month: 5, day: 14, hour: null, gender: 'female' })).not.toBe(one);
  });

  it('시간을 모르면 시주 자리가 - 다', () => {
    expect(tasteFingerprintSourceOf(tasteEvidenceOf(redactedOf(HOURLESS)))).toMatch(/\|辛未癸巳癸卯-\|female\|no-hour$/);
  });
});

describe('맛보기 프롬프트와 출력 모양', () => {
  it('정적인 지시가 앞에, 자료가 맨 뒤에 — 두 사람의 앞부분이 글자째 같다', () => {
    const one = tasteRunPromptOf(tasteEvidenceOf(redactedOf(HAND_SAMPLE.input)));
    const two = tasteRunPromptOf(tasteEvidenceOf(redactedOf(HOURLESS)));
    const head = (prompt: string) => prompt.slice(0, prompt.indexOf('## 자료'));

    expect(head(one)).toBe(head(two));
    expect(one.trimEnd().endsWith('```')).toBe(true);
    expect(one).not.toMatch(YEAR_NUMBER);
  });

  it('시키는 분량을 지시가 말한다', () => {
    const prompt = tasteRunPromptOf(tasteEvidenceOf(redactedOf(HAND_SAMPLE.input)));
    expect(prompt).toContain('300~500자');
    expect(prompt).toContain('문단 2~4개');
  });

  it('출력 모양은 숨은 판단을 먼저, 글을 맨 끝에 짓는다', () => {
    const shape = tasteRunShapeOf(tasteEvidenceOf(redactedOf(HAND_SAMPLE.input)));
    expect(Object.keys(shape.properties)).toEqual([
      'topic',
      'distinctivePattern',
      'supportingClaims',
      'continuationQuestion',
      'answerDirection',
      'previewMarkdown',
    ]);
    expect(shape.required).toEqual(Object.keys(shape.properties));
    expect(shape.properties.topic.enum).toEqual([...TASTE_TOPICS]);
  });

  it('근거 경로는 스키마의 enum 이 막는다 — 있는 칸만, 상한 표 · 겉값 · 빈 시주 없이', () => {
    const paths = tasteClaimPathsOf(tasteEvidenceOf(redactedOf(HAND_SAMPLE.input)));
    expect(paths).toContain('analysis.structure');
    expect(paths).toContain('pillars.hour');
    expect(paths).toContain('relations');
    expect(paths.some((path) => path.startsWith('claims') || path.startsWith('meta') || path === 'pillars.meta')).toBe(false);
    expect(paths.some((path) => path.startsWith('now') || path.startsWith('daeun'))).toBe(false);
    expect(tasteRunShapeOf(tasteEvidenceOf(redactedOf(HAND_SAMPLE.input))).properties.supportingClaims.items.enum).toEqual(paths);

    const hourless = tasteClaimPathsOf(
      tasteEvidenceOf(redactedOf({ year: 1991, month: 6, day: 2, hour: null, gender: 'female' } as never)),
    );
    expect(hourless).not.toContain('pillars.hour');
  });

  it('한 꼴로 몰지 않는다 — 꼴 여덟을 다 보이고 「압박 · 혼자 버팀」은 가장 두드러질 때만', () => {
    const prompt = tasteRunPromptOf(tasteEvidenceOf(redactedOf(HAND_SAMPLE.input)));
    for (const topic of TASTE_TOPICS) expect(prompt).toContain(topic);
    expect(prompt).toContain('정말 가장 두드러질 때만');
    /* 1차 프롬프트의 본보기 멈춤 문장 — 모델이 그대로 베꼈다(2026-10-03 실호출) */
    expect(prompt).not.toContain('같은 압박을 버티는 대신');
  });
});

describe('맛보기 규칙 검사', () => {
  const evidence = tasteEvidenceOf(redactedOf(HAND_SAMPLE.input));
  const GOOD: TasteRunOutput = HAND_SAMPLE.taste;
  const reasonsOf = (output: TasteRunOutput) => {
    const verdict = checkTasteRun(output, evidence);
    return verdict.ok ? [] : verdict.reasons;
  };

  it('손 견본은 지난다 — 근거 경로까지', () => {
    expect(checkTasteRun(GOOD, evidence)).toEqual({ ok: true });
  });

  const preview = GOOD.previewMarkdown;
  it.each<[string, Partial<TasteRunOutput>]>([
    ['previewMarkdown 이 비었다', { previewMarkdown: '  ' }],
    ['continuationQuestion 이 비었다', { continuationQuestion: '' }],
    ['answerDirection 이 비었다', { answerDirection: ' ' }],
    ['supportingClaims 가 0개다', { supportingClaims: [] }],
    ['근거에 없는 경로: now.daeun', { supportingClaims: ['analysis.structure', 'now.daeun'] }],
    ['근거에 없는 경로: analysis.relations', { supportingClaims: ['analysis.relations'] }],
    ['근거에 없는 경로: pillars.year.stem', { supportingClaims: ['pillars.year.stem'] }],
    ['모르는 topic', { topic: '책임감' as never }],
    ['distinctivePattern 이 비었다', { distinctivePattern: ' ' }],
    ['경로 꼴이 아닌 supportingClaims', { supportingClaims: ['구조가 그렇다'] }],
    ['너무 짧다', { previewMarkdown: '짧은 글이에요.\n\n정말 짧아요.' }],
    ['너무 길다', { previewMarkdown: `${preview} ${'그 압박은 생각보다 오래 이어질 수 있어요. '.repeat(14).trim()}` }],
    ['문단이 1개다', { previewMarkdown: preview.replace(/\n\n/g, ' ') }],
    ['완결된 문장으로 끝나지 않는다', { previewMarkdown: `${preview.slice(0, -1)}…` }],
    ['완결된 문장으로 끝나지 않는다', { previewMarkdown: preview.replace(/있을까요\?$/, '그 방향은 바로') }],
    ['장면 안의 물음(「~요?」)으로 멈추지 않는다', { previewMarkdown: preview.replace(/있을까요\?$/, '있어요.') }],
    ['다음을 예고한다: 「다음 이야기」', { previewMarkdown: `${preview.slice(0, -1)} 이게 다음 이야기일까요?` }],
    ['다음을 예고한다: 「따로 살펴」', { previewMarkdown: preview.replace('그렇다면', '따로 살펴보면') }],
    ['해요체로 끝나지 않는 문장이 있다', { previewMarkdown: preview.replace('타고났어요.', '타고났다.') }],
    ['「AI」를 말한다', { previewMarkdown: preview.replace('쇠의 기운을', 'AI 가 보니 쇠의 기운을') }],
    ['제목 · 목록 · 굵은 글씨가 있다', { previewMarkdown: preview.replace('쇠의 기운', '**쇠의 기운**') }],
    ['분류명이 있다: 신약', { previewMarkdown: preview.replace('다만 그 단단함을', '다만 신약이라 그 단단함을') }],
    ['한자가 있다', { previewMarkdown: preview.replace('쇠의 기운', '庚 쇠의 기운') }],
  ])('%s — 걸린다', (reason, patch) => {
    expect(reasonsOf({ ...GOOD, ...patch }).join(' / ')).toContain(reason);
  });

  it('`chart.` 만 떼고 그 밖은 고치지 않는다', () => {
    expect(normalizeClaim(' chart.analysis.strength ')).toBe('analysis.strength');
    expect(normalizeClaim('analysis.relations')).toBe('analysis.relations');
    expect(checkTasteRun({ ...GOOD, supportingClaims: ['chart.analysis.strength', 'chart.relations'] }, evidence)).toEqual({ ok: true });
  });

  it('근거 없이 부르면 경로의 꼴만 본다', () => {
    expect(checkTasteRun({ ...GOOD, supportingClaims: ['now.daeun'] })).toEqual({ ok: true });
  });
});
