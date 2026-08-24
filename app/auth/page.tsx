import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInButton } from './sign-in-button';
import { supabaseOnServer } from './server-client';

export default async function SignInPage() {
  const supabase = await supabaseOnServer();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/me');

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-16 sm:px-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
        <p className="text-sm text-secondary">
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
          로그인 없이 사주 보기
        </Link>
      </p>
    </main>
  );
}
