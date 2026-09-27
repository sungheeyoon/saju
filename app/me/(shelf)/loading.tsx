import { Bone, SkeletonMain } from '../../ui/skeleton';

/**
 * 풀이의 뼈대 — 책장(제목 · 구역 둘의 표지), 넓은 화면은 그 옆에 글 한 칸(`readings/frame.tsx`).
 *
 * **책장 위에 선다.** 풀이는 레이아웃(`readings/layout.tsx`)이 로그인 · 계정 · 목록을 읽는다. `loading.tsx` 는 같은 폴더의
 * 레이아웃을 감싸지 않으므로 `readings/` 안에 두면 누른 뒤 그 레이아웃이 다 읽힐 때까지 여전히 멈춘다 — 그래서 `readings`
 * 를 이 무리(`(shelf)`)에 넣고 뼈대를 그 바깥에 둔다. 책장 안에서 글을 옮겨 다닐 때는 레이아웃이 그대로라 이 뼈대가 안 선다(ADR 0116).
 */
export default function ReadingsLoading() {
  return (
    <SkeletonMain name="readings" className="app-shell flex flex-1 flex-col py-9 sm:py-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <div className="flex min-w-0 flex-col gap-10">
          <Bone className="h-10 w-40 rounded-full" />
          {[0, 1].map((shelf) => (
            <div key={shelf} className="flex flex-col gap-4">
              <Bone className="h-8 w-28 rounded-full" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
                <Bone className="min-h-[14rem] rounded-[0.5rem_1.5rem_1.5rem_0.5rem]" />
                <Bone className="min-h-[14rem] rounded-[0.5rem_1.5rem_1.5rem_0.5rem]" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden min-h-80 flex-col gap-4 rounded-[1.75rem] border border-border bg-surface p-6 lg:flex">
          <Bone className="h-9 w-56 rounded-full" />
          <Bone className="h-5 w-full rounded-full" />
          <Bone className="h-5 w-5/6 rounded-full" />
          <Bone className="h-5 w-2/3 rounded-full" />
        </div>
      </div>
    </SkeletonMain>
  );
}
