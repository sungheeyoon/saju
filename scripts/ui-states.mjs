/**
 * 화면을 보려면 **사람이 어떤 상태에 있어야 하는가.**
 *
 * 경로 하나에 화면 하나가 아니다 — `/me` 는 자기 사주가 없을 때와 있을 때가 다른
 * 화면이고, `/signup` 은 가입 전에만 선다. 그래서 훑기의 단위는 경로가 아니라 **상태**다.
 */

import { cookiesFor, localStack, onlyTheseTwo, participate, plantReading, seed } from './ui-seed.mjs';

export const STATES = {
  /** 구글 로그인만 하고 **가입은 안 끝낸** 사람 — `/signup` 관문이 서는 유일한 자리 */
  raw: '가입 전 (코드·닉네임·안내 확인)',
  /** 가입은 끝났고 자기 사주가 없는 사람 — 온보딩 */
  new: '온보딩 (자기 사주 등록 전)',
  /** 다 갖춘 사람 — 자기 사주·가족 하나·풀이 둘 */
  full: '자기 사주 + 가족 + 풀이 둘',
  /** 둘이 이어진 상태 — 궁합 결과와 알림함이 여기서만 산다 */
  pair: '수락된 궁합 한 쌍 (창 둘)',
  /** 아직 아무에게도 안 보낸 상태 — **후보 카드가 실제로 서는 유일한 자리** */
  board: '홈에 오늘의 인연이 선다 (요청 전)',
};

async function fullOne(local, { nickname, label, gender, tag }) {
  const person = await seed(local, {
    selfPerson: true,
    /* 둘째 사람은 **메모를 달고 선다** — 카드에 메모 칸이 서는 화면도 훑을 값이 있다 */
    people: [
      '어머니',
      {
        label: '동생',
        date: '1994-02-03',
        time: '21:40',
        gender: 'male',
        city: '부산',
        note: '태어난 시각은 병원 기록으로 확인했습니다. 입춘 전후를 늘 헷갈립니다.',
      },
    ],
    nickname,
    label,
    gender,
  }, tag);

  await plantReading(person.api, { kind: 'self', title: '지금의 핵심' });
  await plantReading(person.api, {
    kind: 'person',
    personId: person.managed[0].personId,
    title: '어머니의 결',
  });

  return person;
}

/**
 * 요청을 보내고 **받은 쪽이 수락까지 한다** — 화면을 안 지나간다.
 *
 * 화면으로 지나가면 수락이 곧 풀이 생성이라(ADR 0038) 열쇠 없는 서버에서 실패한 시도가
 * 남는다. 여기서 재려는 것이 없으므로 문으로 바로 지나고, 글은 따로 심는다.
 */
async function pairThem(asker, receiver) {
  const board = await asker.api.rpc('my_discovery_board');
  if (board.error) throw new Error(`후보 목록을 못 받았습니다 — ${board.error.message}`);

  const partner = await receiver.api.from('discovery_profile').select('user_id').maybeSingle();
  const asked = await asker.api.rpc('request_match', {
    p_candidate_user_id: partner.data?.user_id,
  });
  if (asked.error) throw new Error(`요청을 못 보냈습니다 — ${asked.error.message}`);

  const inbox = await receiver.api.rpc('my_match_requests');
  if (inbox.error) throw new Error(`요청함을 못 읽었습니다 — ${inbox.error.message}`);
  const incoming = (inbox.data ?? []).find((row) => row.status === 'pending');
  if (!incoming) throw new Error('받은 요청이 없습니다.');

  const answered = await receiver.api.rpc('respond_to_match_request', {
    p_request_id: incoming.request_id,
    p_accept: true,
  });
  if (answered.error) throw new Error(`수락하지 못했습니다 — ${answered.error.message}`);

  const matches = await receiver.api.rpc('my_matches');
  const match = (matches.data ?? [])[0];
  if (!match) throw new Error('맺어진 궁합이 없습니다.');

  return match.match_id;
}

