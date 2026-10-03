'use client';

import { useState, type KeyboardEvent, type ReactNode } from 'react';

import { HOUR_UNKNOWN_CHOICE } from '@/src/lib/input/query';

import { useBrowserSession } from './auth/browser-session';
import { PairTaste } from './pair-taste';
import { SignedInProvider } from './signed-in';
import { SajuCompatTabs } from './segmented-nav';
import { TAB_HERO_CARD, TabHeroBody, TabHeroGlow } from './tab-hero';
import { SunMark, TaijiMark } from './ui/entry-marks';
import { Icon } from './ui/icons';
import { PAPER_TOP, TYPE_SECTION } from './ui/surfaces';

/**
 * `/` 의 얼굴 — **처음 온 사람과 이미 들어온 사람에게 다른 것을 세운다.**
 *
 * 이 화면은 두 사람이 함께 쓴다. 로그인하지 않은 사람에게는 **현관**이다: 여기서
 * 제품이 무엇인지 알고, 코드를 넣고, 들어온다. 로그인한 사람에게는 홈의 「다른
 * 사람 사주 보기」가 데려오는 **연장**이다: 저장하지 않은 남의 생년월일시를 한 번
 * 계산해 보고, 궁합을 시작한다(메뉴에서 「사주·궁합」 탭은 5차에 빠졌다).
 *
 * 한 벌로 쓰던 동안 회원이 읽던 것은 이랬다 — 「사주풀이와 궁합은 로그인 후」(이미
 * 했다), 「사주풀이에서 만날 이야기」(이미 만났다), 「테스트 코드를 받으셨나요?」
 * (가입 관문이라 다시 지날 수 없다. `signup/form.tsx`). **셋 다 참이 아닌 문장이고,
 * 현관에서만 참이다.**
 *
 * ## 모르는 동안에는 현관을 세운다
 *
 * 헤더와 「궁합 보기」는 아직 모르는 동안 자리만 잡아 둔다 — 거기서 비는 것은 낱말
 * 하나 폭이라 값이 싸다. 여기서 같은 것을 하면 **화면의 첫 반쪽이 빈 칸으로 뜬다.**
 * 그리고 그 대가를 치르는 쪽이 하필 현관이 필요한 사람이다: 로그인하지 않은 사람은
 * 이 주소로 바로 들어오고, 회원은 앱 안에서 걸어온다.
 *
 * 그래서 **미리 그려진 HTML 이 곧 현관**이고, 세션을 알고 나서 회원 쪽으로 갈린다.
 * 회원이 한 틱 동안 현관을 보는 것은 맞바꾼 값이다 — 빈 화면과 달리, 그동안 보이는
 * 것은 틀린 화면이 아니라 **덜 맞는 화면**이다.
 *
 * ## 세션을 한 번만 읽는다
 *
 * 계산기(`signed-in.tsx` 의 통로)와 현관의 입구가 같은 값을 본다. 둘이 따로 읽으면 잠깐 서로 다른 답을 들고,
 * 그 틈에 회원의 화면에 현관이 한 번 더 깜빡인다.
 */
