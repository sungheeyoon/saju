import { Bone, SkeletonMain } from '../../ui/skeleton';

/**
 * 서비스 설문의 뼈대 — 크림 머리 판 한 장, 문항 판 둘(`page.tsx`).
 *
 * 머리글의 톱니에서 여는 화면이다. 탭 넷과 같은 까닭으로 뼈대를 둔다(ADR 0116). 이 폴더는 이 화면 하나만 품고
 * `notFound()` 가 없다.
 */
export default function SurveyLoading() {
  return (
    <SkeletonMain name="survey" className="app-shell flex w-full max-w-2xl flex-1 flex-col gap-6 py-8 sm:py-12">
      <div className="flex min-h-40 flex-col gap-3 rounded-[1.75rem] bg-cream p-6">
        <Bone className="h-9 w-40 rounded-full" />
        <Bone className="h-5 w-full rounded-full" />
        <Bone className="h-5 w-2/3 rounded-full" />
      </div>
      {[0, 1].map((panel) => (
        <div key={panel} className="flex min-h-44 flex-col gap-3 rounded-[1.75rem] border border-border bg-surface p-6">
          <Bone className="h-6 w-48 max-w-full rounded-full" />
          <Bone className="h-12 w-full rounded-2xl" />
          <Bone className="h-12 w-full rounded-2xl" />
        </div>
      ))}
    </SkeletonMain>
  );
}
