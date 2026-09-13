import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Markdown } from '../../../me/reading/markdown';
import { supabaseForShared } from '../../public-client';

/**
 * 받은 사람이 여는 화면 — **로그인도 테스트 코드도 없이 열린다.**
 *
 * 이 앱에서 로그인 없이 서는 화면은 여태 셋이었다(`/`·`/privacy`·`/closed`). 넷째가
 * 이것이고, 앞의 셋과 다른 점은 **사람의 글이 선다**는 것이다. 그래서 여기 있는
 * 것은 보낸 사람이 그때 내놓기로 한 사본 하나뿐이다 — 명식도, 근거도, 누가
 * 보냈는지도 없다(`shared_reading` 이 셋만 내준다).
 *
 * 원본 사용자의 자리는 하나도 안 세운다. 다시 만들기도, 설문도, 풀이권도, 계정
 * 메뉴도 — 그 손잡이들은 자기 글을 든 사람의 것이고 여기 온 사람의 것이 아니다
 * (헤더는 `isSharePath` 로 스스로 접는다).
 */

/**
 * **`generateMetadata` 가 아니라 상수다 — 그것이 이 파일의 중요한 판단이다.**
 *
 * Next 는 동적으로 그려지는 화면의 메타데이터를 본문과 따로 흘려보낸다. 카카오톡
 * 같은 수집기는 `<head>` 만 긁어 가므로, 흘려보내진 것을 못 받는 수집기에서는
 * 미리보기가 통째로 비어 버린다. 상수로 두면 첫 HTML 에 그대로 실린다.
 *
 * 상수로 둘 수 있는 것은 **미리보기에 이 글의 내용을 안 싣기 때문**이다. 닉네임도
 * 풀이 문장도 출생 정보도 안 들어간다 — 링크를 받은 사람의 대화창 목록에, 열어
 * 보기도 전에 남의 사주풀이 한 줄이 서는 일은 없어야 한다. 그래서 미리보기는
 * 토큰마다 다를 이유가 없고, 다를 이유가 없으니 상수가 맞다.
 *
 * 색인은 막는다. 공유본은 링크를 가진 사람의 것이지 검색으로 닿을 것이 아니다.
 */
export const metadata: Metadata = {
  /* `metadataBase` 는 여기 없다 — 루트 레이아웃 한 곳에서 내려온다 */
  title: '사주풀이가 도착했어요 | 만세력',
  description: '공유된 사주풀이를 읽고, 나를 이루는 흐름도 알아보세요.',
  robots: { index: false, follow: false },
  openGraph: {
    type: 'article',
    siteName: '만세력',
    title: '사주풀이가 도착했어요 | 만세력',
    description: '공유된 사주풀이를 읽고, 나를 이루는 흐름도 알아보세요.',
    images: [
      {
        /*
          **1200×628 JPEG 이고 그것이 판단이다.** 원본은 1733×907 PNG 2.1MB 였는데,
          종이 질감이 화면 전체에 깔려 있어 PNG 가 압축을 거의 못 한다. 미리보기
          수집기는 큰 파일을 기다려 주지 않고 조용히 안 싣는다 — 그러면 대화창에
          제목만 남는다. 224KB 로 줄였고 글자는 그대로 읽힌다.

          가로세로는 원본 비(1.911)를 그대로 지켰다. 1200 은 미리보기의 사실상
          표준 폭이라 어디서도 다시 줄이지 않는다.
        */
        url: '/brand/saju-share-v1.jpg',
        width: 1200,
        height: 628,
        type: 'image/jpeg',
        alt: '만세력 — 나를 이루는 흐름을 읽다',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '사주풀이가 도착했어요 | 만세력',
    description: '공유된 사주풀이를 읽고, 나를 이루는 흐름도 알아보세요.',
    images: ['/brand/saju-share-v1.jpg'],
  },
};

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

export default async function SharedReadingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = supabaseForShared();
  const { data, error } = await supabase.rpc('shared_reading', { p_token: token });

  const row = ((data ?? []) as Record<string, unknown>[])[0];

  /*
    **없는 링크와 못 여는 링크를 안 가른다.** 문이 0행으로 답하므로 여기에는 가를
    값 자체가 없다 — 토큰이 틀렸든 지워진 계정의 것이든 같은 화면이다.
  */
  if (error || row === undefined) notFound();

  const metaphor = (row.metaphor as string | null) ?? null;
  const body = row.body as string;

  return (
    <main className="app-shell flex flex-1 flex-col gap-7 py-8 sm:py-12">
      {/*
        **서비스 이름이 먼저다.** 링크를 눌러 들어온 사람은 여기가 어디인지 모른 채
        남의 글부터 만난다. 이름과 한 줄이 먼저 서고, 그 줄 끝에 시작하는 길이 있다 —
        긴 글을 끝까지 읽어야만 시작할 수 있게 두지 않는다.
      */}
      {/*
        **로고를 여기서 다시 안 그린다.** 전역 헤더가 이미 이고 있고, 두 번 그리면
        좁은 화면에서 같은 것이 위아래로 두 줄 선다. 이 자리가 맡는 것은 브랜드 표시가
        아니라 **여기가 무엇을 하는 곳인가** 한 줄이다.
      */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="eyebrow">공유받은 사주풀이</p>
          <p className="text-pretty text-lg font-bold tracking-[-0.03em] sm:text-xl">
            만세력 — 나를 이루는 흐름을 읽다
          </p>
        </div>
        <StartButton variant="quiet" />
      </header>

      {metaphor !== null && (
        <section className="rounded-[1.75rem] border border-border bg-surface-raised px-5 py-6 shadow-[var(--shadow-card)] sm:px-7 sm:py-7">
          <p className="max-w-2xl text-pretty text-lg font-semibold leading-7 sm:text-xl sm:leading-8">
            {metaphor}
          </p>
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
        <h2 className="text-lg font-bold tracking-[-0.03em]">나를 이루는 흐름도 읽어 보세요</h2>
        <p className="text-sm leading-6 text-secondary">
          생년월일시를 넣으면 명식을 세우고, 그 근거로 사주풀이를 받습니다.
        </p>
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
