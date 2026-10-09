import { Bone, SkeletonMain } from '../../ui/skeleton';

/**
 * 서비스 설문의 뼈대 — 크림 머리 판(`PAPER`: 제목 · 몇 줄의 안내 · 한 줄), 문항 판 둘(묻는 줄 · 안내 · 고르는 줄 넷)
 * (`page.tsx` · `form.tsx`). 판의 모서리 · 안쪽 여백 · 줄 높이를 실제 판에 맞춘다 — 낮은 판이면 다 불러온 순간 화면이
 * 출렁였다(2026-10-09 화면 갤러리 감사).
 *
 * 머리글의 톱니에서 여는 화면이다. 탭 넷과 같은 까닭으로 뼈대를 둔다(ADR 0116). 이 폴더는 이 화면 하나만 품고
 * `notFound()` 가 없다.
 */
export default function SurveyLoading() {
  return (
    <SkeletonMain name="survey" className="app-shell flex w-full max-w-2xl flex-1 flex-col gap-6 py-8 sm:py-12">
      <div className="flex flex-col gap-2 rounded-[2rem] bg-cream p-6 sm:p-8">
        <Bone className="h-[2.275rem] w-56 max-w-full rounded-full sm:h-[2.6rem]" />
        <div className="flex flex-col gap-2 py-1">
          <Bone className="h-5 w-full rounded-full" />
          <Bone className="h-5 w-full rounded-full" />
          <Bone className="h-5 w-full rounded-full" />
          <Bone className="h-5 w-1/2 rounded-full" />
        </div>
        <Bone className="h-5 w-44 rounded-full" />
      </div>
      <div className="flex flex-col gap-5">
        {[0, 1].map((panel) => (
          <div key={panel} className="flex flex-col gap-3 rounded-[1.5rem] border border-border bg-surface p-5 sm:p-6">
            <Bone className="h-7 w-64 max-w-full rounded-full" />
            <Bone className="h-5 w-28 rounded-full" />
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((choice) => (
                <Bone key={choice} className="h-12 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonMain>
  );
}
