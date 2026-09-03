import { describe, expect, it } from 'vitest';

import {
  READING_ALREADY_RUNNING_NOTE,
  READING_LEAVE_SAFE_NOTE,
  readingCreditsLabel,
  readingCreditsNote,
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

/**
 * **풀이권은 세는 것이지 적어 두는 것이 아니다**(`reading_credit_limit`). 화면이 하는
 * 말도 그 사실을 따라야 한다 — 「차감」과 「반환」이라는 낱말이 여기 들어오면 사용자는
 * 어딘가에 자기 잔고가 적혀 있다고 믿고, 실패한 뒤에 그것이 돌아왔는지 확인하러 간다.
 */
describe('풀이권 문구', () => {
  /**
   * **「토큰」이라고 부르지 않는다.** 모델의 토큰과 같은 낱말이 되면 긴 풀이가 더
   * 비싸다고 읽힌다 — 여기서 세는 것은 만드는 횟수 하나뿐이다.
   */
  it('모델의 낱말을 빌려 쓰지 않는다', () => {
    const label = readingCreditsLabel({ limit: 5, available: 3 });

    for (const borrowed of ['토큰', '크레딧', '포인트', 'token']) {
      expect(label, borrowed).not.toContain(borrowed);
    }
    expect(label).toContain('풀이권');
  });

  /** 준 것과 남은 것을 함께 세운다 — 얼마나 썼는지를 사용자가 따로 세지 않게 */
  it('준 것과 남은 것을 함께 말한다', () => {
    expect(readingCreditsLabel({ limit: 5, available: 3 })).toBe('풀이권 5번 중 3번 남음');
    expect(readingCreditsLabel({ limit: 5, available: 0 })).toBe('풀이권 5번 중 0번 남음');
  });

  /** 값에서 짓는다 — 손으로 적었다면 상한을 옮겨도 문구가 안 따라온다 */
  it('상한이 바뀌면 문구도 바뀐다', () => {
    expect(readingCreditsLabel({ limit: 10, available: 3 })).toContain('10번 중');
  });

  /**
   * **말할 것이 없으면 안 선다.** 늘 무언가 적혀 있는 줄은 곧 안 읽히고, 그때 정작
   * 말해야 하는 순간에도 안 읽힌다.
   *
   * **다 썼을 때도 마찬가지다.** 한동안 「새로 만들 수는 없지만 이미 만든 풀이는 언제든
   * 다시 볼 수 있어요」가 섰다. 다시 보기가 닫힌 적이 한 번도 없어서 그 줄이 새로 알려
   * 주는 것이 없었다 — 잔액은 머리글이 들고, 못 누른다는 것은 닫힌 버튼이 말한다.
   * 그래서 이 함수는 이제 잔액을 묻지 않고, 갈래가 도는 시도 하나뿐이다.
   */
  it('평소에는 아무 말도 하지 않는다', () => {
    expect(readingCreditsNote({ reserved: 0 })).toBeNull();
  });

  /**
   * 도는 시도가 자리를 잡고 있어서 잔액이 하나 줄어 보인다. 이유를 말하지 않으면
   * 「누르지도 않았는데 하나가 사라졌다」로 읽힌다.
   */
  it('만들고 있는 동안에는 왜 하나 줄었는지와 돌아온다는 것을 함께 말한다', () => {
    const note = readingCreditsNote({ reserved: 1 });

    expect(note).toContain('만들고 있는');
    expect(note).toContain('돌아옵니다');
  });
});
