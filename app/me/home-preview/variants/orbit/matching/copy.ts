import { MATCH_PILLARS_DISCLOSURE } from '@/src/lib/consent/notice';
import { DISCOVERY_EMPTY, DISCOVERY_TEASER } from '@/src/lib/discovery';
import { REQUEST_RESERVES_NOTE } from '@/src/lib/reading/notes';

/*
  **이 화면의 문구 전부 — 새 것과 기존 것의 구분은 `NOTES.md` 의 표가 든다.**

  기존 문구는 실제 매칭 화면(`app/me/matching/*`)에서 글자 그대로 옮겼고, 정책이 짓는 문장(참고 점수 고지 ·
  빈 목록 · 요청 확인 둘)은 상수를 그대로 읽는다 — 손으로 옮겨 적으면 정책이 바뀐 날 시안만 옛말을 한다.
  새 문구는 넷뿐이다: 지도 범례 둘(`legendSupply` · `legendWaiting`)과 쉬는 사람 자리를 여는 접이(`restingPeek`),
  지도 이름(`mapTitle`).
*/
export const MATCHING_COPY = {
  title: '오늘의 인연',
  lead: '궁합으로 발견하고, 마음으로 선택하세요.',
  tabToday: '오늘의 인연',
  tabPassed: '지나친 인연',
  deckHeader: '나와 맞는 오늘의 인연',
  exploration: '색다른 인연',
  scoreLabel: '나와의 예측 궁합 점수',
  noIntro: '자기소개 없음',
  pass: '다음 인연',
  passAria: '다음 인연으로 지나가기',
  request: '궁합 요청',
  requestAria: '상세 궁합 요청하기',
  undoAria: '이전 인연으로 되돌리기',
  stampPass: '다음 인연',
  stampLike: '궁합이 궁금해요',
  undoBar: '지나친 인연에 보관했어요',
  undo: '실행 취소',
  teaser: DISCOVERY_TEASER,
  /* 상세 창 */
  detailEyebrow: '나의 귀인을 알아가는 시간',
  detailTitle: '왜 나와 잘 맞을까요?',
  detailRequest: '상세 궁합 요청하기',
  close: '닫기',
  /* 요청 확인 창 */
  confirmTitle: (name: string) => `${name} 님에게 상세 궁합을 요청할까요?`,
  confirmNotes: [REQUEST_RESERVES_NOTE, MATCH_PILLARS_DISCLOSURE],
  confirmSend: '요청 보내기',
  cancel: '취소',
  sentPreview: (name: string) => `미리보기예요 — ${name} 님에게 요청은 전송되지 않았어요.`,
  passedSaid: (name: string) => `${name} 님을 지나친 인연에 두었어요.`,
  restoredSaid: (name: string) => `${name} 님을 카드 맨 앞으로 가져왔어요.`,
  /* 빈 자리 */
  emptyTitle: DISCOVERY_EMPTY.title,
  emptyLine: DISCOVERY_EMPTY.line,
  doneTitle: '오늘의 인연을 모두 만났어요',
  doneLine: '지나친 인연을 다시 살펴보거나, 나중에 새로운 인연을 확인해 보세요.',
  /* 지나친 인연 */
  passedOverline: '스쳐간 인연을 다시 만나는 곳',
  passedLead: '잠깐 지나쳤어도, 다시 궁금해질 수 있으니까요.',
  passedOrder: '최근 지나친 순',
  passedInspect: '다시 살펴보기',
  passedBack: '목록으로',
  passedDetailOverline: '다시, 알아가는 시간',
  passedIntroTitle: '이런 사람이에요',
  passedRestore: '다시 만나보기',
  passedRestoreNote: '이 인연을 카드 맨 앞으로 가져와요.',
  passedEmptyTitle: '지나친 인연이 여기에 모여요',
  passedEmptyLine: '다시 궁금해진 사람을 살펴보고, 한 번 더 알아갈 수 있는 자리예요.',
  passedContinue: '오늘의 인연 계속 보기',
  passedKeep: '최근 20명을 보관해요. 목록에서 빠진 인연은 마지막으로 넘긴 뒤 하루가 지나면 다시 추천될 수 있어요.',
  compatScore: '궁합',
  /* 지도 */
  mapTitle: '내 궤도로 다가오는 인연',
  me: '나',
  elementsTitle: '오행 분포',
  legendSupply: '채워 주는 기운',
  legendWaiting: '기다리는 인연',
  /* 참여 전 · 쉬는 중 */
  guideTitle: '먼저 내 사주와 이름이 필요해요',
  guideBody:
    '나와 맞는 인연을 찾으려면 내 사주의 오행 구성이 있어야 해요. 내 사주를 저장하고 닉네임을 지으면 오늘의 인연이 섭니다.',
  guideAction: '내 사주로 가기',
  restingPeek: '인연 찾기를 쉬는 사람에게 서는 자리',
  restingTitle: '인연 찾기를 쉬고 있습니다',
  restingBody:
    '지금은 다른 참여자에게 내 프로필이 공개되지 않으며, 새로운 사람도 소개받지 않습니다. 내 사주와 저장한 사람은 그대로 남아 있습니다.',
  restingAction: '계정 관리 열기',
} as const;

export type MatchingCopy = typeof MATCHING_COPY;
