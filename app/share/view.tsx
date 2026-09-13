import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Markdown } from '../me/reading/markdown';
import type { ShareKind } from './path';
import { supabaseForShared } from './public-client';

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
  const supabase = supabaseForShared();
  const { data, error } = await supabase.rpc('shared_reading', { p_token: token });

  const row = ((data ?? []) as Record<string, unknown>[])[0];

  /*
    **없는 링크와 못 여는 링크를 안 가른다.** 문이 0행으로 답하므로 여기에는 가를
    값 자체가 없다 — 토큰이 틀렸든 지워진 계정의 것이든 같은 화면이다.
  */
  if (error || row === undefined) notFound();
  if (row.kind !== expect) notFound();

  const metaphor = (row.metaphor as string | null) ?? null;
  const score = (row.score as number | null) ?? null;
  const body = row.body as string;

  return (
    <main className="app-shell flex flex-1 flex-col gap-7 py-8 sm:py-12">
      {/*
        **로고를 여기서 다시 안 그린다.** 전역 헤더가 이미 이고 있고, 두 번 그리면
        좁은 화면에서 같은 것이 위아래로 두 줄 선다. 이 자리가 맡는 것은 브랜드 표시가
        아니라 **여기가 무엇을 하는 곳인가** 한 줄이다.
      */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="eyebrow">{eyebrow}</p>
          <p className="text-pretty text-lg font-bold tracking-[-0.03em] sm:text-xl">
            만세력 — 나를 이루는 흐름을 읽다
          </p>
        </div>
        <StartButton variant="quiet" />
      </header>

      {(metaphor !== null || score !== null) && (
        <section className="grid overflow-hidden rounded-[1.75rem] border border-border bg-surface-raised shadow-[var(--shadow-card)] sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 flex-col justify-center px-5 py-6 sm:px-7">
            {metaphor !== null && (
              <p className="max-w-2xl text-pretty text-lg font-semibold leading-7 sm:text-xl sm:leading-8">
                {metaphor}
              </p>
            )}
          </div>
          {/* 궁합에서는 **점수가 그 글의 일부다.** 빼면 받은 사람이 다른 글을 본다 */}
          {score !== null && (
            <div className="flex min-w-40 flex-col items-center justify-center border-t border-border bg-accent-wash/45 px-5 py-4 text-center sm:border-l sm:border-t-0 sm:px-6">
              <p className="text-xs font-semibold text-accent">궁합 풀이 점수</p>
              <p className="mt-1 flex items-baseline justify-center gap-1">
                <span className="text-3xl font-bold tabular-nums">{score}</span>
                <span className="text-xs font-medium text-secondary">/ 100</span>
              </p>
            </div>
          )}
        </section>
      )}

      <article className="overflow-hidden rounded-2xl border border-border bg-surface-raised p-5 shadow-[var(--shadow-card)] sm:p-7 lg:p-8">
        <Markdown source={body} />
      </article>

      {/*
        **다 읽은 자리에서 한 번 더 묻는다.** 위의 것은 「여기가 어디인가」에 붙은
        길이고, 이것은 글을 읽고 나서 생긴 마음에 붙은 길이다.

        가입에 코드가 필요하다는 것을 여기서 적는다. 이 화면은 코드 없이 열리지만
        **가입은 아직 코드로만 열린다**(ADR 0042) — 누르고 나서 알게 하면, 그 사람은
        읽은 글이 좋아서 눌렀다가 막힌 문을 만난다.
      */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-5 py-6 shadow-[var(--shadow-card)] sm:px-7">
        <h2 className="text-lg font-bold tracking-[-0.03em]">{invitation.heading}</h2>
        <p className="text-sm leading-6 text-secondary">{invitation.note}</p>
        <div className="mt-1">
          <StartButton variant="loud" />
        </div>
        <p className="text-xs leading-5 text-muted">
          지금은 비공개 테스트 기간이라 가입에 테스트 코드가 필요합니다.
        </p>
      </section>
    </main>
  );
}

/** 시작하는 자리로 보내는 버튼 — 위아래 둘이 같은 곳을 가리킨다 */
function StartButton({ variant }: { variant: 'quiet' | 'loud' }) {
  return (
    <Link
      href="/auth"
      className={
        variant === 'loud'
          ? 'inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent px-6 text-sm font-semibold text-on-accent shadow-sm hover:bg-accent-strong sm:w-auto'
          : 'inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-surface px-4 text-sm font-semibold text-accent shadow-sm hover:border-accent'
      }
    >
      내 사주풀이 보기
    </Link>
  );
}
