import { EmptyReader } from './shelf';

export const metadata = {
  title: '풀이 보관함',
  description: '내가 만든 사주풀이와 궁합풀이를 종류별로 확인합니다.',
};

/**
 * 목록 주소의 **오른쪽 칸.** 책장은 레이아웃이 든다(`layout.tsx`) — 이 주소에서 폰은 책장만 보이고,
 * 넓은 화면은 책장 옆에 이 칸이 선다. 켠 칩에 펼칠 글이 있으면 `frame.tsx` 가 그 글로 옮긴다 — 그 칩에서 마지막으로 연 글이 먼저다(`opening.ts`).
 */
export default function ReadingsPage() {
  return <EmptyReader />;
}
