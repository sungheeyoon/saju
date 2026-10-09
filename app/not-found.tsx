import { BUTTON_PRIMARY } from './ui/buttons';
import { Logo } from './ui/logo';
import { TYPE_TITLE } from './ui/surfaces';
import { HomeLink } from './home-link';

/**
 * **어느 라우트에도 안 맞는 주소**와, 제 `not-found` 가 없는 칸의 `notFound()` 가 오는 자리.
 *
 * 없던 동안은 Next 의 영어 기본 화면(「404 | This page could not be found.」)이 섰다. 사람 주소와 공유
 * 링크는 제 화면이 따로 있다(`app/me/compat/not-found.tsx` · `app/share/not-found.tsx`) — 그 둘은 할 수
 * 있는 일이 달라서 여기로 모으지 않는다. 문구는 운영자가 확정했다(2026-09-28, 해요체).
 *
 * **모양은 다른 공개 안내 화면과 같은 가운데 크림 카드다**(`app/auth/denied/page.tsx`) — 넓은 화면에서 카드 없이 왼쪽 위에
 * 붙어 있어 다른 화면과 따로 놀았다(2026-10-09 화면 갤러리 감사).
 */
export default function NotFound() {
  return (
    <main className="app-shell grid w-full flex-1 place-items-center py-12 sm:py-20">
      <section className="flex w-full max-w-lg flex-col gap-6 rounded-[2rem] bg-cream p-6 sm:p-10">
        <header className="flex flex-col gap-2">
          <span className="grid size-16 place-items-center rounded-full bg-surface shadow-card">
            <Logo className="size-10" />
          </span>
          <h1 className={`mt-3 ${TYPE_TITLE}`}>페이지를 찾을 수 없어요</h1>
          <p className="text-[15px] leading-7 text-secondary">주소가 잘못되었거나 페이지가 이동되었을 수 있어요.</p>
        </header>
        <p className="flex flex-col gap-2 sm:flex-row">
          <HomeLink className={BUTTON_PRIMARY}>홈으로</HomeLink>
        </p>
      </section>
    </main>
  );
}