export function HomeHero({ calculator }: { calculator: ReactNode }) {
  const { session } = useBrowserSession();

  const member = session === 'in';
  /**
   * 현관의 두 입구 중 어느 쪽이 열려 있나 — **회원에게는 없다**(회원의 궁합은 `/compat` 이 든다).
   * 계산기는 궁합 쪽이 열려 있는 동안에도 **내려 두지 않고 숨긴다** — 적던 생일과 선 결과를 잃지 않게.
   */
  const [entry, setEntry] = useState<Entry>('self');
  /** 궁합 입구를 한 번이라도 열었나 — 연 뒤로는 닫아도 두 사람의 칸을 내려 두지 않는다 */
  const [pairOpened, setPairOpened] = useState(false);
  const pair = !member && entry === 'pair';

  /** 입구를 고른다 — 초점은 탭에 남긴다(화살표로 두 입구를 오갈 수 있게). 입력 칸은 바로 아래다 */
  const open = (next: Entry) => {
    setEntry(next);
    if (next === 'pair') setPairOpened(true);
  };

  return (
    <>
      {/*
        **자리에 서는 부품의 종류를 안 바꾼다.** 여기가 `{member ? <MemberHero/> :
        <VisitorHero/>}` 였다. 종류가 갈리면 세션이 풀리는 순간 React 가 머리 전체를
        **뜯고 다시 세운다** — 화면이 한 번 튀고, 그 순간에 손이 이미 폼에 가 있던
        사람은 자기가 친 글자를 잃을 수 있다. 얼굴 하나가 안에서 갈리면 자리는
        그대로고 글자만 바뀐다.
      */}
      <Hero member={member} entry={entry} onEntry={open} />

      {/*
        로그인 전에는 머리와 폼이 **크림 종이 한 장**이다(`PAPER_TOP` · `PAPER_BOTTOM`, ADR 0132) — 이 자리가 `main` 의
        틈만큼 올라붙어 머리의 아래 끝에 닿는다. 자리의 종류는 안 바꾸고 클래스만 갈린다(위 「자리에 서는 부품」).
      */}
      <section id="calculator" className={`scroll-mt-24 ${member ? '' : '-mt-8 sm:-mt-10'}`}>
        <div id="self-panel" role={member ? undefined : 'tabpanel'} aria-labelledby={member ? undefined : 'entry-self'} hidden={pair}>
          {/*
            **제목은 둘이 같다.** 묻는 것이 같기 때문이다 — 가르는 것은 이 입력이
            그 사람에게 무엇이냐는 쪽이지 무엇을 묻느냐가 아니다. 로그인 전 첫 화면에서는 **눈에 안 보인다** —
            바로 위 입구 「내 사주 보기」가 같은 말을 하고, 입구 아래 곧장 폼이 서야 한다(흐름 시안 g, 2026-09-29
            운영자 「내 사주 보기 · 궁합 보기 아래에 바로 입력 폼」). 시각 모름 안내는 시각 칸 아래에 이미 있다.
          */}
          <div className={member ? 'mb-5' : 'sr-only'}>
            {member && <p className="text-[13px] font-semibold text-cream-ink">직접 입력</p>}
            <h2 className={`mt-1 ${TYPE_SECTION}`}>출생 정보를 입력해 주세요</h2>
            {member && <p className="mt-2 text-sm leading-6 text-secondary">출생 시각을 모르면 「{HOUR_UNKNOWN_CHOICE}」을 고르세요.</p>}
          </div>
          {/*
            **계산기도 이 값으로 갈린다** — 로그인하지 않은 사람에게는 결과의 첫머리가 로그인 전 사주 문단이다(`taste.tsx`).
            그런데 계산기를 여기서 만들지는 않는다: `Suspense` 경계는 서버가 세운 것을
            그대로 쓰고(`page.tsx`), 값만 통로로 내려보낸다(`signed-in.tsx`). **모름까지 세 값 그대로 보낸다** — 그 문단은
            입력을 서버로 보내므로 세션을 알기 전에는 안 선다.
          */}
          <SignedInProvider value={session}>{calculator}</SignedInProvider>
        </div>
        {/*
          **로그인 전 궁합 결과는 여는 순간 선다.** 미리 그려 두면 현관에 폼 둘이 함께 실려 첫 화면이 무거워진다. 닫아도
          적던 두 사람은 남는다 — 숨기기만 한다.
        */}
        {!member && pairOpened && (
          <div id="pair-panel" role="tabpanel" aria-labelledby="entry-pair" hidden={!pair}>
            <PairTaste />
          </div>
        )}
      </section>
    </>
  );
}

type Entry = 'self' | 'pair';

/**
 * 로그인하지 않은 사람의 현관 — **미리 그려진 그대로다.**
 *
 * 아직 모르는 동안에도 이 얼굴이 서 있다(파일 머리말 「모르는 동안에는 현관을 세운다」).
 */
function Hero({ member, entry, onEntry }: { member: boolean; entry: Entry; onEntry: (entry: Entry) => void }) {
  return (
    <header className={member ? TAB_HERO_CARD : `relative ${PAPER_TOP}`}>
      {/* 번짐은 회원의 머리에만 — 현관의 종이는 먹 · 흰 · 크림뿐이다(시안 n) */}
      {member && <TabHeroGlow />}
      {/*
        **껍데기는 안 갈린다.** 자리에 서는 부품 종류가 바뀌면 세션이 풀리는 순간
        React 가 머리를 통째로 뜯고 다시 세워 화면이 한 번 튄다. 속만 갈린다.
      */}
      {member ? (
        <TabHeroBody
          eyebrow="사주"
          title="궁금한 사람의 사주를 바로 봅니다."
          lede={
            <p>
              생년월일시를 입력하면 여덟 글자를 확인할 수 있어요.<br />
              저장하지 않아도 볼 수 있어요.
            </p>
          }
          /*
            **회원의 머리에는 토글 하나다.**

            버튼 둘이 서 있었다 — 「출생 정보 입력하기」(`#calculator`)와 「궁합 보러
            가기」. 앞엣것은 **바로 아래 보이는 폼으로 스크롤만 하는 누름**이고(`/compat`
            에서 같은 이유로 걷었다), 뒤엣것은 나란한 짝으로 가는 길인데 버튼 모양이라
            위아래 관계처럼 보였다.

            지금은 사주와 궁합이 **한 덩이 토글**로 선다. 지금 어디에 있는지와 다른
            반쪽으로 가는 길을 한 부품이 함께 말한다 — 한 사람의 사주와 풀이가 이미
            같은 모양이다(`SegmentedNav`).
          */
          actions={<SajuCompatTabs current="saju" />}
        />
      ) : (
        <VisitorFace entry={entry} onEntry={onEntry} />
      )}
    </header>
  );
}

