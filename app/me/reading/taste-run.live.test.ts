import { mkdirSync, writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadLocalEnv } from '@/src/lib/local-env';
import { checkReading, readingEvidenceOf, readingPromptOf, type BirthSecret } from '@/src/lib/reading';
import {
  checkContinuation,
  continuationBlockOf,
  markdownHeadOf,
  type ContinuedReadingOutput,
} from '@/src/lib/reading/continuation';
import {
  tasteRunShapeOf,
  checkTasteRun,
  tasteEvidenceOf,
  tasteFingerprintOf,
  tasteRunPromptOf,
  type TasteRunOutput,
} from '@/src/lib/reading/taste-run';
import { HAND_SAMPLE } from '@/src/lib/reading/taste-run-sample';
import { computeSaju } from '@/src/lib/saju';

import { GENERATION } from './generation';
import type { ModelUsage } from './generator';
import { callModel, type ReasoningEffort } from './model';

/**
 * **개인별 맛보기 · 가입 뒤 이어쓰기의 짝 견본을 뽑는 자리 — 실험이다.** 운영자가 손으로 돌린다(실호출 · 토큰이 나간다).
 *
 * ADR 0131 의 720칸 공용 표를 사람마다 짧은 모델 생성으로 바꾸는 설계를 2026-10-03 에 합의했다
 * (`docs/notes/2026-10-03-taste-run-experiment.md`). ADR 은 아직 없다 — 순서는 「이 시험의 짝 견본 → 사람의 짝 검토 →
 * ADR(0131 대체)」이다. 운영 경로 · DB 는 이 파일을 모르고, 이 파일도 DB 에 쓰지 않는다. 결과는 `.taste-run-live/<시각>/`
 * 에만 떨군다(`.gitignore`). `taste.live.test.ts` · `call.live.test.ts` 와 같은 잠금이다 — 켜는 값이 없으면 아무것도 안 부른다.
 *
 * ## 돌리는 법
 *
 *   # 먼저 작게 — 손 견본 하나 · 추론 none 만(부름 1번, 약 5원)
 *   TASTE_RUN_LIVE=1 TASTE_RUN_SAMPLES=hand TASTE_RUN_EFFORTS=none npx vitest run app/me/reading/taste-run.live.test.ts
 *
 *   # 맛보기만 전부 — 견본 6 × 추론 none = 부름 6번, 약 22원
 *   TASTE_RUN_LIVE=1 npx vitest run app/me/reading/taste-run.live.test.ts
 *
 *   # 짝은 고른 견본만 — 맛보기 6번 + 고른 셋의 전체 자기 풀이 3번(× 약 20원) = 약 80원
 *   TASTE_RUN_LIVE=1 TASTE_RUN_PAIR=1 TASTE_RUN_PAIR_SAMPLES=hand,strong-m,hourless-f npx vitest run app/me/reading/taste-run.live.test.ts
 *
 * 켜는 값 — `TASTE_RUN_EFFORTS`(쉼표, 기본 `none` — 1차에서 `low` 는 느리고 비싸고 검사를 덜 지났다) ·
 * `TASTE_RUN_SAMPLES`(쉼표로 견본 id, 기본 전부) · `TASTE_RUN_PAIR=1`(짝) · `TASTE_RUN_PAIR_SAMPLES`(짝을 지을 견본 id). 맛보기는 출력 상한 1,500 토큰(추론 포함) · 시간 상한 20초 · 기다리는 길로 부르고, 전체 자기
 * 풀이는 운영과 같은 기본값(추론 세기 안 보냄 · 상한 없음 · 240초)으로 부른다. 원 단위는 1,400원/$ 가정이다.
 * 위 원 단위의 맛보기 한 건 값(약 5원)은 **추정**이다 — 이 시험이 실제 사용량으로 다시 센다.
 */

