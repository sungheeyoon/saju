import { describe, expect, it } from 'vitest';

import {
  READING_ALREADY_RUNNING_NOTE,
  READING_LEAVE_SAFE_NOTE,
  readingWaitNote,
} from './notes';

/**
 * **기다리는 동안 화면이 하는 말**은 값이지 장식이 아니다.
 *
 * 앞 문구는 「보통 1분 안에 완성됩니다. 이 화면을 그대로 두어 주세요」였다. 두 문장이
 * 다 틀렸다 — 1분은 잰 적이 없고, 화면을 그대로 둘 필요도 없다.
 */
describe('기다리는 동안의 문구', () => {
  /**
   * **재지 않은 숫자를 약속으로 말하지 않는다.**
   *
   * 상한은 우리가 정한 값이라 검증이 필요 없는 사실이고, 「보통 이만큼」은 재야 하는
   * 주장이다. 재기 전에는 아는 쪽만 말한다.
   */
  it('상한에서 지어 내므로 상한이 바뀌면 문구도 바뀐다', () => {
    expect(readingWaitNote(240_000)).toBe('길면 4분까지 걸립니다.');
    expect(readingWaitNote(120_000)).toBe('길면 2분까지 걸립니다.');

    // 손으로 적은 숫자였다면 이 둘이 같았을 것이다
    expect(readingWaitNote(240_000)).not.toBe(readingWaitNote(120_000));
  });

  it('재어 본 적 없는 「보통 얼마」를 말하지 않는다', () => {
    const note = readingWaitNote(240_000);

    for (const promise of ['보통', '평균', '대개', '안에 완성']) {
      expect(note, promise).not.toContain(promise);
    }
  });

  /**
   * **경고를 지우는 것이 그 변경의 결과다.**
   *
   * 만드는 일이 누름의 요청 안에서 돌던 동안에는 「새로고침하면 중단될 수 있습니다」가
   * 참이었다. 응답 뒤로 옮긴 뒤에는 거짓이다 — 남겨 두면 하지 않아도 되는 걱정을
   * 시키고, 사용자는 그 화면 앞에 붙들려 앉아 있게 된다.
   *
   * 문구가 배선을 따라오지 않으면 **화면이 옛 제약을 계속 파는 셈**이라 여기서 잡는다.
   */
  it('나가도 되고 새로고침해도 된다고 말한다', () => {
    expect(READING_LEAVE_SAFE_NOTE).toContain('새로고침');

    for (const scare of ['중단', '그대로 두어', '닫지 마']) {
      expect(READING_LEAVE_SAFE_NOTE, scare).not.toContain(scare);
    }
  });

  /**
   * 아무것도 시작하지 않은 **성공**이 있다. 실패가 아니므로 실패라고 말하지 않되,
   * 말없이 지나가지도 않는다 — 그게 「눌렀는데 그대로」의 자리였다.
   */
  it('이미 도는 시도를 실패가 아니라 상태로 말한다', () => {
    expect(READING_ALREADY_RUNNING_NOTE).toContain('이미 만들고');

    for (const blame of ['실패', '오류', '문제가']) {
      expect(READING_ALREADY_RUNNING_NOTE, blame).not.toContain(blame);
    }
    // 무엇이 되고 있는지까지 — 상태만 알리고 끝내면 사용자는 다시 누른다
    expect(READING_ALREADY_RUNNING_NOTE).toContain('기다립니다');
    expect(READING_ALREADY_RUNNING_NOTE).toContain('완성되면');
  });
});
