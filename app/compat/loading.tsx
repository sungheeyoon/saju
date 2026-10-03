import { Bone, SkeletonMain } from '../ui/skeleton';

/**
 * 궁합 탭의 뼈대 — 고르는 칸, 궁합풀이 한 줄, 관계 지도(`page.tsx`, 「2026-09-29 u2」).
 *
 * 다른 탭 넷과 같은 까닭이다(ADR 0116) — 로그인을 읽는 동적 화면이라 뼈대가 없으면 누른 뒤 서버 응답이 다 올 때까지 지금
 * 화면에 머문다. 이 폴더는 궁합 첫 화면 하나만 품으므로 무리 폴더가 필요 없다. 익명으로 곧바로 열면 로그인으로 보내는
 * 것이 307 대신 200 + 문서 안의 되돌림이 된다 — 탭 넷과 같은 대가다.
 */
export default function CompatLoading() {
  return (
    <SkeletonMain name="compat" className="app-shell flex flex-1 flex-col gap-10 py-6 sm:gap-14 sm:py-12">
      <div className="flex flex-col gap-4">
        <Bone className="h-8 w-40 rounded-full" />
        <div className="h-72 rounded-[1.25rem] bg-cream" />
      </div>

      <Bone className="h-[4.25rem] rounded-[0.875rem]" />

      <div className="min-h-[22rem] rounded-[1.25rem] bg-cream sm:min-h-[26rem]" />
    </SkeletonMain>
  );
}
