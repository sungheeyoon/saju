import Link from 'next/link';
import { redirect } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';

import { supabaseOnServer } from '../../auth/server-client';
import { dbFailure } from '../../db-error';
import { BUTTON_PRIMARY } from '../../ui/buttons';
import { Icon } from '../../ui/icons';
import { TYPE_DISPLAY } from '../../ui/surfaces';
import { readAccount } from '../account';
import { AccountNotice } from '../account-notice';
import { boardStamp, candidatesForViewer, passedForViewer } from '../candidates';
import { myDiscoveryProfile } from '../discovery/discovery-profile';
import { payloadForViewer } from '../payload';
import { selfElementSummary } from '../summary';
import { MatchingExperience, type DeckCard } from './matching-experience';
import { meMarkOf, type MeMark } from './me-mark';
import { QuietOrbit } from './orbit-map';

export const metadata = {
  title: '오늘의 인연',
  description: '예측 궁합 점수와 서로 보완하는 기운으로 나에게 맞는 인연을 발견하세요.',
  robots: { index: false, follow: false },
};

/**
 * 덱으로 보는 오늘의 인연 — **목록과 같은 자료를 읽는다**(ADR 0037).
 *
 * 카드 모양만 다르고 뽑는 일도 자르는 일도 홈의 목록과 한 자리에서 난다
 * (`candidatesForViewer` → `my_discovery_board`). 화면이 둘이라고 규칙이 둘이면
 * 같은 사람이 화면마다 다른 점수를 받는다.
 *
 * **참여를 여는 호출을 여기서도 한다.** 홈이 목록을 여는 것이 곧 참여를 여는 일인데
 * (`board.tsx`), 이 화면만 보고 홈에 안 들르는 사람이 생기면 그 문을 한 번도 안
 * 지난다. 같은 RPC 라 두 번 불려도 한 번만 연다.
 */
export default async function MatchingPage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { state } = await readAccount<{ status: string; self_person_id: string | null }>(
    supabase,
    'status, self_person_id',
  );
  if (isBlocked(state)) {
    return (
      <main className="app-shell flex flex-1 flex-col gap-7 py-9 sm:py-12">
        <AccountNotice state={state} />
      </main>
    );
  }

  /*
    **내 사주가 없으면 견줄 것이 없다.** 후보를 뽑는 셈이 내 오행 요약에서 시작하므로
    이 자리에서 멈추고 채우러 가는 길을 준다 — 빈 덱을 세우면 「소개할 인연이 없다」로
    읽히고, 실제 이유(내 것이 없다)는 화면 어디에도 안 적힌다.
  */
  const self = await selfElementSummary();
  if (self === null) return <Guide me={null} />;

  /*
    **지도의 가운데는 내 일간이다.** 요약에는 오행 개수만 있어서 일간 글자는 내 명식을 내주는 문
    (`payloadForViewer`)에서 한 번 더 읽는다. 못 읽으면 가운데만 「나」로 비고 다섯 알은 요약대로 선다.
  */
  const [profile, mine] = await Promise.all([myDiscoveryProfile(), payloadForViewer(self.personId)]);
  const me = meMarkOf(mine?.kind === 'ok' ? mine.payload.saju.pillars.dayMaster : null, self.summary);

  /** 못 읽으면 미리 안 거른다 — 끈 사람이면 아래 RPC 가 참여를 안 연다 */
  if (profile.ok && profile.value?.optedOut) return <Resting me={me} />;

  // eslint-disable-next-line no-restricted-syntax -- 옛 자리(ADR 0085): 문으로 옮기면 지운다
  const { data: joined, error: joinError } = await supabase.rpc('ensure_discovery_participation', {
    p_person_id: self.personId,
    p_summary: self.summary,
  });
  /* 부름이 터진 것은 「자격이 없다」가 아니다 — 안내를 세우면 사주가 있는 사람에게 채우라고 한다(ADR 0078) */
  if (joinError) throw dbFailure(joinError, 'ensure_discovery_participation');
  if (joined !== true) return <Guide me={me} />;

  // 목록을 **먼저** 읽는다 — 그 호출이 하루 지난 스냅샷을 새로 만들 수 있다.
  const board = await candidatesForViewer(self.summary);
  const stamp = await boardStamp();
  /*
    **보관함은 서버가 든다.** 화면 상태로만 쌓으면 새로 고치거나 탭을 옮긴 순간 비고,
    그러면 추천에서는 빠져 있는데 꺼낼 자리도 없는 사람이 생긴다.
  */
  const passed = await passedForViewer(self.summary);

  /*
    **증표를 뗀 평범한 값으로 넘긴다.** `CandidateCard` 는 밖에서 지을 수 없게 심볼
    키를 들고 있는데, 심볼은 서버에서 브라우저로 건너가지 못한다 — 그대로 넘기면
    조용히 빠지거나 직렬화가 막힌다. 넘길 칸을 여기서 한 번 적는다.
  */
  const cards: DeckCard[] = board.cards.map((card) => ({
    candidateUserId: card.candidateUserId,
    nickname: card.nickname,
    intro: card.intro,
    hasPhoto: card.hasPhoto,
    avatarElement: card.avatarElement,
    exploration: card.exploration,
    activity: card.activity,
    previewScore: card.previewScore,
    verdict: card.verdict,
    reason: card.reason,
    balanceLabel: card.balanceLabel,
    highlights: card.highlights.map((highlight) => ({
      element: highlight.element,
      text: highlight.text,
    })),
  }));

  const passedCards: DeckCard[] = passed.map((card) => ({
    candidateUserId: card.candidateUserId,
    nickname: card.nickname,
    intro: card.intro,
    hasPhoto: card.hasPhoto,
    avatarElement: card.avatarElement,
    exploration: false,
    activity: null,
    previewScore: card.previewScore,
    verdict: card.verdict,
    reason: card.reason,
    balanceLabel: card.balanceLabel,
    highlights: card.highlights.map((highlight) => ({
      element: highlight.element,
      text: highlight.text,
    })),
  }));

  return (
    <MatchingExperience
      /* 새 목록이 곧 새 덱이다 — 남은 초를 세는 버튼도 여기서 다시 선다 */
      key={stamp?.generatedAt ?? 'none'}
      cards={cards}
      me={me}
      passed={passedCards}
      teaser={board.teaser}
      notice={board.notice}
      explorationNote={board.explorationNote}
      waitSeconds={stamp?.waitSeconds ?? 0}
    />
  );
}

