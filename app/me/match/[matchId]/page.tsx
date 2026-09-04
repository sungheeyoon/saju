import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import {
  MATCH_RESULT_CLOSED_NOTE,
  MATCH_RESULT_ENGINE_NOTE,
  MATCH_RESULT_INTRO,
  MATCH_RESULT_PINNED_NOTE,
} from '@/src/lib/consent';

import { supabaseOnServer } from '../../../auth/server-client';
import { BetweenSections } from '../../../between-view';
import { CARD } from '../../../card';
import { BlockButton, MatchScope } from '../../requests/manage';
import { ReadingSection } from '../../reading/section';
import { matchResultForViewer, type SharedResult } from '../result';

/** 모델 240초 뒤 실패를 적을 60초를 남기되 DB 의 10분 만료보다 짧게 둔다. */
export const maxDuration = 300;

export const metadata = {
  title: '함께 보는 궁합 — 만세력',
  description: '서로 동의한 두 사람의 궁합과 그 위에 선 사주풀이를 봅니다.',
};

/**
 * 공유 결과 — **동의가 실제로 연 것.**
 *
 * 요청·수락 화면이 「열릴 것」이라고 적은 목록이 여기서 열린다. 그래서 같은 한 벌을
 * 여기서도 읽는다(`MATCH_DISCLOSURE`) — 동의할 때 읽은 약속과 실제로 보이는 것이
 * 갈리면, 갈렸다는 사실을 아는 사람이 아무도 없다.
 *
 * **상대의 `Saju`와 `ChartEvidence`는 이 화면에 오지 않는다.** 서버가 두 판본을 읽어
 * 계산하고 잘라 내보낸다(ADR 0010·0012). 여기 서는 것은 `Compatibility` 와
 * `MatchPreview` 와 문장이고, 두 `Saju` 는 `matchResultForViewer` 안에서 나고 죽는다.
 * Compatibility의 관계 참가자를 합쳐 여덟 글자가 드러날 수는 있지만, 상대 원국 전체
 * 판정·명식 표·근거 패널은 없는 것이 그 경계다.
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
            소식
          </Link>
          <Link href="/me" className="text-accent underline underline-offset-2">
            내 사주
          </Link>
        </p>
      </header>

      {outcome.kind === 'ok' ? (
        <Result result={outcome.result} />
      ) : (
        /*
          **문장은 정책이 든다** — 화면이 손으로 적지 않는다.

          여기 「함께 보기로 한 두 분의 동의는 그대로 있습니다…」가 적혀 있었고,
          `MATCH_RESULT_CLOSED_NOTE` 가 같은 말을 하며 시험까지 딸린 채로 **아무도 안
          부르는 상수**로 서 있었다. 두 벌이면 갈리고, 실제로 조금 갈려 있었다.

          `outcome.message` 는 내리고 이 한 줄만 세운다. 그 값은 「매인 판본을 찾지
          못했습니다」처럼 **우리가 FK 를 부르는 이름**이라 읽는 사람에게 아무 뜻이 없고,
          이 문장이 이미 「무엇이 그대로이고 무엇이 지금 안 되는지」를 다 말한다. 어느
          갈래로 닫혔는지는 서버 로그가 든다.
        */
        <section className={CARD}>
          <p className="text-sm text-secondary">{MATCH_RESULT_CLOSED_NOTE}</p>
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

      {/*
        **점수는 여기 한 자리에서만 난다.** 예전에는 이 자리에 `match-v0` 대시보드가
        섰다. 그것을 내린 것은 지표가 틀려서가 아니라 **한 화면에 점수가 둘이면 사용자가
        무엇을 믿을지 정해야 하기 때문**이다 — 사용자에게 보이는 점수는 현재 결과의
        일부이고(`prd-archive`), `match-v0` 는 내부 실험 자산으로 남는다(ADR 0003).
      */}
      {/*
        **여기에는 만드는 버튼이 없다** (ADR 0038).

        풀이권은 요청할 때 예약되고 동의가 그것을 쓴다. 그래서 이 글은 수락하는 그
        순간부터 만들어지고 있고, 두 사람 다 누를 것이 없다 — 「먼저 누른 사람이 쓴다」가
        사라지는 것은 규칙을 하나 더 세워서가 아니라 **누를 것이 없어져서**다.

        글도 도는 시도도 없을 때만 「다시 만들기」가 선다. 자동 생성이 실패한 자리이고,
        거기서까지 버튼을 없애면 동의는 났는데 아무도 못 여는 Match 가 남는다.
      */}
      <ReadingSection target={{ kind: 'match', matchId: result.matchId }} automatic />

      <p className="text-xs text-muted">{MATCH_RESULT_ENGINE_NOTE}</p>

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
        <BlockButton userId={result.partnerUserId} />
      </div>
    </>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}