/**
 * 상태 하나를 세우고 **창에 실을 것**을 돌려준다.
 *
 * 창 하나로 끝나지 않는 상태가 있어서(`pair`) 사람 배열로 답한다 — 부르는 쪽이
 * 「한 명이면 창 하나」를 알 필요가 없다.
 */
export async function build(state) {
  const local = localStack();
  const tag = `${Date.now()}`.slice(-6);

  if (state === 'raw') {
    const one = await seed(local, { selfPerson: false, skipSignup: true }, tag);
    return {
      local,
      people: [{ ...one, cookies: await cookiesFor(local, one.email, one.password), at: '/signup' }],
    };
  }

  if (state === 'new') {
    const one = await seed(local, { selfPerson: false }, tag);
    return {
      local,
      people: [{ ...one, cookies: await cookiesFor(local, one.email, one.password), at: '/me' }],
    };
  }

  if (state === 'full') {
    const one = await fullOne(local, { nickname: `벗${tag.slice(-4)}`, tag });
    await participate(one.api);
    onlyTheseTwo([one.email]);
    return {
      local,
      people: [{ ...one, cookies: await cookiesFor(local, one.email, one.password), at: '/me' }],
    };
  }

  /**
   * **후보 카드를 찍으려면 짝이 둘 필요하다.**
   *
   * `full` 은 풀을 자기 하나로 좁히므로(`onlyTheseTwo`) 홈의 「오늘의 인연」이 늘 빈
   * 자리로 선다 — 앱에서 가장 자주 보는 화면인데 훑기가 그 채워진 모양을 한 번도 안
   * 찍고 있었다.
   *
   * `pair` 와 다른 것은 **아무것도 안 보냈다는 것**이다. 요청이 오가면 상대는 후보에서
   * 빠지므로, 같은 상태로는 이 화면을 못 찍는다.
   *
   * 요약을 서로 어긋나게 준다. 둘 다 다섯 칸이 찬 기본값이면 채울 오행이 없어
   * **오행 칩이 없는 카드**만 선다 — 그것도 참인 화면이지만 흔한 쪽은 아니다.
   */
  if (state === 'board') {
    const viewer = await fullOne(local, { nickname: `벗${tag.slice(-4)}`, tag });
    const other = await fullOne(local, {
      nickname: `이웃${tag.slice(-3)}`,
      label: '이웃',
      gender: 'female',
      tag,
    });

    // 보는 쪽에 土·金 이 비어 있고, 상대가 그 둘을 가졌다
    await participate(viewer.api, { 木: 3, 火: 3, 土: 0, 金: 0, 水: 2 });
    await participate(other.api, { 木: 1, 火: 1, 土: 3, 金: 2, 水: 1 });
    onlyTheseTwo([viewer.email, other.email]);

    return {
      local,
      people: [{ ...viewer, cookies: await cookiesFor(local, viewer.email, viewer.password), at: '/me' }],
    };
  }

  if (state === 'pair') {
    const asker = await fullOne(local, { nickname: `보내는${tag.slice(-3)}`, label: '보낸이', tag });
    const receiver = await fullOne(local, {
      nickname: `받는${tag.slice(-3)}`,
      label: '받은이',
      gender: 'female',
      tag,
    });

    await participate(asker.api);
    await participate(receiver.api);
    onlyTheseTwo([asker.email, receiver.email]);

    const matchId = await pairThem(asker, receiver);
    await plantReading(asker.api, { kind: 'match', matchId, title: '두 사람의 결' });

    return {
      local,
      matchId,
      people: [
        {
          ...asker,
          cookies: await cookiesFor(local, asker.email, asker.password),
          at: `/me/match/${matchId}`,
        },
        {
          ...receiver,
          cookies: await cookiesFor(local, receiver.email, receiver.password),
          at: '/me/requests',
        },
      ],
    };
  }

  throw new Error(`모르는 상태입니다: ${state} — ${Object.keys(STATES).join(', ')} 중 하나`);
}
