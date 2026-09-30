import { describe, expect, it } from 'vitest';

import { TASTE_KEYS, type TasteKey } from './taste';
import { checkTaste, makeTastePassages, tasteKeyParts, tastePromptOf, type TasteAsk, type TasteRow } from './taste-maker';

const GOOD =
  '한낮의 해가 봄의 들판을 비추듯, 먼저 밝히고 먼저 다가가는 사람이에요. 곁에 있는 사람을 데우는 힘이 커서 자리에 들어서면 공기가 달라져요. 그 힘이 어디서 오고 언제 쉬어야 하는지는 전체 풀이에서 더 자세히 볼 수 있어요.';

describe('로그인 전 사주 문단의 짧은 규칙 검사', () => {
  it('해요체 두세 문장 · 알맞은 길이 · 분류명 없음이면 지난다', () => {
    expect(checkTaste(GOOD)).toEqual({ ok: true });
  });

  it.each([
    ['너무 짧다', '짧아요. 정말 짧아요.'],
    ['해요체로 끝나지 않는 문장이 있다', '한낮의 해처럼 먼저 밝히는 사람이다. 곁에 있는 사람을 데우는 힘이 커서 자리에 들어서면 공기가 달라져요.'],
    ['한자가 있다', '丙 일간은 한낮의 해처럼 먼저 밝히는 사람이에요. 곁에 있는 사람을 데우는 힘이 커서 자리에 들어서면 공기가 달라져요.'],
    ['「AI」를 말한다', 'AI 가 보기에 한낮의 해처럼 먼저 밝히는 사람이에요. 곁에 있는 사람을 데우는 힘이 커서 자리에 들어서면 공기가 달라져요.'],
    ['분류명이 있다', '신강한 사주라 한낮의 해처럼 먼저 밝히는 사람이에요. 곁에 있는 사람을 데우는 힘이 커서 자리에 들어서면 공기가 달라져요.'],
    ['제목 · 목록 · 굵은 글씨가 있다', '**한낮의 해**처럼 먼저 밝히는 사람이에요. 곁에 있는 사람을 데우는 힘이 커서 자리에 들어서면 공기가 달라져요.'],
    ['문장이 1개다', '한낮의 해처럼 먼저 밝히고 먼저 다가가며 곁에 있는 사람을 데우는 힘이 커서 자리에 들어서면 공기가 달라지는 사람이에요.'],
  ])('%s — 걸린다', (reason, body) => {
    const verdict = checkTaste(body);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok ? [] : verdict.reasons.join(' / ')).toContain(reason.replace(/^(분류명이 있다).*/, '$1'));
  });

  it('너무 긴 글은 걸린다', () => {
    const verdict = checkTaste(`${'아주 '.repeat(120)}긴 문장이에요. 두 번째 문장이에요.`);
    expect(verdict.ok ? [] : verdict.reasons.join(' / ')).toMatch(/너무 길다/);
  });
});

describe('열쇠와 프롬프트', () => {
  it('열쇠를 엔진 글자로 푼다 — 꼴이 틀리면 null', () => {
    expect(tasteKeyParts('丙午-卯')).toEqual({ stem: '丙', dayBranch: '午', monthBranch: '卯' });
    expect(tasteKeyParts('丙午卯')).toBeNull();
    expect(tasteKeyParts('X午-卯')).toBeNull();
  });

  it('프롬프트에는 열쇠의 엔진 값만 가고 사람은 없다', () => {
    const prompt = tastePromptOf('丙午-卯');
    expect(prompt).toContain('丙(병)');
    expect(prompt).toContain('봄');
    expect(prompt).not.toMatch(/\d{4}년|생년월일|이름:/);
  });

  it('720칸 모두 프롬프트가 지어진다', () => {
    expect(TASTE_KEYS.map((key) => tastePromptOf(key).length > 0).every(Boolean)).toBe(true);
  });
});

describe('도는 차례 — 모의 모델', () => {
  const keys: TasteKey[] = ['甲子-子', '甲子-丑', '甲子-寅', '甲子-卯'];

  it('검사를 지난 글만 적고, 못 지난 칸 · 실패한 칸 · 이미 있는 칸은 적지 않는다', async () => {
    const written: TasteRow[] = [];
    const asked: string[] = [];
    const answers: Record<string, Awaited<ReturnType<TasteAsk>>> = {
      [tastePromptOf('甲子-丑')]: { ok: true, body: GOOD, model: 'mock-model' },
      [tastePromptOf('甲子-寅')]: { ok: true, body: '신약이다.', model: 'mock-model' },
      [tastePromptOf('甲子-卯')]: { ok: false, detail: 'model-timeout' },
    };
    const ask: TasteAsk = async (prompt) => {
      asked.push(prompt);
      return answers[prompt];
    };

    const report = await makeTastePassages({
      keys,
      done: new Set(['甲子-子']),
      ask,
      write: async (row) => {
        written.push(row);
      },
    });

    expect(report.skipped).toEqual(['甲子-子']);
    expect(report.written).toEqual(['甲子-丑']);
    expect(report.rejected.map(({ key }) => key)).toEqual(['甲子-寅']);
    expect(report.failed).toEqual([{ key: '甲子-卯', detail: 'model-timeout' }]);
    expect(written).toEqual([{ key: '甲子-丑', body: GOOD, model: 'mock-model', checked: true }]);
    /* 이미 있는 칸은 묻지도 않는다 — 다시 돌려도 비용이 두 번 안 나간다 */
    expect(asked).toHaveLength(3);
  });
});
