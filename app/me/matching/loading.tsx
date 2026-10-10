import { Bone, SkeletonMain } from '../../ui/skeleton';

/**
 * 오늘의 인연의 뼈대 — 제목 줄(날짜 · 제목 / 보기 전환) · 카드 한 장과 그 아래 단추 줄, 넓은 화면은 그 옆에 크림 궤도 판 ·
 * 인연 기록 한 줄(`matching-experience.tsx` · `today-card.tsx` · `history-row.tsx`).
 *
 * **폰에서는 카드가 실제와 같이 뷰포트에 묶인다** — 카드 자리에 `data-deck-fit` 을 달아 `globals.css` 의 같은 규칙이 문서를
 * 화면 높이에 묶고, 카드가 제목 줄과 독 사이의 남는 높이를 다 쓴다. 고정 높이(28rem)였을 때는 다 불러온 순간 카드 높이가
 * 바뀌고 단추 줄이 새로 섰다(2026-10-09 화면 갤러리 감사). 넓은 화면의 카드는 실제처럼 4:5 다.
 *
 * 탭을 누르는 즉시 이 뼈대로 넘어간다(ADR 0116).
 */
export default function MatchingLoading() {
  return (
    <SkeletonMain name="matching" className="app-shell flex min-w-0 flex-1 flex-col gap-3 py-6 sm:gap-7 sm:py-12">
      <div className="flex flex-row items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Bone className="h-5 w-28 rounded-full" />
          <Bone className="h-[2.275rem] w-48 max-w-full rounded-full sm:h-[2.925rem]" />
        </div>
        <Bone className="h-11 w-32 shrink-0 rounded-full sm:h-[3.25rem] sm:w-72" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:flex-none lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 lg:flex-none lg:gap-4">
          <div data-deck-fit="" className="relative flex min-h-0 flex-1 flex-col lg:aspect-[4/5] lg:flex-none">
            <Bone className="min-h-0 flex-1 rounded-[2rem]" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Bone className="size-14 shrink-0 rounded-full" />
            <Bone className="h-14 flex-1 rounded-full" />
            <Bone className="h-14 flex-[1.3] rounded-full" />
          </div>
        </div>
        <div className="hidden min-w-0 flex-col gap-4 lg:flex">
          <div className="flex flex-col rounded-[2rem] bg-cream">
            <div className="px-6 pt-6">
              <Bone className="h-8 w-56 rounded-full" />
            </div>
            <div className="flex items-center px-8 py-4">
              <Bone className="mx-auto aspect-square w-full max-w-[32rem] rounded-full" />
            </div>
            <div className="px-6 pb-4">
              <Bone className="h-5 w-64 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <Bone className="h-[3.25rem] w-full shrink-0 rounded-[1.25rem]" />
    </SkeletonMain>
  );
}