/**
 * 현관의 속 — 카드 껍데기는 `Hero` 가 든다(흐름 시안 g 의 첫 화면, ADR 0131). 크림 종이의 위 토막이고, 아래 토막은
 * 폼이다 — 제목 · 입구 · 폼 · 주 단추가 한 장 안에 선다(입력 폼 시안 n, ADR 0132).
 *
 * 제목 한 줄, 설명 한 줄, 그리고 **두 입구** — 「내 사주 보기」와 「궁합 보기」. 입구는 바로 아래 입력 칸을 고르는 탭이다:
 * 둘 다 로그인 없이 로그인 전 결과까지 간다. 입구 아래에는 곧장 폼이 선다.
 *
 * ## 걷은 것
 *
 * - 「테스트 코드를 받으셨나요? · 테스트 코드로 시작하기」 띠 — 기준은 일반 공개 서비스다(운영자 2026-09-29). 코드는
 *   운영자가 테스터에게 직접 알리고, 넣는 자리는 그대로 가입 화면이다(머리글의 「로그인」 → 가입). 현관이 앞세우지 않을 뿐이다.
 * - 「사주풀이에서 만날 이야기」 세 칸 — 결과의 잠긴 목차가 본 풀이의 실제 절 이름으로 그 일을 한다(`taste.tsx`).
 * - 로고 · 이름 · 한 줄 소개와 관계의 그림, 제목 둘째 줄(「우리는 왜 끌릴까.」) — 운영자가 시안 g 와 견주어 「위에 글도
 *   많고」라고 했다(2026-09-29). 로고는 머리글에 이미 서고, 그림은 폰에서 폼을 한 화면 아래로 밀었다.
 * - 「사주는 로그인 없이 · 사주풀이와 궁합은 로그인 후」 — 궁합도 로그인 전 궁합 결과까지는 로그인 없이 간다. 참이 아니게 됐다.
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
        {/*
          **망설임을 첫 줄에서 걷는다**(그로스 시안, 2026-10-03). 처음 온 사람이 생일을 넣기 전에 묻는 둘 — 가입해야
          하나, 내 생일이 남나 — 에 폼 위에서 답한다. 둘 다 코드가 하는 일이다: 사주와 궁합 첫 신호는 로그인 없이
          열리고, 넣은 값은 저장하지 않는다(로그인 전 사주 문단도 계산에만 쓰고 안 남긴다, ADR 0143).
        */}
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-semibold text-cream-ink" aria-label="시작하기 전에">
          {['로그인 없이', '입력은 저장 안 해요', '두 사람 궁합도'].map((fact) => (
            <li key={fact} className="inline-flex items-center gap-1">
              <Icon name="check" className="size-3.5" />
              {fact}
            </li>
          ))}
        </ul>
      </div>
      {/* 입구는 세그먼트 한 줄이다(시안 n) — 큰 카드 둘이던 자리가 한 줄로 줄어 폼이 첫 화면에 더 많이 든다 */}
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

/**
 * 두 입구 — 그림은 장식이다. 이름이 곧 탭의 이름이다.
 *
 * 오행 그림(火 · 水)이 서 있었는데 입구는 오행을 뜻하지 않는다 — 해와 태극의 흑백 그림으로 바꿨다(시안 n, ADR 0132).
 */
const ENTRIES: readonly { id: Entry; Mark: typeof SunMark; title: string }[] = [
  { id: 'self', Mark: SunMark, title: '내 사주 보기' },
  { id: 'pair', Mark: TaijiMark, title: '궁합 보기' },
];
