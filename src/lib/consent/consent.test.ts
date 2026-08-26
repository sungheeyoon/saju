import { describe, expect, it } from 'vitest';

import {
  BLOCK_NOTE,
  CONSENT_FLOW_CAVEAT,
  CONSENT_FLOW_STEPS,
  CONSENT_INTRO,
  MATCH_DISCLOSURE,
  MATCH_RESULT_CLOSED_NOTE,
  MATCH_RESULT_INTRO,
  MATCH_RESULT_ENGINE_NOTE,
  MATCH_RESULT_PINNED_NOTE,
  NOTIFICATION_KINDS,
  REJECTION_IS_FINAL_NOTE,
  REQUEST_INTRO,
  REQUEST_STATUSES,
  REQUEST_STATUS_TEXT,
  REVISION_BOUND_NOTE,
  notificationText,
  suppliedText,
} from './index';

/**
 * **상태 전이는 여기서 재지 않는다.**
 *
 * pending 이 무엇으로 갈 수 있는지, 무엇이 무효를 부르는지는 전부 DB 안에 있고
 * `supabase/tests/10_match_request.test.sql` 이 잰다. 여기서 재는 것은 **말**이다 —
 * 다섯 상태와 네 사건에 빠짐없이 문장이 있는지, 그리고 그 문장이 실제 동작과 같은
 * 약속을 하는지.
 */
describe('요청 상태는 다섯이고 다섯 다 말이 있다', () => {
  it('DB 검사식과 같은 다섯을 든다', () => {
    expect([...REQUEST_STATUSES]).toEqual([
      'pending',
      'accepted',
      'rejected',
      'invalidated',
      'cancelled',
    ]);
  });

  it('상태마다 보낸 쪽과 받은 쪽의 말이 다 있다', () => {
    for (const status of REQUEST_STATUSES) {
      const text = REQUEST_STATUS_TEXT[status];
      expect(text.label.length).toBeGreaterThan(0);
      expect(text.sent.length).toBeGreaterThan(0);
      expect(text.received.length).toBeGreaterThan(0);
    }
  });

  /**
   * 둘 다 「성립하지 않았다」지만 **누가 거뒀는지가 다르다.** 한 낱말로 합치면 사용자에게
   * 「왜 사라졌는지」를 말해 줄 수 없다(US 43).
   */
  it('무효와 거둠을 갈라서 말한다', () => {
    expect(REQUEST_STATUS_TEXT.invalidated.label).not.toBe(REQUEST_STATUS_TEXT.cancelled.label);
    expect(REQUEST_STATUS_TEXT.invalidated.sent).toContain('출생정보');
  });
});

describe('알림은 네 사건을 말한다', () => {
  it('사건마다 문장이 있고 별명을 부른다', () => {
    for (const kind of NOTIFICATION_KINDS) {
      const text = notificationText(kind, '지영');
      expect(text).toContain('지영');
      expect(text.length).toBeGreaterThan(0);
    }
  });

  /**
   * 별명을 못 읽어도 사건은 말할 수 있다. **없는 이름을 지어 부르지 않는다** —
   * 「알 수 없는 사람이 요청했습니다」는 사용자가 아무것도 할 수 없는 문장이다.
   */
  it('별명이 없으면 사람을 부르지 않는 문장으로 낸다', () => {
    for (const kind of NOTIFICATION_KINDS) {
      const text = notificationText(kind, null);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toContain('null');
      expect(text).not.toContain('undefined');
      expect(text).not.toContain('님');
    }
  });

  it('빈 별명도 없는 것으로 읽는다', () => {
    expect(notificationText('request_received', '  ')).toBe(
      notificationText('request_received', null),
    );
  });
});

/**
 * **보내는 쪽과 받는 쪽이 같은 한 벌을 읽는다.**
 *
 * 두 화면에 따로 적으면 동의가 무엇에 대한 것인지 갈린다. 그래서 목록은 하나이고,
 * 앞에 붙는 말만 다르다.
 */
