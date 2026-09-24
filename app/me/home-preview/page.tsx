import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../../auth/server-client';
import { DEFAULT_PARAMS, PEOPLE_COUNTS, paramsFrom, stateOf, type StateParams } from './state';
import { VARIANTS } from './variants';

export const metadata = {
  title: '홈 시안 비교 — 만세력',
  robots: { index: false, follow: false },
};

/**
 * 로그인한 홈의 **시안을 나란히 고르는 자리** — 주소로만 온다. 메뉴에 없다.
 *
 * 실제 화면(`/me`)도 공용 컴포넌트도 안 고친다. 시안마다 `variants/<이름>/` 에 살고, 모두 같은 가짜 데이터
 * (`fixtures.ts`)를 받는다. 두 층으로 고른다: 위는 **시안**, 아래는 **상태**(내 사주 · 사람 수 · 소식 · 경고).
 * 고르고 나면 이 폴더는 통째로 지운다.
 */
export default async function HomePreviewPage({ searchParams }: PageProps<'/me/home-preview'>) {
  /* `/me` 아래의 규약이다 — 관문은 길만 가리키고 로그인 판정은 화면이 한다 */
  const supabase = await supabaseOnServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const search = await searchParams;
  const params = paramsFrom(search);
  /* 「모아 보기」는 시안 전부를 한 화면에 차례로 세운다 — 액자(iframe)는 `X-Frame-Options: DENY` 가 막는다 */
  const allRound = search.v === 'all2' ? 2 : search.v === 'all' || search.v === 'all1' ? 1 : null;
  const current = VARIANTS.find((variant) => variant.key === search.v) ?? VARIANTS[0];
  const currentKey = allRound === null ? current.key : `all${allRound}`;
  const state = stateOf(params);
  const rounds = ([2, 1] as const).map((round) => ({
    round,
    tabs: [{ key: `all${round}`, label: '모아 보기' }, ...VARIANTS.filter((variant) => variant.round === round)],
  }));
  const shown = allRound === null ? [] : VARIANTS.filter((variant) => variant.round === allRound);

  const hrefOf = (key: string, next: Partial<StateParams>) => {
    const merged = { ...params, ...next };
    const query = new URLSearchParams({ v: key });
    if (merged.self !== DEFAULT_PARAMS.self) query.set('self', '0');
    if (merged.people !== DEFAULT_PARAMS.people) query.set('people', String(merged.people));
    if (merged.unread) query.set('unread', '1');
    if (merged.warning) query.set('warning', '1');
    return `/me/home-preview?${query}`;
  };

  return (
    <main className="app-shell flex flex-1 flex-col gap-6 py-6 sm:py-9">
      <header className="flex flex-col gap-4 border-b border-border pb-5">
        <div>
          <p className="eyebrow">미리보기</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em]">홈 시안 비교</h1>
          <p className="mt-1 text-sm text-secondary">
            가짜 데이터로 그립니다. 링크는 목적지를 주소창의 # 뒤에만 보이고 이동하지 않습니다.
          </p>
        </div>

        {rounds.map(({ round, tabs }) => (
          <nav key={round} aria-label={`${round}차 시안`} className="-mx-4 flex items-center gap-2 overflow-x-auto px-4">
            <span className="shrink-0 text-xs font-bold text-muted">{round}차</span>
            <ul className="flex w-max gap-2">
              {tabs.map((variant) => {
                const active = variant.key === currentKey;
                return (
                  <li key={variant.key}>
                    <Link
                      href={hrefOf(variant.key, {})}
                      aria-current={active ? 'page' : undefined}
                      className={`inline-flex whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${
                        active
                          ? 'border-accent bg-accent text-on-accent'
                          : 'border-border-strong bg-surface hover:border-accent hover:text-accent'
                      }`}
                    >
                      {variant.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ))}

        <div aria-label="상태" className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
          <Choice
            title="내 사주"
            options={[
              { text: '등록됨', href: hrefOf(currentKey, { self: true }), on: params.self },
              { text: '없음', href: hrefOf(currentKey, { self: false }), on: !params.self },
            ]}
          />
          <Choice
            title="저장한 사람"
            options={PEOPLE_COUNTS.map((count) => ({
              text: `${count}명`,
              href: hrefOf(currentKey, { people: count }),
              on: params.people === count,
            }))}
          />
          <Choice
            title="새 소식"
            options={[
              { text: '없음', href: hrefOf(currentKey, { unread: false }), on: !params.unread },
              { text: '있음', href: hrefOf(currentKey, { unread: true }), on: params.unread },
            ]}
          />
          <Choice
            title="경고 안내"
            options={[
              { text: '없음', href: hrefOf(currentKey, { warning: false }), on: !params.warning },
              { text: '있음', href: hrefOf(currentKey, { warning: true }), on: params.warning },
            ]}
          />
        </div>
      </header>

      {allRound !== null ? (
        <>
          <nav aria-label="시안으로 건너뛰기" className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {shown.map((variant) => (
              <a key={variant.key} href={`#variant-${variant.key}`} className="font-semibold text-accent underline underline-offset-2">
                {variant.label}
              </a>
            ))}
          </nav>
          {shown.map(({ key, label, Component }) => (
            <section
              key={key}
              id={`variant-${key}`}
              aria-labelledby={`variant-${key}-title`}
              className="flex scroll-mt-20 flex-col gap-5 rounded-[2rem] border-2 border-dashed border-border-strong p-3 sm:p-6"
            >
              <h2 id={`variant-${key}-title`} className="text-xl font-bold tracking-[-0.03em] text-accent-strong">
                {label}
              </h2>
              <Component state={state} />
            </section>
          ))}
        </>
      ) : (
        <current.Component state={state} />
      )}
    </main>
  );
}

function Choice({ title, options }: { title: string; options: { text: string; href: string; on: boolean }[] }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted">{title}</span>
      <span className="inline-flex rounded-full border border-border bg-surface-soft p-0.5">
        {options.map((option) => (
          <Link
            key={option.text}
            href={option.href}
            aria-current={option.on ? 'true' : undefined}
            className={`rounded-full px-2.5 py-1 font-semibold ${option.on ? 'bg-surface text-accent shadow-sm' : 'text-muted hover:text-foreground'}`}
          >
            {option.text}
          </Link>
        ))}
      </span>
    </div>
  );
}
