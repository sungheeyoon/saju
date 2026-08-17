import { describe, expect, it } from 'vitest';

import { computeSaju, formatPillars, type Saju } from '@/src/lib/saju';
import { COMPAT_SIDES, analyzeCompatibility, type CompatSide } from '@/src/lib/saju/compat';
import {
  ASSEMBLE_POLICY,
  CLAIM_STRENGTH_KO,
  CORPUS_POLICY,
  FRAGMENT_INDEX,
  UNCOVERED_COMPAT_FACTS,
  UNCOVERED_FACTS,
  assembleCompatText,
  assembleText,
  fragmentCoverage,
  sentencesOf,
  type Utterance,
} from '@/src/lib/saju/text';

/**
 * 문장 골든 — **명식 하나에서 어떤 발화가 나오고 무엇이 침묵하는지.**
 *
 * 계산 골든(`golden.snapshot.txt`)과 파일을 나눈 것은 변경 이유가 다르기
 * 때문이다. 절기 계산을 고쳤는데 문장 diff 가 쏟아지거나, 문장 틀을 고쳤는데
 * 사주 계산이 바뀐 것처럼 보이면 둘 다 못 읽는다.
 *
 * 시간 미상 명식이 반드시 한 건 있어야 한다. 강등과 침묵이 눈에 보이는 자리는
 * 여기뿐이고, 계약에서 가장 되돌리기 쉬운 줄이 그것이다.
 */

type TextCase = {
  id: string;
  note: string;
  saju: Saju;
};

const CASES: TextCase[] = [
  {
    id: 'relations-rich',
    note: '관계가 여럿 걸린다 — 종류마다 술어가 갈리는 것이 보인다',
    saju: computeSaju(
      { year: 1990, month: 5, day: 20, hour: 14, minute: 30, second: 0, gender: 'male' },
      {},
    ),
  },
  {
    id: 'branch-clash',
    note: '지지충·형·해·파·원진이 한꺼번에 — 종류가 달라도 행의 모양은 같다',
    saju: computeSaju(
      { year: 2000, month: 1, day: 1, hour: 14, minute: 30, second: 0, gender: 'male' },
      {},
    ),
  },
  {
    id: 'no-relations',
    note: '관계가 하나도 없다 — 사실이 없으면 발화도 없다',
    saju: computeSaju(
      { year: 1989, month: 5, day: 11, hour: 9, minute: 30, second: 0, gender: 'male' },
      {},
    ),
  },
  {
    id: 'hour-unknown',
    note: '시간 미상 — 강도가 한 칸 내려가고 "없다"는 발화는 입을 닫는다',
    saju: computeSaju({ year: 1990, month: 5, day: 20, hour: null, gender: 'male' }, {}),
  },
  // 조후표 120칸 중 여섯만 상·하반월을 갈라 말한다. 흔한 칸만 골라 두면 나머지
  // 두 변종은 골든에 한 번도 나오지 않고, 그러면 갈라 쓴 이유도 보이지 않는다.
  {
    id: 'johu-half-month',
    note: '조후표가 상·하반월을 가르는 칸 — 절반을 판정해 한쪽만 든다',
    saju: computeSaju(
      { year: 1985, month: 1, day: 13, hour: 14, minute: 30, second: 0, gender: 'male' },
      {},
    ),
  },
  {
    id: 'johu-half-unjudged',
    note: '같은 칸인데 시간 미상이고 중기가 그날 안에 있다 — 절반을 고르지 않는다',
    saju: computeSaju({ year: 1985, month: 7, day: 23, hour: null, gender: 'male' }, {}),
  },
];

/** 문장이 됐는가, 조각이 없는가, 말하지 않기로 했는가 */
const markOf = (utterance: Utterance): string => {
  if (utterance.key === null) return '×';
  return utterance.text === null ? '·' : '✓';
};

const formatUtterance = (utterance: Utterance): string => {
  const { request, strength, key, text } = utterance;
  const coordinate = key ?? `${request.topic}/${request.variant}`;
  const body = text ?? (key === null ? '(말하지 않는다)' : '(조각 없음)');

  return [
    `    ${markOf(utterance)} ${coordinate}`,
    `        ${CLAIM_STRENGTH_KO[strength].padEnd(6)} ${body}`,
  ].join('\n');
};

