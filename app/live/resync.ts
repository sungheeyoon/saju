import { ALL_SIGNALS, redrawsOnResync } from './changes';

/** 다시 대조가 하는 일의 손 — 라이브 층(`live-updates.tsx`)이 브라우저에 잇는다 */
export type ResyncHands = {
  /** 머리글의 딱지 신호를 낸다 */
  readonly announce: (signals: readonly string[]) => void;
  /** 방과 목록에 「어느 방인지 모르게 바뀌었다」를 낸다 */
  readonly chatMoved: () => void;
  /** 서버가 그리는 지금 화면을 표지를 실어 다시 그린다(`redraw-mark.ts` — 활동이 아니다, G-76) */
  readonly redraw: () => void;
};

/**
 * **다시 대조** — 딱지를 다시 세고, 방을 다시 읽고, 지금 화면이 어느 갈래로든 다시 그리는 목록이면 한 번 다시 그린다.
 *
 * 채널이 **처음 선 때도 다시 선 때와 같다.** 서버가 목록을 그린 뒤 채널이 서기 전의 변경은 어느 사건으로도 오지 않는다 —
 * 처음 선 때를 건너뛰면 받는 쪽이 손댈 때까지 옛 목록이 남는다. 그 다시 그리기가 활동으로 적히던 것은 표지가 막는다.
 */
export function resyncScreen(pathname: string, hands: ResyncHands): void {
  hands.announce(ALL_SIGNALS);
  hands.chatMoved();
  if (redrawsOnResync(pathname)) hands.redraw();
}
