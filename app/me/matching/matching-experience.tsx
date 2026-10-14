'use client';

import { useRef, useState, type ReactNode } from 'react';

import { MATCH_PILLARS_DISCLOSURE } from '@/src/lib/consent/notice';
import { DISCOVERY_TEASER } from '@/src/lib/discovery/copy';
import { REQUEST_OPENS_CHAT_NOTE } from '@/src/lib/matching/copy';
import { REQUEST_RESERVES_NOTE } from '@/src/lib/reading/notes';

import { elementScope } from '../../ui/element-tone';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon, type IconName } from '../../ui/icons';
import { TYPE_DISPLAY, TYPE_META } from '../../ui/surfaces';
import { CandidatePhoto } from './candidate-photo';
import { supplyOf, type DeckCard } from './deck-card';
import type { MeMark } from './me-mark';
import { ApproachMap, Legend } from './orbit-map';
import { PassedConnections } from './passed-connections';
import { ReportBlock } from '../requests/report-block';
import { DeckButtons, DeckDots, TodayCard } from './today-card';
import { DetailSheet, openSheet } from '../../ui/sheet';
import { Letter } from './letter';
import { useDeck } from './use-deck';
import { Feedback } from './deck-feedback';
import { EmptyDeck } from './empty-deck';
import { SupplyBody } from './supply-body';


const EMPTY_CARDS: readonly DeckCard[] = [];

type View = 'today' | 'passed';

