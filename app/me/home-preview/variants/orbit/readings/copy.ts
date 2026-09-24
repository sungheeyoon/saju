import { READING_STALE_NOTE } from '@/src/lib/reading';

/*
  **이 화면의 문구 전부** — 새 것과 기존 것의 구분은 `NOTES.md` 의 표가 든다.
  기존 문구는 실제 `/me/readings` · `/me/readings/[subject]` · 풀이 칸(`reading/panel.tsx`)에서 그대로 옮겼다.
*/
export const COPY = {
  /* 기존 — 목록 */
  eyebrow: '풀이',
  title: '만든 풀이',
  lead: '사주풀이와 궁합풀이를 나누어, 각 구역에서 최근에 만든 순서대로 확인할 수 있습니다.',
  singles: '사주풀이',
  singlesLead: '나와 저장한 사람을 한 사람씩 본 풀이입니다.',
  pairs: '궁합풀이',
  pairsLead: '두 사람을 함께 맞대어 본 풀이입니다.',
  making: '함께 보는 궁합',
  makingLead: '서로 동의한 궁합풀이를 만들고 있습니다.',
  makingState: '궁합풀이 만드는 중…',
  makingAction: '함께 보기',
  oldChart: '이전 명식',
  scoreUnit: '점',
  nothingTitle: '아직 만든 풀이가 없습니다',
  me: '나',
  register: '내 명식 등록',
  readingGet: '사주풀이 받기',

  /* 기존 — 한 사람 풀이 */
  back: '만든 풀이 목록',
  chartTab: '사주',
  readingTab: '사주풀이',
  share: '공유 링크 복사',
  remake: '사주풀이 다시 받기',
  madeSuffix: '생성',
  stale: READING_STALE_NOTE,

  /* 새 */
  mapTitle: '글이 있는 관계',
  mapHint: '점을 누르면 그 사람이 든 글만 모아 봅니다.',
  legendSingle: '사주풀이',
  legendPair: '궁합풀이와 점수',
  legendMaking: '만드는 중',
  focusAll: '전체 보기',
  count: (n: number) => `${n}편`,
  focusOf: (name: string, n: number) => `${name}의 글 ${n}편`,
  contents: '차례',
  related: '이어진 글',
  eachReading: '각자의 사주풀이',
  pairOpen: '궁합풀이 보기',
  pairWhere: '궁합풀이는 두 사람의 궁합 화면에서 이어 읽습니다.',
} as const;
