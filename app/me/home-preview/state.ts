import type { WarningNotice } from '@/src/lib/account';

import type { ReadingEntry } from '../reading/current';
import { PEOPLE, RECENT_READINGS, SELF, WARNING, type FixturePerson, type FixtureSelf } from './fixtures';

/**
 * 시안 하나가 받는 것 — **모든 시안이 같은 값을 받는다.**
 *
 * 시안마다 제 데이터를 지어내면 비교가 데이터의 비교가 된다. 상태는 주소에 실린다(`?self=0&people=10`) —
 * 같은 상태로 시안만 바꿔 가며 볼 수 있어야 한다.
 */
export type PreviewState = {
  /** 내 사주 — 등록 전이면 `null` */
  self: FixtureSelf | null;
  /** 저장한 사람 — 0 · 3 · 10명 */
  people: readonly FixturePerson[];
  /** 내가 만든 풀이, 최근 것이 앞 — 등록 전이면 빈다 */
  readings: readonly ReadingEntry[];
  /** 안 읽은 소식 수 */
  unread: number;
  /** 안 읽은 채팅 수 */
  unreadChat: number;
  warning: WarningNotice | null;
};

export const PEOPLE_COUNTS = [0, 3, 10] as const;
export type PeopleCount = (typeof PEOPLE_COUNTS)[number];

export type StateParams = {
  self: boolean;
  people: PeopleCount;
  unread: boolean;
  warning: boolean;
};

export const DEFAULT_PARAMS: StateParams = { self: true, people: 3, unread: false, warning: false };

type Search = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function paramsFrom(search: Search): StateParams {
  const people = Number(one(search.people));
  return {
    self: one(search.self) !== '0',
    people: (PEOPLE_COUNTS as readonly number[]).includes(people) ? (people as PeopleCount) : DEFAULT_PARAMS.people,
    unread: one(search.unread) === '1',
    warning: one(search.warning) === '1',
  };
}

export function stateOf(params: StateParams): PreviewState {
  const people = PEOPLE.slice(0, params.people);
  const ids = new Set([...(params.self ? [SELF.personId] : []), ...people.map((p) => p.personId)]);
  return {
    self: params.self ? SELF : null,
    people,
    /* 화면에 없는 사람의 풀이는 안 세운다 — 사람 0명인데 「엄마 사주」가 서면 fixture 가 거짓말한다 */
    readings: RECENT_READINGS.filter((entry) =>
      entry.kind === 'self'
        ? params.self
        : ids.has(entry.personA ?? '') && (entry.personB === null || ids.has(entry.personB)),
    ),
    unread: params.unread ? 2 : 0,
    unreadChat: params.unread ? 3 : 0,
    warning: params.warning ? WARNING : null,
  };
}
