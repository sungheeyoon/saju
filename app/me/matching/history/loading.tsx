import { Bone, SkeletonMain } from '../../../ui/skeleton';

/**
 * 인연 기록의 뼈대 — ← 줄 · 제목 · 인연 궁합 표지 두 권 · 지난 요청(작은 제목과 줄 카드 둘)(`page.tsx` ·
 * `requests-lead.tsx` 의 `PastRequestList`). 표지는 책장의 `PairCover` 처럼 14rem 높이다 — 3:4 비율이면 넓은 화면에서
 * 실제보다 훨씬 높아 다 불러온 순간 아래가 끌려 올라왔다(2026-10-09 화면 갤러리 감사).
 *
 * 「인연 기록」 한 줄을 누르는 즉시 이 뼈대로 넘어간다(ADR 0116). 인연 탭의 뼈대(`../loading.tsx`)는 덱 모양이라 여기 쓰면
 * 목록 화면에 카드 한 장이 번쩍 섰다 사라진다.
 */
export default function MatchHistoryLoading() {
  return (
    <SkeletonMain name="match-history" className="app-shell flex flex-1 flex-col gap-7 py-6 sm:py-10">
      <div className="flex flex-col gap-2">
        <Bone className="h-11 w-16 rounded-full" />
        <Bone className="h-[2.275rem] w-36 rounded-full sm:h-[2.6rem]" />
      </div>

      <div className="flex flex-col gap-4">
        <Bone className="h-8 w-32 rounded-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Bone className="min-h-[14rem] rounded-[0.5rem_1.5rem_1.5rem_0.5rem]" />
          <Bone className="min-h-[14rem] rounded-[0.5rem_1.5rem_1.5rem_0.5rem]" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Bone className="h-8 w-28 rounded-full" />
        <div className="flex flex-col gap-2">
          <Bone className="h-[1.375rem] w-20 rounded-full" />
          <Bone className="h-24 w-full rounded-[1.25rem]" />
          <Bone className="h-24 w-full rounded-[1.25rem]" />
        </div>
      </div>
    </SkeletonMain>
  );
}
