import { Bone, SkeletonMain } from '../../../ui/skeleton';

/**
 * 채팅 목록의 뼈대 — 제목 · 대화방 줄 셋, 넓은 화면은 두 칸 틀(`room-list.tsx` 의 `ChatFrame`).
 *
 * **이 무리(`(rooms)`)는 목록 하나만 품는다.** 방(`[matchId]`)은 없거나 못 보는 방에 404 를 곧바로 보내야 하고(흐름 검사가
 * 그 상태 코드를 잰다), 목록에서 방으로 갈 때는 목록 뼈대가 방 모양도 아니다(ADR 0116).
 */
export default function ChatLoading() {
  return (
    <SkeletonMain name="chat" className="app-shell flex w-full flex-1 flex-col py-6 sm:py-10 lg:py-8">
      <div className="grid min-w-0 flex-1 gap-5 lg:h-[calc(100dvh-8rem)] lg:min-h-[32rem] lg:flex-none lg:grid-cols-[21rem_minmax(0,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 lg:rounded-[2rem] lg:bg-surface lg:p-4 lg:ring-1 lg:ring-border">
          <Bone className="mb-3 h-10 w-24 rounded-full lg:mb-2 lg:h-8" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex min-h-[4.5rem] items-center gap-3 px-2 py-2.5">
              <Bone className="size-12 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Bone className="h-5 w-28 rounded-full" />
                <Bone className="h-4 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden rounded-[2rem] bg-surface ring-1 ring-border lg:block" />
      </div>
    </SkeletonMain>
  );
}