/*
  **오늘의 인연 — 한 사람을 한 장의 편지처럼**(부드러움, ADR 0109).

  **카드 한 장은 폰과 넓은 화면이 같다**(`today-card.tsx`, 운영자 2026-09-25) — 사진이 주인공이고 그 위에 이름 · 점수 ·
  판정 · 채워 주는 기운 · 소개 한 줄, 사진 아래에 글자 단추 줄. 끌어서 넘기지 않는다.

  **폰은 한 화면에 그 한 장이다.** 페이지는 위아래로 안 움직이고, 까닭 · 기운의 문장 · 소개 전문 · 궤도 · 「참고 점수」
  고지는 ⓘ 시트가 든다. **넓은 화면은 두 열이다** — 왼쪽에 같은 카드, 오른쪽에 「내 궤도로 다가오는 인연」 지도와 폰의
  시트가 들던 것을 펼쳐 둔다. 참고 점수 고지는 넓은 화면에서는 목록 머리 한 줄이다.

  동작은 옛 덱 그대로다 — 덱의 상태와 누름(넘기기 · 요청 · 되돌리기 · 차단)은 `useDeck` 이 들고, 여기는 그리기만 한다.

  **덱은 여섯 자리이고 떠나면 채워진다**(ADR 0115). 넘기거나 요청하면 응답이 실어 온 새 목록에 채운 사람이 뒤에
  붙어 오고, `sync` 가 그 사람을 덱 뒤에 합친다 — 덱을 통째로 다시 세우지 않는다. 새로고침 단추는 없다.
*/
export function MatchingExperience({
  lead,
  tail,
  cards,
  me,
  notice,
  explorationNote,
  passed: passedFromServer = EMPTY_CARDS,
}: {
  /** 받은 요청 띠 한 줄 — 제목 아래, 덱 위에 선다. 없으면 아무것도 안 선다(ADR 0130) */
  lead?: ReactNode;
  /** 덱 아래 — 「인연 기록 N」 한 줄(2026-09-29 u2). 비면 아무것도 안 선다 */
  tail?: ReactNode;
  cards: readonly DeckCard[];
  /** 지도의 가운데 — 내 일간과 오행 다섯 */
  me: MeMark;
  /** 서버가 든 보관함 — 새로 고쳐도 남는다 */
  passed?: readonly DeckCard[];
  notice: string | null;
  explorationNote: string | null;
}) {
  const {
    profile, next, remaining, passed, hidden, total, counter, exit, leaving, announcement, flash, failure, working,
    asking, setAsking, buy, mapCards, statusOf, askToRequest, pass, send, restoreCard, undo, blocked: leaveBlocked,
  } = useDeck({ cards, passedFromServer });
  const [view, setView] = useState<View>('today');
  const sheet = useRef<HTMLDialogElement>(null);

  /** 차단했다 — 열려 있던 ⓘ 시트를 닫고 덱에서 뺀다 */
  function blocked(card: DeckCard) {
    sheet.current?.close();
    leaveBlocked(card);
  }

  /** 되돌릴 한 줄 · 실패 · 방금 한 일 — 한 화면에 한 자리에만 선다 */
  const feedback = (
    <Feedback
      undo={hidden !== null ? undo : null}
      working={working}
      failure={failure}
      announcement={announcement}
      flash={flash}
    />
  );

  /** 카드 위 — 되돌리기 줄이 없다(카드 아래 ↶ 가 같은 일을 한다). 줄은 덱이 비었을 때만 선다 */
  const cardFeedback = (
    <Feedback
      onCard
      undo={null}
      working={working}
      failure={failure}
      announcement={announcement}
      flash={flash}
    />
  );

  /** 폰의 ⓘ 시트와 넓은 화면의 옆 열이 함께 드는 것 — 판정의 까닭 · 채워 주는 기운의 문장. 지나친 인연의 시트도 같은 것을 든다 */
  const detailsOf = (card: DeckCard) => (
    <>
      <div className="flex flex-col gap-1">
        <p className="font-rounded text-heading leading-snug text-[var(--ink)]">{card.verdict}</p>
        <p className="max-w-prose text-note leading-6 text-foreground">{card.reason}</p>
      </div>
      <div className="flex flex-col gap-2 rounded-tile bg-surface p-4 ring-1 ring-border">
        <SupplyBody card={card} explorationNote={explorationNote} />
      </div>
    </>
  );
  const details = profile && detailsOf(profile);
  /*
    소개 전문 — 폰은 ⓘ 시트가, 넓은 화면은 **카드 열** 아래가 든다. 오른쪽 열(지도 + 까닭 + 기운)이 카드보다 길어 왼쪽 열
    아래가 통째로 비었다(화면 감사 2026-10-09). 그 사람의 말이라 그 사람 카드 밑이 제자리이기도 하다.
  */
  const letterOf = (card: DeckCard) => <Letter key={card.candidateUserId} nickname={card.nickname} intro={card.intro} />;
  const letter = profile && letterOf(profile);

  return (
    <main className="app-shell flex min-w-0 flex-1 flex-col gap-3 py-6 sm:gap-7 sm:py-12">
      {/*
        **폰에서는 제목과 보기 전환이 한 줄에 선다**(2026-09-25). 두 칸짜리 토글이 폰에서 한 줄을 통째로 썼다 — 폰에는
        「지금 아닌 쪽」으로 가는 알약 하나와, 그 위에 덱 순번 점이 선다. 지나친 인연은 가끔 여는 보관함이라 오늘의 인연과
        같은 무게일 까닭이 없다.
      */}
      <header className="flex flex-row items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className={TYPE_META} suppressHydrationWarning>{todayLabel()}</p>
          <h1 className={TYPE_DISPLAY}>오늘의 인연</h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:hidden">
          {view === 'today' && profile !== undefined && <DeckDots total={total} counter={counter} />}
          <button
            type="button"
            onClick={() => setView(view === 'today' ? 'passed' : 'today')}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-3.5 text-small font-semibold text-foreground ring-1 ring-border hover:ring-border-strong active:scale-[0.97]"
          >
            {view === 'today' ? <Icon name="undo" className="size-4" /> : <Icon name="heart" className="size-4" />}
            {view === 'today' ? '지나친 인연' : '오늘의 인연'}
            <span className="tabular-nums text-secondary">
              {view === 'today' ? passed.length : remaining.length}
              <span className="sr-only">명</span>
            </span>
          </button>
        </div>
        <div role="group" aria-label="보기" className="hidden grid-cols-2 gap-1 rounded-full bg-surface p-1 ring-1 ring-border sm:grid">
          <ViewButton on={view === 'today'} onClick={() => setView('today')} icon="heart" label="오늘의 인연" count={remaining.length} />
          <ViewButton on={view === 'passed'} onClick={() => setView('passed')} icon="undo" label="지나친 인연" count={passed.length} />
        </div>
      </header>

      {/*
        목록 머리 — 참고 점수라는 사실과(PRD 「추천은 여섯 자리 덱이다」) 목록이 비슷한 까닭. 카드마다 되풀이하지 않는다.
        **폰은 이 줄을 ⓘ 시트가 든다** — 한 화면을 그 사람에게 준다(2026-09-25).
      */}
      {view === 'today' && profile !== undefined && (
        <div className="-mt-4 hidden max-w-3xl flex-col gap-1 lg:flex">
          <p className="text-fine leading-5 text-secondary">{DISCOVERY_TEASER}</p>
          {notice !== null && <p className={TYPE_META}>{notice}</p>}
        </div>
      )}
      {view === 'today' && profile === undefined && notice !== null && <p className={`${TYPE_META} max-w-prose sm:-mt-2`}>{notice}</p>}

      {/*
        **답할 요청이 덱보다 먼저다**(시안 g · u, ADR 0130). 받은 요청은 내가 답할 때까지 남는 유일한 것이라 덱 위에 띠 한
        줄로 선다 — 누르면 카드 시트가 올라온다. 요청이 없으면 이 자리는 비어 사진이 그 높이를 도로 가져간다.
      */}
      {lead}

      {view === 'passed' ? (
        <PassedConnections
          cards={passed}
          working={working || exit === 'right'}
          onRestore={async (card) => {
            const message = await restoreCard(card);
            if (message === null) setView('today');
            return message;
          }}
          onBack={() => setView('today')}
          map={
            passed.length > 0 ? (
              <ApproachMap
                shape="arc"
                me={me}
                cards={passed.slice(0, 6)}
                statusOf={() => 'kept'}
                className="mx-auto max-w-[28rem]"
              />
            ) : null
          }
          feedback={feedback}
          detail={(card) => (
            <>
              {detailsOf(card)}
              {letterOf(card)}
            </>
          )}
        />
      ) : profile === undefined ? (
        <EmptyDeck me={me} feedback={feedback} />
      ) : (
        <section
          aria-label="인연 카드"
          className="flex min-h-0 flex-1 flex-col lg:grid lg:flex-none lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]"
        >
          {/* 그 사람 한 장 — 폰은 남는 높이를 다 쓰고, 넓은 화면은 4:5 */}
          <article
            aria-label={`${profile.nickname} 님`}
            aria-busy={!!exit || working}
            className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 lg:flex-none lg:gap-4"
          >
            <TodayCard
              profile={profile}
              next={next}
              exit={exit}
              leaving={leaving}
              feedback={cardFeedback}
              onInfo={() => openSheet(sheet.current)}
              onBlocked={() => blocked(profile)}
            />
            <DeckButtons
              actions={{
                undo,
                pass,
                request: askToRequest,
                canUndo: !!hidden && !working && exit !== 'right',
                busy: !!exit || working,
              }}
            />
            <div className={`${elementScope(supplyOf(profile))} hidden lg:block`}>{letter}</div>
          </article>

          {/*
            오른쪽(넓은 화면) — 「내 궤도로 다가오는 인연」과, 폰에서 ⓘ 시트가 들던 것. 그림이 주인공이고 색은 채워지는 한
            자리에만 선다.
          */}
          <div className="hidden min-w-0 flex-col gap-4 lg:flex">
            <section aria-labelledby="matching-map" className="flex flex-col overflow-hidden rounded-paper bg-cream">
              <div className="flex items-baseline justify-between gap-3 px-6 pt-6">
                <h2 id="matching-map" className="font-rounded text-section leading-8 text-foreground">
                  내 궤도로 다가오는 인연
                </h2>
                <p className="shrink-0 text-small font-semibold text-secondary">
                  나와 맞는 오늘의 인연 <span className="tabular-nums text-foreground">{counter}</span>
                </p>
              </div>
              <div className="flex items-center px-8 py-4">
                <ApproachMap shape="round" me={me} cards={mapCards} statusOf={statusOf} className="mx-auto max-w-[32rem]" />
              </div>
              <Legend className="px-6 pb-4" />
            </section>
            <div key={profile.candidateUserId} className={`${elementScope(supplyOf(profile))} flex flex-col gap-4`}>
              {details}
            </div>
          </div>
        </section>
      )}

      {/*
        **덱 다음은 지나간 것이다**(2026-09-29 u2) — 인연 궁합과 지난 요청이 「인연 기록 N」 한 줄로 접혀 선다. 폰은 덱이
        뷰포트에 묶여 있어 이 줄의 높이만큼 카드 사진이 줄고, 페이지는 여전히 한 화면이다.
      */}
      {tail}

      {/* 폰의 ⓘ — 사진 위에 못 둔 것 전부와 궤도 · 참고 점수 고지 */}
      {profile && (
        <DetailSheet
          sheet={sheet}
          nickname={profile.nickname}
          menu={<ReportBlock key={profile.candidateUserId} userId={profile.candidateUserId} nickname={profile.nickname} onBlocked={() => blocked(profile)} />}
        >
          <div className={`${elementScope(supplyOf(profile))} flex flex-col gap-4`}>
            {details}
            {letter}
            <div className="overflow-hidden rounded-card bg-cream px-2 pt-3">
              <ApproachMap shape="arc" me={me} cards={mapCards} statusOf={statusOf} className="mx-auto max-w-[28rem]" />
            </div>
            <p className="text-fine leading-5 text-secondary">{DISCOVERY_TEASER}</p>
            {notice !== null && <p className={TYPE_META}>{notice}</p>}
          </div>
        </DetailSheet>
      )}

      {/*
        **요청 확인 창은 목록과 같은 말을 한다.** 문구가 화면마다 갈리면 어느 쪽이
        실제로 나가는 약속인지 알 수 없다 — 둘 다 정책이 지어 온 문장이다. 「채팅은 아직 없다」는
        제한문은 채팅이 선 뒤(ADR 0091) 걷었다 — 대화방은 수락하는 순간 열린다(#147).
      */}
      {profile && (
        <ConfirmDialog
          open={asking}
          onClose={() => setAsking(false)}
          /* 풀이권 확인 창과 같은 판 · 같은 단추 줄이다(확인 창 한 벌 — 첫 초점은 「취소」, ADR 0166) */
          className={elementScope(supplyOf(profile))}
          lead={
            <div className="flex items-center gap-3">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-full bg-[var(--tile)] text-section ring-2 ring-[var(--tile)]">
                <CandidatePhoto card={profile} />
              </span>
              <span className="grid size-10 place-items-center rounded-full bg-[var(--tile)]">
                <ElementSymbol element={supplyOf(profile)} className="size-6" />
              </span>
            </div>
          }
          title={`${profile.nickname} 님에게 상세 궁합을 요청할까요?`}
          confirmLabel={
            <>
              <Icon name="heart" className="size-[18px]" />
              요청 보내기
            </>
          }
          onConfirm={() => {
            setAsking(false);
            send();
          }}
          busy={working}
        >
          <p>{REQUEST_RESERVES_NOTE}</p>
          <p>{MATCH_PILLARS_DISCLOSURE}</p>
          <p>{REQUEST_OPENS_CHAT_NOTE}</p>
        </ConfirmDialog>
      )}
      {buy.notice}
    </main>
  );
}

/** 제목 위 날짜 — 홈의 인사와 같은 형식. 서버와 브라우저의 시간대가 달라도 한국 날짜로 선다 */
function todayLabel(): string {
  return new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' });
}

function ViewButton({ on, onClick, icon, label, count }: { on: boolean; onClick: () => void; icon: IconName; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-body font-semibold active:scale-[0.97] ${
        on ? 'bg-accent text-on-accent' : 'text-secondary hover:bg-surface-soft hover:text-foreground'
      }`}
    >
      <Icon name={icon} className="size-[18px]" />
      {label}
      <span
        className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-tag font-bold tabular-nums ${
          on ? 'bg-[color-mix(in_srgb,var(--on-accent)_20%,transparent)]' : 'bg-surface-soft text-foreground'
        }`}
      >
        {count}
        <span className="sr-only">명</span>
      </span>
    </button>
  );
}
