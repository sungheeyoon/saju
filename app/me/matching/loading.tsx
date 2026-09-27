import { Bone, SkeletonMain } from '../../ui/skeleton';

/**
 * 오늘의 인연의 뼈대 — 제목 줄 · 카드 한 장, 넓은 화면은 그 옆에 궤도 지도(`matching-experience.tsx`).
 *
 * 이 폴더 아래는 예시 화면(`preview`)뿐이고 같은 모양이라 함께 이 뼈대를 쓴다(ADR 0116).
 */
export default function MatchingLoading() {
  return (
    <SkeletonMain name="matching" className="app-shell flex min-w-0 flex-1 flex-col gap-5 py-6 sm:gap-7 sm:py-10">
      <div className="flex flex-row items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Bone className="h-5 w-28 rounded-full" />
          <Bone className="h-10 w-48 max-w-full rounded-full" />
        </div>
        <Bone className="h-11 w-28 rounded-full sm:w-64" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:flex-none lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex min-h-[28rem] flex-1 flex-col justify-end gap-3 rounded-[1.75rem] border border-border bg-surface p-5 lg:h-[36rem] lg:flex-none">
          <Bone className="h-10 w-40 rounded-full" />
          <Bone className="h-5 w-full rounded-full" />
          <Bone className="h-5 w-2/3 rounded-full" />
        </div>
        <div className="hidden h-[30rem] rounded-[2rem] bg-cream lg:block" />
      </div>
    </SkeletonMain>
  );
}