describe('Match 가 여는 범위는 한 벌이다', () => {
  it('열리는 것에 궁합 관계·사주풀이와 점수·일부 오행 구성이 있다', () => {
    const shown = MATCH_DISCLOSURE.shown.join(' ');
    // 점수는 사주풀이와 같은 생성 건에서 난다. 내부 지표 이름은 여기 서지 않는다(PRD).
    expect(shown).toContain('사주풀이와 점수');
    expect(shown).not.toContain('match-v0');
    expect(shown).toContain('오행');
    // 누가 보든 같은 글이다 — `perspectivePersonId` 로 결론이 바뀌지 않는다(US 48).
    expect(shown).toContain('누가 보든');
  });

  /** 여덟 글자는 열려도 출생 원문과 상대 원국 전체 판정은 계속 닫혀 있다 */
  it('열리지 않는 것에 출생 원문과 상대 원국 전체 판정이 있다', () => {
    const hidden = MATCH_DISCLOSURE.hidden.join(' ');
    expect(hidden).toContain('생년월일시');
    expect(hidden).toContain('출생지');
    expect(hidden).toContain('상대 원국');
    expect(hidden).toContain('전체 판정');
  });

  it('세 문턱이 같은 목록 앞에 선다', () => {
    expect(REQUEST_INTRO).toContain('수락');
    expect(CONSENT_INTRO).toContain('Match');
    // 결과 화면도 같은 목록을 읽는다(ADR 0010) — 앞에 붙는 말만 다르다.
    expect(MATCH_RESULT_INTRO).toContain('사주풀이와 점수');
  });

  /**
   * 결과를 만들면서 실제로 무엇이 나가는지 알게 됐다 — 관계 표 여러 줄을 합치면
   * 여덟 글자가 전부 드러날 수 있다. 우연에 맡기지 않고 동의 범위에 **적는다**(ADR 0012).
   */
  it('관계를 합치면 여덟 글자가 전부 보일 수 있음을 적는다', () => {
    const shown = MATCH_DISCLOSURE.shown.join(' ');
    expect(shown).toContain('글자');
    expect(shown).toContain('여덟 글자');
    expect(shown).toContain('전부');
    expect(MATCH_DISCLOSURE.hidden.join(' ')).not.toContain('여덟 글자');
  });
});

/**
 * 결과 화면의 말 — **이 화면에만 있는 사실 셋.**
 *
 * 판본에 매여 있다는 것, 어느 문장이 조립된 것이고 어느 것이 모델이 쓴 것인지, 그리고
 * 못 열 때 무엇이 그대로 남아 있는지. 셋 다 화면이 손으로 적으면 한 곳만 고쳐진다.
 */
describe('공유 결과는 무엇으로 났는지 함께 말한다', () => {
  it('매인 판본으로 났고 나중 수정에 흔들리지 않는다고 말한다', () => {
    expect(MATCH_RESULT_PINNED_NOTE).toContain('판본');
    expect(MATCH_RESULT_PINNED_NOTE).toContain('움직이지 않습니다');
  });

  /**
   * 두 층을 구별해 말한다 — 조립된 문장과 모델이 쓴 글이 한 화면에 함께 선다.
   *
   * 예전에는 이 자리가 「모델이 붙어도 점수를 새로 만들지 않고 `match-v0` 를 설명한다」
   * 였다. 그 결정은 폐기됐다(HEAD `a9337f4`) — 점수는 해석과 **같은 생성 건**에서 나온다.
   */
  it('조립된 문장과 모델이 쓴 사주풀이를 구별해 말한다', () => {
    expect(MATCH_RESULT_ENGINE_NOTE).toContain('조립');
    // 제목에는 도구 이름을 안 박지만 **두 층이 나란히 서는 이 자리에서는 밝힌다.**
    // 「사주풀이」만 적으면 표와 같은 곳에서 나온 것처럼 읽힌다.
    expect(MATCH_RESULT_ENGINE_NOTE).toContain('사주풀이');
    expect(MATCH_RESULT_ENGINE_NOTE).toContain('언어 모델');
    // 내부 지표 이름은 사용자에게 보이지 않는다(PRD).
    expect(MATCH_RESULT_ENGINE_NOTE).not.toContain('match-v0');
  });

  /** 「못 연다」와 「없다」는 다른 말이다 — Match 와 동의는 그대로 있다 */
  it('열지 못할 때도 Match 가 그대로라고 말한다', () => {
    expect(MATCH_RESULT_CLOSED_NOTE).toContain('Match');
    expect(MATCH_RESULT_CLOSED_NOTE).toContain('그대로');
  });
});

/**
 * **「동의한 뒤에 열립니다」는 설명이 아니다.**
 *
 * 그 한 줄은 맞는 말이지만, 읽는 사람이 모르는 것은 「동의가 필요하다」가 아니라
 * 자기가 지금 무엇을 해야 하는가다. 그래서 흐름을 세 걸음으로 적고, 걸음마다
 * **그 걸음에서 아직 열리지 않는 것**을 함께 적는다 — 이 제품이 파는 것이 곧
 * 「아직 안 열렸다」라서, 그 사실이 빠지면 요청을 보내는 일 자체가 무서운 일이 된다.
 */
