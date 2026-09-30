import { Bone, SkeletonMain } from '../../ui/skeleton';

/**
 * 프로필의 뼈대 — 제목 · 한 줄 설명, 사진 칸 줄 · 닉네임 칸 · 소개 칸(`page.tsx` · `form.tsx`).
 *
 * 계정 관리의 첫 줄에서 여는 화면이다. 탭 넷과 같은 까닭으로 뼈대를 둔다(ADR 0116). 이 폴더는 이 화면 하나만 품고
 * `notFound()` 가 없다 — 사진 주소(`/me/photo/…`)는 다른 폴더다.
 */
export default function ProfileLoading() {
  return (
    <SkeletonMain name="profile" className="app-shell flex w-full max-w-2xl flex-1 flex-col gap-6 py-8 sm:py-12">
      <div className="flex flex-col gap-2">
        <Bone className="h-9 w-28 rounded-full" />
        <Bone className="h-5 w-60 max-w-full rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Bone className="aspect-square rounded-2xl" />
        <Bone className="aspect-square rounded-2xl" />
        <Bone className="aspect-square rounded-2xl" />
      </div>
      <div className="flex flex-col gap-2">
        <Bone className="h-5 w-20 rounded-full" />
        <Bone className="h-12 w-full rounded-2xl" />
      </div>
      <div className="flex flex-col gap-2">
        <Bone className="h-5 w-16 rounded-full" />
        <Bone className="h-28 w-full rounded-2xl" />
      </div>
    </SkeletonMain>
  );
}
