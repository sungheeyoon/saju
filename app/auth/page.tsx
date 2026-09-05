import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInButton } from './sign-in-button';
import { supabaseOnServer } from './server-client';
import { safeReturnPath } from './return-path';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const returnTo = safeReturnPath((await searchParams).next);
  const supabase = await supabaseOnServer();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(returnTo);

  const forCompat = returnTo === '/compat';

  return (
    <main className="app-shell grid flex-1 place-items-center py-12 sm:py-20">
      <section className="flex w-full max-w-lg flex-col gap-6 rounded-[2rem] border border-border bg-surface p-6 shadow-[var(--shadow-float)] sm:p-10">
      <header className="flex flex-col gap-2">
        <span className="grid size-11 place-items-center rounded-2xl bg-accent-wash font-bold text-accent">命</span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {forCompat ? '궁합을 보려면 로그인해 주세요' : '다시 만나 반가워요'}
        </h1>
        <p className="text-sm leading-6 text-secondary">
          {forCompat
            ? '두 사람의 정보와 결과를 안전하게 다루기 위해 궁합은 로그인 후 이용할 수 있습니다.'
            : '저장한 사람과 사주풀이를 안전하게 관리하려면 로그인이 필요합니다.'}
          {' '}지금은 비공개 베타라, 처음 오셨다면 로그인 뒤에 <strong className="font-semibold">테스트 코드</strong>가
          한 번 필요합니다.
        </p>
      </header>

      <SignInButton returnTo={returnTo} />

      <p className="text-xs text-muted">
        구글 화면에 <code>supabase.co</code> 주소가 함께 보입니다. 이 서비스가 로그인 처리에
        쓰는 곳이라 정상입니다.
      </p>

      <Link href="/" className="text-sm text-accent underline underline-offset-2">
        사주 보기로 돌아가기
      </Link>
      </section>
    </main>
  );
}
