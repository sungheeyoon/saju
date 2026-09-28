import { Bone, SkeletonMain } from '../../ui/skeleton';

/**
 * 홈의 뼈대 — 인사 · 내 사주와 이번 달 흐름 두 카드 · 내가 받은 사주풀이 표지 차례(`page.tsx`, ADR 0129).
 *
 * **이 무리(`(home)`)는 홈 하나만 품는다.** `app/me/loading.tsx` 로 두면 `/me` 아래 모든 화면(사람 · 계정 관리 · 궁합 ·
 * 인연 결과)이 이 뼈대로 열리고, 그 화면들이 곧바로 보내는 404 · 307 도 스트리밍 뒤의 200 으로 바뀐다(흐름 검사가 그 상태
 * 코드를 잰다, ADR 0116).
 */
export default function HomeLoading() {
  return (
    <SkeletonMain name="home" className="app-shell flex min-w-0 flex-1 flex-col gap-6 py-5 sm:gap-12 sm:py-12">
      {/* 인사는 폰에서 제목으로만 남는다 — 뼈대도 넓은 화면에서만 선다 */}
      <div className="hidden flex-col gap-2 sm:flex">
        <Bone className="h-5 w-32 rounded-full" />
        <Bone className="h-10 w-72 max-w-full rounded-full" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-stretch lg:gap-6">
        <div className="flex min-h-[22rem] flex-col gap-4 rounded-[1.75rem] border border-border bg-surface p-5 sm:min-h-[26rem] sm:p-6">
          <Bone className="h-4 w-20 rounded-full" />
          <Bone className="h-9 w-40 rounded-full" />
          <Bone className="mt-2 h-40 w-full rounded-[1.25rem]" />
          <Bone className="mt-auto h-12 w-36 rounded-full" />
        </div>
        <div className="flex min-h-64 flex-col gap-4 rounded-[2rem] border border-border bg-surface p-5 sm:p-8">
          <Bone className="h-8 w-32 rounded-full" />
          <Bone className="h-24 w-full rounded-[1.5rem]" />
          <Bone className="mt-auto h-20 w-full rounded-xl" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Bone className="h-8 w-48 rounded-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Bone className="min-h-[14rem] rounded-[0.5rem_1.5rem_1.5rem_0.5rem]" />
          <Bone className="min-h-[14rem] rounded-[0.5rem_1.5rem_1.5rem_0.5rem]" />
        </div>
      </div>
    </SkeletonMain>
  );
}
