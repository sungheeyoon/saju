/**
 * **러너가 전부 돌았다고 말하는가** — 이 한 줄이 없으면 사슬로 돌아간 것을 아무도 못 본다.
 *
 * `test:flow` 가 `&&` 사슬이던 동안 `check-reading` 하나가 틀리자 **`check-share` 65건이
 * 아예 안 돌았고**, 화면에는 「실패 1건」으로만 보였다. 같은 사고가 `docs/prd.md` §0.7 에
 * 이미 적혀 있다. 그래서 러너에 대고 재는 것은 「실패를 세는가」가 아니라 **첫 검사가
 * 실패해도 마지막 검사의 이름이 결과에 서는가**다.
 */
import { describe, expect, it } from 'vitest';

import { SCRIPTS, summarize } from './run-checks.mjs';

const ran = (name: string, passed: number, total: number, failed: string[] = []) =>
  ({ ran: true, name, passed, total, failed });

describe('흐름 검사 러너', () => {
  it('첫 검사가 실패해도 마지막 검사가 결과에 선다', () => {
    const { text, ok } = summarize([
      ran('check-onboarding', 34, 35, ['첫 줄이 틀렸다']),
      ran('check-share', 65, 65),
    ]);

    expect(ok).toBe(false);
    expect(text).toContain('check-share — 65/65');
    expect(text).toContain('2/2 스크립트 완주');
  });

  it('돌지 못한 검사는 0건 통과가 아니라 「안 잰 것」이다', () => {
    const { text, ok } = summarize([
      { ran: false, name: 'check-managed', total: 0, passed: 0, failed: [], reason: '종료 코드 1' },
      ran('check-share', 65, 65),
    ]);

    expect(ok).toBe(false);
    expect(text).toContain('돌지 못했다');
    /** 안 잰 것이 통과 수에 섞이면 스택이 죽은 날 「전부 통과」가 나온다 */
    expect(text).toContain('검사 65건: 65건 통과');
    expect(text).toContain('1/2 스크립트 완주');
  });

  it('단언은 다 통과했어도 비정상 종료했으면 초록이 아니다', () => {
    /**
     * 요약은 `finish()` 가 쓰고 프로세스는 그 뒤로도 더 산다. 종료 훅이 던지거나 신호로
     * 끊기면 **단언 결과는 전부 통과인 채로** 프로세스가 성치 않게 끝난다 — 그 자리를
     * 요약만 보고 접으면 러너가 뒷정리가 깨진 것을 숨긴 채 「전부 통과」라고 말한다.
     */
    const { text, ok } = summarize([
      { ...ran('check-share', 65, 65), status: null, signal: 'SIGSEGV' },
    ]);

    expect(ok).toBe(false);
    expect(text).toContain('비정상 종료했다');
    expect(text).toContain('SIGSEGV');
  });

  it('전부 통과하면 초록이다', () => {
    const { text, ok } = summarize([ran('check-onboarding', 35, 35), ran('check-share', 65, 65)]);

    expect(ok).toBe(true);
    expect(text).toContain('검사 100건: 100건 통과');
    expect(text).not.toContain('실패');
  });

  it('러너가 아는 검사와 저장소의 검사가 같다', async () => {
    const { readdirSync } = await import('node:fs');
    const onDisk = readdirSync('scripts')
      .filter((f) => f.startsWith('check-') && f.endsWith('.mjs'))
      .sort();

    expect([...SCRIPTS].sort()).toEqual(onDisk);
  });
});
