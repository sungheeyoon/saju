import { describe, expect, it } from 'vitest';

import type { RunningLine } from './running-line';
import { afterRunningAnswer } from './running-watch';

const line = (key: string, stage = '준비 중…'): RunningLine => ({ key, href: key, name: '내 사주풀이', stage });

describe('홈의 「만드는 중」 줄은 다시 물은 답을 따른다', () => {
  it('단계가 바뀌면 줄만 바꾸고 홈은 다시 그리지 않는다', () => {
    const answer = afterRunningAnswer([line('/a')], [line('/a', '이 사주의 핵심 작성 중…')]);
    expect(answer).toEqual({ lines: [line('/a', '이 사주의 핵심 작성 중…')], redraw: false, stop: false });
  });

  it('못 읽었으면 앞서 본 줄을 그대로 두고 계속 묻는다', () => {
    expect(afterRunningAnswer([line('/a')], null)).toEqual({ lines: [line('/a')], redraw: false, stop: false });
  });

  it('줄 하나가 사라지면(끝났다) 홈을 한 번 다시 그리고 남은 줄로 계속 묻는다', () => {
    expect(afterRunningAnswer([line('/a'), line('/b')], [line('/b')])).toEqual({
      lines: [line('/b')],
      redraw: true,
      stop: false,
    });
  });

  /** 만료가 지난 시도도 서버가 거르므로 같은 길이다 — 줄이 비면 더 묻지 않는다 */
  it('줄이 다 사라지면 다시 그리고 멈춘다', () => {
    expect(afterRunningAnswer([line('/a')], [])).toEqual({ lines: [], redraw: true, stop: true });
  });

  it('새로 선 줄은 다시 그리지 않고 더한다', () => {
    expect(afterRunningAnswer([line('/a')], [line('/b'), line('/a')])).toEqual({
      lines: [line('/b'), line('/a')],
      redraw: false,
      stop: false,
    });
  });
});