/**
 * 덱이 서지 않는 자리 — 아무도 다가오지 않는 작은 궤도 곁에 이유 한 줄과 갈 길 하나.
 * 내 사주가 없으면(`me: null`) 궤도의 가운데도 비어 있다.
 */
function Quiet({ me, title, line, href, action }: { me: MeMark | null; title: string; line: string; href: string; action: string }) {
  return (
    <main className="app-shell flex flex-1 flex-col gap-5 py-6 sm:gap-7 sm:py-10">
      <h1 className={TYPE_DISPLAY}>오늘의 인연</h1>
      <section className="grid items-center gap-6 overflow-hidden rounded-[2rem] bg-cream p-6 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-10 sm:p-10">
        <QuietOrbit me={me} />
        <div className="flex min-w-0 flex-col items-start gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="font-rounded text-[1.625rem] leading-[1.35] text-foreground sm:text-[2rem]">{title}</h2>
            <p className="max-w-prose text-[15px] leading-6 text-secondary">{line}</p>
          </div>
          <Link href={href} className={BUTTON_PRIMARY}>
            {action}
            <Icon name="arrow" className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

/** 참여가 열릴 자리가 아직 아니다 — 이름이나 내 사주가 비어 있다 */
function Guide({ me }: { me: MeMark | null }) {
  return (
    <Quiet
      me={me}
      title="먼저 내 사주와 이름이 필요해요"
      line="나와 맞는 인연을 찾으려면 내 사주의 오행 구성이 있어야 해요. 내 사주를 저장하고 닉네임을 지으면 오늘의 인연이 섭니다."
      href="/me"
      action="내 사주로 가기"
    />
  );
}

/** 쉬기로 한 사람에게 서는 자리 — 홈의 목록과 같은 말을 한다 */
function Resting({ me }: { me: MeMark }) {
  return (
    <Quiet
      me={me}
      title="인연 찾기를 쉬고 있습니다"
      line="지금은 다른 참여자에게 내 프로필이 공개되지 않으며, 새로운 사람도 소개받지 않습니다. 내 사주와 저장한 사람은 그대로 남아 있습니다."
      href="/me/settings"
      action="계정 관리 열기"
    />
  );
}
