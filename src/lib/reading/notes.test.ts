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
   * **뒷문장을 빼면 거짓말이 된다.**
   *
   * 생성은 누른 그 요청 안에서 끝까지 돈다. 앱 안의 이동은 그 요청을 끊지 않지만
   * 새로고침과 탭 닫기는 끊는다. 앞문장만 적으면 화면은 깔끔해지고 문구는 틀린다 —
   * 사용자가 실제로 조심해야 하는 것이 정확히 그 둘이다.
   */
  it('나가도 되는 것과 안 되는 것을 함께 말한다', () => {
    expect(READING_LEAVE_SAFE_NOTE).toContain('이동');
    expect(READING_LEAVE_SAFE_NOTE).toContain('새로고침');
    expect(READING_LEAVE_SAFE_NOTE).toContain('탭을 닫으면');

    // 「그대로 두어 주세요」로 가두지 않는다 — 가둘 이유가 없다
    expect(READING_LEAVE_SAFE_NOTE).not.toContain('그대로 두어');
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
    // 무엇을 하면 되는지까지 — 상태만 알리고 끝내면 사용자는 다시 누른다
    expect(READING_ALREADY_RUNNING_NOTE).toContain('다시 열면');
  });
});
