import { Bone, SkeletonMain } from '../../ui/skeleton';

/**
 * 홈의 뼈대 — 인사 · 줄인 내 사주 카드 · 내가 받은 사주풀이 표지 셋 · 저장한 사람 타일 차례(`page.tsx`, ADR 0129 「2026-09-29 u2」).
 *
 * **이 무리(`(home)`)는 홈 하나만 품는다.** `app/me/loading.tsx` 로 두면 `/me` 아래 모든 화면(사람 · 계정 관리 · 궁합 ·
 * 인연 결과)이 이 뼈대로 열리고, 그 화면들이 곧바로 보내는 404 · 307 도 스트리밍 뒤의 200 으로 바뀐다(흐름 검사가 그 상태
 * 코드를 잰다, ADR 0116).
 */
export default function HomeLoading() {
  return (
    <SkeletonMain name="home" className="app-shell flex min-w-0 flex-1 flex-col gap-4 py-4 sm:gap-12 sm:py-12">
      {/* 인사는 폰에서 제목으로만 남는다 — 뼈대도 넓은 화면에서만 선다 */}
      <div className="hidden flex-col gap-2 sm:flex">
        <Bone className="h-5 w-32 rounded-full" />
        <Bone className="h-10 w-72 max-w-full rounded-full" />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        {/* 줄인 내 사주 카드 — 폰에서는 오행 칸이 없어 낮고, 넓은 화면은 그대로다 */}
        <div className="flex min-h-52 flex-col gap-3 rounded-[1.25rem] bg-surface p-4 sm:min-h-[26rem] sm:gap-4 sm:p-8">
          <Bone className="h-6 w-24 rounded-full" />
          <Bone className="h-9 w-40 rounded-full" />
          <Bone className="h-4 w-48 rounded-full" />
          <Bone className="mt-2 hidden h-32 w-full rounded-[0.875rem] sm:block" />
          <Bone className="mt-auto h-12 w-full rounded-full sm:w-72" />
        </div>

        <div className="flex flex-col gap-3 sm:gap-4">
          <Bone className="h-8 w-48 rounded-full" />
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Bone className="min-h-[9.25rem] rounded-[0.25rem_0.875rem_0.875rem_0.25rem]" />
            <Bone className="min-h-[9.25rem] rounded-[0.25rem_0.875rem_0.875rem_0.25rem]" />
            <Bone className="min-h-[9.25rem] rounded-[0.25rem_0.875rem_0.875rem_0.25rem]" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Bone className="h-8 w-40 rounded-full" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <Bone className="min-h-44 rounded-[1rem]" />
          <Bone className="min-h-44 rounded-[1rem]" />
        </div>
      </div>
    </SkeletonMain>
  );
}
