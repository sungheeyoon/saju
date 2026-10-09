import { Bone, SkeletonMain } from '../../ui/skeleton';

/**
 * 홈의 뼈대 — 인사 · 줄인 내 사주 카드와 그 아래 「다른 사람 사주 보기」 줄 · 내가 받은 사주풀이 표지 · 저장한 사람 타일
 * 차례(`page.tsx`, ADR 0129 「2026-09-29 u2」). 폭 · 열 · 높이는 실제 부품(`home/self-card.tsx` 의 `compact` ·
 * `home/received-readings.tsx` · `(shelf)/readings/shelf.tsx` 의 `row` 표지)을 따른다 — 어긋나면 다 불러온 순간 화면이
 * 출렁인다(2026-10-09 화면 갤러리 감사).
 *
 * **이 무리(`(home)`)는 홈 하나만 품는다.** `app/me/loading.tsx` 로 두면 `/me` 아래 모든 화면(사람 · 계정 관리 · 궁합 ·
 * 인연 결과)이 이 뼈대로 열리고, 그 화면들이 곧바로 보내는 404 · 307 도 스트리밍 뒤의 200 으로 바뀐다(흐름 검사가 그 상태
 * 코드를 잰다, ADR 0116).
 */
export default function HomeLoading() {
  return (
    <SkeletonMain name="home" className="app-shell flex min-w-0 flex-1 flex-col gap-3 py-4 sm:gap-12 sm:py-12">
      {/* 인사는 폰에서 제목으로만 남는다 — 뼈대도 넓은 화면에서만 선다 */}
      <div className="hidden flex-col gap-1 sm:flex">
        <Bone className="h-5 w-32 rounded-full" />
        <Bone className="h-[2.925rem] w-72 max-w-full rounded-full" />
      </div>

      <div className="grid gap-3 sm:gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          {/* 줄인 내 사주 카드 — 폰에서는 오행 칸과 출생 정보 상자가 없어 낮고, 넓은 화면은 그 둘이 선다 */}
          <div className="flex flex-col gap-3 rounded-[2rem] bg-surface p-4 sm:gap-6 sm:p-8">
            <div className="flex flex-col gap-2 sm:gap-3">
              <div className="flex flex-col gap-1">
                <Bone className="h-6 w-20 rounded-full" />
                <Bone className="h-8 w-40 rounded-full sm:h-[2.875rem] sm:w-56" />
              </div>
              <Bone className="h-[1.6rem] w-3/4 rounded-full sm:h-[1.875rem]" />
            </div>
            <Bone className="-mt-2 h-5 w-48 rounded-full sm:mt-0 sm:h-[6.375rem] sm:w-full sm:rounded-[1.25rem]" />
            <div className="hidden flex-col gap-3 sm:flex">
              <Bone className="h-5 w-16 rounded-full" />
              <div className="grid grid-cols-5 gap-3">
                {[0, 1, 2, 3, 4].map((element) => (
                  <Bone key={element} className="h-[9.375rem] rounded-2xl" />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex">
              <Bone className="h-12 rounded-full sm:w-52" />
              <Bone className="h-12 rounded-full sm:w-44" />
            </div>
          </div>
          {/* 「다른 사람 사주 보기」 한 줄 */}
          <Bone className="h-14 w-full rounded-[1.25rem]" />
        </div>

        {/* 내가 받은 사주풀이 — 폰 · md 는 한 줄 셋, lg 는 두 줄 둘(넷째 권은 lg 에서만 선다) */}
        <div className="flex min-w-0 flex-col gap-2 sm:gap-4">
          <Bone className="h-8 w-48 rounded-full" />
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-2">
            {[0, 1, 2, 3].map((book) => (
              <Bone
                key={book}
                className={`min-h-[9rem] rounded-[0.5rem_1.25rem_1.25rem_0.5rem] sm:min-h-[14rem] sm:rounded-[0.5rem_1.5rem_1.5rem_0.5rem] ${book === 3 ? 'hidden lg:block' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Bone className="h-8 w-40 rounded-full" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <Bone className="min-h-44 rounded-[1.5rem]" />
          <Bone className="min-h-44 rounded-[1.5rem]" />
        </div>
      </div>
    </SkeletonMain>
  );
}
