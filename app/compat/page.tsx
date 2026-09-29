import { Suspense } from 'react';

import { selfPersonIdOf } from '@/src/lib/account';
import { storedChartOf } from '@/src/lib/input/stored';
import { STEM_INFO, type Element } from '@/src/lib/saju';

import { readAccount } from '../me/account';
import { storedInputsOf } from '../me/person-input';
import { supabaseOnServer } from '../auth/server-client';
import { signedInUser } from '../auth/signed-in';
import { redirectToSignIn } from '../auth/sign-in-redirect';
import { dbFailure } from '../db-error';
import { CompatPicker } from '../compat-picker';
import { MyCircle } from '../me/home/circle-view';
import { myReadings } from '../me/reading/current';
import { TYPE_SECTION } from '../ui/surfaces';
import { CompatArchive } from './archive';

export const metadata = {
  title: '궁합',
  description: '두 사주 사이에 성립하는 관계와 오행 보완을 사실 그대로 봅니다.',
};

/**
 * **궁합 탭의 첫 화면** — 위에서부터 궁합 새로 보기(두 사람 고르기), 최근 궁합풀이, 관계 지도와 저장한 사람
 * (ADR 0129 「2026-09-29 e+」).
 *
 * 탭을 연 사람이 가장 먼저 하려는 일이 새 궁합이라 고르는 칸이 맨 위에 서고, 폰의 첫 화면에서 스크롤 없이 보인다.
 * 두 사람을 정하는 자리는 그대로다 — 칸마다 어디서 올지를 고르고, 결과는 한 화면에서 본다(ADR 0054). 그 아래 이미 본
 * 직접 궁합이 최근 것 셋까지, 그 아래 나와 내가 저장한 사람이 선다. 인연 궁합은 인연 탭이 든다(ADR 0130).
 * 지도의 카드 · 타일의 「나와 궁합」은 위의 두 칸을 채우고 그 칸을 화면에 들인다(`compat-picker.tsx`).
 * 내 사주가 아직 없으면 지도 · 타일은 안 서고 고르는 칸과 최근 궁합풀이만 선다(내 사주 등록은 나 탭이 든다).
 */
export default async function CompatPage() {
  const supabase = await supabaseOnServer();
  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const [{ state }, { data: edges, error: edgesError }, readings] = await Promise.all([
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
    /* 지도의 선 · 타일의 점수 · 최근 궁합풀이가 같은 목록을 읽는다 — 한 번 읽어 나눠 준다 */
    myReadings(),
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

  const selfPersonId = selfPersonIdOf(state);

  return (
    <main className="app-shell flex flex-1 flex-col gap-10 py-6 sm:gap-14 sm:py-12">
      {/* 제목은 화면 밖에서만 읽힌다 — 켜진 탭이 이미 「궁합」이라 말하고, 폰의 첫 화면은 고르는 칸이 차지한다 */}
      <h1 className="sr-only">궁합</h1>

      {/*
        사주 화면과 같은 이유로 Suspense 아래에 둔다 — 주소창의 `#` 뒤를 읽는데 fragment 는 서버에 오지 않는다.
        지도의 카드 · 사람 타일의 「나와 궁합」이 두 칸을 채운 주소(`/compat#a.person=…`)로 여기에 온다.
      */}
      {/* 지도 · 타일이 칸을 채우면 고르는 칸이 이 구역을 머리글 아래로 데려오고 제목에 초점을 둔다(`compat-picker.tsx`) */}
      <section aria-labelledby="compat-new" className="flex scroll-mt-24 flex-col gap-4">
        <h2 id="compat-new" tabIndex={-1} className={`${TYPE_SECTION} outline-none`}>
          궁합 새로 보기
        </h2>
        <Suspense fallback={<div className="h-72 rounded-[2rem] bg-cream" />}>
          <CompatPicker people={people} />
        </Suspense>
        <p className="text-[13px] leading-6 text-secondary">
          직접 입력한 사람은 <strong className="font-semibold text-foreground">사람 목록에 저장되지 않습니다.</strong>
        </p>
      </section>

      <CompatArchive readings={readings} />

      {selfPersonId !== null && <MyCircle selfPersonId={selfPersonId} readings={readings} />}
    </main>
  );
}
