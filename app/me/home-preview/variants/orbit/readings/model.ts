import { ELEMENT_KO, STEM_INFO, type Element, type Saju } from '@/src/lib/saju';
import { READING_NOUN } from '@/src/lib/reading';

import type { ReadingEntry } from '../../../../reading/current';
import { readingDate, readingHref, readingTitle } from '../../../../reading/line';
import type { PreviewState } from '../../../state';
import { previewHref } from '../../../shared/preview-href';

/*
  **풀이 화면이 먹는 값 — 서버가 한 번 접어 내려보낸다.**

  홈 지도(`../model.ts`)와 같은 경계다. 목록 · 지도 · 글 칸은 「무엇을 골랐나」 때문에 브라우저에서 돌지만,
  글자 · 오행 · 주소 · **날짜 문자열**은 전부 여기서 짓는다. 날짜를 브라우저가 다시 적으면 서버와 시간대가
  갈리는 날 하이드레이션이 어긋난다.

  **목록의 차례는 받은 그대로다.** 실제 화면처럼 사주풀이 · 궁합풀이 두 구역으로만 가르고, 구역 안에서는
  `state.readings` 의 차례(최근 것이 앞)를 지킨다 — 다시 정렬하면 판정하는 자리가 둘이 된다(ADR 0033).
*/

/** 지도와 줄 앞 표식에 서는 한 사람 — 나 · 저장한 사람 · 인연 상대 */
export type Node = {
  id: string;
  label: string;
  /** 일간 글자 — 명식을 못 읽거나 인연 상대면 `null` */
  stem: string | null;
  element: Element | null;
  /** 보조기기용 — 「일간 甲, 갑목」 */
  spoken: string;
  isSelf: boolean;
  photoUrl: string | null;
};

export type Entry = {
  key: string;
  shape: 'single' | 'pair';
  title: string;
  metaphor: string | null;
  score: number | null;
  date: string;
  /** 글 칸의 「… 생성」 — 분까지 */
  made: string;
  current: boolean;
  /** 이 글에 든 사람 — 한 사람 또는 두 사람 */
  subjects: string[];
  /** 실제 결과 화면의 주소(미리보기 링크) */
  href: string;
  /** 한 사람 풀이만 — 사주 탭이 가는 곳 · 글 칸 머리 */
  chartHref: string | null;
  name: string;
  heading: string;
};

export type Making = { id: string; nickname: string; photoUrl: string | null; href: string };

export type ReadingsModel = {
  self: Node | null;
  nodes: Record<string, Node>;
  singles: Entry[];
  pairs: Entry[];
  making: Making[];
  /** 지도 둘레에 앉는 사람 — 글에 처음 나온 차례 */
  orbit: string[];
};

export const SELF_ID = 'self';

function dayOf(saju: Saju): Pick<Node, 'stem' | 'element' | 'spoken'> {
  const stem = saju.pillars.dayMaster;
  const info = STEM_INFO[stem];
  return { stem, element: info.element, spoken: `일간 ${stem}, ${info.ko}${ELEMENT_KO[info.element]}` };
}

const made = (iso: string) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

export function readingsModelOf(state: PreviewState): ReadingsModel {
  const nodes: Record<string, Node> = {};
  const selfPersonId = state.self?.personId ?? null;

  const self: Node | null =
    state.self === null
      ? null
      : { id: SELF_ID, label: state.self.label, isSelf: true, photoUrl: null, ...dayOf(state.self.saju) };
  if (self !== null) nodes[SELF_ID] = self;

  for (const person of state.people) {
    nodes[person.personId] = {
      id: person.personId,
      label: person.local_label,
      isSelf: false,
      photoUrl: null,
      ...(person.chart.ok
        ? dayOf(person.chart.saju)
        : { stem: null, element: null, spoken: person.chart.message }),
    };
  }

  /* 내 personId 는 지도 가운데 하나로 모은다 — 궁합 줄의 한쪽이 나일 때 */
  const idOf = (personId: string | null) => (personId !== null && personId === selfPersonId ? SELF_ID : personId ?? '');
  const photoOf = (userId: string, nickname: string) =>
    state.cards.find((card) => card.candidateUserId === userId || card.nickname === nickname)?.photoUrl ?? null;

  const entryOf = (entry: ReadingEntry): Entry => {
    const single = READING_NOUN[entry.kind] === '사주풀이';
    const subjects =
      entry.kind === 'self'
        ? [SELF_ID]
        : entry.kind === 'person'
          ? [idOf(entry.personA)]
          : entry.kind === 'private'
            ? [idOf(entry.personA), idOf(entry.personB)]
            : [SELF_ID, `match:${entry.matchId ?? ''}`];
    if (entry.kind === 'match') {
      const id = subjects[1];
      nodes[id] ??= { id, label: entry.labelA ?? '', stem: null, element: null, spoken: '', isSelf: false, photoUrl: null };
    }
    const mine = entry.kind === 'self';
    const name = mine ? '내 사주' : entry.labelA ?? '';
    return {
      key: `${entry.kind}:${entry.matchId ?? entry.personA ?? 'me'}:${entry.personB ?? ''}`,
      shape: single ? 'single' : 'pair',
      title: readingTitle(entry),
      metaphor: entry.metaphor,
      score: entry.score,
      date: readingDate(entry.createdAt),
      made: made(entry.createdAt),
      current: entry.fromCurrentChart,
      subjects,
      href: previewHref(readingHref(entry)),
      chartHref: single ? previewHref(mine ? '/me' : `/me/people/${entry.personA ?? ''}`) : null,
      name,
      heading: mine ? '내 사주풀이' : `${name}의 사주풀이`,
    };
  };

  const entries = state.readings.map(entryOf);
  const singles = entries.filter((entry) => entry.shape === 'single');
  const pairs = entries.filter((entry) => entry.shape === 'pair');

  const making: Making[] = state.making.map((match) => {
    const id = `match:${match.matchId}`;
    const photoUrl = match.hasPhoto ? photoOf(match.partnerUserId, match.nickname) : null;
    nodes[id] ??= { id, label: match.nickname, stem: null, element: null, spoken: '', isSelf: false, photoUrl };
    return { id, nickname: match.nickname, photoUrl, href: previewHref(`/me/match/${match.matchId}`) };
  });

  const orbit: string[] = [];
  for (const id of [...entries.flatMap((entry) => entry.subjects), ...making.map((one) => one.id)]) {
    if (id !== SELF_ID && id in nodes && !orbit.includes(id)) orbit.push(id);
  }

  return { self, nodes, singles, pairs, making, orbit };
}
