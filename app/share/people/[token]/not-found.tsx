import Link from 'next/link';

/**
 * 열리지 않는 공유 링크.
 *
 * 이유를 넷으로 가르지 않는다 — 주소를 잘못 옮겨 적었든, 보낸 사람이 계정을
 * 지웠든, 애초에 없던 토큰이든 문은 0행으로 답한다. 그 이상을 말하려면 **없는
 * 토큰과 있는 토큰을 가르는 답**을 내줘야 하고, 그러면 주소를 찍어 보는 사람에게
 * 어느 것이 실재하는지 알려 주게 된다.
 *
 * 대신 **여기서 할 수 있는 일**을 남긴다. 링크를 받고 들어온 사람이니, 막다른 자리에
 * 세워 두지 않고 서비스로 가는 길을 준다.
 */
export default function SharedReadingNotFound() {
  return (
    <main className="app-shell flex flex-1 flex-col items-center justify-center gap-5 py-16 text-center sm:py-24">
      <span className="grid size-12 place-items-center rounded-2xl bg-surface-sunken text-xl text-muted" aria-hidden="true">
        ✦
      </span>
      <div className="flex max-w-sm flex-col gap-2">
        <h1 className="text-xl font-bold tracking-[-0.03em]">열 수 없는 링크입니다</h1>
        <p className="text-sm leading-6 text-secondary">
          주소가 잘못됐거나 더 이상 남아 있지 않은 풀이입니다. 보낸 분에게 링크를 다시
          받아 주세요.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent shadow-sm hover:bg-accent-strong"
      >
        만세력 둘러보기
      </Link>
    </main>
  );
}
