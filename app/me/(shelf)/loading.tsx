import { Bone, SkeletonMain } from '../../ui/skeleton';

/**
 * 풀이의 뼈대 — 책장(제목 · 종류 칩 · 구역 둘의 제목 · 설명 · 표지), 넓은 화면은 그 옆에 글 한 칸(`readings/frame.tsx` ·
 * `readings/shelf.tsx`). 칩 줄과 구역 설명이 없으면 다 불러온 순간 표지가 아래로 밀렸다(2026-10-09 화면 갤러리 감사).
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
          {/* 머리 — 제목과 풀이 종류 칩 넷(`ShelfHead`). 폰에서는 머리글 아래 붙는 띠라 위아래 여백이 있다 */}
          <div className="flex flex-col gap-3 pb-3 pt-2 lg:p-0">
            <Bone className="h-[2.275rem] w-40 rounded-full sm:h-[2.6rem]" />
            <div className="flex gap-2">
              {['w-14', 'w-20', 'w-20', 'w-20'].map((width, at) => (
                <Bone key={at} className={`h-9 shrink-0 rounded-full ${width}`} />
              ))}
            </div>
          </div>
          {[0, 1].map((shelf) => (
            <div key={shelf} className="flex flex-col gap-4">
              <div className="flex flex-col gap-0.5">
                <Bone className="h-8 w-28 rounded-full" />
                <Bone className="h-5 w-56 max-w-full rounded-full" />
              </div>
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
