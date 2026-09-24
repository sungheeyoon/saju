import Link from 'next/link';

import type { VariantProps } from '..';
import { PERSON_LIMIT } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { UnreadStrip } from '../../shared/unread-strip';
import { WarningBanner } from '../../shared/warning-banner';
import { PersonRow } from './person-row';
import { ProposedMenu } from './proposed-menu';

/*
  **E · 단일 목록형** — 홈이 목록 하나다. 첫 줄이 나(고정), 그 아래 저장한 사람. 카드를 줄로 바꾸면
  열 명이 한 화면에 드는가, 그리고 무엇을 잃는가를 보려는 시안이다. 자세한 명식과 풀이 본문은 안 싣는다 —
  줄을 누르면 기존 상세로 간다.
*/
export default function Variant({ state }: VariantProps) {
  const { self, people } = state;
  const selfPersonId = self?.personId ?? null;
  const full = people.length >= PERSON_LIMIT;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ProposedMenu unread={state.unread} unreadChat={state.unreadChat} />
      <WarningBanner notice={state.warning} />
      <UnreadStrip count={state.unread} />

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h2 className="text-xl font-bold tracking-[-0.03em]">나의 사주와 인연</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {full ? (
            <span className="rounded-full border border-border bg-surface-sunken px-3.5 py-1.5 font-semibold text-muted">
              사람 추가 <span className="tabular-nums">{people.length}/{PERSON_LIMIT}</span>
            </span>
          ) : (
            <Link
              href={previewHref('/me/people')}
              className="rounded-full border border-border-strong bg-surface px-3.5 py-1.5 font-semibold hover:border-accent hover:text-accent"
            >
              + 사람 추가 <span className="tabular-nums text-muted">{people.length}/{PERSON_LIMIT}</span>
            </Link>
          )}
          <Link
            href={previewHref('/')}
            className="rounded-full border border-border-strong bg-surface px-3.5 py-1.5 font-semibold hover:border-accent hover:text-accent"
          >
            다른 사람 사주 보기
          </Link>
        </div>
      </div>

      <ol className="divide-y divide-border overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow-card)]">
        {self === null ? (
          <SelfMissing />
        ) : (
          <PersonRow
            self
            selfPersonId={selfPersonId}
            person={{
              personId: self.personId,
              label: self.label,
              note: null,
              chart: { ok: true, saju: self.saju },
              reading: self.reading,
            }}
          />
        )}
        {people.map((person) => (
          <PersonRow
            key={person.personId}
            self={false}
            selfPersonId={selfPersonId}
            person={{
              personId: person.personId,
              label: person.local_label,
              note: person.note,
              chart: person.chart,
              reading: person.reading,
            }}
          />
        ))}
        {people.length === 0 && (
          <li className="px-4 py-4 text-sm text-muted">
            아직 저장한 사람이 없습니다. 이름과 출생 정보를 입력해 사람을 추가해 보세요.
          </li>
        )}
      </ol>

      {self !== null && (
        <Link
          href={previewHref('/me/matching')}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-accent-wash px-4 py-2.5 text-sm font-semibold text-accent"
        >
          <span className="truncate">매칭에서 오늘의 인연 만나기</span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}

/** 내 사주가 없을 때 첫 줄 — 등록 폼은 안 그리고 온보딩으로 이끄는 자리만 선다 */
function SelfMissing() {
  return (
    <li className="flex flex-col gap-3 bg-accent-wash px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5">
          <span className="text-sm font-semibold">내 사주 등록</span>
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-on-accent">나</span>
        </p>
        <p className="mt-0.5 text-xs text-secondary">
          나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.
        </p>
      </div>
      <Link
        href={previewHref('/me')}
        className="inline-flex h-10 shrink-0 items-center self-start rounded-lg bg-accent px-4 text-sm font-medium text-on-accent sm:self-auto"
      >
        내 사주 등록
      </Link>
    </li>
  );
}
