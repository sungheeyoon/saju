import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { supabaseOnServer } from '../../../auth/server-client';
import { SajuResult } from '../../../saju-calculator';
import { UnreadableRevisionError } from '../../../revision';
import { Halted } from '../../halted';
import { payloadForViewer } from '../../payload';
import { ReadingSection } from '../../reading/section';

/**
 * **결과 칸이 서는 화면은 상한을 든다.**
 *
 * 생성은 응답 뒤에 돌고(`after`) 그 콜백이 사는 시간은 이 라우트의 상한이다. 없으면
 * 플랫폼 기본값에서 잘리고, 그러면 시도가 열린 채 남아 그 대상이 10분간 잠긴다 —
 * 화면에는 「만드는 중」만 돌고 아무것도 안 온다. `/me/compat` 이 실제로 그랬다.
 */
export const maxDuration = 300;

export const metadata = {
  title: '사주 상세 보기 — 만세력',
  description: '저장한 사람의 명식과 운 흐름을 자세히 봅니다.',
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

  const { data: account } = await supabase
    .from('app_user')
    .select('status, self_person_id')
    .maybeSingle();
  if (account?.status !== 'active') {
    return (
      <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-12">
        <Halted status={account?.status ?? 'suspended'} />
      </main>
    );
  }

  const { personId } = await params;
  let person;
  try {
    person = await payloadForViewer(personId);
  } catch (error) {
    if (error instanceof UnreadableRevisionError) {
      return (
        <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-12">
          <p className="rounded-2xl border border-border bg-surface p-5 text-sm">{error.message}</p>
        </main>
      );
    }
    throw error;
  }
  if (!person) notFound();

  /**
   * 내 명식이면 풀이 칸은 `/me` 의 것이다 — 두 자리에 세우면 글이 둘 선다.
   *
   * **주소에 적힌 글자가 아니라 `person.personId` 로 견준다.** uuid 비교는 대소문자를
   * 안 가려서 대문자로 적은 주소도 조회를 지나가는데, 문자열 비교는 가린다. 그 둘이
   * 갈리는 순간 이 값이 거짓이 되고 화면은 못 만드는 버튼을 세운다 — DB 는 거절하므로
   * 안전은 지켜지지만, 「못 만드는 버튼을 안 보여 준다」는 약속이 깨진다.
   */
  const mine = account.self_person_id === person.personId;

  return (
    <main className="app-shell flex flex-1 flex-col gap-7 py-9 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="eyebrow">저장한 사람</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">{person.name}의 사주</h1>
          <p className="mt-1 text-sm text-secondary">명식과 운의 흐름을 자세히 확인하세요.</p>
        </div>
        <Link
          href="/me/people"
          className="rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
        >
          사람 목록으로
        </Link>
      </header>

      <SajuResult saju={person.saju} />

      {/*
        **저장한 사람도 혼자 풀이를 받는다.**

        여기 버튼이 없던 동안 엄마의 풀이를 보려면 엄마 × 다른 한 사람 궁합으로 가야
        했다. `self` 를 넓히지 않고 kind 를 하나 늘린 까닭은 낱말과, 낱말이 지키는 기록
        때문이다 — 내 명식을 넘긴 것과 남의 명식을 넘긴 것은 동의 범위가 다른 일이다.

        **여는 것만으로는 아무것도 안 만든다.** 이 칸은 저장된 결과를 읽을 뿐이고,
        모델을 부르는 길은 버튼 하나다(`ReadingSection`).

        **내 명식이면 이 칸이 아니다.** 목록은 selfPerson 을 이미 걸러 내지만 이 주소는
        열린다. 여기에 칸을 세우면 같은 명식에 글이 둘 서고 같은 자료로 풀이권이 두 번
        나간다. 막는 것은 DB 다(`reading_scope_for`) — 여기서는 그 자리에 **어디로 가면
        되는지**를 세운다. 못 만드는 버튼을 세워 두고 눌러야 알게 하지 않는다.
      */}
      {mine ? (
        <p className="rounded-2xl border border-border bg-surface p-5 text-sm leading-6">
          내 명식의 사주풀이는{' '}
          <Link href="/me" className="font-semibold text-accent underline underline-offset-4">
            내 사주
          </Link>{' '}
          화면에 있습니다.
        </p>
      ) : (
        <ReadingSection
          target={{ kind: 'person', personId: person.personId }}
          heading={`${person.name}의 사주풀이`}
        />
      )}
    </main>
  );
}
