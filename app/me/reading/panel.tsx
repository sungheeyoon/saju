'use client';

import type { ReactNode } from 'react';

import { READING_REPLACES_NOTE, readingNoneNote, READING_USES_TICKET_NOTE } from '@/src/lib/reading/notes';
import type { RunProgress } from '@/src/lib/reading';
import type { Element } from '@/src/lib/saju';

import { BUTTON_PRIMARY_FACE, BUTTON_SECONDARY_FACE } from '../../ui/buttons';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Icon } from '../../ui/icons';
import { TYPE_NAME } from '../../ui/surfaces';
import type { ReadingCredits } from '../credits/remaining';
import type { CurrentReading } from './current';
import { ReadingFeedback } from './feedback';
import { ShareReadingButton } from './share-button';
import { READING_COLUMN } from './markdown';
import { readingOutline } from './outline';
import type { ReadingTarget } from './target';
import type { TasteCarryView } from '../../taste/taste-carry';
import { CarryCard } from './carry-card';
import { LoadingState } from './reading-waiting';
import { Result } from './reading-result';
import { useReadingPanel } from './use-reading-panel';

export function ReadingPanel({
  target,
  initialReading,
  initialFailed,
  initialRunning,
  initialProgress,
  lastFailureCode = null,
  outline,
  credits,
  consented,
  heading,
  headingHidden = false,
  allowMockFallback,
  automatic = false,
  ask,
  betweenSummaryAndBody,
  matchNames,
  tones,
  carry = null,
}: {
  target: ReadingTarget;
  initialReading: CurrentReading | null;
  initialFailed: boolean;
  /**
   * 이 화면을 여는 지금 **서버에 도는 시도가 있는가.**
   *
   * 만드는 일이 누름의 요청에서 떨어져 나온 뒤로 생긴 값이다. 새로고침하고 돌아오거나
   * 다른 기기에서 열어도 만들던 것은 계속 돌고 있으므로, 화면은 그 사실을 알고 기다리는
   * 모습으로 열려야 한다. 모르면 「아무것도 안 하고 있다」고 말하게 된다.
   */
  initialRunning: boolean;
  /**
   * 그 시도가 **서버에서 어디까지 왔는가** — 끝났거나 모르면 `null`(ADR 0127).
   *
   * 새로고침하고 돌아와도 목차가 처음부터 다시 시작하는 것처럼 보이지 않게, 화면을 여는 그 왕복에서 함께 읽는다.
   */
  initialProgress: RunProgress | null;
  /**
   * 지난 시도가 실패했으면 그 코드 — 아니면 `null`. 잇기가 막혀 실패했으면(`taste-link-failed`) 「전체 풀이만 보기」가 선다
   * (`offersPlainReading`). 기다리던 시도가 끝나면 화면을 다시 읽으므로(`afterAsking`) 이 값도 새로 온다.
   */
  lastFailureCode?: string | null;
  /**
   * 기다리는 동안의 목차 줄 이름 — 프롬프트가 시킨 절 이름. 이름을 미리 모르는 궁합이면 `null`(ADR 0127).
   *
   * 서버가 지어 넘긴다. 이 칸은 브라우저에서 돌고, 프롬프트 모듈은 브라우저로 안 간다(`scripts/layers.test.ts`).
   */
  outline: readonly string[] | null;
  /**
   * 남은 풀이권 — **못 물었으면 `null`.**
   *
   * 모르면 그 줄을 아예 안 세운다. 「알 수 없음」을 세우면 사용자가 있지도 않은 숫자를
   * 세어 보게 되고, 만들지 말지를 그 값으로 정하게 된다.
   */
  credits: ReadingCredits | null;
  /**
   * 설문을 세울 수 있는가 — 개선 활용에 **동의한 사람만.**
   *
   * `improvementConsented()` 가 `null`(아직 안 물었다)과 `false`(거절했다)를 이미 하나로
   * 좁혀 준다. 여기서 다시 `?? false` 를 적으면 좁히는 자리가 둘이 된다.
   *
   * 점수와 태그도 이 뒤에 있다. 설문은 서비스 제공에 필요한 처리가 아니라 우리가 더
   * 나은 것을 만들려고 받는 것이라, 자유로운 선택 동의 뒤에 서야 한다. 거절해도
   * 사주는 하나도 안 좁아진다 — 위의 모든 칸이 이 값을 묻지 않는다.
   */
  consented: boolean;
  /**
   * 이 칸의 제목 — **부르는 쪽이 정한다.**
   *
   * kind 로 지어내던 자리다(`self` 면 「나의 사주풀이」, 아니면 「두 사람의 사주풀이」).
   * 저장한 사람의 풀이가 생기면서 그 방식이 끝났다 — 「{이름}의 사주풀이」는 이 칸이
   * 알 수 없는 값이고, 이름을 여기서 또 읽어 오면 화면이 이미 들고 있는 것을 한 번 더
   * 묻는 일이 된다.
   */
  heading: string | null;
  /**
   * 제목을 보조기기에만 읽힐까 — 화면 머리가 이미 같은 대상을 부를 때(인연 궁합의 「{상대} 님과의 인연 궁합」, 화면 점검 C12).
   * 칸의 구조(`h2`)는 그대로 남는다. 공유 · 다시 받기 단추가 서면 그 줄은 그대로 보인다.
   */
  headingHidden?: boolean;
  allowMockFallback: boolean;
  /**
   * **다음 풀이를 위해 먼저 정할 것.**
   *
   * 만드는 버튼과 같은 덩어리에 선다. 이 자리에 있는 물음은 지금 서 있는 글이 아니라
   * **다음 글**을 바꾸는 것이라, 글 위도 아래도 아닌 **버튼 옆**이 답이다 — 무엇을 안
   * 넘겼는지를 여기 세운 것과 같은 까닭이다(`notes.ts`).
   *
   * 지금은 비공개 궁합의 「무슨 사이인가」 하나뿐이다. 자기 풀이에는 상대가 없고 공유
   * 궁합은 성립 방식이 사이를 정한다.
   */
  /**
   * 이 글을 **동의가 만드는가** (ADR 0038).
   *
   * 공유 궁합이 그렇다. 요청할 때 풀이권을 예약하고 동의가 그것을 쓰므로, 성공 경로에는
   * **누를 것이 아무것도 없다** — 「먼저 누른 사람」이 사라지는 것은 누를 것이 없어져서다.
   *
   * **실패 경로에서까지 없애지는 않는다.** 글도 없고 도는 시도도 없으면 그 자리는 막다른
   * 골목이 되고, 그것은 이 ADR 이 없애려던 바로 그 자리다. 그때는 아무것도 없는 자리에
   * 서는 버튼 그대로 「궁합풀이 받기」가 서고, 누른 사람이 한 번을 쓴다
   * (ADR 0017 — 드물고 눈에 보이는 자리다).
   */
  automatic?: boolean;
  ask?: ReactNode;
  betweenSummaryAndBody?: ReactNode;
  matchNames?: { readonly me: string; readonly partner: string };
  /**
   * 표지의 색 — 대상의 일간 오행. 한 사람이면 하나, 두 사람이면 둘이고 못 읽은 사람은 `null`(회색).
   * 안 넘기면 크림 한 장이다(`Result`).
   */
  tones?: readonly (Element | null)[];
  /**
   * 가입 전에 읽던 로그인 전 사주 문단 — 내 사주풀이에만 온다(ADR 0143). 맨 위에 「아까 보던 내용」으로 선다: 누르기 전 ·
   * 만드는 동안 · 그 문단을 이은 글 위. 그 글을 새로 받으면(`shown` 에서 누름) 새 글은 이어 쓴 글이 아니라 내려간다.
   */
  carry?: TasteCarryView | null;
}) {
  const {
    phase,
    failure,
    reading,
    isMock,
    progress,
    noun,
    creditsNote,
    chrome,
    showsCarry,
    asking,
    closeAsking,
    confirmGenerate,
    generate,
    press,
    buy,
    offersPlain,
    skipping,
    skipCarry,
  } = useReadingPanel({
    target,
    initialReading,
    initialFailed,
    initialRunning,
    initialProgress,
    lastFailureCode,
    credits,
    consented,
    allowMockFallback,
    automatic,
    carry,
  });

  /**
   * 만드는 버튼 — **두 자리에 같은 버튼이 선다.**
   *
   * 글이 아직 없으면 권하는 말과 함께 칸 안에(`block`), 글이 이미 있으면 **머리의 공유
   * 버튼 옆에**(`pill`) 선다. 뒤엣것이 이 화면에서 사용자가 글을 읽고 나서 하는 두
   * 가지 — 보내기와 다시 받기 — 이고, 그 둘은 나란히 있어야 고르기가 된다.
   */
  const makeButton = (shape: 'block' | 'pill', emphasis: 'primary' | 'secondary') => (
    <button
      type="button"
      onClick={press}
      disabled={chrome.makeDisabled}
      aria-busy={chrome.buysCredits ? buy.checking : undefined}
      className={`${emphasis === 'primary' ? BUTTON_PRIMARY_FACE : BUTTON_SECONDARY_FACE} ${
        shape === 'pill' ? 'w-full whitespace-nowrap px-3 sm:w-auto sm:px-5' : 'w-full shrink-0 px-5 sm:w-auto'
      }`}
    >
      <Icon name="spark" className="size-[18px]" />
      {chrome.makeLabel}
    </button>
  );

  /**
   * **수정 전 정보로 만든 글이면 다시 받기가 주 단추가 된다.** 지금 명식과 다른 글을 들고 있는 사람에게는 새로 받는 것이
   * 먼저다(시안 3차 warm). 평소에는 머리에 주 단추가 없다 — 보내기는 늘 보조다(2026-10-10 화면 점검 B12: 읽으러 온 사람에게
   * 글보다 먼저 공유를 권했다). 한 영역에 주 단추는 하나 이하다.
   */
  const stale = reading !== null && target.kind !== 'match' && !reading.fromCurrentChart;

  const makeBlock = chrome.hideMake ? null : (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface px-5 py-5 sm:px-6">
      {/* 먼저 정할 것이 있으면 버튼보다 앞에 선다 — 정하고 나서 누르는 차례다 */}
      {ask}
      {/*
        **버튼 옆에 남는 것은 한 줄뿐이다** — 무엇을 안 넘기는가. 누를지 정하는 시점에 사용자가 실제로
        알아야 하는 사실이고, 그 자리가 여기다. 아직 글이 없을 때만 권하는 말이 위에 붙는다.
      */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          {reading === null && (
            <>
              <p className="text-lead font-semibold text-foreground">사주를 바탕으로 {noun}를 받아 보세요</p>
              <p className="text-small leading-5 text-secondary">{readingNoneNote(noun)}</p>
            </>
          )}
        </div>

        {/*
          **숫자는 여기 없다 — 머리글에 있다.** 풀이권은 이 글의 성질이 아니라 계정의 성질이라, 화면마다
          세우면 같은 숫자가 네 번 선다. 대신 이 누름에 대해 **말할 것이 있을 때는** 여기서 말한다.
        */}
        {makeButton('block', 'primary')}
      </div>
      {creditsNote !== null && <p className="text-small leading-5 text-secondary">{creditsNote}</p>}
    </div>
  );

  const alert = failure === null ? null : (
    <div
      role={phase === 'error' ? 'alert' : 'status'}
      className={`flex gap-2.5 rounded-row px-4 py-3.5 text-note leading-6 ${phase === 'error' ? 'bg-danger-wash text-danger' : 'bg-warning-wash text-warning'}`}
    >
      <Icon name="alert" className="mt-0.5 size-5" />
      <div className="min-w-0">
        <p>{failure}</p>
        {phase === 'error' && (
          <button
            type="button"
            onClick={generate}
            className="-ml-1 mt-1 inline-flex min-h-11 items-center px-1 font-semibold underline underline-offset-4"
          >
            다시 시도하기
          </button>
        )}
        {offersPlain && (
          <button
            type="button"
            onClick={skipCarry}
            disabled={skipping}
            className="-ml-1 mt-1 inline-flex min-h-11 items-center px-1 font-semibold underline underline-offset-4"
          >
            전체 풀이만 보기
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 부르는 화면이 제목을 이미 세웠고(`heading === null`) 누를 것도 없으면 머리는 통째로 안 선다 — 빈 칸이 틈만 남긴다 */}
      {(heading !== null || chrome.canShare || chrome.makeInHeader) && (
      <header className={headingHidden && !chrome.canShare && !chrome.makeInHeader ? 'sr-only' : 'flex flex-col gap-3'}>
        {/*
          **왼쪽은 이름, 오른쪽은 이 글에 대해 할 수 있는 것.** 좁은 화면에서는 위에서 아래로 쌓이고, 그때
          버튼 둘은 **줄을 반씩 나눠 쓴다** — 가운데에 모아 두면 누르는 자리가 화면마다 옮겨 다닌다. 400px 아래
          폰에서는 반쪽에 「사주풀이 다시 받기」가 두 줄로 꺾이므로 위아래로 쌓는다.
        */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          {heading !== null && <h2 className={headingHidden ? 'sr-only' : TYPE_NAME}>{heading}</h2>}

          {/*
            **보내기와 다시 받기가 나란히 선다.** 글을 다 읽은 사람이 하는 일이 그 둘이고, 같은 일에
            손잡이가 여럿이면 어느 것이 무엇인지 세어 봐야 한다.
          */}
          {(chrome.canShare || chrome.makeInHeader) && (
            <div
              className={
                chrome.canShare && chrome.makeInHeader
                  ? 'grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:flex sm:shrink-0'
                  : 'flex sm:shrink-0'
              }
            >
              {chrome.canShare && <ShareReadingButton target={target} />}
              {chrome.makeInHeader && makeButton('pill', stale || !chrome.canShare ? 'primary' : 'secondary')}
            </div>
          )}
        </div>

        {/* 다음 글에 대한 말은 그 버튼 아래다 — 사이 물음과 풀이권 이야기 */}
        {chrome.makeInHeader && ask}
        {chrome.makeInHeader && creditsNote !== null && (
          <p className="text-small leading-5 text-secondary">{creditsNote}</p>
        )}
      </header>
      )}

      {/* 맨 위 — 가입 전에 읽던 문단. 검사 전의 새 글은 여기 안 선다: 저장된 그 원문뿐이다 */}
      {showsCarry && carry !== null && <CarryCard preview={carry.preview} />}

      {/*
        **다시 받는 버튼이 글 위에 선다.** 그것은 글을 읽기 전에 정하는 일이라, 8천 자 뒤에 있으면 없는
        것과 같다.
      */}
      {!chrome.makeInHeader && makeBlock}
      {alert}

      {phase === 'loading' ? (
        <>
          {betweenSummaryAndBody}
          <LoadingState rows={readingOutline(outline, progress)} />
        </>
      ) : reading === null ? (
        /*
          **빈 자리는 한 겹이다** — 위의 버튼 칸이 「아직 받은 풀이가 없어요」를 이미 말한다. 그 아래 점선 상자가 같은 말을
          또 했고, 궁합 화면에서는 한 사람 풀이의 소개(「핵심 성향, 강점…」)까지 들고 섰다(화면 갤러리 감사 2026-10-09).
        */
        betweenSummaryAndBody
      ) : (
        <Result
          reading={reading}
          target={target}
          isMock={isMock}
          tones={tones}
          betweenSummaryAndBody={betweenSummaryAndBody}
          matchNames={matchNames}
        />
      )}

      {/*
        **읽고 나서 곧바로 묻는다 — 글 바로 아래다.** 시점이 값을 정한다. 무엇이 이 자리를 막는지는
        `panelChrome` 의 `asksFeedback` 이 든다 — 규칙을 여기 한 벌 더 적으면 두 벌이 언젠가 갈린다.
        본문 끝에 공유 칸을 한 번 더 세우지 않는다 — 같은 문 앞의 손잡이가 둘이 된다.
      */}
      {/* `reading` 을 한 번 더 보는 것은 타입 검사기 때문이다 — 판단은 위에서 끝났다 */}
      {chrome.asksFeedback && reading !== null && reading.sourceRunId !== null && (
        <div className={READING_COLUMN}>
          <ReadingFeedback target={target} runId={reading.sourceRunId} given={reading.myFeedback} />
        </div>
      )}

      {/*
        **누를 수 없는 자리에는 창도 없다.** 이 창은 만드는 버튼이 여는 것이라, 버튼이 없는 화면(만드는 동안 · 동의가
        만드는 글의 성공 경로)에서는 열릴 길이 없다. 닫힌 채 실려 오면 버튼 글자가 화면에 두 벌 남고,
        검사가 그 글자를 세어 「만드는 버튼이 있나」를 늘 참으로 만든다.
      */}
      {chrome.hideMake ? null : (
      <ConfirmDialog
        open={asking}
        onClose={closeAsking}
        /*
          「아까 보던 내용」이 서 있으면 좁은 화면에서는 창을 아래에 붙인다 — 가운데 창은 맨 위의 그 문단을 덮는다. 그 문단을
          보며 그 답을 받을지 정하는 자리다(ADR 0143 「덧」).
        */
        className={showsCarry ? 'max-sm:mb-6' : undefined}
        lead={
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-cream text-cream-ink">
            <Icon name="ticket" className="size-5" />
          </span>
        }
        title="풀이권 1장을 사용하시겠어요?"
        /* 지금 글을 잃는 누름은 위험 색이다 — 「목록에서 빼기」 창과 같은 무게(B5). 잃을 글이 없으면 첫 초점도 받기 쪽이다 */
        confirmLabel={reading === null ? `${noun} 받기` : `${noun} 다시 받기`}
        onConfirm={confirmGenerate}
        danger={reading !== null}
        firstFocus={reading === null ? 'confirm' : 'cancel'}
      >
        <p>{READING_USES_TICKET_NOTE}</p>
        {reading !== null && <p className="font-medium text-danger">{READING_REPLACES_NOTE}</p>}
      </ConfirmDialog>
      )}
      {buy.notice}
    </>
  );
}
