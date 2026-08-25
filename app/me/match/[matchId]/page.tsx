import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import {
  MATCH_RESULT_INTRO,
  MATCH_RESULT_NO_AI_NOTE,
  MATCH_RESULT_PINNED_NOTE,
} from '@/src/lib/consent';

import { supabaseOnServer } from '../../../auth/server-client';
import { BetweenSections } from '../../../between-view';
import { CARD } from '../../../card';
import { MatchIndexCard, ScoringNote } from '../../../match-index';
import { BlockButton, MatchScope } from '../../requests/manage';
import { matchResultForViewer, type SharedResult } from '../result';

export const metadata = {
  title: '함께 보는 궁합 — 만세력',
  description: '서로 동의한 두 사람의 궁합과 고정된 match-v0 지표를 봅니다.',
};

/**
 * 공유 결과 — **동의가 실제로 연 것.**
 *
 * 요청·수락 화면이 「열릴 것」이라고 적은 목록이 여기서 열린다. 그래서 같은 한 벌을
 * 여기서도 읽는다(`MATCH_DISCLOSURE`) — 동의할 때 읽은 약속과 실제로 보이는 것이
 * 갈리면, 갈렸다는 사실을 아는 사람이 아무도 없다.
 *
 * **상대의 명식은 이 화면에 오지 않는다.** 서버가 두 판본을 읽어 계산하고 잘라
 * 내보낸다(ADR 0010). 여기 서는 것은 `Compatibility` 와 `MatchPreview` 와 문장이고,
 * 두 `Saju` 는 `matchResultForViewer` 안에서 나고 죽는다 — 궁합 화면과 달리 명식
 * 표도 근거 패널도 없는 것이 그 때문이다.
 */
export default async function MatchResultPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { matchId } = await params;

  /**
   * **그릴 것을 정하기 전에 답이 나온다**(`/me/compat` 과 같은 규율).
   *
   * 거절을 화면 안쪽 컴포넌트에 두면 그것이 그려질 때는 응답이 이미 흘러나가기
   * 시작했을 수 있고, 그러면 404 를 부르고도 200 이 나간다.
   */
  const outcome = await matchResultForViewer(matchId);

  /**
   * **없는 Match 와 못 보는 Match 를 같은 말로 거절한다.**
   *
   * 갈리면 응답 차이만으로 그 Match 가 실재하는지 알아낼 수 있다. 여기서 두 경우가
   * 같아지는 것은 문장을 맞춰 적어서가 아니라 **답이 한 자리에서 나오기 때문**이다 —
   * `matchResultForViewer` 는 둘 다 `null` 을 내고, 그 `null` 을 응답으로 바꾸는
   * 곳이 이 한 줄뿐이다.
   */
  if (outcome === null) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">함께 보는 궁합</h1>
        <p className="flex flex-wrap gap-4 text-sm">
          <Link href="/me/requests" className="text-accent underline underline-offset-2">
            요청과 알림
          </Link>
          <Link href="/me" className="text-accent underline underline-offset-2">
            내 사주
          </Link>
        </p>
      </header>

      {outcome.kind === 'ok' ? (
        <Result result={outcome.result} />
      ) : (
        <section className={`${CARD} flex flex-col gap-2`}>
          <p className="text-sm">{outcome.message}</p>
          <p className="text-xs text-muted">
            Match 와 두 분의 동의는 그대로 있습니다. 지금 이 화면이 그 판본을 읽지 못하는
            것입니다.
          </p>
        </section>
      )}
    </main>
  );
}

function Result({ result }: { result: SharedResult }) {
  return (
    <>
      <section className={`${CARD} flex flex-col gap-2`}>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-lg font-semibold">{result.partnerNickname}</h2>
          <span className="text-xs text-muted">{when(result.createdAt)} 성립</span>
        </div>
        {result.partnerIntro !== null && (
          <p className="text-sm text-secondary">{result.partnerIntro}</p>
        )}

        {/*
          왜 이 사람이었나 — **요청이 잡아 둔 그때의 두 축**이다. 지금 다시 세지
          않는 것은 요약이 지금 판본의 것이라 매인 판본과 갈릴 수 있어서다.
        */}
        {result.suppliedToMe !== null && (
          <p className="text-sm text-secondary">{result.suppliedToMe}</p>
        )}
        {result.suppliedToThem !== null && (
          <p className="text-sm text-secondary">{result.suppliedToThem}</p>
        )}
        <p className="text-sm text-secondary">{result.balanceLabel}</p>
      </section>

      {/*
        **결과 화면에서도 같은 한 벌을 읽는다.** 무엇이 열렸고 무엇이 여전히 닫혀
        있는지는 동의할 때 읽은 그 목록이다 — 여기서 다시 쓰면 두 벌이 되고, 두 벌은
        갈린다. 매인 판본에 대한 말만 이 화면의 것으로 바꾼다.
      */}
      <MatchScope intro={MATCH_RESULT_INTRO} note={MATCH_RESULT_PINNED_NOTE} />

      <BetweenSections compat={result.compat} names={result.names} />

      <MatchIndexCard preview={result.preview} names={result.names} />

      <div className="flex flex-col gap-2">
        <ScoringNote />
        <p className="text-xs text-muted">{MATCH_RESULT_NO_AI_NOTE}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
        <BlockButton userId={result.partnerUserId} />
      </div>
    </>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}
