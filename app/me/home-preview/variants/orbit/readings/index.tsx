import type { VariantProps } from '../..';
import { BottomBar, TopBar } from './menu';
import { readingsModelOf } from './model';
import { ReadingsView } from './view';

/*
  **3차 · 관계 지도의 풀이 — 목록도 지도의 문법으로 읽는다.**

  홈에서 사람은 점이고 이미 본 궁합은 두 점을 잇는 선이었다. 풀이 목록의 줄도 그 모양을 앞에 단다 —
  제목을 읽기 전에 「한 사람의 글인가, 두 사람의 글인가, 누구인가」가 보이게. 목록 위의 작은 궤도는 글이 있는
  관계만 그리고, 점을 누르면 목록이 그 사람의 글로 좁혀진다. 글은 데스크톱에서 옆 칸, 폰에서 목록 자리에 선다.

  모양과 차례의 까닭은 `view.tsx` 머리말, 문구는 `copy.ts`, 새 것과 기존 것의 구분은 `NOTES.md` 가 든다.
*/
export default function Screen({ state }: VariantProps) {
  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <TopBar unread={state.unread} unreadChat={state.unreadChat} current="/me/readings" />
      <ReadingsView model={readingsModelOf(state)} hasSelf={state.self !== null} />
      <BottomBar unreadChat={state.unreadChat} current="/me/readings" />
    </div>
  );
}
