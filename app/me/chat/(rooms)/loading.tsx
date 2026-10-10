import { Bone, SkeletonMain } from '../../../ui/skeleton';

/**
 * 채팅 목록의 뼈대 — 제목 · 대화방 줄 셋, 넓은 화면은 두 칸 틀(`room-list.tsx` 의 `ChatFrame` · `RoomList` · `RoomRow`).
 * 제목의 여백 · 줄의 사진(56px) · 넓은 화면의 판 안쪽 여백을 실제 목록에 맞춘다 — 어긋나면 다 불러온 순간 줄이
 * 밀렸다(2026-10-09 화면 갤러리 감사).
 *
 * **이 무리(`(rooms)`)는 목록 하나만 품는다.** 방(`[matchId]`)은 없거나 못 보는 방에 404 를 곧바로 보내야 하고(흐름 검사가
 * 그 상태 코드를 잰다), 목록에서 방으로 갈 때는 목록 뼈대가 방 모양도 아니다(ADR 0116).
 */
export default function ChatLoading() {
  return (
    <SkeletonMain name="chat" className="app-shell flex w-full flex-1 flex-col py-6 sm:py-12 lg:py-8">
      <div className="grid min-w-0 flex-1 gap-5 lg:h-[calc(100dvh-8rem)] lg:min-h-[32rem] lg:flex-none lg:grid-cols-[21rem_minmax(0,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col lg:rounded-[2rem] lg:bg-surface lg:ring-1 lg:ring-border">
          <div className="pb-4 lg:px-6 lg:pb-2 lg:pt-5">
            <Bone className="h-[2.275rem] w-24 rounded-full sm:h-[2.6rem] lg:h-[1.95rem]" />
          </div>
          <div className="-mx-2 flex flex-col gap-0.5 lg:mx-0 lg:p-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex min-h-[4.5rem] items-center gap-3 px-2 py-2.5 lg:px-3">
                <Bone className="size-14 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Bone className="h-5 w-28 rounded-full" />
                  <Bone className="h-4 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden rounded-[2rem] bg-surface ring-1 ring-border lg:block" />
      </div>
    </SkeletonMain>
  );
}
