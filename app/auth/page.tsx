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
      <section className="flex w-full max-w-lg flex-col gap-6 rounded-[1.75rem] border border-border bg-surface p-6 shadow-[var(--shadow-float)] sm:p-10">
      <header className="flex flex-col gap-2">
        <span className="grid size-11 place-items-center rounded-2xl bg-accent-wash font-bold text-accent">命</span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {forCompat ? '궁합은 로그인 후 이용할 수 있습니다' : '로그인'}
        </h1>
        <p className="text-sm leading-6 text-secondary">
          {/*
            궁합 쪽은 제목이 이미 「왜 여기 섰는가」를 다 말한다 — 본문이 그 이유를 한 번 더
            적으면 바로 아래 선 베타 안내까지 같이 안 읽힌다.
          */}
          {!forCompat && '로그인하면 저장한 사람과 사주풀이를 다음에도 이어서 볼 수 있습니다. '}
          지금은 비공개 베타라, 처음 오셨다면 로그인 뒤에 <strong className="font-semibold">테스트 코드</strong>가
          필요합니다.
        </p>
      </header>

      <SignInButton returnTo={returnTo} />

      <Link href="/" className="text-sm text-accent underline underline-offset-2">
        사주 보기로 돌아가기
      </Link>
      </section>
    </main>
  );
}
