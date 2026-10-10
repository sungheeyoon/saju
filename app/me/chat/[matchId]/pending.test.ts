import { describe, expect, it } from 'vitest';

import { RATE_LIMITED_TEXT } from '@/src/lib/chat';

import type { ChatMessage } from './messages';
import {
  UNREACHED,
  droppable,
  newClientId,
  pendingMessage,
  settlePending,
  verdictOf,
  withFailure,
  withPending,
  withState,
  type Pending,
} from './pending';

const message = (seq: number, body: string, clientId: string | null, mine = true): ChatMessage => ({
  messageId: `m${seq}`,
  seq,
  mine,
  fromLeftPartner: false,
  body,
  createdAt: '2026-10-08T00:00:00Z',
  clientId,
});

const pending = (id: string, body: string, state: Pending['state'] = 'sending', mightBeKept = false): Pending => ({
  id,
  body,
  sentAt: '2026-10-08T00:00:01Z',
  state,
  mightBeKept,
});

describe('보내는 중인 말 맞추기 — 본문이 아니라 보낸 사람이 지은 id 로', () => {
  it('읽혀 온 내 말의 id 가 같으면 걷는다', () => {
    expect(settlePending([pending('c1', '안녕')], [message(5, '앞 말', null), message(6, '안녕', 'c1')])).toEqual([]);
  });

  it('같은 본문이어도 id 가 다르면 짝이 아니다 — 같은 말을 연달아 보내도 섞이지 않는다', () => {
    const first = pending('c1', 'ㅋㅋ');
    const second = pending('c2', 'ㅋㅋ');
    expect(settlePending([first, second], [message(3, 'ㅋㅋ', 'c2')])).toEqual([first]);
  });

  it('상대의 말은 짝이 아니다', () => {
    const one = pending('c1', '응');
    expect(settlePending([one], [message(4, '응', 'c1', false)])).toEqual([one]);
  });

  it('실패로 보인 말도 서버가 받았던 것이면 읽혀 올 때 걷힌다 — 응답만 잃은 전송', () => {
    expect(settlePending([pending('c1', '늦은 답', 'failed')], [message(9, '늦은 답', 'c1')])).toEqual([]);
  });

  it('걷을 것이 없으면 같은 목록을 돌려준다 — 다시 그리지 않는다', () => {
    const list = [pending('c1', '아직')];
    expect(settlePending(list, [message(9, '다른 말', 'c0')])).toBe(list);
    expect(settlePending(list, [message(9, '옛 말', null)])).toBe(list);
  });
});

describe('보내는 중인 말의 상태', () => {
  it('실패한 말은 제자리에 남는다 — 목록의 차례가 그대로다', () => {
    const list = [pending('c1', '하나'), pending('c2', '둘'), pending('c3', '셋')];
    const after = withFailure(list, 'c2', false);
    expect(after.map((one) => [one.id, one.state])).toEqual([
      ['c1', 'sending'],
      ['c2', 'failed'],
      ['c3', 'sending'],
    ]);
  });

  it('다시 보내면 같은 자리에서 보내는 중으로 돌아간다', () => {
    const list = [pending('c1', '하나', 'failed')];
    expect(withState(list, 'c1', 'sending')).toEqual([pending('c1', '하나', 'sending')]);
  });

  it('서버에 남았을 수 있다는 표지는 한 번 켜지면 다음 실패가 분명한 거절이어도 그대로다', () => {
    const once = withFailure([pending('c1', '하나')], 'c1', true);
    const again = withFailure(withState(once, 'c1', 'sending'), 'c1', false);
    expect(again[0].mightBeKept).toBe(true);
    expect(droppable(again[0])).toBe(false);
  });

  it('「삭제」는 서버가 분명히 거절한 실패에만 선다', () => {
    expect(droppable(pending('c1', '하나', 'failed'))).toBe(true);
    expect(droppable(pending('c1', '하나', 'failed', true))).toBe(false);
    expect(droppable(pending('c1', '하나', 'sending'))).toBe(false);
    expect(droppable(pending('c1', '하나', 'accepted'))).toBe(false);
  });
});

describe('보내는 중인 말을 목록 끝에 붙이기', () => {
  it('가진 말 뒤에 보낸 차례대로 내 말로 선다', () => {
    const shown = withPending([message(1, '앞', null, false)], [pending('c1', '하나'), pending('c2', '둘')]);
    expect(shown.map((one) => one.body)).toEqual(['앞', '하나', '둘']);
    expect(shown.slice(1).every((one) => one.mine && !one.fromLeftPartner)).toBe(true);
    expect(shown.slice(1).map((one) => one.messageId)).toEqual(['c1', 'c2']);
  });

  it('보내는 중이 없으면 가진 목록 그대로다', () => {
    const have = [message(1, '앞', null)];
    expect(withPending(have, [])).toBe(have);
  });

  it('보내는 중인 말의 차례는 가진 어느 말보다 뒤이고 제 id 를 든다', () => {
    const one = pendingMessage(pending('c1', '뒤'));
    expect(one.seq).toBe(Number.MAX_SAFE_INTEGER);
    expect(one.clientId).toBe('c1');
    expect(one.createdAt).toBe('2026-10-08T00:00:01Z');
  });
});

describe('전송의 답을 화면의 갈래로', () => {
  it('받았다 · 닫혔다 · 한도 · 문장으로 거절', () => {
    expect(verdictOf({ ok: true, outcome: 'sent' })).toEqual({ kind: 'accepted' });
    expect(verdictOf({ ok: true, outcome: 'closed' })).toEqual({ kind: 'closed' });
    expect(verdictOf({ ok: true, outcome: 'rate_limited' })).toEqual({ kind: 'failed', message: RATE_LIMITED_TEXT, mightBeKept: false });
    expect(verdictOf({ ok: false, message: '이용이 정지된 계정입니다.', refused: true })).toEqual({
      kind: 'failed',
      message: '이용이 정지된 계정입니다.',
      mightBeKept: false,
    });
  });

  it('DB 가 분명히 거절하지 않은 실패는 서버에 남았을 수 있다', () => {
    expect(verdictOf({ ok: false, message: '잠시 후 다시 시도해 주세요.', refused: false })).toMatchObject({ mightBeKept: true });
    expect(verdictOf(UNREACHED)).toEqual({ kind: 'failed', message: null, mightBeKept: true });
  });
});

describe('전송의 id', () => {
  it('보안 맥락이 아니어도 uuid v4 모양으로 짓는다', () => {
    const id = newClientId({ getRandomValues: crypto.getRandomValues.bind(crypto) });
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('randomUUID 가 있으면 그것을 쓴다', () => {
    const fixed = '00000000-0000-4000-8000-000000000000';
    expect(newClientId({ getRandomValues: crypto.getRandomValues.bind(crypto), randomUUID: () => fixed })).toBe(fixed);
  });
});
