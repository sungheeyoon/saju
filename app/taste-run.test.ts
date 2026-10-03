import { describe, expect, it } from 'vitest';

import { DEFAULT_QUERY, toSearchParams, type Query } from '@/src/lib/input/query';
import { TASTE_CHECK_FAILED, TASTE_RUN_CALL } from '@/src/lib/reading/taste-run';
import { HAND_SAMPLE } from '@/src/lib/reading/taste-run-sample';
import type { TasteSessionView } from '@/src/lib/reading/taste-visit';

import type { Reserved, TasteFinish } from './keyed-taste';
import type { TasteClaim } from './me/keyed-taste-claims';
import {
  TASTE_INTERNAL_ERROR,
  claimTasteWith,
  sajuOfDraft,
  serveTaste,
  tasteFingerprintOfSaju,
  viewTaste,
  type TasteClaimHands,
  type TasteHands,
} from './taste-run';

/**
 * **로그인 전 사주 문단 한 번 — 서버가 짓고, 원문은 안 나간다**(ADR 0143). 손잡이를 가짜로 넣어 부른다 — 무엇이 DB 와
 * 모델로 가는지 그 인자를 그대로 본다.
 */

const QUERY: Query = {
  ...DEFAULT_QUERY,
  name: '민지',
  date: '1992-05-14',
  time: '09:30',
  hourKnown: true,
  gender: 'female',
  city: '부산',
};
const DRAFT = toSearchParams(QUERY).toString();
const RAW = ['1992-05-14', '1992', '09:30', '민지', '부산'];

const SESSION = '11111111-1111-4111-8111-111111111111';
const ARTIFACT = '22222222-2222-4222-8222-222222222222';
const BROWSER_HMAC = 'b'.repeat(64);
const IP_HMAC = 'c'.repeat(64);

type Seen = { reserve: unknown[]; finish: TasteFinish[]; prompts: string[]; options: unknown[]; views: unknown[] };

function hands(
  reserved: Reserved | null,
  {
    view = { ok: true, value: null },
    called = { ok: true, output: HAND_SAMPLE.taste, usage: null, reasoningTokens: null, modelId: 'm' },
    finished = 'recorded',
    visitor = { browserHmac: BROWSER_HMAC, ipHmac: IP_HMAC },
    member = false,
    throwing,
  }: {
    member?: boolean;
    /** 이 손잡이가 던진다 — 예약 뒤의 예외 길 */
    throwing?: 'call' | 'finish-first';
    view?: { ok: true; value: TasteSessionView | null } | { ok: false };
    called?: Awaited<ReturnType<TasteHands['call']>>;
    finished?: 'recorded' | 'ignored' | null;
    visitor?: { browserHmac: string; ipHmac: string } | null;
  } = {},
): { hands: TasteHands; seen: Seen } {
  const seen: Seen = { reserve: [], finish: [], prompts: [], options: [], views: [] };
  let now = 1_000;
  return {
    seen,
    hands: {
      member: async () => member,
      visitor: async () => visitor,
      reserve: async (args) => {
        seen.reserve.push(args);
        return reserved;
      },
      view: async (...args) => {
        seen.views.push(args);
        return view;
      },
      finish: async (finish) => {
        seen.finish.push(finish);
        if (throwing === 'finish-first' && seen.finish.length === 1) throw new Error('적는 문이 던졌다');
        return finished;
      },
      call: async (prompt, options) => {
        seen.prompts.push(prompt);
        seen.options.push(options);
        now += 4_321;
        if (throwing === 'call') throw new Error('모델 손잡이가 던졌다');
        return called;
      },
      clock: () => now,
    },
  };
}

const callModel = (attempt = 1): Reserved => ({ outcome: 'call_model', sessionId: SESSION, artifactId: ARTIFACT, attempt });