const live = process.env.TASTE_RUN_LIVE === '1';
const pairing = process.env.TASTE_RUN_PAIR === '1';
/** 짝을 부를 견본 — 적으면 그 견본만 짝을 짓는다(2차: 주제가 갈린 것을 보고 대표 셋만). 안 적으면 검사를 지난 것 전부 */
const pairSamples = process.env.TASTE_RUN_PAIR_SAMPLES?.split(',').map((one) => one.trim()).filter((one) => one !== '') ?? [];
const OUTPUT_ROOT = '.taste-run-live';

/** 맛보기 전용 설정 — 합의한 값(노트 「맛보기 전용 모델 설정」) */
const TASTE_CALL = { maxOutputTokens: 1_500, timeoutMs: 20_000 } as const;

/**
 * 공식 단가(USD / 1M 토큰) — gpt-5.6-luna, https://developers.openai.com/api/docs/models/gpt-5.6-luna (2026-10-03 확인).
 * 캐시 쓰기는 입력의 1.25배다. 청구의 원본은 대시보드다 — 여기 값은 견주기용이다.
 */
const PRICE_PER_MILLION = { input: 0.2, cacheRead: 0.02, cacheWrite: 0.25, output: 1.2 } as const;
const KRW_PER_USD = 1_400;

type SampleInput = Parameters<typeof computeSaju>[0];

/**
 * 고정 견본 — **신강 · 신약 · 시간 모름 · 남녀를 섞는다.** 섞였는지는 아래 잠금 없는 블록이 돈 쓰기 전에 잰다.
 * 신강 둘은 2026-10-03 에 1987 · 1995 년을 훑어 `analysis.strength.ratio` 가 0.7 을 넘는 날로 골랐다.
 */
const SAMPLES: readonly { id: string; label: string; input: SampleInput; city: string }[] = [
  { id: 'hand', label: '1992-05-14 09:30 여성 (손 견본의 사주)', input: HAND_SAMPLE.input, city: '서울' },
  { id: 'weak-m', label: '1990-05-12 14:30 남성', input: { year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0, gender: 'male' }, city: '서울' },
  { id: 'strong-m', label: '1987-07-07 10:00 남성', input: { year: 1987, month: 7, day: 7, hour: 10, minute: 0, second: 0, gender: 'male' }, city: '부산' },
  { id: 'strong-f', label: '1995-01-07 10:00 여성', input: { year: 1995, month: 1, day: 7, hour: 10, minute: 0, second: 0, gender: 'female' }, city: '대구' },
  { id: 'hourless-f', label: '1991-06-02 시간 모름 여성', input: { year: 1991, month: 6, day: 2, hour: null, gender: 'female' }, city: '서울' },
  { id: 'weak-f', label: '1993-11-03 08:10 여성', input: { year: 1993, month: 11, day: 3, hour: 8, minute: 10, second: 0, gender: 'female' }, city: '부산' },
];

const pad = (value: number) => String(value).padStart(2, '0');

/** 견본의 출생 원문 — 풀이 검사(`checkReading`)가 본문에 새지 않았는지 보는 값이다 */
const secretOf = ({ input, city }: (typeof SAMPLES)[number]): BirthSecret => {
  const date = `${input.year}-${pad(input.month)}-${pad(input.day)}`;
  const time = input.hour === null ? null : `${pad(input.hour)}:${pad(input.minute ?? 0)}:00`;
  return { originalDate: date, solarDate: date, birthTime: time, city };
};

describe('맛보기 실험 견본은 신강 · 신약 · 시간 모름 · 남녀를 섞는다 (돈을 쓰지 않는다)', () => {
  it('섞였다 — 엔진이 자라 한쪽으로 쏠리면 실호출 전에 빨개진다', () => {
    const charts = SAMPLES.map(({ input }) => computeSaju(input));
    const verdicts = new Set(charts.map((chart) => chart.analysis.strength.verdict));
    expect([...verdicts].sort()).toEqual(['strong', 'weak']);
    expect(charts.some((chart) => !chart.meta.hourKnown)).toBe(true);
    expect(new Set(SAMPLES.map(({ input }) => input.gender))).toEqual(new Set(['male', 'female']));
    expect(SAMPLES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(SAMPLES.map(({ id }) => id)).size).toBe(SAMPLES.length);
  });
});

