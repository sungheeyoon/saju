import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInButton } from './sign-in-button';
import { supabaseOnServer } from './server-client';

export default async function SignInPage() {
  const supabase = await supabaseOnServer();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/me');

  return (
    <main className="app-shell grid flex-1 place-items-center py-12 sm:py-20">
      <section className="flex w-full max-w-lg flex-col gap-6 rounded-[2rem] border border-border bg-surface p-6 shadow-[var(--shadow-float)] sm:p-10">
      <header className="flex flex-col gap-2">
        <span className="grid size-11 place-items-center rounded-2xl bg-accent-wash font-bold text-accent">命</span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">다시 만나 반가워요</h1>
        <p className="text-sm leading-6 text-secondary">
          지금은 초대받은 분만 들어올 수 있습니다. 초대받지 않은 주소로는 계정이 만들어지지
          않습니다.
        </p>
      </header>

      <SignInButton />

      <p className="text-xs text-muted">
        구글 화면에 <code>supabase.co</code> 주소가 함께 보입니다. 이 서비스가 로그인 처리에
        쓰는 곳이라 정상입니다.
      </p>

      <p className="text-sm">
        <Link href="/" className="text-accent underline underline-offset-2">
          로그인 없이 명식 보기
        </Link>
      </p>
      </section>
    </main>
  );
}
