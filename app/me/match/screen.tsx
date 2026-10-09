import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';
import { MATCH_RESULT_CLOSED_NOTE } from '@/src/lib/consent';
import { STEM_INFO } from '@/src/lib/saju';

import { supabaseOnServer } from '../../auth/server-client';
import { signedInUser } from '../../auth/signed-in';
import { redirectToSignIn } from '../../auth/sign-in-redirect';
import { PillarPair } from '../../compat-view';
import { BUTTON_SECONDARY_SMALL, BUTTON_TERTIARY } from '../../ui/buttons';
import { Icon } from '../../ui/icons';
import { EMPTY_SLOT, TYPE_TITLE } from '../../ui/surfaces';
import { ReportBlock } from '../requests/report-block';
import { ReadingSection } from '../reading/section';
import { backOf, placeOf } from '../../came-from';
import { matchResultForViewer, type SharedResult } from './result';

/** 결과가 어느 틀에 서나 — 제 주소(`/me/match/[id]`)의 한 화면, 또는 풀이 보관함의 옆 칸(ADR 0134, `../compat/screen.tsx` 와 같다) */
type MatchFrame = 'page' | 'shelf';

/**
 * 공유 결과 — **동의가 실제로 연 것.**
 *
 * 요청·수락 화면이 「열릴 것」이라고 적은 목록이 여기서 열린다. 그래서 같은 한 벌을
 * 여기서도 읽는다(`MATCH_DISCLOSURE`) — 동의할 때 읽은 약속과 실제로 보이는 것이
 * 갈리면, 갈렸다는 사실을 아는 사람이 아무도 없다.
 *
 * **상대의 `Saju`와 `ChartEvidence`는 이 화면에 오지 않는다.** 서버가 두 판본을 읽어
 * 계산한 뒤, 서로 공개하기로 한 여덟 글자만 새 객체로 잘라 내보낸다(ADR 0010·0012).
 * 정확한 생년월일시·출생지·상대 원국 전체 판정·근거 패널은 계속 서버 경계 안에 남는다.
 */
export async function MatchScreen({
  matchId,
  query,
  frame,
}: {
  matchId: string;
  query: { from?: string | string[]; kind?: string | string[] };
  frame: MatchFrame;
}) {
  const supabase = await supabaseOnServer();

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

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

  /* 방으로 돌아가는 ← 는 이 Match 의 방이다 — `matchId` 는 위 문이 UUID 로 걸렀고 실제로 볼 수 있는 Match 다 */
  const place = placeOf(query, frame === 'shelf' ? `/me/readings/match/${matchId}` : `/me/match/${matchId}`);
  const back = backOf('match', { ...place, matchId });
  /* 보관함 옆 칸에서 ← 가 보관함으로 가면 넓은 화면에서는 안 선다 — 책장이 이미 옆에 있다(사주풀이와 같다) */
  const besideShelf = frame === 'shelf' && place.from === 'shelf';
  const Title = frame === 'page' ? 'h1' : 'h2';
  /*
    **방으로 가는 길은 머리에 선다**(화면 감사 2026-10-09). 맺어진 뒤 가장 먼저 할 일인데, 글 끝(설문 뒤 약 3000px)에만
    있었다. 방에서 왔으면 ← 가 이미 그 방이라(`backOf` 의 `chat`) 한 머리에 같은 이름 · 같은 곳이 둘 서지 않게 뺀다.
  */
  const room = outcome.kind === 'ok' ? `/me/chat/${outcome.result.matchId}` : null;
  const toRoom = room !== null && back.href !== room ? room : null;

  return (
    /*
      **다른 화면과 같은 폭·같은 머리를 쓴다.** 여기만 제 손으로 여백과 제목을 그리고
      있어서, 소식에서 이 화면으로 들어오면 앱이 한 번 갈아 끼워지는 것처럼 보였다.
    */
    <Frame frame={frame}>
      <header className="flex flex-col gap-5">
        {/* 되돌아가는 자리는 **온 곳**이다(ADR 0134) — 인연 탭 · 인연 기록 · 대화방 · 보관함, 없으면 인연 탭 첫 화면 */}
        <Link href={back.href} className={`${BUTTON_TERTIARY} self-start ${besideShelf ? 'lg:hidden' : ''}`}>
          <Icon name="back" className="size-4" />
          {back.label}
        </Link>
        {/*
          **머리는 한 줄이 상대를 부른다**(운영자 2026-10-10, 화면 점검 C12). 「인연」 눈썹 → 「인연 궁합」 → 「… 님과의 궁합풀이」가
          같은 대상을 세 번 불렀다. 제목이 상대 이름을 품고, 눈썹은 걷고, 아래 풀이 칸의 이름표는 보조기기에만 읽힌다. 닫힌 결과는
          상대가 안 실려 와 「인연 궁합」 그대로다.
        */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <Title className={`${TYPE_TITLE} min-w-0 break-keep`}>
              {outcome.kind === 'ok' ? `${outcome.result.partnerNickname} 님과의 인연 궁합` : '인연 궁합'}
            </Title>
            <div className="flex shrink-0 items-center gap-1">
              {/* 동의가 나면 방이 열린다(PRD 「앱 내 채팅」) — 결과에서 바로 그 방으로 간다 */}
              {toRoom !== null && (
                <Link href={toRoom} className={`${BUTTON_SECONDARY_SMALL} shrink-0`}>
                  <Icon name="chat" className="size-[18px]" />
                  {CHAT_TAB_LABEL}
                </Link>
              )}
              {/*
                **끊는 자리는 머리의 「⋯」다**(운영자 결정 2026-10-09, ADR 0158). 차단이 풀이와 긴 설문 아래 글 끝에 혼자
                있었다 — 대화방과 같은 「⋯」에 신고와 함께 둔다. 닫힌 결과에는 상대가 안 실려 와 서지 않는다.
              */}
              {outcome.kind === 'ok' && (
                <ReportBlock userId={outcome.result.partnerUserId} nickname={outcome.result.partnerNickname} />
              )}
            </div>
          </div>
          <p className="text-[15px] leading-6 text-secondary">
            두 분 모두 같은 글과 같은 점수를 봐요.
          </p>
        </div>
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
        <section className={EMPTY_SLOT}>
          <p className="text-[15px] leading-7 text-secondary">{MATCH_RESULT_CLOSED_NOTE}</p>
        </section>
      )}
    </Frame>
  );
}