const formatCase = ({ id, note, saju }: TextCase): string => {
  const utterances = assembleText(saju);
  const spoken = utterances.filter((utterance) => utterance.text !== null).length;
  const missing = utterances.filter(
    (utterance) => utterance.key !== null && utterance.text === null,
  ).length;
  const silent = utterances.filter((utterance) => utterance.key === null).length;

  return [
    `── ${id}`,
    `   ${note}`,
    `   사주  ${formatPillars(saju.pillars)}`,
    `   발화 ${utterances.length} · 문장 ${spoken} · 조각 없음 ${missing} · 말하지 않음 ${silent}`,
    '',
    ...utterances.map(formatUtterance),
  ].join('\n');
};

/**
 * 궁합 케이스 — **같은 주제, 같은 조각인데 행에 이름이 붙는다.**
 *
 * 원국 케이스와 나란히 찍혀야 그것이 보인다. 궁합용 문장을 따로 뒀다면 같은
 * 관계가 화면 두 곳에서 다르게 읽혔을 텐데, 여기서 두 절을 붙여 놓으면 그런
 * 일이 생기는 순간 diff 가 한눈에 보인다.
 */
type CompatCase = {
  id: string;
  note: string;
  people: Record<CompatSide, { label: string; saju: Saju }>;
};

const COMPAT_CASES: CompatCase[] = [
  {
    id: 'compat-named',
    note: '두 사람 — 누구의 어느 자리 어느 글자인지가 행에 그대로 있다',
    people: {
      a: {
        label: '민수',
        saju: computeSaju(
          { year: 1990, month: 5, day: 20, hour: 14, minute: 30, second: 0, gender: 'male' },
          {},
        ),
      },
      b: {
        label: '지영',
        saju: computeSaju(
          { year: 1992, month: 11, day: 3, hour: 9, minute: 0, second: 0, gender: 'female' },
          {},
        ),
      },
    },
  },
  {
    id: 'compat-hour-unknown',
    note: '한쪽이 시간 미상 — 행은 사실 그대로이고 목록이 누구의 시주가 빠졌는지 든다',
    people: {
      a: {
        label: '민수',
        saju: computeSaju(
          { year: 1990, month: 5, day: 20, hour: 14, minute: 30, second: 0, gender: 'male' },
          {},
        ),
      },
      b: {
        label: '지영',
        saju: computeSaju({ year: 1992, month: 11, day: 3, hour: null, gender: 'female' }, {}),
      },
    },
  },
  /**
   * 십성 변종 다섯 중 골든이 밟는 것은 위 두 케이스에서 둘(인성·식상)뿐이다.
   * 아래 둘이 나머지 셋을 밟는다 — 조후표에서 갈리는 칸을 일부러 골라 둔 것과
   * 같은 이유로, 흔한 칸만 두면 변종을 왜 갈랐는지가 골든에 안 보인다.
   */
  {
    id: 'compat-officer-wealth',
    note: '십성이 비대칭인 자리 — 한쪽은 관성으로 보고 다른 쪽은 재성으로 본다',
    people: {
      a: {
        label: '민수',
        saju: computeSaju(
          { year: 1990, month: 5, day: 20, hour: 14, minute: 30, second: 0, gender: 'male' },
          {},
        ),
      },
      b: {
        label: '지영',
        saju: computeSaju(
          { year: 1992, month: 1, day: 5, hour: 9, minute: 0, second: 0, gender: 'female' },
          {},
        ),
      },
    },
  },
  /**
   * 두 일간이 같은 오행이면 양방향이 같은 값이 된다 — **비겁만 그렇다.**
   * 두 행이 같은 말을 하고 그것을 겹친 채로 둔다. 방향을 변종으로 갈라 "서로를
   * 같게 본다" 한 줄로 접을 수도 있었지만, 그러면 엔진이 양방향으로 들고 있는
   * 값을 문장이 하나로 접는 것이라 접었다는 사실이 어디에도 안 남는다.
   */
  {
    id: 'compat-mutual',
    note: '두 일간이 같은 오행 — 양방향이 같은 십성이라 두 행이 겹친다',
    people: {
      a: {
        label: '민수',
        saju: computeSaju(
          { year: 1990, month: 5, day: 20, hour: 14, minute: 30, second: 0, gender: 'male' },
          {},
        ),
      },
      b: {
        label: '지영',
        saju: computeSaju(
          { year: 1992, month: 1, day: 9, hour: 9, minute: 0, second: 0, gender: 'female' },
          {},
        ),
      },
    },
  },
  /**
   * 같은 짝인데 지영의 시각만 지운다. 위 케이스에서 "지영 원국에 그 오행이
   * 없습니다" 로 서던 문장이 **입을 닫는다** — 시지가 그 오행이었을 수 있어서
   * "없습니다"가 그냥 틀린 문장이 되기 때문이다. 궁합에서 침묵이 처음 보이는
   * 자리이고, 계약의 `absence → silent` 가 두 사람 판에서도 도는 것을 확인한다.
   */
  {
    id: 'compat-absence-silent',
    note: '없다는 주장은 상대의 시주가 빠지면 입을 닫는다 — 같은 짝, 시각만 지웠다',
    people: {
      a: {
        label: '민수',
        saju: computeSaju(
          { year: 1990, month: 5, day: 20, hour: 14, minute: 30, second: 0, gender: 'male' },
          {},
        ),
      },
      b: {
        label: '지영',
        saju: computeSaju({ year: 1992, month: 1, day: 9, hour: null, gender: 'female' }, {}),
      },
    },
  },
  /**
   * 둘 다 금이 없는 짝. 보완이 **안 되는** 자리가 골든에 없으면 오행 보완이 언제나
   * 채워 주는 것처럼 읽힌다 — `still-missing` 변종이 서는 유일한 케이스다.
   * 그리고 두 사람 다 없는 오행이 있으므로 `weakest` 는 양쪽 다 서지 않는다.
   */
  {
    id: 'compat-both-missing',
    note: '둘 다 없는 오행이 있다 — 보완이 안 되는 자리는 한 번만 선다',
    people: {
      a: {
        label: '민수',
        saju: computeSaju(
          { year: 1988, month: 1, day: 3, hour: 10, minute: 0, second: 0, gender: 'male' },
          {},
        ),
      },
      b: {
        label: '지영',
        saju: computeSaju(
          { year: 1988, month: 2, day: 19, hour: 10, minute: 0, second: 0, gender: 'female' },
          {},
        ),
      },
    },
  },
];

