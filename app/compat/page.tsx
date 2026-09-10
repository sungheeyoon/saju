import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { selfPersonIdOf } from '@/src/lib/account';

import { readAccount } from '../me/account';
import { supabaseOnServer } from '../auth/server-client';
import { CompatPicker } from '../compat-picker';
import { CompatHero } from '../compat-hero';

export const metadata = {
  title: '궁합 — 만세력',
  description: '두 원국 사이에 성립하는 관계와 오행 보완을 사실 그대로 봅니다.',
};

/**
 * 궁합의 **첫 걸음** — 두 사람을 정하는 자리.
 *
 * 여기 계산 결과가 서 있었고, 저장한 사람으로 고르는 화면이 따로 있었다(`/me/compat`).
 * 나뉜 것은 **사람이 아니라 입력 방법**이라 섞인 조합이 갈 곳이 없었다 — 이제 칸마다
 * 어디서 올지를 고르고, 결과는 한 화면에서 본다(ADR 0054).
 */
export default async function CompatPage() {
  const supabase = await supabaseOnServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth?next=%2Fcompat');

  const [{ state }, { data: edges }] = await Promise.all([
    readAccount(supabase),
    /*
      정책이 자기 목록만 내준다 — `user_id` 를 여기서 또 적지 않는다.
      **목록에 선 사람만 고를 수 있다**(`listed`): 궁합만 보려고 만든 사람은 사용자가
      이름을 관리하지 않으므로 고르는 자리에 서면 「저건 누구지」가 된다.
    */
    supabase
      .from('user_person_access')
      .select('person_id, local_label')
      .eq('listed', true)
      .order('created_at', { ascending: true }),
  ]);

  const people = (edges ?? []).map((edge) => ({
    personId: edge.person_id as string,
    label: edge.local_label as string,
    isSelf: edge.person_id === selfPersonIdOf(state),
  }));

  return (
    <main className="app-shell flex flex-1 flex-col gap-8 py-9 sm:py-14">
      <CompatHero />

      {/*
        원국 화면과 같은 이유로 Suspense 아래에 둔다 — 주소창의 `#` 뒤를 읽는데
        이 페이지는 빌드 때 미리 그려지고, fragment 는 서버에 오지 않는다.
      */}
      <Suspense fallback={<div className="h-72 rounded-[1.75rem] border border-border bg-surface" />}>
        <CompatPicker people={people} />
      </Suspense>

      <footer className="border-t border-border py-6 text-xs leading-6 text-muted">
        직접 입력한 사람은 <strong className="font-medium">사람 목록에 저장되지 않습니다.</strong>
      </footer>
    </main>
  );
}