describe('지문은 서버가 짓는다', () => {
  it('받은 입력에서 명식을 다시 계산해 지문을 잰다 — 같은 입력이면 같은 지문, 이름 · 출생지는 지문을 안 바꾼다', async () => {
    const { hands: one, seen } = hands(callModel());
    await serveTaste(DRAFT, one);
    const expected = await tasteFingerprintOfSaju(sajuOfDraft(DRAFT)!);
    expect(seen.reserve).toEqual([{ fingerprint: expected, browserHmac: BROWSER_HMAC, ipHmac: IP_HMAC }]);
    expect(expected).toMatch(/^[0-9a-f]{64}$/);

    const renamed = toSearchParams({ ...QUERY, name: '다른이름' }).toString();
    expect(await tasteFingerprintOfSaju(sajuOfDraft(renamed)!)).toBe(expected);
  });

  it('입력을 못 읽으면 예약도 안 하고 닫는다', async () => {
    const { hands: one, seen } = hands(callModel());
    expect(await serveTaste('date=&hour=', one)).toEqual({ state: 'failed', retry: false });
    expect(await serveTaste('x'.repeat(2_000), one)).toEqual({ state: 'failed', retry: false });
    expect(seen.reserve).toEqual([]);
  });
});

describe('출생 원문은 프롬프트 · DB 인자 어디에도 없다', () => {
  it('예약 · 모델 · 결과 · 읽기의 인자에 날짜 · 시각 · 이름 · 출생지가 없다', async () => {
    const { hands: one, seen } = hands(callModel());
    await serveTaste(DRAFT, one);
    const everything = JSON.stringify(seen);
    for (const raw of RAW) expect(everything, raw).not.toContain(raw);
    expect(seen.prompts).toHaveLength(1);
  });
});

