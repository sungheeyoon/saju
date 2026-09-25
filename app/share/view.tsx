import Link from 'next/link';
import { notFound } from 'next/navigation';

import { calledName } from '@/src/lib/reading/display';

import { Markdown } from '../me/reading/markdown';
import { BUTTON_PRIMARY, BUTTON_SECONDARY_SMALL } from '../ui/buttons';
import { Icon } from '../ui/icons';
import { Logo } from '../ui/logo';
import { CARD, TYPE_SECTION, TYPE_TITLE } from '../ui/surfaces';
import type { ShareKind } from './path';
import { sharedReadingOf } from './read';

/**
 * 받은 사람이 보는 화면 — **세 주소가 같은 이것을 쓴다.**
 *
 * 갈리는 것은 미리보기와 몇 마디뿐이라 화면을 셋 그리지 않는다. 셋 그리면 「원본
 * 사용자의 자리는 안 세운다」 같은 규칙이 세 곳에서 지켜져야 하고, 그중 하나를 안
 * 고치는 날이 온다.
 *
 * 로그인도 테스트 코드도 없이 열린다. 여기 있는 것은 보낸 사람이 그때 내놓기로 한
 * 사본 하나뿐이다 — 명식도, 근거도, 누가 보냈는지도 없다(`shared_reading` 이 넷만 낸다).
 */
