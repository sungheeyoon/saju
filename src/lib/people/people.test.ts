import { describe, expect, it } from 'vitest';

import { RELATIONS, noRoomToSave, relationOf, relationSentence, type PersonSlots } from '.';

/**
 * DB 가 내주는 한 줄 — 수는 `person_limit()` 이 들고 화면은 그것을 옮기기만 한다.
 *
 * 그래서 여기 적힌 수는 **한도가 아니라 표본**이다. 이 함수가 하는 일은 문장을 짓는
 * 것뿐이고 어떤 수가 와도 같아야 하므로, 아래 검사도 이 값에서 문장을 만들어 대조한다 —
 * 기대값에 숫자를 손으로 적으면 한도를 옮기는 날 이 파일이 옛 수를 지킨다.
 */
const LIMIT = 10;

const slots = (remaining: number, limit = LIMIT): PersonSlots => ({
  limit,
  used: limit - remaining,
  remaining,
});

/**
 * **한도에 닿았을 때 무슨 말이 서는가.**
 *
 * 「아무도 안 남는다」는 우리 쪽 규율이고, 사용자가 보는 것은 이 문장이다. 저장하는
 * 입구가 둘이라(사주풀이 하나 · 궁합 둘) 말을 각자 지으면 한쪽만 고쳐진다.
 */
describe('저장할 자리가 모자랄 때', () => {
  it('자리가 넉넉하면 아무 말도 하지 않는다', () => {
    expect(noRoomToSave(1, slots(1))).toBeNull();
    expect(noRoomToSave(2, slots(2))).toBeNull();
    expect(noRoomToSave(2, slots(LIMIT))).toBeNull();
  });

  /** 둘이 필요한데 하나 남은 자리 — 한 문으로 저장하므로 눌러도 둘 다 되돌아간다 */
  it('둘이 필요한데 하나 남았으면 막는다', () => {
    const said = noRoomToSave(2, slots(1));

    expect(said).not.toBeNull();
    expect(said).toContain('1명분만 남았습니다');
    // 무엇을 해야 하는지까지 — 「안 됩니다」로 끝내면 사용자가 할 일을 못 찾는다
    expect(said).toContain('1명을 지워야');
  });

  it('다 찼으면 몇 명이 찼는지와 할 일을 말한다', () => {
    for (const needed of [1, 2]) {
      const said = noRoomToSave(needed, slots(0));

      expect(said, String(needed)).toContain(`${LIMIT}명을 다 채웠습니다`);
      expect(said, String(needed)).toContain('한 명을 지워야');
    }
  });

  /**
   * **못 읽었을 때는 막지 않는다.** 읽기가 한 번 실패했다고 「다 찼다」고 말하면 그것은
   * 거짓이고, 저장은 어차피 DB 가 막는다 — 여기서 하는 일은 먼저 말해 주는 것이다.
   */
  it('자리를 못 읽었으면 아무 말도 하지 않는다', () => {
    expect(noRoomToSave(2, null)).toBeNull();
  });

  /** 수를 화면이 들지 않는다 — 한도를 옮기면 이 문장도 저절로 따라온다 */
  it('한도 수는 받은 값에서 나온다', () => {
    expect(noRoomToSave(1, slots(0, 30))).toContain('30명을 다 채웠습니다');
  });
});

/**
 * **「선택 안 함」이 되돌리는 길이다.**
 *
 * 저장하는 누름에 사이가 함께 실리는데(ADR 0030), 라디오가 고르기를 강제하면 모르는
 * 사람이 아무거나 고르게 되고 그때 틀린 값이 「모른다」보다 나쁜 자리에 앉는다.
 * 안 고른 채로 저장되면 궁합 3번 절이 중립 물음으로 나간다 — 그것이 맞는 동작이다.
 */
describe('사이는 안 골라도 값이다', () => {
  it('모른다도 프롬프트에 한 문장으로 나간다', () => {
    expect(relationSentence(null)).toContain('무슨 사이인지 모른다');
    expect(relationSentence(null)).toContain('어느 사이에나 해당하는 장면');
  });

  it('고를 수 있는 갈래는 셋이고 그 밖은 없다', () => {
    expect([...RELATIONS]).toEqual(['family', 'friend', 'partner']);
  });

  it('모르는 이름은 모른다로 눕힌다 — 그럴듯한 쪽으로 밀지 않는다', () => {
    for (const raw of ['동창', '', null, undefined, 'other']) {
      expect(relationOf(raw), String(raw)).toBeNull();
    }
  });
});
