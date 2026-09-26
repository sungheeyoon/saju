import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { selfPersonIdOf } from '@/src/lib/account';
import { storedChartOf } from '@/src/lib/input/stored';
import { STEM_INFO, type Element } from '@/src/lib/saju';

import { readAccount } from '../me/account';
import { storedInputsOf } from '../me/person-input';
import { supabaseOnServer } from '../auth/server-client';
import { dbFailure } from '../db-error';
import { CompatPicker } from '../compat-picker';
import { CompatHero } from '../compat-hero';

export const metadata = {
  title: '궁합',
  description: '두 사주 사이에 성립하는 관계와 오행 보완을 사실 그대로 봅니다.',
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

  const [{ state }, { data: edges, error: edgesError }] = await Promise.all([
    readAccount(supabase),
    /*
      정책이 자기 목록만 내준다 — `user_id` 를 여기서 또 적지 않는다.
      **목록에 선 사람만 고를 수 있다**(`listed`): 궁합만 보려고 만든 사람은 사용자가
      이름을 관리하지 않으므로 고르는 자리에 서면 「저건 누구지」가 된다.
    */
    // eslint-disable-next-line no-restricted-syntax -- 옛 자리(ADR 0085): 문으로 옮기면 지운다
    supabase
      .from('user_person_access')
      .select('person_id, local_label')
      .eq('listed', true)
      .order('created_at', { ascending: true }),
  ]);

  /* 고를 사람이 이 화면의 본체다 — 못 읽은 것을 「저장한 사람이 없다」로 세우지 않는다(ADR 0078) */
  if (edgesError) throw dbFailure(edgesError, 'user_person_access.listed');
  const listed = edges ?? [];

  /**
   * **고를 사람마다 그 사람의 일간 오행 하나만** 접어 넘긴다 — 고르는 칸의 줄과 두 원이 그 사람의 상징을 든다.
   * 명식이나 출생 입력은 브라우저로 안 넘긴다. 저장한 사람 목록과 같은 문(`storedInputsOf`)을 한 번 부르고,
   * 못 읽은 사람은 `null`(물음표 원)이다 — 없는 오행을 지어내지 않는다.
   */
  const stored = await storedInputsOf(
    supabase,
    listed.map((edge) => edge.person_id as string),
  );
  const elementOf = (personId: string, label: string): Element | null => {
    const input = stored.get(personId);
    if (input === undefined) return null;
    const chart = storedChartOf(input, label);
    return chart.ok ? STEM_INFO[chart.saju.pillars.dayMaster].element : null;
  };

  const stemOf = (personId: string, label: string): string | null => {
    const input = stored.get(personId);
    if (input === undefined) return null;
    const chart = storedChartOf(input, label);
    return chart.ok ? chart.saju.pillars.dayMaster : null;
  };

  const people = listed.map((edge) => ({
    personId: edge.person_id as string,
    label: edge.local_label as string,
    isSelfPerson: edge.person_id === selfPersonIdOf(state),
    element: elementOf(edge.person_id as string, edge.local_label as string),
    stem: stemOf(edge.person_id as string, edge.local_label as string),
  }));

  return (
    <main className="app-shell flex flex-1 flex-col gap-6 py-8 sm:gap-8 sm:py-12">
      <CompatHero />

      {/*
        사주 화면과 같은 이유로 Suspense 아래에 둔다 — 주소창의 `#` 뒤를 읽는데
        이 페이지는 빌드 때 미리 그려지고, fragment 는 서버에 오지 않는다.

        **앵커가 없다.** 머리의 「두 사람 고르기」가 여기(`#pair`)를 가리키고 있었는데,
        그 버튼을 걷으면서 짚을 사람도 없어졌다.
      */}
      <section>
        <Suspense fallback={<div className="h-72 rounded-[2rem] bg-cream" />}>
          <CompatPicker people={people} />
        </Suspense>
      </section>

      <footer className="border-t border-border py-5 text-[13px] leading-6 text-secondary">
        직접 입력한 사람은 <strong className="font-semibold text-foreground">사람 목록에 저장되지 않습니다.</strong>
      </footer>
    </main>
  );
}