const formatCompatCase = ({ id, note, people }: CompatCase): string => {
  const compat = analyzeCompatibility(people.a.saju, people.b.saju);

  const utterances = assembleCompatText(compat, {
    a: { label: people.a.label, hourKnown: people.a.saju.meta.hourKnown },
    b: { label: people.b.label, hourKnown: people.b.saju.meta.hourKnown },
  });

  return [
    `── ${id}`,
    `   ${note}`,
    ...COMPAT_SIDES.map(
      (side) => `   ${people[side].label}  ${formatPillars(people[side].saju.pillars)}`,
    ),
    `   사이 관계 ${compat.relations.length} · 문장 ${sentencesOf(utterances).length}`,
    '',
    ...utterances.map(formatUtterance),
  ].join('\n');
};

describe('문장 골든', () => {
  it('명식마다 어떤 발화가 서고 무엇이 침묵하는지', async () => {
    const coverage = fragmentCoverage(FRAGMENT_INDEX);

    const header = [
      '='.repeat(78),
      'L3 문장 골든 — 발화 판정과 조립',
      '='.repeat(78),
      '',
      '  ✓ 문장이 됐다   · 발화는 있으나 조각이 없다   × 말하지 않기로 했다',
      '',
      `  말뭉치 ${coverage.filled} / 지시서 ${coverage.expected} 칸`,
      '',
      ...Object.entries(ASSEMBLE_POLICY).map(([key, value]) => `    ${key.padEnd(16)} ${value}`),
      '',
      ...Object.entries(CORPUS_POLICY).map(([key, value]) => `    ${key.padEnd(16)} ${value}`),
      '',
      '  주제가 없어 아직 발화하지 않는 사실 — 고른 것이 아니라 주제가 없는 것이다.',
      ...UNCOVERED_FACTS.map((fact) => `    ${fact}`),
      '',
      '='.repeat(78),
      '',
    ].join('\n');

    const compatHeader = [
      '',
      '',
      '='.repeat(78),
      '궁합 — 같은 주제, 같은 조각. 행에 이름이 붙을 뿐이다',
      '='.repeat(78),
      '',
      '  주제가 없어 아직 발화하지 않는 사실.',
      ...UNCOVERED_COMPAT_FACTS.map((fact) => `    ${fact}`),
      '',
      '='.repeat(78),
      '',
    ].join('\n');

    const body = CASES.map(formatCase).join('\n\n');
    const compatBody = COMPAT_CASES.map(formatCompatCase).join('\n\n');

    await expect(`${header}${body}\n${compatHeader}${compatBody}\n`).toMatchFileSnapshot(
      './text.snapshot.txt',
    );
  });

  it('케이스 id 가 중복되지 않는다', () => {
    const ids = CASES.map((textCase) => textCase.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('시간 미상 케이스가 반드시 하나 있다', () => {
    expect(CASES.some(({ saju }) => !saju.meta.hourKnown)).toBe(true);
  });
});