const EFFORTS: readonly ReasoningEffort[] = ['none', 'low', 'medium', 'high'];

const chosenEfforts = (): readonly ReasoningEffort[] => {
  const listed = (process.env.TASTE_RUN_EFFORTS ?? 'none').split(',').map((one) => one.trim()).filter((one) => one !== '');
  const unknown = listed.filter((one) => !(EFFORTS as readonly string[]).includes(one));
  if (unknown.length > 0) throw new Error(`모르는 추론 세기: ${unknown.join(', ')} — ${EFFORTS.join(' · ')} 중에서`);
  return listed as ReasoningEffort[];
};

const chosenSamples = () => {
  const listed = process.env.TASTE_RUN_SAMPLES?.split(',').map((one) => one.trim()).filter((one) => one !== '');
  if (listed === undefined || listed.length === 0) return SAMPLES;
  const unknown = listed.filter((id) => !SAMPLES.some((sample) => sample.id === id));
  if (unknown.length > 0) throw new Error(`없는 견본: ${unknown.join(', ')} — ${SAMPLES.map(({ id }) => id).join(' · ')}`);
  return SAMPLES.filter(({ id }) => listed.includes(id));
};

type Spend = {
  ms: number;
  usage: ModelUsage | null;
  reasoningTokens: number | null;
  /** 못 센 칸이 있으면 `null` — 0 으로 채우지 않는다 */
  usd: number | null;
  krw: number | null;
  /** 캐시 쓰기를 provider 가 안 줬다 — 그 몫은 입력 단가로 셌다(최대 25% 낮다) */
  cacheWriteUnknown: boolean;
};

const spendOf = (ms: number, usage: ModelUsage | null, reasoningTokens: number | null): Spend => {
  if (usage === null || usage.noCacheTokens === null || usage.outputTokens === null) {
    return { ms, usage, reasoningTokens, usd: null, krw: null, cacheWriteUnknown: true };
  }
  const usd =
    (usage.noCacheTokens * PRICE_PER_MILLION.input +
      (usage.cacheReadTokens ?? 0) * PRICE_PER_MILLION.cacheRead +
      (usage.cacheWriteTokens ?? 0) * PRICE_PER_MILLION.cacheWrite +
      usage.outputTokens * PRICE_PER_MILLION.output) /
    1_000_000;
  return { ms, usage, reasoningTokens, usd, krw: usd * KRW_PER_USD, cacheWriteUnknown: usage.cacheWriteTokens === null };
};

const timed = async <T>(call: () => Promise<T>): Promise<{ ms: number; value: T }> => {
  const started = performance.now();
  const value = await call();
  return { ms: Math.round(performance.now() - started), value };
};

type PairRecord = {
  ok: boolean;
  detail: string | null;
  output: ContinuedReadingOutput | null;
  spend: Spend | null;
  continuationCheck: readonly string[] | 'ok' | null;
  readingCheck: readonly unknown[] | 'ok' | null;
};

type RunRecord = {
  sample: string;
  label: string;
  effort: ReasoningEffort;
  fingerprint: string;
  eightChars: string;
  ok: boolean;
  detail: string | null;
  output: TasteRunOutput | null;
  spend: Spend | null;
  tasteCheck: readonly string[] | 'ok' | null;
  pair: PairRecord | null;
};

const describeSpend = (spend: Spend | null): string => {
  if (spend === null) return '부르지 못했다';
  const usage = spend.usage;
  const tokens =
    usage === null
      ? '사용량 못 받음'
      : `입력 ${usage.inputTokens ?? '?'}(캐시 읽기 ${usage.cacheReadTokens ?? '?'} · 쓰기 ${usage.cacheWriteTokens ?? '못 받음'}) · 출력 ${usage.outputTokens ?? '?'}(추론 ${spend.reasoningTokens ?? '?'})`;
  const cost = spend.usd === null ? '비용 못 셈' : `$${spend.usd.toFixed(5)} ≈ ${spend.krw?.toFixed(1)}원`;
  return `${spend.ms.toLocaleString()} ms · ${tokens} · ${cost}`;
};

