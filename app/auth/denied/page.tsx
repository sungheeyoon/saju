import Link from 'next/link';

/**
 * 관문에 막힌 자리.
 *
 * 계정은 만들어지지 않았다 — 「가입은 됐는데 아무것도 못 하는 계정」을 남기지 않으려고
 * 관문을 DB 훅에 걸었기 때문이다. 그래서 나중에 초대 명단에 들어가면, 그때 처음
 * 가입하는 것과 똑같이 들어온다. 여기서 할 수 있는 일이 없는 것이 정상이다.
 */
export default function DeniedPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-16 sm:px-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">초대된 주소가 아닙니다</h1>
        <p className="text-sm text-secondary">
          계정은 만들어지지 않았습니다. 초대받은 주소로 다시 로그인하시거나, 초대를 받은 뒤
          같은 자리에서 다시 시도하시면 됩니다.
        </p>
      </header>

      <p className="text-sm text-secondary">
        로그인 없이 쓰는 사주·궁합 화면은 그대로 열려 있습니다.
      </p>

      <p className="flex gap-4 text-sm">
        <Link href="/auth" className="text-accent underline underline-offset-2">
          다시 로그인
        </Link>
        <Link href="/" className="text-accent underline underline-offset-2">
          사주 보기
        </Link>
      </p>
    </main>
  );
}
