import { Bone, SkeletonMain } from '../../ui/skeleton';

/**
 * 프로필의 뼈대 — 제목 · 한 줄 설명, 크림 사진 판(큰 대표 2×2 · 작은 칸 다섯), 흰 판의 닉네임 · 소개 · 저장 줄
 * (`page.tsx` · `photo-grid.tsx` · `form.tsx`). 사진 판이 같은 크기 정사각형 셋이면 다 불러온 순간 화면이 출렁였다
 * (2026-10-09 화면 갤러리 감사) — 판의 배치가 바뀌면 이 뼈대도 함께 고친다. 넓은 화면(`lg`)에서는 실제처럼 폭이
 * `max-w-4xl` 로 넓어지고 사진 판(22rem)과 글 판이 나란히 선다(`form.tsx`).
 *
 * 계정 관리의 첫 줄에서 여는 화면이다. 탭 넷과 같은 까닭으로 뼈대를 둔다(ADR 0116). 이 폴더는 이 화면 하나만 품고
 * `notFound()` 가 없다 — 사진 주소(`/me/photo/…`)는 다른 폴더다.
 */
export default function ProfileLoading() {
  return (
    <SkeletonMain name="profile" className="app-shell flex w-full max-w-2xl flex-1 flex-col gap-6 py-8 sm:py-12 lg:max-w-4xl">
      <div className="flex flex-col gap-1">
        <Bone className="h-[2.275rem] w-28 rounded-full sm:h-[2.6rem]" />
        <Bone className="h-5 w-60 max-w-full rounded-full" />
      </div>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4 rounded-[2rem] bg-cream px-4 py-5 sm:px-6 sm:py-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Bone className="col-span-2 row-span-2 h-full rounded-2xl" />
            {[2, 3, 4, 5, 6].map((position) => (
              <Bone key={position} className="aspect-[3/4] rounded-2xl" />
            ))}
          </div>
          <Bone className="h-5 w-3/4 rounded-full" />
        </div>

        <div className="flex flex-col gap-5 rounded-[1.5rem] border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-col gap-1.5">
            <Bone className="h-5 w-14 rounded-full" />
            <div className="flex items-center gap-2">
              <Bone className="h-12 min-w-0 flex-1 rounded-2xl sm:max-w-64" />
              <Bone className="h-12 w-24 shrink-0 rounded-full" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Bone className="h-5 w-20 rounded-full" />
            <Bone className="h-[6.125rem] w-full rounded-2xl" />
          </div>
          <div className="border-t border-border pt-5">
            <Bone className="h-12 w-full rounded-full sm:w-36" />
          </div>
        </div>
      </div>
    </SkeletonMain>
  );
}
