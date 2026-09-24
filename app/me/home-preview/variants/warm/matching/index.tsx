import Link from 'next/link';

import { DISCOVERY_TEASER, boardNotes } from '@/src/lib/discovery';
import { ELEMENTS, STEM_INFO } from '@/src/lib/saju';

import type { VariantProps } from '../..';
import { previewHref } from '../../../shared/preview-href';
import { PRIMARY } from '../buttons';
import { rounded } from '../fonts';
import { Icon, ROOT_CLASS } from '../symbols';
import { Deck, QuietOrbit } from './deck';
import { Dock, TopBar } from './menu';
import type { MeMark } from './orbit-map';

/*
  **3차 · warm 매칭 — 「오늘의 인연」 한 사람이 주인공.**

  홈이 아침 인사 → 인용 → 나 → 사람들로 내려왔다면, 매칭은 **한 사람을 한 장의 편지처럼** 건넨다. 큰 사진 한 장,
  그 사람의 이름을 둥근 서체로 크게, 예측 궁합 점수를 숫자로 과감하게, 「이 사람이 채워 주는 기운」을 홈의 다섯
  상징과 파스텔로, 소개는 크림색 편지지 위에 인용처럼. 카드는 그 사람이 채워 주는 오행의 색을 입는다 — 홈의 타일이
  일간 색을 입던 규칙을 매칭으로 옮긴 것이다.

  단추 위계는 홈의 세 층 그대로다: 「궁합 요청」 먹색 채움 알약(한 화면에 하나) · 「넘기기」 흰 동그라미 ·
  되돌리기는 테두리만. 데이팅 앱의 손짓(오른쪽 = 요청 확인, 왼쪽 = 넘기기)은 사진 위에서 흉내만 낸다 — 요청은 나가지 않는다.

  내 사주가 없으면 덱 대신 참여 안내가 선다(실제 화면의 `Guide` 와 같은 문장).

  **4차 · 지도를 섞다.** 관계 지도(orbit)의 「내 궤도로 다가오는 인연」을 부드러움으로 다시 그려(`orbit-map.tsx`)
  카드와 같은 상태를 읽게 했다. 넓은 화면은 카드 옆 온 궤도, 폰은 사진 위의 해돋이 띠. 빈 날 · 다 만난 날 ·
  내 사주 없음은 아무도 다가오지 않는 작은 궤도로 선다.
*/
export default function Screen({ state }: VariantProps) {
  const me = meOf(state);
  const exploring = state.cards.some((card) => card.exploration);
  const { explorationNote } = boardNotes({ viewerMissingCount: 1, hasExploration: exploring });

  return (
    <div className={`${ROOT_CLASS} flex min-w-0 flex-col gap-5 break-keep sm:gap-8`}>
      <TopBar active="/me/matching" unread={state.unread} unreadChat={state.unreadChat} />

      {me === null ? (
        <>
          <Heading />
          <Guide />
        </>
      ) : (
        <Deck
          me={me}
          cards={state.cards}
          teaser={DISCOVERY_TEASER}
          explorationNote={explorationNote}
          heading={<Heading />}
        />
      )}

      <Dock active="/me/matching" unreadChat={state.unreadChat} />
    </div>
  );
}

/** 지도의 가운데와 안쪽 궤도 — 내 일간과 오행 다섯. 문턱은 후보를 뽑는 셈과 같다(여덟 글자의 20% 보다 적으면 적은 기운) */
function meOf({ self }: VariantProps['state']): MeMark | null {
  if (self === null) return null;
  const stem = self.saju.pillars.dayMaster;
  const { counts, glyphCount } = self.saju.analysis.elements;
  return {
    stem,
    element: STEM_INFO[stem].element,
    elements: ELEMENTS.map((element) => ({
      element,
      count: counts[element],
      low: glyphCount > 0 && counts[element] / glyphCount < 0.2,
    })),
  };
}

/** 날짜 한 줄 + 「오늘의 인연」 — 홈의 인사와 같은 단(고운돋움 표시 단) */
function Heading() {
  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  return (
    <header className="flex flex-col gap-1">
      <p className="text-[13px] font-semibold text-secondary">{today}</p>
      <h2 className={`${rounded.className} text-[1.75rem] leading-[1.3] tracking-[-0.02em] text-foreground sm:text-[2.25rem]`}>
        오늘의 인연
      </h2>
    </header>
  );
}

/** 참여가 열릴 자리가 아직 아니다 — 실제 화면의 문장 그대로, 모양만 홈의 「내 사주 등록」 카드로 */
function Guide() {
  return (
    <section className="grid items-center gap-6 overflow-hidden rounded-[2rem] bg-[var(--cream)] p-6 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-10 sm:p-10">
      <QuietOrbit me={null} />
      <div className="flex min-w-0 flex-col items-start gap-5">
      <div className="flex flex-col gap-2">
        <h3 className={`${rounded.className} text-[1.625rem] leading-[1.35] text-foreground sm:text-[2rem]`}>
          먼저 내 사주와 이름이 필요해요
        </h3>
        <p className="max-w-prose text-[15px] leading-6 text-secondary">
          나와 맞는 인연을 찾으려면 내 사주의 오행 구성이 있어야 해요. 내 사주를 저장하고 닉네임을 지으면 오늘의 인연이 섭니다.
        </p>
      </div>
      <Link href={previewHref('/me')} className={`${PRIMARY} self-start`}>
        내 사주로 가기
        <Icon name="arrow" className="size-4" />
      </Link>
      </div>
    </section>
  );
}
