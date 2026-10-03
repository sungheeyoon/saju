import { Bone, SkeletonMain } from '../../ui/skeleton';

/**
 * 계정 관리의 뼈대 — 제목 · 한 줄 설명, 무리 넷(작은 제목 · 흰 판)(`page.tsx`).
 *
 * 머리글의 톱니에서 여는 화면이다. 탭 넷과 같은 까닭으로 뼈대를 둔다(ADR 0116) — 로그인을 읽는 동적 화면이라 뼈대가
 * 없으면 누른 뒤 서버 응답이 다 올 때까지 지금 화면에 머문다. 이 폴더는 이 화면 하나만 품고 `notFound()` 가 없다.
 */
export default function SettingsLoading() {
  return (
    <SkeletonMain name="settings" className="app-shell flex w-full max-w-2xl flex-1 flex-col gap-8 py-8 sm:py-12">
      <div className="flex flex-col gap-2">
        <Bone className="h-9 w-36 rounded-full" />
        <Bone className="h-5 w-64 max-w-full rounded-full" />
      </div>
      {[0, 1, 2, 3].map((group) => (
        <div key={group} className="flex flex-col gap-2">
          <Bone className="mx-1 h-6 w-28 rounded-full" />
          <Bone className="h-[4.5rem] w-full rounded-[1rem]" />
        </div>
      ))}
    </SkeletonMain>
  );
}
