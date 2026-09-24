import { chartOf } from '@/src/lib/input/chart';
import { DEFAULT_QUERY, type Query } from '@/src/lib/input/query';
import type { WarningNotice } from '@/src/lib/account';
import type { Saju } from '@/src/lib/saju';

import type { ReadingEntry } from '../reading/current';

/*
  **미리보기의 가짜 사람들 — DB 를 안 읽는다.**

  여덟 글자는 진짜 엔진(`chartOf`)이 세운다. 모양만 흉내 낸 글자를 두면 시안이 실제 명식의 길이와 색을
  못 겪는다. 사람 열은 깨지기 쉬운 경우를 일부러 섞었다: 열두 자 이름 · 출생 시각 모름 · 음력 ·
  풀이 없음 · 이전 명식으로 만든 풀이 · 긴 메모 · 못 읽는 판본.
*/

type Chart = { ok: true; query: Query; saju: Saju } | { ok: false; message: string };

/** 저장한 사람 카드(`shared/person-card.tsx`)가 받는 모양 — 원본 목록의 `Person` 과 같다 */
export type FixturePerson = {
  personId: string;
  person_id: string;
  local_label: string;
  note: string | null;
  chart: Chart;
  reading: ReadingEntry | null;
};

export type FixtureSelf = {
  personId: string;
  label: string;
  query: Query;
  saju: Saju;
  reading: ReadingEntry | null;
};

function query(name: string, fields: Partial<Query>): Query {
  return { ...DEFAULT_QUERY, name, ...fields };
}

function charted(q: Query): Chart {
  return { ok: true, query: q, saju: chartOf(q) };
}

function reading(fields: Partial<ReadingEntry> & Pick<ReadingEntry, 'kind' | 'createdAt'>): ReadingEntry {
  return {
    personA: null,
    personB: null,
    matchId: null,
    labelA: null,
    labelB: null,
    score: null,
    metaphor: null,
    fromCurrentChart: true,
    ...fields,
  };
}

const SELF_READING = reading({
  kind: 'self',
  metaphor: '서리 내린 가을 아침, 맑게 울리는 쇠종',
  createdAt: '2026-09-20T10:12:00+09:00',
});

/* 목(木) 0 · 화(火) 1 · 수(水) 1 — 예시 후보 셋(木 · 火 · 水를 채워 줌)이 실제로 모자란 기운을 채우는 명식이다 */
const SELF_QUERY = query('서하', { date: '1992-10-09', time: '15:20', gender: 'female' });

export const SELF: FixtureSelf = {
  personId: 'preview-self',
  label: '서하',
  query: SELF_QUERY,
  saju: chartOf(SELF_QUERY),
  reading: SELF_READING,
};

function person(
  id: string,
  label: string,
  fields: Partial<Query>,
  extra: { note?: string; reading?: ReadingEntry | null; unreadable?: boolean } = {},
): FixturePerson {
  const personId = `preview-${id}`;
  return {
    personId,
    person_id: personId,
    local_label: label,
    note: extra.note ?? null,
    chart: extra.unreadable
      ? { ok: false, message: '저장된 출생 정보를 읽지 못했습니다.' }
      : charted(query(label, fields)),
    reading: extra.reading ?? null,
  };
}

function personReading(personId: string, label: string, metaphor: string | null, createdAt: string, current = true) {
  return reading({
    kind: 'person',
    personA: `preview-${personId}`,
    labelA: label,
    metaphor,
    createdAt,
    fromCurrentChart: current,
  });
}

const MOM_READING = personReading('mom', '엄마', '늦가을 들판을 비추는 오후의 햇살', '2026-09-18T21:03:00+09:00');
const JUN_READING = personReading('jun', '준호', '한여름 소나기 뒤의 계곡물', '2026-09-12T19:40:00+09:00', false);
const SEO_READING = personReading('seo', '서진', '저녁 노을에 물든 바위산', '2026-09-22T13:30:00+09:00');

/** 열 명 — 차례가 곧 목록의 차례다. 앞의 셋이 「3명」 상태다 */
export const PEOPLE: readonly FixturePerson[] = [
  person('mom', '엄마', { date: '1965-11-02', time: '14:20', gender: 'female', calendar: 'lunar' }, {
    note: '음력 생일로 챙김',
    reading: MOM_READING,
  }),
  person('jun', '준호', { date: '1992-07-28', time: '23:30', gender: 'male' }, {
    reading: JUN_READING,
  }),
  person('long', '김수한무거북이와두루미', { date: '1998-01-09', time: '', hourKnown: false, gender: 'male' }),
  person('dad', '아빠', { date: '1962-05-15', time: '06:10', gender: 'male' }, {
    note: '회사 동료분들이 부르는 이름과 달라서 헷갈리지 않게 적어 둠 — 출생 시각은 할머니께 여쭤본 값',
  }),
  person('yuna', '유나', { date: '1995-12-24', time: '11:05', gender: 'female' }, {
    reading: personReading('yuna', '유나', null, '2026-08-30T08:15:00+09:00'),
  }),
  person('min', '민재', { date: '2001-04-03', time: '16:45', gender: 'male' }),
  person('sis', '언니', { date: '1990-09-19', time: '02:15', gender: 'female' }, {
    reading: personReading('sis', '언니', '달빛 아래 고요히 흐르는 강', '2026-09-01T22:50:00+09:00'),
  }),
  person('boss', '팀장님', { date: '1979-02-11', time: '09:30', gender: 'female', city: '부산' }),
  person('old', '할머니', { date: '1940-06-06', time: '', hourKnown: false, gender: 'female' }, { unreadable: true }),
  person('seo', '서진', { date: '1996-10-30', time: '20:00', gender: 'male' }, {
    reading: SEO_READING,
  }),
];

/** 최근 풀이 — 풀이 목록(`/me/readings`)의 줄과 같은 모양이다. 최근 것이 앞이다 */
export const RECENT_READINGS: readonly ReadingEntry[] = [
  reading({
    kind: 'private',
    personA: SELF.personId,
    personB: 'preview-seo',
    labelA: '서하',
    labelB: '서진',
    score: 78,
    metaphor: '물길이 산을 돌아 흐르듯 서로를 비켜 가며 채운다',
    createdAt: '2026-09-23T09:10:00+09:00',
  }),
  SEO_READING,
  SELF_READING,
  MOM_READING,
  reading({
    kind: 'private',
    personA: 'preview-mom',
    personB: 'preview-dad',
    labelA: '엄마',
    labelB: '아빠',
    score: 64,
    metaphor: null,
    createdAt: '2026-09-15T17:25:00+09:00',
  }),
  JUN_READING,
];

export const WARNING: WarningNotice = { ref: 'W-7KQM', category: 'harassment', warnedOn: '2026-09-21' };

/** 저장 자리 한도 — `enforce_person_limit` 와 같은 수 */
export const PERSON_LIMIT = 10;
