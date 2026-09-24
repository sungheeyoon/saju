import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../../auth/server-client';
import { DEFAULT_PARAMS, PEOPLE_COUNTS, paramsFrom, stateOf, type StateParams } from './state';
import { SCREENS, STYLES, type ScreenKey } from './variants';

export const metadata = {
  title: '홈 시안 비교 — 만세력',
  robots: { index: false, follow: false },
};

/**
 * 채택 후보 스타일을 **화면 넷(홈 · 매칭 · 풀이 · 채팅)으로** 견주는 자리 — 주소로만 온다. 메뉴에 없다.
 *
 * 실제 화면도 공용 컴포넌트도 안 고친다. 모두 같은 가짜 데이터(`fixtures.ts` · `screens.ts`)를 받는다.
 * 세 층으로 고른다: 스타일 · 화면 · 상태. 「둘 다 보기」는 같은 화면을 두 스타일로 차례로 세운다.
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
  const both = search.v === 'all';
  const style = STYLES.find((one) => one.key === search.v) ?? STYLES[0];
  const styleKey = both ? 'all' : style.key;
  const screen: ScreenKey = SCREENS.find((one) => one.key === search.screen)?.key ?? 'home';
  const state = stateOf(params);

  const hrefOf = (next: Partial<StateParams> & { v?: string; screen?: ScreenKey }) => {
    const merged = { ...params, ...next };
    const query = new URLSearchParams({ v: next.v ?? styleKey, screen: next.screen ?? screen });
    if (merged.self !== DEFAULT_PARAMS.self) query.set('self', '0');
    if (merged.people !== DEFAULT_PARAMS.people) query.set('people', String(merged.people));
    if (merged.unread) query.set('unread', '1');
    if (merged.warning) query.set('warning', '1');
    if (merged.empty) query.set('empty', '1');
    return `/me/home-preview?${query}`;
  };

  const shown = both ? STYLES : [style];

  return (
    <main className="app-shell flex flex-1 flex-col gap-6 py-6 sm:py-9">
      <header className="flex flex-col gap-4 border-b border-border pb-5">
        <div>
          <p className="eyebrow">미리보기</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em]">시안 비교</h1>
          <p className="mt-1 text-sm text-secondary">
            가짜 데이터로 그립니다. 링크는 목적지를 주소창의 # 뒤에만 보이고 이동하지 않습니다.
          </p>
        </div>

        <Tabs
          title="스타일"
          items={[
            { key: 'all', label: '둘 다 보기', href: hrefOf({ v: 'all' }) },
            ...STYLES.map((one) => ({ key: one.key, label: one.label, href: hrefOf({ v: one.key }) })),
          ]}
          current={styleKey}
        />
        <Tabs
          title="화면"
          items={SCREENS.map((one) => ({ key: one.key, label: one.label, href: hrefOf({ screen: one.key }) }))}
          current={screen}
        />

        <div aria-label="상태" className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
          <Choice
            title="내 사주"
            options={[
              { text: '등록됨', href: hrefOf({ self: true }), on: params.self },
              { text: '없음', href: hrefOf({ self: false }), on: !params.self },
            ]}
          />
          <Choice
            title="저장한 사람"
            options={PEOPLE_COUNTS.map((count) => ({
              text: `${count}명`,
              href: hrefOf({ people: count }),
              on: params.people === count,
            }))}
          />
          <Choice
            title="매칭 · 풀이 · 채팅"
            options={[
              { text: '있음', href: hrefOf({ empty: false }), on: !params.empty },
              { text: '비어 있음', href: hrefOf({ empty: true }), on: params.empty },
            ]}
          />
          <Choice
            title="새 소식"
            options={[
              { text: '없음', href: hrefOf({ unread: false }), on: !params.unread },
              { text: '있음', href: hrefOf({ unread: true }), on: params.unread },
            ]}
          />
          <Choice
            title="경고 안내"
            options={[
              { text: '없음', href: hrefOf({ warning: false }), on: !params.warning },
              { text: '있음', href: hrefOf({ warning: true }), on: params.warning },
            ]}
          />
        </div>
      </header>

      {shown.map((one) => {
        const Screen = one.screens[screen];
        return both ? (
          <section
            key={one.key}
            aria-label={one.label}
            className="flex flex-col gap-5 rounded-[2rem] border-2 border-dashed border-border-strong p-3 sm:p-6"
          >
            <h2 className="text-xl font-bold tracking-[-0.03em] text-accent-strong">{one.label}</h2>
            <Screen state={state} />
          </section>
        ) : (
          <Screen key={one.key} state={state} />
        );
      })}
    </main>
  );
}

function Tabs({
  title,
  items,
  current,
}: {
  title: string;
  items: { key: string; label: string; href: string }[];
  current: string;
}) {
  return (
    <nav aria-label={title} className="-mx-4 flex items-center gap-2 overflow-x-auto px-4">
      <span className="shrink-0 text-xs font-bold text-muted">{title}</span>
      <ul className="flex w-max gap-2">
        {items.map((item) => {
          const active = item.key === current;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${
                  active
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-border-strong bg-surface hover:border-accent hover:text-accent'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
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