describe('갈래', () => {
  it('부르는 갈래 — 합의한 설정으로 한 번 부르고, 검사를 지나면 성공으로 적고 글을 낸다', async () => {
    const { hands: one, seen } = hands(callModel(2));
    const answer = await serveTaste(DRAFT, one);
    expect(answer).toEqual({ state: 'ready', sessionId: SESSION, preview: HAND_SAMPLE.taste.previewMarkdown });
    expect(seen.options[0]).toMatchObject({
      reasoningEffort: TASTE_RUN_CALL.reasoningEffort,
      maxOutputTokens: 1_500,
      timeoutMs: 20_000,
      maxRetries: 0,
    });
    expect(seen.finish).toHaveLength(1);
    expect(seen.finish[0]).toMatchObject({ artifactId: ARTIFACT, attempt: 2, failureCode: null });
    expect(seen.finish[0].output?.supportingClaims).toEqual(HAND_SAMPLE.taste.supportingClaims);
  });

  it('사용량은 다섯 칸과 응답 시간을 빠짐없이 넘긴다 — 못 받은 칸은 비운다', async () => {
    const { hands: one, seen } = hands(callModel(), {
      called: {
        ok: true,
        output: HAND_SAMPLE.taste,
        usage: { inputTokens: 3_000, noCacheTokens: 1_000, cacheReadTokens: 1_800, cacheWriteTokens: 200, outputTokens: 900, totalTokens: 3_900 },
        reasoningTokens: 0,
        modelId: 'm',
      },
    });
    await serveTaste(DRAFT, one);
    expect(seen.finish[0].usage).toEqual({
      inputTokens: 3_000,
      cacheReadTokens: 1_800,
      cacheWriteTokens: 200,
      outputTokens: 900,
      reasoningTokens: 0,
      responseMs: 4_321,
    });
  });

  it('검사에 걸리면 실패 코드로 적고 글을 안 낸다 — 다시 읽기는 DB 가 센 시도 수가 정한다', async () => {
    const broken = { ...HAND_SAMPLE.taste, previewMarkdown: '짧다.' };
    const { hands: one, seen } = hands(callModel(), {
      called: { ok: true, output: broken, usage: null, reasoningTokens: null, modelId: 'm' },
      view: { ok: true, value: { state: 'failed', retryable: true, preview: null } },
    });
    expect(await serveTaste(DRAFT, one)).toEqual({ state: 'failed', retry: true });
    expect(seen.finish[0]).toMatchObject({ failureCode: TASTE_CHECK_FAILED, output: null });
  });

  it('모델 시간 초과는 「시간 초과」로 · 다른 실패는 「실패」로 — 세 번째면 다시 읽기를 안 연다', async () => {
    const timedOut = hands(callModel(3), {
      called: { ok: false, code: 'model-timeout', detail: 'aborted' },
      view: { ok: true, value: { state: 'failed', retryable: false, preview: null } },
    });
    expect(await serveTaste(DRAFT, timedOut.hands)).toEqual({ state: 'timeout', retry: false });
    expect(timedOut.seen.finish[0]).toMatchObject({ failureCode: 'model-timeout', output: null });
    expect(timedOut.seen.finish[0].usage.responseMs).toBe(4_321);

    const failed = hands(callModel(1), {
      called: { ok: false, code: 'model-call-failed', detail: 'boom' },
      view: { ok: true, value: { state: 'failed', retryable: true, preview: null } },
    });
    expect(await serveTaste(DRAFT, failed.hands)).toEqual({ state: 'failed', retry: true });
  });

  it('재사용 — 모델을 안 부르고 세션의 글을 낸다', async () => {
    const { hands: one, seen } = hands(
      { outcome: 'reuse_succeeded', sessionId: SESSION, artifactId: ARTIFACT, attempt: null },
      { view: { ok: true, value: { state: 'succeeded', retryable: false, preview: '이미 쓴 글' } } },
    );
    expect(await serveTaste(DRAFT, one)).toEqual({ state: 'ready', sessionId: SESSION, preview: '이미 쓴 글' });
    expect(seen.prompts).toEqual([]);
    expect(seen.views).toEqual([[SESSION, BROWSER_HMAC]]);
  });

  it('누가 쓰는 중 — 모델을 안 부르고 기다린다', async () => {
    const { hands: one, seen } = hands(
      { outcome: 'wait_running', sessionId: SESSION, artifactId: ARTIFACT, attempt: null },
      { view: { ok: true, value: { state: 'running', retryable: false, preview: null } } },
    );
    expect(await serveTaste(DRAFT, one)).toEqual({ state: 'waiting', sessionId: SESSION });
    expect(seen.prompts).toEqual([]);
  });

  it('한도 · 다 쓴 입력 — 모델도 세션도 안 건드린다', async () => {
    for (const outcome of ['limited_request', 'limited_browser', 'limited_ip', 'limited_global'] as const) {
      const { hands: one, seen } = hands({ outcome, sessionId: null, artifactId: null, attempt: null });
      expect(await serveTaste(DRAFT, one)).toEqual({ state: 'limited' });
      expect(seen.prompts).toEqual([]);
      expect(seen.views).toEqual([]);
    }
    const { hands: done } = hands({ outcome: 'retries_exhausted', sessionId: SESSION, artifactId: ARTIFACT, attempt: null });
    expect(await serveTaste(DRAFT, done)).toEqual({ state: 'failed', retry: false });
  });

  it('비밀이 없으면(방문자 없음) · 예약 문이 터지면 · 결과를 못 적으면 닫는다 — 기본값으로 돌지 않는다', async () => {
    const noVisitor = hands(callModel(), { visitor: null });
    expect(await serveTaste(DRAFT, noVisitor.hands)).toEqual({ state: 'failed', retry: false });
    expect(noVisitor.seen.reserve).toEqual([]);

    expect(await serveTaste(DRAFT, hands(null).hands)).toEqual({ state: 'failed', retry: false });
    expect(await serveTaste(DRAFT, hands(callModel(), { finished: null }).hands)).toEqual({ state: 'failed', retry: false });
  });

  it('늦게 와서 무시된 결과는 세션이 지금 무엇인지 읽어 답한다', async () => {
    const { hands: one } = hands(callModel(), {
      finished: 'ignored',
      view: { ok: true, value: { state: 'succeeded', retryable: false, preview: '먼저 선 글' } },
    });
    expect(await serveTaste(DRAFT, one)).toEqual({ state: 'ready', sessionId: SESSION, preview: '먼저 선 글' });
  });
});

describe('로그인한 사람은 맛보기로 가지 않는다', () => {
  it('회원의 요청은 입력을 읽지도 예약하지도 모델을 부르지도 않고 닫는다', async () => {
    const { hands: one, seen } = hands(callModel(), { member: true });
    expect(await serveTaste(DRAFT, one)).toEqual({ state: 'failed', retry: false });
    expect(seen.reserve).toEqual([]);
    expect(seen.prompts).toEqual([]);
    expect(seen.finish).toEqual([]);
  });
});

