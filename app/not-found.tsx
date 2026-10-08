import { BUTTON_PRIMARY } from './ui/buttons';
import { TYPE_TITLE } from './ui/surfaces';
import { HomeLink } from './home-link';

/**
 * **어느 라우트에도 안 맞는 주소**와, 제 `not-found` 가 없는 칸의 `notFound()` 가 오는 자리.
 *
 * 없던 동안은 Next 의 영어 기본 화면(「404 | This page could not be found.」)이 섰다. 사람 주소와 공유
 * 링크는 제 화면이 따로 있다(`app/me/compat/not-found.tsx` · `app/share/not-found.tsx`) — 그 둘은 할 수
 * 있는 일이 달라서 여기로 모으지 않는다. 문구는 운영자가 확정했다(2026-09-28, 해요체).
 */
export default function NotFound() {
  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-4 py-10 sm:py-14">
      <h1 className={TYPE_TITLE}>페이지를 찾을 수 없어요</h1>
      <p className="text-[15px] leading-6 text-secondary">
        주소가 잘못되었거나 페이지가 이동되었을 수 있어요.
      </p>
      <p className="flex flex-wrap gap-2">
        <HomeLink className={BUTTON_PRIMARY}>
          홈으로
        </HomeLink>
      </p>
    </main>
  );
}
