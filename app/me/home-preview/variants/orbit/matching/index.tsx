import Link from 'next/link';

import { boardNotes } from '@/src/lib/discovery';
import { ELEMENTS, ELEMENT_KO, STEM_INFO } from '@/src/lib/saju';

import type { VariantProps } from '../..';
import { previewHref } from '../../../shared/preview-href';
import { Arrow, BUTTON } from '../ui';
import { MATCHING_COPY as COPY } from './copy';
import { Deck, type MeMark } from './deck';
import { BottomBar, TopBar } from './menu';
import { EmptyOrbit } from './orbit-art';

/*
  **3차 · 관계 지도의 매칭 — 후보가 내 궤도 바깥에서 다가온다.**

  홈에서 나는 지도의 가운데였고 저장한 사람이 둘레를 돌았다. 매칭은 그 지도의 **바깥 궤도**다: 오늘의 후보
  셋이 점선 궤도에서 기다리고, 지금 보는 한 사람만 안쪽으로 끌려 들어와 **내게 적은 오행의 자리**에 선을 댄다.
  넘기면 궤도 밖으로 튕겨 나가고, 궁합을 요청하면 나에게로 빨려 든다.

  **주인공은 카드다.** 사진이 맨 위, 이름 · 점수 · 보완 기운 · 소개 순으로 읽힌다(PRD §6.1.1). 지도는 데스크톱에서
  카드 옆에 서는 맥락이고, 폰에서는 카드 속 작은 궤도 도식(나 ↔ 채워 주는 기운)이 그 일을 한다.

  **후보 점에는 일간 글자를 안 쓴다.** 홈의 사람 점은 일간 글자와 오행 색이었지만, 후보의 명식은 공개되지 않는다
  (`DISCOVERY_DISCLOSURE.hidden`). 후보 점은 사진이고, 오행 색은 **그 사람이 채워 주는 기운**에만 입힌다.
*/

export default function Screen({ state }: VariantProps) {
  const me = meOf(state);

  return (
    <div className="flex min-w-0 flex-col gap-7 sm:gap-9">
      <TopBar unread={state.unread} unreadChat={state.unreadChat} current="/me/matching" />

      {me === null ? (
        <NotJoined kind="guide" />
      ) : (
        <Deck
          me={me}
          cards={state.cards}
          explorationNote={boardNotes({ viewerMissingCount: 1, hasExploration: state.cards.some((card) => card.exploration) }).explorationNote}
        />
      )}

      {/* 쉬는 사람의 자리는 상태 막대에 없다 — 같은 모양을 접어서 세워 둔다 */}
      {me !== null && (
        <details className="group rounded-[1.5rem] border border-dashed border-border-strong">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm font-semibold text-secondary [&::-webkit-details-marker]:hidden">
            {COPY.restingPeek}
            <span aria-hidden="true" className="text-lg transition group-open:rotate-45">+</span>
          </summary>
          <div className="px-3 pb-3 sm:px-4 sm:pb-4">
            <NotJoined kind="resting" />
          </div>
        </details>
      )}

      <BottomBar unreadChat={state.unreadChat} current="/me/matching" />
    </div>
  );
}

/** 내 일간과 오행 다섯 — 지도의 가운데와 안쪽 궤도가 먹는다. 명식 전부는 브라우저로 안 내려간다 */
function meOf({ self }: VariantProps['state']): MeMark | null {
  if (self === null) return null;
  const stem = self.saju.pillars.dayMaster;
  const info = STEM_INFO[stem];
  const { counts, glyphCount } = self.saju.analysis.elements;
  return {
    stem,
    element: info.element,
    spoken: `일간 ${stem}, ${info.ko}${ELEMENT_KO[info.element]}`,
    elements: ELEMENTS.map((element) => ({
      element,
      ko: ELEMENT_KO[element],
      count: counts[element],
      /* 후보를 뽑는 셈과 같은 문턱 — 여덟 글자의 20% 보다 적으면 「적은 기운」이다 */
      low: glyphCount > 0 && counts[element] / glyphCount < 0.2,
    })),
  };
}

/**
 * 참여가 아직 안 열렸거나(내 사주 없음) 쉬고 있는 사람 — **지도는 서되 바깥 궤도가 비어 있다.**
 * 실제 화면은 글 카드 한 장이었다. 여기서는 빈 궤도 자체가 「아직 아무도 다가오지 않는다」를 말한다.
 */
function NotJoined({ kind }: { kind: 'guide' | 'resting' }) {
  const guide = kind === 'guide';
  return (
    <section className="grid items-center gap-6 overflow-hidden rounded-[2rem] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-8 sm:p-8">
      <EmptyOrbit filled={!guide} label={COPY.me} />
      <div className="flex min-w-0 flex-col items-start gap-3">
        <p className="text-[11px] font-bold tracking-[0.08em] text-accent">{COPY.title}</p>
        <h2 className="text-balance text-[1.5rem] font-bold leading-[1.25] tracking-[-0.04em] sm:text-[1.75rem]">{guide ? COPY.guideTitle : COPY.restingTitle}</h2>
        <p className="text-[15px] leading-6 text-secondary">{guide ? COPY.guideBody : COPY.restingBody}</p>
        <Link
          href={previewHref(guide ? '/me' : '/me/settings')}
          className={`${guide ? BUTTON.primary : BUTTON.secondary} mt-2 w-full sm:w-auto`}
        >
          {guide ? COPY.guideAction : COPY.restingAction} <Arrow />
        </Link>
      </div>
    </section>
  );
}