describe('예약한 뒤의 모든 길이 결과를 적는다', () => {
  it('모델 손잡이가 던져도 실패 코드로 닫고 예외는 위로 간다', async () => {
    const { hands: one, seen } = hands(callModel(2), { throwing: 'call' });
    await expect(serveTaste(DRAFT, one)).rejects.toThrow('모델 손잡이가 던졌다');
    expect(seen.finish).toHaveLength(1);
    expect(seen.finish[0]).toMatchObject({ artifactId: ARTIFACT, attempt: 2, failureCode: TASTE_INTERNAL_ERROR, output: null });
    expect(seen.finish[0].usage).toMatchObject({ inputTokens: null, responseMs: 4_321 });
    expect(TASTE_INTERNAL_ERROR).toMatch(/^[a-z0-9-]{1,64}$/);
  });

  it('결과를 적는 문이 터지면(못 적음 · 던짐) 실패 코드로 한 번 더 닫는다 — 받은 사용량은 그대로 싣는다', async () => {
    const usage = { inputTokens: 3_000, noCacheTokens: 3_000, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 900, totalTokens: 3_900 };
    const notWritten = hands(callModel(), {
      called: { ok: true, output: HAND_SAMPLE.taste, usage, reasoningTokens: 0, modelId: 'm' },
      finished: null,
    });
    expect(await serveTaste(DRAFT, notWritten.hands)).toEqual({ state: 'failed', retry: false });
    expect(notWritten.seen.finish.map((one) => one.failureCode)).toEqual([null, TASTE_INTERNAL_ERROR]);
    expect(notWritten.seen.finish[1]).toMatchObject({ output: null, usage: { inputTokens: 3_000, outputTokens: 900 } });

    const thrown = hands(callModel(), { throwing: 'finish-first' });
    await expect(serveTaste(DRAFT, thrown.hands)).rejects.toThrow('적는 문이 던졌다');
    expect(thrown.seen.finish.map((one) => one.failureCode)).toEqual([null, TASTE_INTERNAL_ERROR]);
  });

  it('적은 뒤에는 다시 닫지 않는다 — 결과 하나에 적기 하나', async () => {
    const { hands: one, seen } = hands(callModel(), { finished: 'ignored', view: { ok: false } });
    expect(await serveTaste(DRAFT, one)).toEqual({ state: 'failed', retry: false });
    expect(seen.finish).toHaveLength(1);
  });
});

describe('다시 묻기', () => {
  it('세션 id 꼴이 아니면 안 묻고, 브라우저 HMAC 이 없으면 닫는다', async () => {
    const views: unknown[] = [];
    const view = async (...args: unknown[]) => {
      views.push(args);
      return { ok: true as const, value: { state: 'running', retryable: false, preview: null } };
    };
    expect(await viewTaste('nope', { view, browserHmac: async () => BROWSER_HMAC })).toEqual({ state: 'failed', retry: false });
    expect(await viewTaste(SESSION, { view, browserHmac: async () => null })).toEqual({ state: 'failed', retry: false });
    expect(views).toEqual([]);
    expect(await viewTaste(SESSION, { view, browserHmac: async () => BROWSER_HMAC })).toEqual({ state: 'waiting', sessionId: SESSION });
  });
});

/**
 * **귀속은 세 갈래다 — 답이 났는가(`claimed` · `terminal`), 안 났는가(`retryable`)**(ADR 0143 「덧」). 앞서는 DB 오류와 진짜
 * 불일치가 같은 「안 이어짐」이었고, 화면은 그것을 보통 흐름으로 읽었다.
 */
