import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **기다리는 길(`callModel`)이 SDK 에 무엇을 넘기나** — 모델은 안 부른다. `generateText` 만 가짜로 두고 받은 인자를 본다.
 *
 * 재는 것은 하나다 — 숨은 재시도. SDK 의 `generateText` 는 실패하면 기본 두 번 더 보낸다. 로그인 전 사주 문단은 시도 수를 DB 가
 * 예약으로 세므로(`taste_attempt_limit()`) 그 길만 `maxRetries: 0` 을 넘기고, 넘기지 않은 길은 SDK 기본값 그대로여야 한다.
 */
const generateText = vi.fn();
vi.mock('ai', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('ai')),
  generateText: (...args: unknown[]) => generateText(...args),
}));

const { callModel } = await import('./model');

beforeEach(() => {
  generateText.mockReset();
  generateText.mockResolvedValue({ output: { markdown: '글' }, usage: {}, response: { modelId: 'gpt-check' } });
});

describe('숨은 재시도', () => {
  it('`maxRetries: 0` 을 넘기면 SDK 에 그대로 간다 — 예약 하나에 모델 호출 하나', async () => {
    await callModel('프롬프트', { maxRetries: 0 });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(generateText.mock.calls[0][0]).toMatchObject({ maxRetries: 0 });
  });

  it('넘기지 않으면 싣지 않는다 — 운영 풀이 길의 기본값은 그대로다', async () => {
    await callModel('프롬프트');
    expect(generateText.mock.calls[0][0]).not.toHaveProperty('maxRetries');
  });
});
