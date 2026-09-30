import { describe, expect, it } from 'vitest';

import { sectionCounter, type SectionCount } from './progress';

/**
 * 모델이 내는 그대로 — **JSON 글자**다. 본문은 `markdown` 문자열 안에 이스케이프된 채 온다.
 *
 * 자기 풀이는 운영 차례(`score · metaphor · markdown`), 두 궁합 4판은 본문이 먼저다(`writesSummaryLast`).
 */
const BODY = [
  '## 먼저 볼 핵심 세 가지',
  '1. 혼자 판단할 때 강점이 드러나요.',
  '',
  '## 이 사주의 핵심',
  '"따옴표"와 \\ 역슬래시가 든 문장. 줄 가운데의 ## 는 머리가 아니다.',
  '### 작은 제목은 절이 아니다',
  '',
  '## 성격과 속마음',
  '마지막 절의 글.',
  '',
  '---',
  '',
  '### 근거 (검사용)',
  '이 사주의 핵심 — 결론 「…」 | 자료: charts.a [원국]',
].join('\n');

const soloJson = JSON.stringify({ score: null, metaphor: '한 줄 요약', markdown: BODY });
const pairJson = JSON.stringify({ markdown: BODY, score: 71, metaphor: '한 줄 요약' });

const feedAll = (chunks: readonly string[]): SectionCount[] => {
  const counter = sectionCounter();
  return chunks.map((chunk) => counter.feed(chunk));
};

const last = <T>(values: readonly T[]): T => values[values.length - 1];

/** 결정적인 난수 — 실행마다 같은 조각이 나야 붉을 때 다시 밟을 수 있다 */
const splitRandomly = (text: string, seed: number): string[] => {
  let state = seed;
  const next = () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state;
  };
  const chunks: string[] = [];
  let at = 0;
  while (at < text.length) {
    const size = 1 + (next() % 7);
    chunks.push(text.slice(at, at + size));
    at += size;
  }
  return chunks;
};

describe('절 머리 세기', () => {
  it('한 번에 받으면 소제목 셋 · 본문 다 씀이다 — `###` 와 줄 가운데의 `##` 는 안 센다', () => {
    expect(last(feedAll([soloJson]))).toEqual({ begun: 3, bodyWritten: true });
  });

  it('본문이 먼저인 차례(두 궁합 4판)도 같다', () => {
    expect(last(feedAll([pairJson]))).toEqual({ begun: 3, bodyWritten: true });
  });

  it('**한 글자씩** 받아도 같다 — `\\` 와 `n` 사이, `#` 와 공백 사이에서 잘려도', () => {
    const counts = feedAll([...soloJson]);
    expect(last(counts)).toEqual({ begun: 3, bodyWritten: true });

    /* 값은 올라가기만 하고, 셋이 차례로 선다 — 한꺼번에 뛰지 않는다 */
    const seen = counts.map((count) => count.begun);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(new Set(seen)).toEqual(new Set([0, 1, 2, 3]));
  });

  it('조각을 어디서 잘라도 끝 값이 같다', () => {
    for (const seed of [1, 7, 42, 2026, 99_991]) {
      expect(last(feedAll(splitRandomly(soloJson, seed)))).toEqual({ begun: 3, bodyWritten: true });
      expect(last(feedAll(splitRandomly(pairJson, seed)))).toEqual({ begun: 3, bodyWritten: true });
    }
  });

  it('머리 줄은 **끝났을 때** 센다 — 다음 줄이 오기 전에는 그 절을 시작했다고 말하지 않는다', () => {
    const opening = '{"score":null,"metaphor":"요약","markdown":"## 먼저 볼 핵심';
    const counter = sectionCounter();
    expect(counter.feed(opening)).toEqual({ begun: 0, bodyWritten: false });
    expect(counter.feed(' 세 가지\\')).toEqual({ begun: 0, bodyWritten: false });
    expect(counter.feed('n1. 첫 줄')).toEqual({ begun: 1, bodyWritten: false });
  });

  it('검사용 근거 절이 서면 본문을 다 쓴 것이다 — 문자열이 아직 안 닫혀도', () => {
    const counter = sectionCounter();
    counter.feed('{"markdown":"## 하나\\n글\\n\\n### 근거\\n');
    expect(counter.count).toEqual({ begun: 1, bodyWritten: true });
  });

  /**
   * 모델이 가끔 근거 절 제목을 `##` 로 쓴다(2026-09-30, 운영자 답 — 「`##` 도 근거 절로 받는다」).
   * 그 제목을 절 하나로 세면 기다리는 화면의 목차가 한 칸 넘친다.
   */
  it('근거 절 제목이 `##` 로 와도 절로 안 세고 본문을 다 쓴 것이다 — 그 뒤의 `##` 도 안 센다', () => {
    const twoHashes = `${BODY.replace('### 근거 (검사용)', '## 근거 (검사용)')}\n## 근거 칸 안의 머리`;
    const json = JSON.stringify({ score: null, metaphor: '한 줄 요약', markdown: twoHashes });

    expect(last(feedAll([json]))).toEqual({ begun: 3, bodyWritten: true });
    for (const seed of [1, 7, 42]) {
      expect(last(feedAll(splitRandomly(json, seed)))).toEqual({ begun: 3, bodyWritten: true });
    }

    const counter = sectionCounter();
    counter.feed('{"markdown":"## 하나\\n글\\n\\n## 근거\\n');
    expect(counter.count).toEqual({ begun: 1, bodyWritten: true });
  });

  it('`####` 근거는 근거 절이 아니다 — 본문을 다 썼다고 말하지 않는다', () => {
    const counter = sectionCounter();
    counter.feed('{"markdown":"## 하나\\n글\\n\\n#### 근거\\n');
    expect(counter.count).toEqual({ begun: 1, bodyWritten: false });
  });

  it('근거 절 없이 끝나도 문자열이 닫히면 본문을 다 쓴 것이다 — 마지막 줄이 머리여도 센다', () => {
    expect(last(feedAll(['{"markdown":"## 하나\\n글\\n## 둘', '","score":null}']))).toEqual({
      begun: 2,
      bodyWritten: true,
    });
  });

  it('`\\u` 로 온 글자도 풀어 읽는다', () => {
    expect(last(feedAll(['{"markdown":"\\u0023\\u0023 하나\\n', '\\u0023# 둘\\n"}']))).toEqual({
      begun: 2,
      bodyWritten: true,
    });
  });

  it('`\\\\n` 은 역슬래시와 n 이지 줄바꿈이 아니다', () => {
    expect(last(feedAll(['{"markdown":"글\\\\n## 머리 아님\\n## 머리\\n"}']))).toEqual({
      begun: 1,
      bodyWritten: true,
    });
  });

  it('앞 칸(한 줄 요약)에 적힌 `## ` 는 본문이 아니다', () => {
    expect(last(feedAll(['{"score":null,"metaphor":"\\n## 요약","markdown":"글\\n"}']))).toEqual({
      begun: 0,
      bodyWritten: true,
    });
  });

  it('본문 칸이 끝내 안 오면 아무것도 안 센다', () => {
    const counter = sectionCounter();
    counter.feed(`{"score":null,"metaphor":"${'가'.repeat(5_000)}`);
    expect(counter.feed('","markdown":"## 하나\\n"}')).toEqual({ begun: 0, bodyWritten: false });
  });
});