describe('귀속의 세 갈래', () => {
  const FINGERPRINT = 'f'.repeat(64);
  const CARRY = { previewMarkdown: '글', continuationQuestion: '물음', answerDirection: '방향', supportingClaims: [] };

  function claimHands(over: Partial<TasteClaimHands> = {}) {
    const seen = { claims: [] as unknown[], counted: [] as string[], marked: [] as string[], forgot: 0 };
    const one: TasteClaimHands = {
      secretsReady: () => true,
      browserHmac: async () => BROWSER_HMAC,
      fingerprint: async () => FINGERPRINT,
      claim: async (args) => {
        seen.claims.push(args);
        return { outcome: 'claimed', carry: CARRY, readingRunId: null, readingRunStatus: null };
      },
      countCompleted: async (sessionId) => {
        seen.counted.push(sessionId);
      },
      mark: async (sessionId) => {
        seen.marked.push(sessionId);
      },
      forget: async () => {
        seen.forgot += 1;
      },
      ...over,
    };
    return { hands: one, seen };
  }

  it('붙었으면 `claimed` — 귀속 표를 세우고 가입 완료를 센다', async () => {
    const { hands: one, seen } = claimHands();
    expect(await claimTasteWith(SESSION, one)).toBe('claimed');
    expect(seen.claims).toEqual([{ sessionId: SESSION, browserHmac: BROWSER_HMAC, fingerprint: FINGERPRINT }]);
    expect(seen.marked).toEqual([SESSION]);
    expect(seen.counted).toEqual([SESSION]);
    expect(seen.forgot).toBe(0);
  });

  it.each(['discarded', 'expired', 'taken', 'not_found', 'not_ready'] as const)(
    'DB 가 `%s` 로 답하면 `terminal` — 표를 걷는다',
    async (outcome) => {
      const { hands: one, seen } = claimHands({ claim: async () => ({ outcome }) as TasteClaim });
      expect(await claimTasteWith(SESSION, one)).toBe('terminal');
      expect(seen.marked).toEqual([]);
      expect(seen.forgot).toBe(1);
    },
  );

  it('이어진 풀이가 이미 섰으면 `terminal` — 그 풀이가 열린다', async () => {
    const { hands: one, seen } = claimHands({
      claim: async () => ({ outcome: 'claimed', carry: CARRY, readingRunId: 'run-1', readingRunStatus: 'succeeded' }),
    });
    expect(await claimTasteWith(SESSION, one)).toBe('terminal');
    expect(seen.marked).toEqual([]);
  });

  it('id 꼴이 틀렸거나 · 비밀이 없거나 · 쿠키가 없으면 `terminal` — DB 에 안 묻는다', async () => {
    for (const [sessionId, over] of [
      ['nope', {}],
      [SESSION, { secretsReady: () => false }],
      [SESSION, { browserHmac: async () => null }],
    ] as const) {
      const { hands: one, seen } = claimHands(over);
      expect(await claimTasteWith(sessionId, one)).toBe('terminal');
      expect(seen.claims).toEqual([]);
    }
  });

  it('귀속 문이 답하지 않으면(`null`) `retryable` — 표를 건드리지 않는다', async () => {
    const { hands: one, seen } = claimHands({ claim: async () => null });
    expect(await claimTasteWith(SESSION, one)).toBe('retryable');
    expect(seen.marked).toEqual([]);
    expect(seen.forgot).toBe(0);
    expect(seen.counted).toEqual([]);
  });

  it('방금 저장한 내 사주를 못 읽거나(`null`) 지문 · 쿠키 읽기가 던지면 `retryable`', async () => {
    for (const over of [
      { fingerprint: async () => null },
      { fingerprint: async () => Promise.reject(new Error('db')) },
      { browserHmac: async () => Promise.reject(new Error('cookies')) },
    ]) {
      const { hands: one, seen } = claimHands(over);
      expect(await claimTasteWith(SESSION, one)).toBe('retryable');
      expect(seen.claims).toEqual([]);
      expect(seen.forgot).toBe(0);
    }
  });

  it('다시 시도하면 같은 세션이 붙는다 — 한 번 답이 안 난 것이 다음 답을 막지 않는다', async () => {
    let up = false;
    const { hands: one, seen } = claimHands({
      claim: async () => (up ? { outcome: 'claimed', carry: CARRY, readingRunId: null, readingRunStatus: null } : null),
    });
    expect(await claimTasteWith(SESSION, one)).toBe('retryable');
    up = true;
    expect(await claimTasteWith(SESSION, one)).toBe('claimed');
    expect(seen.marked).toEqual([SESSION]);
  });

  it('가입 완료를 못 세도 귀속의 답은 그대로다', async () => {
    const { hands: one } = claimHands({ countCompleted: async () => Promise.reject(new Error('count')) });
    expect(await claimTasteWith(SESSION, one)).toBe('claimed');
  });
});
