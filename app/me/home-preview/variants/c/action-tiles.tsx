import Link from 'next/link';
import type { ReactNode } from 'react';

import { STEM_INFO } from '@/src/lib/saju';

import { ELEMENT_TONE } from '../../../../element-tone';
import { PERSON_LIMIT, type FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import type { PreviewState } from '../../state';
import { Icon, type IconName } from './icons';

/**
 * 「무엇을 할까」 — **타일 몇 개와, 그중 채운 것 하나.**
 *
 * 버튼 위계는 저장한 사람 카드의 `ReadingAction` 을 그대로 빌린다 — 할 일이 남은 것은 accent 채움, 이어 볼 것은
 * accent-wash. 채운 타일이 둘이면 둘 다 안 읽히므로 **하나만** 채우고 그 타일이 맨 앞 한 줄을 다 쓴다.
 *
 * 채울 것은 상태가 고른다(위가 먼저): 내 사주 없음 → 등록 · 사람 0명 → 사람 추가 · 내 풀이 없음 → 풀이 받기 ·
 * 새 소식 있음 → 소식 · 그 밖 → 궁합. 소식은 채우지 못해도 **채운 것 바로 뒤로** 당겨 선다.
 */

type TileKind = 'register' | 'news' | 'add' | 'selfReading' | 'compat' | 'stranger' | 'matching';

export function ActionTiles({ state }: { state: PreviewState }) {
  const kinds = tileKindsOf(state);
  const [primary, ...rest] = kinds;

  return (
    <section aria-labelledby="c-actions" className="flex flex-col gap-3">
      <h2 id="c-actions" className="text-lg font-bold tracking-[-0.03em]">
        무엇을 할까요?
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {primary !== undefined && <TileFor kind={primary} state={state} primary />}
        {rest.map((kind) => (
          <TileFor key={kind} kind={kind} state={state} primary={false} />
        ))}
      </div>
    </section>
  );
}

/** 차례 — 맨 앞이 채운 타일이다 */
function tileKindsOf(state: PreviewState): TileKind[] {
  const news: TileKind[] = state.unread > 0 ? ['news'] : [];

  /* 내 사주가 없으면 궁합 · 풀이 · 매칭은 설 자리가 없다 — 셋 다 「나」를 한쪽에 둔다 */
  if (state.self === null) return ['register', ...news, 'stranger', 'add'];

  const base: TileKind[] = ['selfReading', 'compat', 'add', 'stranger', 'matching'];
  const lead: TileKind =
    state.people.length === 0
      ? 'add'
      : state.self.reading === null
        ? 'selfReading'
        : state.unread > 0
          ? 'news'
          : 'compat';

  const after = lead === 'news' ? [] : news;
  return [lead, ...after, ...base.filter((kind) => kind !== lead)];
}

function TileFor({ kind, state, primary }: { kind: TileKind; state: PreviewState; primary: boolean }) {
  const self = state.self;

  switch (kind) {
    case 'register':
      return (
        <Tile
          href="/me"
          icon="add"
          title="내 사주 등록"
          sub="출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있습니다."
          primary={primary}
        />
      );
    case 'news':
      return (
        <Tile
          href="/me/requests"
          icon="news"
          title="새 소식"
          sub="아직 확인하지 않은 새 소식이 있습니다."
          badge={state.unread}
          primary={primary}
        />
      );
    case 'add': {
      const full = state.people.length >= PERSON_LIMIT;
      return (
        <Tile
          href={full ? '/me/people' : '/me/people#add'}
          icon="add"
          title="사람 추가"
          sub={
            full
              ? `등록할 수 있는 ${PERSON_LIMIT}명을 다 채웠습니다.`
              : '가족이나 친구의 출생 정보를 저장하고 관리하세요.'
          }
          primary={primary}
        />
      );
    }
    case 'selfReading': {
      const reading = self?.reading ?? null;
      return (
        <Tile
          href="/me/readings/self"
          icon="reading"
          title={reading === null ? '내 사주풀이 받기' : '내 사주풀이 보기'}
          sub={reading === null ? '기질과 삶의 흐름을 읽어보세요' : (reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요')}
          primary={primary}
        />
      );
    }
    case 'compat':
      return <CompatTile selfId={self?.personId ?? ''} people={state.people} primary={primary} />;
    case 'stranger':
      return (
        <Tile
          href="/"
          icon="search"
          title="다른 사람 사주 보기"
          sub="저장하지 않고 생년월일시로 한 번 봅니다."
          primary={primary}
        />
      );
    case 'matching':
      return (
        <Tile
          href="/me/matching"
          icon="people"
          title="매칭에서 오늘의 인연 만나기"
          sub="예측 궁합과 보완하는 기운으로, 나의 귀인을 찾아보세요."
          primary={primary}
        />
      );
  }
}

/* `ReadingAction` 의 두 모양 — 채움과 wash. 채운 것은 한 줄을 다 쓴다 */
const PRIMARY =
  'col-span-full bg-accent text-on-accent shadow-sm hover:bg-accent-strong';
const SECONDARY = 'border border-accent/25 bg-accent-wash hover:border-accent';
const BODY = 'group flex min-h-[4.75rem] w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl px-4 py-3';

function Tile({
  href,
  icon,
  title,
  sub,
  badge = 0,
  primary,
}: {
  href: string;
  icon: IconName;
  title: string;
  sub: string;
  badge?: number;
  primary: boolean;
}) {
  return (
    <Link href={previewHref(href)} className={`${BODY} ${primary ? PRIMARY : SECONDARY}`}>
      <TileFace icon={icon} title={title} sub={sub} badge={badge} primary={primary} />
    </Link>
  );
}

function TileFace({
  icon,
  title,
  sub,
  badge,
  primary,
  arrow = '→',
}: {
  icon: IconName;
  title: string;
  sub: string;
  badge: number;
  primary: boolean;
  arrow?: ReactNode;
}) {
  return (
    <>
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-xl ${primary ? 'bg-white/14' : 'bg-surface text-accent shadow-sm'}`}
      >
        <Icon name={icon} className="size-[1.15rem]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${primary ? '' : 'text-accent-strong'}`}>{title}</span>
          {badge > 0 && (
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-fire text-[10px] font-bold text-white">
              {badge}
              <span className="sr-only">건 안 읽음</span>
            </span>
          )}
        </span>
        <span className={`mt-0.5 line-clamp-2 block text-xs ${primary ? 'text-on-accent/75' : 'text-secondary'}`}>
          {sub}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`shrink-0 text-sm group-hover:translate-x-0.5 ${primary ? 'text-on-accent/70 group-hover:text-on-accent' : 'text-accent'}`}
      >
        {arrow}
      </span>
    </>
  );
}

/**
 * 궁합 — **누르면 그 자리에서 상대를 고른다.** 한 번 더 누르면 나 × 그 사람이 미리 찬 궁합 화면으로 간다.
 *
 * 궁합 탭이 없어지면 사람을 먼저 고를 자리가 홈이어야 한다. `<details>` 로 펴고, 펴진 동안은 한 줄을 다 쓴다.
 * 저장한 사람이 없으면 펼 것이 없으니 바로 궁합 화면으로 간다.
 */
function CompatTile({
  selfId,
  people,
  primary,
}: {
  selfId: string;
  people: readonly FixturePerson[];
  primary: boolean;
}) {
  const title = '궁합 보기';
  const sub = '나와 저장한 사람, 또는 직접 입력한 사람과 봅니다.';
  const direct = `/compat#a.person=${selfId}`;
  /* 못 읽는 판본은 궁합을 세울 글자가 없다 — 고르는 줄에서 뺀다 */
  const pickable = people.filter((person) => person.chart.ok);

  if (pickable.length === 0) return <Tile href={direct} icon="compat" title={title} sub={sub} primary={primary} />;

  return (
    <details className={`group/compat min-w-0 rounded-2xl open:col-span-full ${primary ? 'col-span-full' : ''}`}>
      <summary
        className={`${BODY} ${primary ? PRIMARY : SECONDARY} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        <TileFace
          icon="compat"
          title={title}
          sub={sub}
          badge={0}
          primary={primary}
          arrow={<span className="inline-block transition-transform group-open/compat:rotate-90">→</span>}
        />
      </summary>
      <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
        <p className="text-xs text-muted">누구와 볼까요?</p>
        <ul className="flex flex-wrap gap-2">
          {pickable.map((person) => (
            <li key={person.personId} className="min-w-0 max-w-full">
              <Link
                href={previewHref(`/compat#a.person=${selfId}&b.person=${person.personId}`)}
                className="flex min-w-0 items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent"
              >
                <span className="text-muted">나 ×</span>
                <DayStem person={person} />
                <span className="truncate">{person.local_label}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={previewHref(direct)}
              className="flex items-center rounded-full border border-dashed border-border-strong px-3 py-1.5 text-sm font-semibold text-secondary hover:border-accent hover:text-accent"
            >
              직접 입력
            </Link>
          </li>
        </ul>
      </div>
    </details>
  );
}

/** 이름 앞의 일간 한 글자 — 못 읽는 판본이면 안 세운다 */
export function DayStem({ person }: { person: FixturePerson }) {
  if (!person.chart.ok) return null;
  const stem = person.chart.saju.pillars.dayMaster;
  const tone = ELEMENT_TONE[STEM_INFO[stem].element];
  return (
    <span
      aria-hidden="true"
      className={`glyph grid size-6 shrink-0 place-items-center rounded-md text-sm font-bold ${tone.surface} ${tone.text}`}
    >
      {stem}
    </span>
  );
}
