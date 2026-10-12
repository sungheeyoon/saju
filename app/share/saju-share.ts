/**
 * 받은 사주풀이 공유본의 머리 한 줄과 끝의 초대 — 내 풀이(`app/share/readings/[token]/page.tsx`)와 저장한 사람의 풀이
 * (`app/share/people/[token]/page.tsx`)가 같은 글자로 선다. 받은 사람에게는 둘 다 「사주풀이」 한 편이라 두 벌로 적지 않는다.
 * 궁합풀이 공유본(`app/share/compat/[token]/page.tsx`)은 글이 달라 제 자리에 둔다.
 */
export const SAJU_SHARE_EYEBROW = '공유받은 사주풀이';

export const SAJU_SHARE_INVITATION = {
  heading: '내 사주도 직접 읽어보세요',
  note: '생년월일시를 입력하면 나만의 사주를 확인하고, 그 근거를 바탕으로 풀이를 받아볼 수 있어요.',
} as const;
