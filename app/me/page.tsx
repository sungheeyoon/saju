import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseOnServer } from '../auth/server-client';

/**
 * 로그인한 사람이 도착하는 자리.
 *
 * 아직 자기 사주를 등록하는 화면이 없다. 지금 이 화면이 확인하는 것은 세로로 뚫렸는가
 * 하나다 — 초대된 주소로 들어왔고, 계정 행이 따라 생겼고, 다시 접속해도 같은 사람으로
 * 보이는가. 등록 화면은 이 다음에 붙는다.
 */
export default async function MePage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  /**
   * 계정 행은 가입할 때 트리거가 만든다. 여기서 만들지 않는다 — 만들기 시작하면
   * 「이 화면을 안 거친 계정」이 생기고, 그 계정은 어디서 만들어지는지 아무도 모른다.
   *
   * 정책이 자기 행만 내주므로 `where` 를 적지 않는다. 적으면 판정하는 자리가 둘이 된다.
   */
  const { data: account } = await supabase
    .from('app_user')
    .select('status, self_person_id, created_at')
    .maybeSingle();

  const signOut = async () => {
    'use server';
    const client = await supabaseOnServer();
    await client.auth.signOut();
    redirect('/');
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-16 sm:px-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">내 계정</h1>
        <p className="text-sm text-secondary">{user.email}</p>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-border bg-surface p-4 text-sm">
        <dt className="text-muted">계정 상태</dt>
        <dd>{account?.status ?? '확인할 수 없습니다'}</dd>
        <dt className="text-muted">내 사주</dt>
        <dd>{account?.self_person_id ? '등록됨' : '아직 등록하지 않았습니다'}</dd>
      </dl>

      <p className="text-sm text-secondary">
        자기 사주를 등록하는 화면은 아직 없습니다. 지금은 로그인 없이 쓰는 화면에서 계산하고,
        링크로 나눠 주세요.
      </p>

      <div className="flex items-center gap-4 text-sm">
        <Link href="/" className="text-accent underline underline-offset-2">
          사주 보기
        </Link>
        <form action={signOut}>
          <button type="submit" className="text-accent underline underline-offset-2">
            로그아웃
          </button>
        </form>
      </div>
    </main>
  );
}