/** 틀 — 제 주소면 한 화면(`main`), 보관함이면 옆 칸의 글 한 편(`article`)이다. 보관함의 `main` 은 레이아웃이 세웠다 */
function Frame({ frame, children }: { frame: MatchFrame; children: ReactNode }) {
  return frame === 'page' ? (
    <main className="app-shell flex w-full flex-1 flex-col gap-8 py-8 sm:py-12">{children}</main>
  ) : (
    <article className="flex min-w-0 flex-col gap-8">{children}</article>
  );
}

function Result({ result }: { result: SharedResult }) {
  return (
    <>
      {/*
        **점수는 여기 한 자리에서만 난다.** 예전에는 이 자리에 `match-v0` 대시보드가
        섰다. 그것을 내린 것은 지표가 틀려서가 아니라 **한 화면에 점수가 둘이면 사용자가
        무엇을 믿을지 정해야 하기 때문**이다 — 사용자에게 보이는 점수는 현재 결과의
        일부이고(`prd-archive`), `match-v0` 는 그 뒤 코드에서도 걷었다.
      */}
      {/*
        **여기에는 만드는 버튼이 없다** (ADR 0038).

        풀이권은 요청할 때 예약되고 동의가 그것을 쓴다. 그래서 이 글은 수락하는 그
        순간부터 만들어지고 있고, 두 사람 다 누를 것이 없다 — 「먼저 누른 사람이 쓴다」가
        사라지는 것은 규칙을 하나 더 세워서가 아니라 **누를 것이 없어져서**다.

        글도 도는 시도도 없을 때만 「궁합풀이 받기」가 선다. 자동 생성이 실패한 자리이고,
        거기서까지 버튼을 없애면 동의는 났는데 아무도 못 여는 Match 가 남는다.
      */}
      <ReadingSection
        target={{ kind: 'match', matchId: result.matchId }}
        heading={`${result.partnerNickname} 님과의 궁합풀이`}
        headingHidden
        automatic
        bare
        matchNames={{ me: '나', partner: result.partnerNickname }}
        betweenSummaryAndBody={<PillarPair charts={result.charts} names={result.names} />}
        /*
          표지는 두 사람의 일간이 비스듬히 만난다 — 동의로 열린 여덟 글자에서 읽으므로 새로 열리는 것이 없다
          (ADR 0012). 앞자리가 늘 보는 사람이다(`names.a`).
        */
        tones={[STEM_INFO[result.charts.a.dayMaster].element, STEM_INFO[result.charts.b.dayMaster].element]}
      />
    </>
  );
}
