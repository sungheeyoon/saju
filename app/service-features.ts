import type { IconName } from './ui/icons';

/**
 * **서비스가 하는 일 넷** — 사주 · 사주풀이 · 궁합 · 인연.
 *
 * 서비스 소개(`about/page.tsx`)가 넷을, 로그인 전 첫 화면의 「할 수 있는 것」(`landing-guide.tsx`)이 사주를 뺀 셋을 카드로
 * 세운다. 첫 화면은 `note`(로그인 · 풀이권 조건)를 싣지 않는다 — 홈은 무엇을 하는지만 말한다(운영자 결정 2026-10-08).
 * 사실은 PRD 「화면」 · 「자원」 절이 말하는 것만 적는다 — 수(풀이권 몇 개 · 저장 몇 명)는 운영 중에 바뀌므로 안 적는다.
 */
export const SERVICE_FEATURES: readonly { icon: IconName; title: string; body: string; note: string }[] = [
  {
    icon: 'spark',
    title: '사주',
    body: '생년월일시를 넣으면 여덟 글자와 오행을 바로 볼 수 있어요.',
    note: '로그인 없이 볼 수 있어요',
  },
  {
    icon: 'reading',
    title: '사주풀이',
    body: '내 사주와 저장한 사람의 사주를 글로 풀어 드려요.',
    note: '로그인 · 풀이권 1번',
  },
  {
    icon: 'taiji',
    title: '궁합',
    body: '두 사람을 골라 궁합을 보고, 궁합풀이를 받아요. 저장하지 않은 사람과도 볼 수 있어요.',
    note: '로그인 · 풀이는 풀이권 1번',
  },
  {
    icon: 'people',
    title: '인연',
    body: '다른 사람에게 궁합을 요청하고, 서로 동의하면 인연 궁합이 열리고 대화를 나눌 수 있어요.',
    note: '로그인 · 요청할 때 풀이권 1번 예약',
  },
];

