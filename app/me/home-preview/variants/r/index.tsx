import Link from 'next/link';

import type { VariantProps } from '..';
import type { ReadingEntry } from '../../../reading/current';
import { PERSON_LIMIT, type FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { UnreadStrip } from '../../shared/unread-strip';
import { WarningBanner } from '../../shared/warning-banner';
import { ProposedMenu } from '../a1/proposed-menu';
import { SelfSummary } from '../a1/self-summary';
import { PersonRow } from './person-row';

/*
  **R · 추천 조합** — 여덟 시안에서 하나씩 가져왔다.
  - 나: A1 의 요약 카드(일주 · 여덟 글자 · 오행 · 사주풀이 · 사주 자세히 보기)
  - 사람: E 의 한 줄 — 열 명이 한 화면에 들고 모든 길이 한 번이다
  - 궁합 단추: B 의 규칙 — 이미 본 궁합은 점수가 붙고 그 글로 간다
  - 빈 상태: C 의 규칙 — 할 일이 하나뿐일 때는 그것 하나만 채운 단추로 선다
  - 메뉴: 홈 · 매칭 · 풀이 · 채팅. 「풀이」는 남긴다 — 「함께 보는 궁합」 줄이 거기에만 산다(D 의 발견)
*/
export default function Variant({ state }: VariantProps) {
  const { self, people } = state;
  const selfId = self?.personId ?? null;
  const full = people.length >= PERSON_LIMIT;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ProposedMenu unread={state.unread} unreadChat={state.unreadChat} />
      <WarningBanner notice={state.warning} />

      <header className="flex flex-col gap-1 border-b border-border pb-5">
        <h2 className="text-3xl font-bold tracking-[-0.04em]">나의 사주와 인연</h2>
        <p className="text-sm text-secondary">저장한 사주를 확인하고 오늘의 인연을 만나보세요.</p>
      </header>

      <UnreadStrip count={state.unread} />

      {self === null ? <RegisterSelf /> : <SelfSummary self={self} />}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <h2 className="text-lg font-bold tracking-[-0.03em]">
            저장한 사람
            <span className="ml-2 text-sm font-normal tabular-nums text-muted">
              {people.length}/{PERSON_LIMIT}명
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {!full && people.length > 0 && (
              <Link
                href={previewHref('/me/people')}
                className="rounded-full border border-border-strong bg-surface px-3.5 py-1.5 font-semibold hover:border-accent hover:text-accent"
              >
                + 사람 추가
              </Link>
            )}
            {people.length > 0 && (
              <Link href={previewHref('/me/people')} className="px-1.5 py-1.5 font-semibold text-accent">
                전체 관리 <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </div>

        {people.length === 0 ? (
          <AddFirst />
        ) : (
          <ol className="divide-y divide-border overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow-card)]">
            {people.map((person) => (
              <PersonRow
                key={person.personId}
                self={false}
                selfPersonId={selfId}
                pair={pairOf(state.readings, selfId, person)}
                person={{
                  personId: person.personId,
                  label: person.local_label,
                  note: person.note,
                  chart: person.chart,
                  reading: person.reading,
                }}
              />
            ))}
          </ol>
        )}
        {full && <p className="text-xs text-muted">등록할 수 있는 10명을 다 채웠습니다.</p>}
      </section>

      <nav aria-label="더 해 보기" className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:flex-wrap">
        {[
          { href: '/', label: '다른 사람 사주 보기' },
          { href: '/compat', label: '궁합 보러 가기' },
          ...(self === null ? [] : [{ href: '/me/matching', label: '매칭에서 오늘의 인연 만나기' }]),
        ].map((link) => (
          <Link
            key={link.href}
            href={previewHref(link.href)}
            className="inline-flex min-h-10 items-center justify-between gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent sm:justify-start"
          >
            {link.label} <span aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** 나 × 그 사람의 궁합풀이 — 최근 것이 앞이라 처음 만난 것이 가장 최근이다 */
function pairOf(readings: readonly ReadingEntry[], selfId: string | null, person: FixturePerson): ReadingEntry | null {
  if (selfId === null) return null;
  return (
    readings.find(
      (entry) =>
        entry.kind === 'private' &&
        ((entry.personA === selfId && entry.personB === person.personId) ||
          (entry.personB === selfId && entry.personA === person.personId)),
    ) ?? null
  );
}

/** 내 사주 전 — 할 일이 이것 하나라 채운 단추 하나만 선다(C 의 규칙) */
function RegisterSelf() {
  return (
    <section className="flex flex-col gap-4 rounded-[1.75rem] border border-accent/25 bg-accent-wash p-5 sm:p-6">
      <header className="flex flex-col gap-1">
        <p className="eyebrow">내 사주</p>
        <h2 className="text-base font-semibold">내 사주 등록</h2>
        <p className="text-sm text-secondary">
          출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.
        </p>
      </header>
      <Link
        href={previewHref('/me')}
        className="inline-flex h-11 items-center self-start rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-strong sm:h-10"
      >
        내 명식 등록
      </Link>
    </section>
  );
}

/** 사람 0명 — 목록 대신 첫 사람을 부르는 자리 하나 */
function AddFirst() {
  return (
    <Link
      href={previewHref('/me/people')}
      className="flex flex-col gap-1 rounded-[1.75rem] border border-dashed border-border-strong bg-surface p-5 hover:border-accent sm:p-6"
    >
      <span className="text-base font-semibold text-accent-strong">+ 사람 추가</span>
      <span className="text-sm text-secondary">가족이나 친구의 출생 정보를 저장하고 관리하세요.</span>
    </Link>
  );
}
