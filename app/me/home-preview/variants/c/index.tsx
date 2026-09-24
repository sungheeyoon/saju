import type { VariantProps } from '..';
import { WarningBanner } from '../../shared/warning-banner';
import { ActionTiles } from './action-tiles';
import { PeopleChips } from './people-chips';
import { ProposedMenu } from './proposed-menu';
import { SelfStrip } from './self-strip';

/**
 * C · 행동 중심형 — 홈이 **「무엇을 할까」로 시작한다.**
 *
 * 답하려는 질문은 하나다: 사주·궁합 탭을 없애도 홈에서 그 길을 잃지 않는가. 그래서 명식은 얇은 띠로 물러나고,
 * 사주 · 궁합 · 풀이 · 매칭 · 사람 추가가 같은 크기의 타일로 선다. 새 소식은 띠(`UnreadStrip`) 대신 타일 하나로 든다 —
 * 같은 문구가 두 자리에 서지 않게.
 */
export default function Variant({ state }: VariantProps) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ProposedMenu unread={state.unread} unreadChat={state.unreadChat} />
      <WarningBanner notice={state.warning} />
      {state.self !== null && <SelfStrip self={state.self} />}
      <ActionTiles state={state} />
      <PeopleChips people={state.people} />
    </div>
  );
}
