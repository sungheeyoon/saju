import { Bone, SkeletonMain } from '../../ui/skeleton';

/**
 * 소식의 뼈대 — 제목 · 구역 제목 · 소식 줄 넷(`page.tsx`).
 *
 * 머리글의 종이 여는 화면이다. 탭 넷 · 톱니 안 화면과 같은 까닭으로 뼈대를 둔다(ADR 0116) — 종을 누르면 서버가 소식을
 * 다 읽을 때까지 지금 화면에 머물러, 눌렸는지 모르는 채 한 번 더 누르게 됐다. 이 폴더는 이 화면 하나만 품고 `notFound()` 가
 * 없다. 관문(`proxy.ts`)이 로그인을 먼저 보므로 화면의 로그인 되돌림은 뼈대 뒤에 설 일이 거의 없다.
 */
export default function RequestsLoading() {
  return (
    <SkeletonMain name="requests" className="app-shell flex w-full max-w-2xl flex-1 flex-col gap-8 py-8 sm:py-12">
      <Bone className="h-9 w-24 rounded-full" />
      <div className="flex flex-col gap-3">
        <Bone className="h-7 w-28 rounded-full" />
        <div className="flex flex-col overflow-hidden rounded-[1.5rem] border border-border bg-surface">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-start gap-3 border-t border-border px-4 py-4 first:border-t-0">
              <Bone className="size-10 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Bone className="h-4 w-4/5 rounded-full" />
                <Bone className="h-3 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonMain>
  );
}