const describeCheck = (check: readonly unknown[] | 'ok' | null): string =>
  check === null ? '안 잼' : check === 'ok' ? '지남' : `걸림 — ${check.map((one) => (typeof one === 'string' ? one : JSON.stringify(one))).join(' / ')}`;

const quoted = (text: string) =>
  text
    .split('\n')
    .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
    .join('\n');

/** 사람이 읽는 짝 문서 — 화면에 서는 차례대로 */
const pairDocOf = (record: RunRecord): string => {
  const lines = [
    `# ${record.label} · 추론 ${record.effort}`,
    '',
    `- 명식 ${record.eightChars} · 지문 \`${record.fingerprint.slice(0, 12)}…\``,
    `- 맛보기 부름: ${record.ok ? describeSpend(record.spend) : `실패 — ${record.detail}`}`,
    `- 맛보기 검사: ${describeCheck(record.tasteCheck)}`,
  ];
  if (record.output === null) return lines.join('\n');
  const output = record.output;
  lines.push(
    '',
    '## 맛보기 원문 (로그인 전 화면)',
    '',
    output.previewMarkdown,
    '',
    '**[더보기]**',
    '',
    '## 보이지 않는 칸',
    '',
    `- 꼴: ${output.topic}`,
    `- 이 사주가 갈리는 점: ${output.distinctivePattern}`,
    `- 질문: ${output.continuationQuestion}`,
    `- 답의 방향: ${output.answerDirection}`,
    `- 기대는 자료: ${output.supportingClaims.map((claim) => `\`${claim}\``).join(' · ')}`,
  );
  const pair = record.pair;
  if (pair === null) {
    lines.push('', pairing ? '_(짝 없음 — 맛보기 검사를 못 지났다)_' : '_(짝 없음 — `TASTE_RUN_PAIR=1` 이 아니다)_');
    return lines.join('\n');
  }
  lines.push(
    '',
    '---',
    '',
    '## 가입 뒤 — 아까 보던 내용',
    '',
    quoted(output.previewMarkdown),
    '',
    `- 전체 풀이 부름: ${pair.ok ? describeSpend(pair.spend) : `실패 — ${pair.detail}`}`,
    `- continuationAnswer 검사: ${describeCheck(pair.continuationCheck)}`,
    `- 풀이 저장 검사(checkReading): ${describeCheck(pair.readingCheck)}`,
  );
  if (pair.output !== null) {
    lines.push(
      '',
      '## continuationAnswer',
      '',
      pair.output.continuationAnswer,
      '',
      '## markdown 첫 절',
      '',
      markdownHeadOf(pair.output.markdown).trim(),
      '',
      `_(한 줄 요약: ${pair.output.metaphor})_`,
    );
  }
  return lines.join('\n');
};

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const summaryRow = (name: string, spends: readonly Spend[], total: number, passed: number): string => {
  const times = spends.map(({ ms }) => ms);
  const costs = spends.flatMap(({ krw }) => (krw === null ? [] : [krw]));
  const mean = costs.length === 0 ? null : costs.reduce((sum, value) => sum + value, 0) / costs.length;
  const reasoning = spends.flatMap(({ reasoningTokens }) => (reasoningTokens === null ? [] : [reasoningTokens]));
  return `| ${name} | ${total} | ${spends.length} | ${passed} | ${median(times)?.toLocaleString() ?? '-'} | ${times.length === 0 ? '-' : Math.max(...times).toLocaleString()} | ${mean === null ? '-' : mean.toFixed(2)} | ${median(reasoning) ?? '-'} |`;
};

const summaryOf = (records: readonly RunRecord[], efforts: readonly ReasoningEffort[]): string => {
  const rows = efforts.map((effort) => {
    const mine = records.filter((record) => record.effort === effort);
    const spends = mine.flatMap(({ spend, ok }) => (ok && spend !== null ? [spend] : []));
    return summaryRow(`맛보기 · ${effort}`, spends, mine.length, mine.filter(({ tasteCheck }) => tasteCheck === 'ok').length);
  });
  const pairs = records.flatMap(({ pair }) => (pair === null ? [] : [pair]));
  if (pairs.length > 0) {
    const spends = pairs.flatMap(({ spend, ok }) => (ok && spend !== null ? [spend] : []));
    rows.push(summaryRow('전체 풀이(이어쓰기)', spends, pairs.length, pairs.filter(({ continuationCheck }) => continuationCheck === 'ok').length));
  }
  return [
    `# 맛보기 실험 요약 — ${new Date().toISOString()}`,
    '',
    `모델 \`${GENERATION.model}\` · 맛보기 출력 상한 ${TASTE_CALL.maxOutputTokens} · 시간 상한 ${TASTE_CALL.timeoutMs / 1000}초 · 단가 입력 $${PRICE_PER_MILLION.input} · 캐시 읽기 $${PRICE_PER_MILLION.cacheRead} · 캐시 쓰기 $${PRICE_PER_MILLION.cacheWrite} · 출력 $${PRICE_PER_MILLION.output} /1M · ${KRW_PER_USD}원/$`,
    '',
    '| 무엇 | 부름 | 받음 | 검사 지남 | 시간 중앙값(ms) | 시간 최댓값(ms) | 비용 평균(원) | 추론 토큰 중앙값 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '캐시 쓰기를 provider 가 안 준 부름은 그 몫을 입력 단가로 셌다 — 최대 25% 낮게 나온다(`runs.json` 의 `cacheWriteUnknown`).',
    '',
    '## 주제가 갈렸나 — 견본마다 고른 꼴과 갈리는 점',
    '',
    '| 견본 | 세기 | 꼴 | 갈리는 점 | 질문 |',
    '| --- | --- | --- | --- | --- |',
    ...records.flatMap(({ label, effort, output }) =>
      output === null ? [] : [`| ${label} | ${effort} | ${output.topic} | ${output.distinctivePattern.replace(/\|/g, '/')} | ${output.continuationQuestion.replace(/\|/g, '/')} |`],
    ),
    '',
    '## 짝 검토의 여섯 질문 (`docs/notes/2026-10-03-taste-run-experiment.md`)',
    '',
    '1. 첫 문단에서 「내 얘기」인가',
    '2. [더보기]를 누르고 싶은가',
    '3. 가입 뒤 답이 기대를 해소하는가',
    '4. 한 사람이 쓴 한 글처럼 이어지는가',
    '5. 응답 시간이 견딜 만한가',
    '6. 맛보기 한 건 실제 비용',
    '',
    '## 견줄 거리 — 손 견본(실호출 아님)',
    '',
    HAND_SAMPLE.taste.previewMarkdown,
    '',
    `- 질문: ${HAND_SAMPLE.taste.continuationQuestion}`,
    `- 답의 방향: ${HAND_SAMPLE.taste.answerDirection}`,
    '',
    HAND_SAMPLE.continuationAnswer,
    '',
    ...records.map((record) => `- [${record.label} · ${record.effort}](./${record.sample}-${record.effort}.md) — 맛보기 ${describeCheck(record.tasteCheck)}${record.pair === null ? '' : ` · 이어쓰기 ${describeCheck(record.pair.continuationCheck)}`}`),
  ].join('\n');
};

