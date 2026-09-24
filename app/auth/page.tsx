import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BUTTON_TERTIARY } from '../ui/buttons';
import { Logo } from '../ui/logo';
import { TYPE_TITLE } from '../ui/surfaces';
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
  if (data.user) redirect(returnTo === '/#resume-reading' ? '/signup?resume=reading' : returnTo);

  const forCompat = returnTo === '/compat';
  const forReading = returnTo === '/#resume-reading';

  return (
    <main className="app-shell grid flex-1 place-items-center py-12 sm:py-20">
      <section className="flex w-full max-w-lg flex-col gap-6 rounded-[2rem] bg-cream p-6 sm:p-10">
      <header className="flex flex-col gap-2">
        <span className="grid size-16 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]">
          <Logo className="size-10" />
        </span>
        <h1 className={`mt-3 ${TYPE_TITLE}`}>
          {forCompat ? '궁합은 로그인 후 이용할 수 있습니다' : forReading ? '내 사주풀이로 이어갈까요?' : '로그인'}
        </h1>
        <p className="text-[15px] leading-7 text-secondary">
          {/*
            궁합 쪽은 제목이 이미 「왜 여기 섰는가」를 다 말한다 — 본문이 그 이유를 한 번 더
            적으면 바로 아래 선 베타 안내까지 같이 안 읽힌다.
          */}
          {forReading && '로그인 후 방금 확인한 사주로 돌아갑니다. 출생 정보를 저장하면 사주풀이를 받을 수 있습니다. '}
          {!forCompat && !forReading && '로그인하면 저장한 사람과 사주풀이를 다음에도 이어서 볼 수 있습니다. '}
          지금은 비공개 베타라, 처음 오셨다면 로그인 뒤에 <strong className="font-semibold">테스트 코드</strong>가
          필요합니다.
        </p>
      </header>

      <SignInButton returnTo={returnTo} />

      <Link href="/" className={`${BUTTON_TERTIARY} w-fit`}>
        사주로 돌아가기
      </Link>
      </section>
    </main>
  );
}
