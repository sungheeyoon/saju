import Link from 'next/link';

/**
 * **없는 사람과 못 보는 사람이 도착하는 같은 자리.**
 *
 * 「그런 사람이 없습니다」와 「볼 수 없습니다」를 가르면, 그 차이만으로 어떤 Person 이
 * 실재하는지 알아낼 수 있다. 그래서 두 경우가 이 한 화면으로 온다 — 화면이 둘인데
 * 문장만 맞춰 적는 것이 아니라, 애초에 **한 화면**이다(ADR 0007 「이행」).
 *
 * 문장도 둘 중 어느 쪽인지 말하지 않는다. 사용자가 할 수 있는 일만 적는다.
 */
export default function PersonNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-12 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight">찾을 수 없습니다</h1>
      <p className="text-sm text-secondary">
        주소에 적힌 사람을 찾지 못했습니다. 목록에서 다시 골라 주세요.
      </p>
      <p className="flex flex-wrap gap-4 text-sm">
        <Link href="/me/compat" className="text-accent underline underline-offset-2">
          두 사람 고르기
        </Link>
        <Link href="/me/people" className="text-accent underline underline-offset-2">
          저장한 사람
        </Link>
      </p>
    </main>
  );
}