describe.skipIf(!live)('맛보기 · 이어쓰기 짝 견본을 뽑는다 (TASTE_RUN_LIVE=1)', () => {
  it(
    '견본 × 추론 세기마다 맛보기를 부르고, 짝이면 전체 풀이를 이어 부른다 — 원문과 시간 · 비용을 떨군다',
    async () => {
      loadLocalEnv();
      const efforts = chosenEfforts();
      const samples = chosenSamples();
      const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
      const dir = `${OUTPUT_ROOT}/${stamp}`;
      mkdirSync(dir, { recursive: true });
      console.info(`맛보기 ${samples.length * efforts.length}번${pairing ? ' + 짝' : ''} — ${dir}/`);

      const records: RunRecord[] = [];
      for (const sample of samples) {
        const chart = computeSaju(sample.input);
        const built = readingEvidenceOf('self', { a: chart }, new Date());
        if (built.kind !== 'self') throw new Error('한 사람의 근거가 아니다');
        const taste = tasteEvidenceOf(built.evidence);
        const fingerprint = await tasteFingerprintOf(taste);
        const eightChars = [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour]
          .map((pillar) => pillar?.name ?? '--')
          .join(' ');

        for (const effort of efforts) {
          const { ms, value: called } = await timed(() =>
            callModel<TasteRunOutput>(tasteRunPromptOf(taste), { shape: tasteRunShapeOf(taste), reasoningEffort: effort, ...TASTE_CALL }),
          );
          const record: RunRecord = {
            sample: sample.id,
            label: sample.label,
            effort,
            fingerprint,
            eightChars,
            ok: called.ok,
            detail: called.ok ? null : `${called.code}: ${called.detail} (${ms.toLocaleString()} ms)`,
            output: called.ok ? called.output : null,
            spend: called.ok ? spendOf(ms, called.usage, called.reasoningTokens) : null,
            tasteCheck: null,
            pair: null,
          };
          if (called.ok) {
            const verdict = checkTasteRun(called.output, taste);
            record.tasteCheck = verdict.ok ? 'ok' : verdict.reasons;
          }

          /* 짝은 검사를 지난 맛보기만 — 떨어진 맛보기는 화면에 안 서므로 그 뒤를 부를 까닭이 없다 */
          if (
            pairing &&
            record.output !== null &&
            record.tasteCheck === 'ok' &&
            (pairSamples.length === 0 || pairSamples.includes(sample.id))
          ) {
            const carry = record.output;
            const prompt = `${readingPromptOf(built)}\n\n${continuationBlockOf(carry)}`;
            const { ms: pairMs, value: full } = await timed(() => callModel<ContinuedReadingOutput>(prompt, { continuation: true }));
            const pair: PairRecord = {
              ok: full.ok,
              detail: full.ok ? null : `${full.code}: ${full.detail}`,
              output: full.ok ? full.output : null,
              spend: full.ok ? spendOf(pairMs, full.usage, full.reasoningTokens) : null,
              continuationCheck: null,
              readingCheck: null,
            };
            if (full.ok) {
              const continued = checkContinuation({
                answer: full.output.continuationAnswer,
                preview: carry.previewMarkdown,
                markdown: full.output.markdown,
              });
              pair.continuationCheck = continued.ok ? 'ok' : continued.reasons;
              const saved = checkReading({
                kind: 'self',
                output: full.output,
                evidenceText: JSON.stringify(built.evidence),
                secrets: [secretOf(sample)],
              });
              pair.readingCheck = saved.ok ? 'ok' : saved.failures;
            }
            record.pair = pair;
          }

          records.push(record);
          /* 부를 때마다 떨군다 — 도중에 끊겨도 돈을 낸 원문이 남는다 */
          writeFileSync(`${dir}/${sample.id}-${effort}.md`, `${pairDocOf(record)}\n`);
          writeFileSync(`${dir}/runs.json`, JSON.stringify({ generation: GENERATION, tasteCall: TASTE_CALL, price: PRICE_PER_MILLION, records }, null, 2));
          console.info(
            `[${sample.id} · ${effort}] 맛보기 ${record.ok ? describeSpend(record.spend) : record.detail} — ${describeCheck(record.tasteCheck)}${
              record.pair === null ? '' : ` · 짝 ${record.pair.ok ? describeSpend(record.pair.spend) : record.pair.detail} — ${describeCheck(record.pair.continuationCheck)}`
            }`,
          );
        }
      }

      writeFileSync(`${dir}/summary.md`, `${summaryOf(records, efforts)}\n`);
      console.info(`요약 — ${dir}/summary.md`);

      /* 이 시험은 견본을 뽑는 자리다 — 검사에 걸린 것도 원문으로 남기고 실패로 세우지 않는다. 다 불렀는지만 본다 */
      expect(records).toHaveLength(samples.length * efforts.length);
    },
    /* 맛보기 20초 × 12 + 짝 240초 × 12 의 바깥 상한 */
    90 * 60 * 1000,
  );
});
