import { Bone, SkeletonMain } from '../../../ui/skeleton';

/**
 * 인연 기록의 뼈대 — ← 줄 · 제목 · 인연 궁합 표지 두 권 · 지난 요청 두 줄(`page.tsx`).
 *
 * 「인연 기록」 한 줄을 누르는 즉시 이 뼈대로 넘어간다(ADR 0116). 인연 탭의 뼈대(`../loading.tsx`)는 덱 모양이라 여기 쓰면
 * 목록 화면에 카드 한 장이 번쩍 섰다 사라진다.
 */
export default function MatchHistoryLoading() {
  return (
    <SkeletonMain name="match-history" className="app-shell flex flex-1 flex-col gap-7 py-6 sm:py-10">
      <div className="flex flex-col gap-2">
        <Bone className="h-11 w-16 rounded-full" />
        <Bone className="h-9 w-36 rounded-full" />
      </div>

      <div className="flex flex-col gap-4">
        <Bone className="h-8 w-32 rounded-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Bone className="aspect-[3/4] rounded-[1.5rem]" />
          <Bone className="aspect-[3/4] rounded-[1.5rem]" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Bone className="h-8 w-28 rounded-full" />
        <Bone className="h-16 w-full rounded-[1.25rem]" />
        <Bone className="h-16 w-full rounded-[1.25rem]" />
      </div>
    </SkeletonMain>
  );
}