export async function SharedReadingView({
  token,
  expect,
  eyebrow,
  invitation,
}: {
  token: string;
  /**
   * 이 주소가 맡은 갈래 — **다르면 안 연다.**
   *
   * 주소마다 미리보기가 다르므로, 한 사람짜리 토큰이 궁합 주소로 열리면 대화창에는
   * 「두 사람의 궁합」이 서고 열면 한 사람 글이 나온다. 미리보기가 거짓말을 하는
   * 자리라 화면이 아니라 여기서 막는다.
   */
  expect: ShareKind;
  eyebrow: string;
  invitation: { heading: string; note: string };
}) {
  /*
    **없는 링크와 못 여는 링크를 안 가른다** — 그 판단은 읽는 문이 든다(`read.ts`).
    여기서 하는 일은 없으면 안 그리는 것뿐이다.
  */
  const shared = await sharedReadingOf(token, expect);
  if (shared === null) notFound();

  const { metaphor, score, body } = shared;
  const whose = titleOf(expect, shared.nameA, shared.nameB);

  return (
    <main className="app-shell flex flex-1 flex-col gap-7 py-8 sm:py-12">
      {/*
        **로고를 여기서 다시 안 그린다.** 전역 헤더가 이미 이고 있고, 두 번 그리면
        좁은 화면에서 같은 것이 위아래로 두 줄 선다. 이 자리가 맡는 것은 브랜드 표시가
        아니라 **여기가 무엇을 하는 곳인가** 한 줄이다.
      */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-[13px] font-semibold text-cream-ink">{eyebrow}</p>
          {/*
            **누구 것인지가 제목이다.**

            여기 이름이 없으면 링크를 받은 사람은 글을 다 읽고도 「그래서 이게 누구
            건데?」라고 묻는다 — 그 답은 본문 안에 흩어져 있고, 찾아내는 일이 읽는
            사람 몫이 된다.

            **새로 새는 값이 아니다.** 본문은 이미 이 사람을 이 이름으로 부른다.
            머리에 한 번 세우는 것뿐이고, **미리보기에는 안 싣는다**(ADR 0063) —
            대화창 목록에, 열어 보기도 전에 남의 이름이 서는 일은 없어야 한다.
          */}
          <h1 className={`text-pretty ${TYPE_TITLE}`}>{whose}</h1>
        </div>
        <StartButton variant="quiet" />
      </header>

      {(metaphor !== null || score !== null) && (
        <section className="grid overflow-hidden rounded-[2rem] bg-cream sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 gap-3 px-5 py-7 sm:px-8 sm:py-9">
            {metaphor !== null && (
              <>
                <Icon name="quote" className="mt-1 size-6 text-cream-ink" />
                <p className="max-w-2xl text-pretty font-rounded text-[1.5rem] leading-[1.45] tracking-[-0.01em] text-foreground sm:text-[1.75rem]">
                  {metaphor}
                </p>
              </>
            )}
          </div>
          {/* 궁합에서는 **점수가 그 글의 일부다.** 빼면 받은 사람이 다른 글을 본다 */}
          {score !== null && (
            <div className="tone-fire m-3 flex min-w-40 flex-col items-center justify-center rounded-[1.5rem] bg-[var(--tile)] px-5 py-4 text-center sm:ml-0">
              <p className="flex items-center gap-1 text-[13px] font-semibold text-[var(--ink)]">
                <Icon name="heart" className="size-4" />
                궁합풀이 점수
              </p>
              <p className="mt-1 flex items-baseline justify-center gap-1">
                <span className="text-[2.5rem] font-bold leading-none tabular-nums text-foreground">{score}</span>
                <span className="text-[13px] font-semibold text-secondary">/ 100</span>
              </p>
            </div>
          )}
        </section>
      )}

      <article className={`${CARD} overflow-hidden sm:p-8 lg:p-10`}>
        <Markdown source={body} />
      </article>

      {/*
        **다 읽은 자리에서 한 번 더 묻는다.** 위의 것은 「여기가 어디인가」에 붙은
        길이고, 이것은 글을 읽고 나서 생긴 마음에 붙은 길이다.

        가입에 코드가 필요하다는 것을 여기서 적는다. 이 화면은 코드 없이 열리지만
        **가입은 아직 코드로만 열린다**(ADR 0042) — 누르고 나서 알게 하면, 그 사람은
        읽은 글이 좋아서 눌렀다가 막힌 문을 만난다.
      */}
      <section className="flex flex-col gap-3 rounded-[2rem] bg-cream px-5 py-7 sm:px-8">
        <span className="grid size-14 place-items-center rounded-full bg-surface shadow-card">
          <Logo className="size-9" />
        </span>
        <h2 className={TYPE_SECTION}>{invitation.heading}</h2>
        <p className="text-[15px] leading-7 text-secondary">{invitation.note}</p>
        <div className="mt-1">
          <StartButton variant="loud" />
        </div>
        <p className="text-[13px] leading-5 text-secondary">
          지금은 비공개 테스트 기간이라 가입에 테스트 코드가 필요합니다.
        </p>
      </section>
    </main>
  );
}

/**
 * 이 화면의 제목 — **누구의 무엇인가.**
 *
 * 부르는 말은 `calledName` 이 정한다. 본문이 쓰는 규칙과 같은 것을 써야 머리와
 * 본문이 같은 사람을 같은 이름으로 부른다.
 *
 * 두 사람은 `×` 로 잇는다. 목록이 이미 그렇게 적고 있고(`line.ts`), 조사를 안 쓰므로
 * 이름 끝의 받침에 따라 「과」와 「와」가 갈리는 자리를 아예 안 만든다.
 *
 * **이름을 못 구했으면 갈래 이름만 세운다.** 「님의 사주풀이」처럼 앞이 빈 제목을
 * 세우느니, 누구 것인지 모른다는 사실이 그대로 보이는 편이 낫다.
 */
function titleOf(kind: ShareKind, nameA: string | null, nameB: string | null): string {
  const a = nameA === null ? '' : calledName(nameA);
  const b = nameB === null ? '' : calledName(nameB);

  if (kind === 'private') {
    return a !== '' && b !== '' ? `${a} × ${b} 궁합풀이` : '두 사람의 궁합풀이';
  }

  return a !== '' ? `${a}의 사주풀이` : '사주풀이';
}

/**
 * 시작하는 자리로 보내는 버튼 — 위아래 둘이 같은 곳을 가리킨다.
 *
 * **「내 사주풀이 보기」가 아니다.** 이 글을 읽는 사람에게는 열 풀이가 아직 없고, 이
 * 누름이 여는 것은 로그인이다(가입에는 테스트 코드가 더 필요하다 — 그 말은 바로 아래
 * 줄이 든다). 없는 것을 「보기」라고 적으면 눌러서 도착한 자리가 약속과 다르다.
 */
function StartButton({ variant }: { variant: 'quiet' | 'loud' }) {
  return (
    <Link
      href="/auth"
      className={variant === 'loud' ? `${BUTTON_PRIMARY} w-full sm:w-auto` : `${BUTTON_SECONDARY_SMALL} shrink-0`}
    >
      로그인하고 시작하기
    </Link>
  );
}
