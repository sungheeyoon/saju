import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { isBlocked, selfPersonIdOf } from '@/src/lib/account';
import { STEM_INFO } from '@/src/lib/saju';

import { supabaseOnServer } from '../../../auth/server-client';
import { SajuResult } from '../../../saju/view';
import { UNREADABLE_INPUT_NOTE } from '@/src/lib/input/stored';
import { AccountNotice } from '../../account-notice';
import { readAccount } from '../../account';
import { payloadForViewer } from '../../payload';
import { ReadingTabs } from '../../reading-tabs';
import { elementScope } from '../../../ui/element-tone';
import { BUTTON_ON_TILE, BUTTON_TERTIARY } from '../../../ui/buttons';
import { Icon } from '../../../ui/icons';
import { TYPE_META, TYPE_TITLE } from '../../../ui/surfaces';
import { DayMasterChip } from '../chart-bits';
import { StemSymbol } from '../../../ui/stem-symbol';
import { compatHrefFor } from '../compat-href';

export const metadata = {
  title: '사주 상세',
  description: '저장한 사람의 사주와 운의 흐름을 자세히 봅니다.',
};

export default async function PersonSajuPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const supabase = await supabaseOnServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  /**
   * **못 읽은 것을 중지로 말하지 않는다**(ADR 0048).
   *
   * 여기는 `account?.status !== 'active'` 로 물어서, 계정을 못 읽었을 때도 「중지된
   * 계정입니다」를 세우고 있었다. `app_user` 의 select 정책은 `id = auth.uid()` 하나이고
   * `status` 를 안 보므로 — 정지된 계정도 자기 행을 읽는다 — 그 말은 참일 수가 없었다.
   */
  const { state } = await readAccount(supabase);
  if (isBlocked(state)) {
    return (
      <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-12">
        <AccountNotice state={state} />
      </main>
    );
  }

  const { personId } = await params;
  const view = await payloadForViewer(personId);
  if (view === null) notFound();

  /**
   * 못 읽는 입력은 **메우지 않는다** — 저장된 값은 그대로 있고 읽는 쪽이 못 읽는 것이다.
   *
   * 앞서는 이 자리가 `instanceof` 로 예외를 받았다. 받는 것을 잊으면 500 이 되는 모양이라
   * 문이 값으로 내주는 쪽으로 옮겼다(`PersonView`).
   */
  if (view.kind === 'unreadable-input') {
    return (
      <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-12">
        <section className="flex flex-col gap-2 rounded-[1.75rem] border border-border bg-surface p-5 sm:p-6">
          <p className="text-[15px]">{view.message}</p>
          <p className={TYPE_META}>{UNREADABLE_INPUT_NOTE}</p>
        </section>
      </main>
    );
  }

  const person = view.payload;

  /**
   * 내 명식이면 풀이 칸은 `/me` 의 것이다 — 두 자리에 세우면 글이 둘 선다.
   *
   * **주소에 적힌 글자가 아니라 `person.personId` 로 견준다.** uuid 비교는 대소문자를
   * 안 가려서 대문자로 적은 주소도 조회를 지나가는데, 문자열 비교는 가린다. 그 둘이
   * 갈리는 순간 이 값이 거짓이 되고 화면은 못 만드는 버튼을 세운다 — DB 는 거절하므로
   * 안전은 지켜지지만, 「못 만드는 버튼을 안 보여 준다」는 약속이 깨진다.
   */
  const selfPersonId = selfPersonIdOf(state);
  const mine = selfPersonId === person.personId;
  const element = STEM_INFO[person.saju.pillars.dayMaster].element;

  return (
    <main className="app-shell flex flex-1 flex-col gap-6 py-8 sm:py-12">
      {/*
        **머리는 그 사람의 일간 색을 입는다** — 목록의 타일을 눌러 들어온 사람이 같은 색의 판을 다시 만난다.
        색 혼자 말하지 않게 일간 딱지(상징 · 글자 · 오행 이름)가 함께 선다.
      */}
      <header className={`${elementScope(element)} relative overflow-hidden rounded-[2rem] bg-[var(--tile)] p-5 sm:p-8`}>
        <StemSymbol
          stem={person.saju.pillars.dayMaster}
          className="pointer-events-none absolute -right-8 -top-8 size-44 opacity-[0.14] sm:size-56"
        />
        <div className="relative flex flex-col gap-4">
          <Link href={mine ? '/me' : '/me/people'} className={`${BUTTON_TERTIARY} -ml-1 self-start`}>
            <Icon name="back" className="size-4" />
            {mine ? '내 사주로 돌아가기' : '사람 목록으로 돌아가기'}
          </Link>

          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold text-[var(--ink)]">{mine ? '내 사주' : '저장한 사람'}</p>
            <h1 className={TYPE_TITLE}>{person.name}의 사주</h1>
            <p className="text-[15px] leading-6 text-secondary">사주와 운의 흐름을 자세히 확인하세요.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DayMasterChip stem={person.saju.pillars.dayMaster} className="min-h-11" />
            {/*
              **궁합은 여기서도 시작한다**(ADR 0036).

              저장한 사람을 보고 있는 사람이 「이 사람과 누구」를 떠올리는 자리는 바로
              여기다. 궁합의 첫 걸음(`/compat`)이 **이 사람이 앉은 채** 열린다 — 내 사주가 있으면
              나 × 이 사람으로 두 칸이 다 찬다(`compatHrefFor`, 주소에는 person id 만).
            */}
            <Link href={compatHrefFor(selfPersonId, person.personId)} className={`${BUTTON_ON_TILE} px-4`}>
              <Icon name="heart" className="size-4" />
              궁합 보러 가기
            </Link>
          </div>
        </div>
      </header>

      <ReadingTabs
        current="chart"
        chartHref={`/me/people/${person.personId}`}
        readingHref={mine ? '/me/readings/self' : `/me/readings/${person.personId}`}
        label={mine ? '내 사주' : person.name}
      />

      <SajuResult saju={person.saju} />
    </main>
  );
}