describe('무엇을 하는 곳인지 세 걸음으로 적는다', () => {
  it('보내기·답하기·함께 보기 순서로 선다', () => {
    expect(CONSENT_FLOW_STEPS).toHaveLength(3);
    const [send, answer, open] = CONSENT_FLOW_STEPS;
    expect(send.title).toContain('요청');
    expect(answer.title).toContain('답');
    expect(open.title).toContain('봅니다');
  });

  it('걸음마다 그때 열리지 않는 것을 함께 적는다', () => {
    const [send, answer, open] = CONSENT_FLOW_STEPS;
    // 보내는 것만으로는 아무것도 열리지 않는다.
    expect(send.body).toContain('열리는 것은 없고');
    // 수락하지 않으면 지금 보이는 것에서 더 나가지 않는다.
    expect(answer.body).toContain('수락하지 않으면');
    // 열린 뒤에도 출생 원문은 닫혀 있다(ADR 0012).
    expect(open.body).toContain('생년월일시와 출생지는 열리지 않습니다');
  });

  /**
   * 개념을 **처음 만나는 자리**에서 우리 내부 낱말로 설명하지 않는다.
   * 「판본」은 요청 카드 안의 고지가 든다(`REVISION_BOUND_NOTE`).
   */
  it('흐름 설명에는 판본이라는 말이 서지 않는다', () => {
    const flow = [...CONSENT_FLOW_STEPS.map((step) => `${step.title} ${step.body}`), CONSENT_FLOW_CAVEAT].join(' ');
    expect(flow).not.toContain('판본');
    // 같은 사실은 그래도 말한다 — 무엇이 요청을 깨뜨리는지, 그리고 그다음에 할 일.
    expect(CONSENT_FLOW_CAVEAT).toContain('출생정보');
    expect(CONSENT_FLOW_CAVEAT).toContain('무효');
    expect(CONSENT_FLOW_CAVEAT).toContain('다시 보내야');
  });
});

describe('무효화와 거절과 차단은 누르기 전에 읽힌다', () => {
  /**
   * 미리 적어 두면 실제로 무효가 됐을 때 **그렇게 하기로 했던 것**이 된다. 안 적으면
   * 사고처럼 읽힌다.
   */
  it('요청이 판본에 매인다는 것을 먼저 말한다', () => {
    expect(REVISION_BOUND_NOTE).toContain('판본');
    expect(REVISION_BOUND_NOTE).toContain('무효');
    // 이름·메모 수정은 무효로 만들지 않는다 — 그 경계도 함께 적는다.
    expect(REVISION_BOUND_NOTE).toContain('이름');
    // 무효는 막다른 길이 아니다 — 그다음에 할 일을 함께 적는다.
    expect(REVISION_BOUND_NOTE).toContain('다시 보내면');
  });

  it('거절이 되돌아오지 않는다는 것을 먼저 말한다', () => {
    expect(REJECTION_IS_FINAL_NOTE).toContain('다시');
  });

  it('차단이 「다시 보지 않기」보다 넓고 되돌릴 수 없다는 것을 말한다', () => {
    expect(BLOCK_NOTE).toContain('요청');
    expect(BLOCK_NOTE).toContain('Match');
    // 용어집: 차단은 양방향으로 접촉을 막고 **되돌리지 않는다**. 푸는 문이 없으므로
    // 누르기 전에 그렇게 말해야 한다.
    expect(BLOCK_NOTE).toContain('되돌릴 수 없습니다');
  });
});

describe('채우는 오행은 이름으로 말한다', () => {
  it('글자와 우리말 이름을 함께 낸다', () => {
    expect(suppliedText(['木', '水'], 'toMe')).toBe(
      '나에게 부족한 목(木) · 수(水) 기운을 이 사람이 채웁니다.',
    );
  });

  /**
   * **두 방향을 정책이 짓는다.** 화면이 한 문장을 받아 낱말을 바꿔 쓰면 그때부터 문구는
   * 화면이 쓰는 것이 되고, 고칠 자리가 둘이 된다.
   */
  it('반대 방향은 내가 채우는 것으로 말한다', () => {
    expect(suppliedText(['木'], 'toThem')).toBe('이 사람에게 부족한 목(木) 기운을 내가 채웁니다.');
  });

  /** 없는 것을 설명하지 않는다 — 채우는 것이 없으면 그 줄이 서지 않는다 */
  it('채우는 것이 없으면 문장이 없다', () => {
    expect(suppliedText([], 'toMe')).toBeNull();
    expect(suppliedText([], 'toThem')).toBeNull();
  });
});
