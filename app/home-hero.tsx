'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';

import { useBrowserSession } from './auth/browser-session';
import { PairTaste } from './pair-taste';
import { memberLandingOf } from './saju-landing';
import { SignedInProvider } from './signed-in';
import { SunMark, TaijiMark } from './ui/entry-marks';
import { PAPER_TOP } from './ui/surfaces';

/**
 * `/` 의 얼굴 — **로그인 전 첫 화면 하나다**(ADR 0144). 로그인한 사람은 세션을 안 순간 홈(`/me`)으로, 입력을 든 주소면
 * `/saju` 로 옮긴다(`saju-landing.ts`).
 *
 * 이 화면은 미리 그려지고 세션을 브라우저에서 읽는다 — 서버가 방문마다 세션을 묻지 않게. 그래서 **미리 그려진 HTML 이
 * 곧 첫 화면**이고, 회원은 세션을 아는 한 틱 동안 이 화면을 본 뒤 옮긴다. 빈 화면 대신 덜 맞는 화면을 보는 것이 맞바꾼 값이다.
 *
 * 계산기(`page.tsx` 가 만든다)에는 회원의 세션을 **모름**으로 내려보낸다 — 곧 떠날 화면에서 회원의 폼 모양이 한 번
 * 깜빡이지 않게, 그리고 서버로 입력을 보내는 로그인 전 결과가 회원에게 서지 않게(`useSessionKnown`, ADR 0143).
 */
export function HomeHero({ calculator }: { calculator: ReactNode }) {
  const { session } = useBrowserSession();
  const router = useRouter();

  useEffect(() => {
    if (session !== 'in') return;
    router.replace(memberLandingOf(window.location));
  }, [session, router]);

  /**
   * 두 입구 중 어느 쪽이 열려 있나. 계산기는 궁합 쪽이 열려 있는 동안에도 **내려 두지 않고 숨긴다** — 적던 생일과 선
   * 결과를 잃지 않게.
   */
  const [entry, setEntry] = useState<Entry>('self');
  /** 궁합 입구를 한 번이라도 열었나 — 연 뒤로는 닫아도 두 사람의 칸을 내려 두지 않는다 */
  const [pairOpened, setPairOpened] = useState(false);
  const pair = entry === 'pair';

  /** 입구를 고른다 — 초점은 탭에 남긴다(화살표로 두 입구를 오갈 수 있게). 입력 칸은 바로 아래다 */
  const open = (next: Entry) => {
    setEntry(next);
    if (next === 'pair') setPairOpened(true);
  };

  return (
    // 넓은 화면에서도 폼은 42rem 한 축이다 — 칸이 이름표와 값을 양 끝으로 가르지 않는 한 손 너비(PRD §3.1). 위에 소개를 따로
    // 세우지 않는다 — 폼이 첫 화면에 한 번에 보이는 쪽을 골랐다(운영자 2026-10-08)
    <div className="mx-auto w-full max-w-[42rem]">
      <header className={`relative ${PAPER_TOP}`}>
        <VisitorFace entry={entry} onEntry={open} />
      </header>

      {/* 머리와 폼이 **크림 종이 한 장**이다(`PAPER_TOP` · `PAPER_BOTTOM`, ADR 0132) — 틈 없이 붙는다 */}
      <section id="calculator" className="scroll-mt-24">
        <div id="self-panel" role="tabpanel" aria-labelledby="entry-self" hidden={pair}>
          {/* 제목은 눈에 안 보인다 — 바로 위 입구 「내 사주 보기」가 같은 말을 하고, 입구 아래 곧장 폼이 선다 */}
          <h2 className="sr-only">출생 정보를 입력해 주세요</h2>
          {/*
            계산기를 여기서 만들지 않는다 — `Suspense` 경계는 서버가 세운 것을 그대로 쓰고(`page.tsx`), 값만 통로로
            내려보낸다(`signed-in.tsx`). 모름까지 그대로 보낸다: 로그인 전 결과는 입력을 서버로 보내므로 세션을 알기 전에는 안 선다.
          */}
          <SignedInProvider value={session === 'in' ? 'unknown' : session}>{calculator}</SignedInProvider>
        </div>
        {/* 로그인 전 궁합 결과는 여는 순간 선다 — 미리 그려 두면 첫 화면에 폼 둘이 함께 실린다. 닫아도 숨기기만 한다 */}
        {pairOpened && (
          <div id="pair-panel" role="tabpanel" aria-labelledby="entry-pair" hidden={!pair}>
            <PairTaste />
          </div>
        )}
      </section>
    </div>
  );
}

type Entry = 'self' | 'pair';

/**
 * 첫 화면의 속 — 크림 종이의 위 토막이고, 아래 토막은 폼이다(ADR 0131 · 0132). 제목 한 줄, 설명 한 줄, 그리고 **두 입구** —
 * 「내 사주 보기」와 「궁합 보기」. 입구는 바로 아래 입력 칸을 고르는 탭이고, 둘 다 로그인 없이 로그인 전 결과까지 간다.
 */
function VisitorFace({ entry, onEntry }: { entry: Entry; onEntry: (entry: Entry) => void }) {
  /** 탭 목록의 화살표 — 두 입구 사이를 오간다(WAI-ARIA 탭 패턴) */
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next: Entry = entry === 'self' ? 'pair' : 'self';
    onEntry(next);
    document.getElementById(`entry-${next}`)?.focus();
  };

  return (
    <div className="relative px-3 pb-4 pt-5 sm:px-10 sm:pt-9">
      <div className="px-1">
        <h1 className="font-rounded text-[1.6rem] leading-[1.3] tracking-[-0.02em] text-foreground sm:text-[2rem]">
          나는 어떤 사람일까?
        </h1>
        <p className="mt-1 max-w-md text-sm leading-6 text-secondary">생일만 넣으면 사주가 보여 주는 나를 바로 볼 수 있어요.</p>
      </div>
      <div role="tablist" aria-label="무엇을 볼까요" className="mt-4 grid grid-cols-2 gap-0.5 rounded-[0.9rem] bg-surface-sunken p-0.5">
        {ENTRIES.map(({ id, Mark, title }) => (
          <button
            key={id}
            id={`entry-${id}`}
            type="button"
            role="tab"
            aria-selected={entry === id}
            aria-controls={`${id}-panel`}
            tabIndex={entry === id ? 0 : -1}
            onClick={() => onEntry(id)}
            onKeyDown={onKeyDown}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-[0.75rem] px-2 text-[15px] font-semibold active:scale-[0.98] ${
              entry === id ? 'bg-surface text-foreground shadow-card' : 'text-secondary'
            }`}
          >
            <Mark className="size-5" />
            {title}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 두 입구 — 그림(해 · 태극)은 장식이다. 이름이 곧 탭의 이름이다(ADR 0132) */
const ENTRIES: readonly { id: Entry; Mark: typeof SunMark; title: string }[] = [
  { id: 'self', Mark: SunMark, title: '내 사주 보기' },
  { id: 'pair', Mark: TaijiMark, title: '궁합 보기' },
];
