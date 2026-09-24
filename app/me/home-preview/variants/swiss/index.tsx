import Link from 'next/link';

import { WARNING_ACKNOWLEDGE_LABEL, WARNING_NOTICE_TITLE, warningNoticeLines, type WarningNotice } from '@/src/lib/account';

import type { VariantProps } from '..';
import { PERSON_LIMIT } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { han, latin } from './fonts';
import { Icon } from './icons';
import { SwissMenu } from './menu';
import { PeopleTable } from './people-table';
import { SectionIndex, SelfBlock } from './self-block';
import s from './swiss.module.css';

/*
  **2 · 타이포 그리드 — 스위스.** 구조는 R 을 따르고, 모양은 12열 격자 · 먹 하나 · 강조색 하나 · 그림자 없음.

  위계는 네 단으로만 선다: ① 명식 한자(최대 120px, 900) ② 이름과 큰 숫자(32~40px) ③ 본문(15px)
  ④ 11px 대문자형 라벨. 카드 테두리 대신 2px 먹선이 섹션을 가르고 1px 선이 줄을 가른다.
  섹션은 01 내 사주 · 02 저장한 사람 · 03 더 해 보기 — 번호가 스크롤의 좌표다.
*/
export default function Variant({ state }: VariantProps) {
  const { self, people } = state;
  const full = people.length >= PERSON_LIMIT;

  return (
    <div
      className={`${s.root} ${latin.variable} ${han.variable} flex min-w-0 flex-col gap-12 rounded-[4px] border border-[var(--sw-rule)] px-4 pb-10 pt-4 sm:px-8 sm:pb-12 sm:pt-6 md:gap-16`}
    >
      <SwissMenu unread={state.unread} unreadChat={state.unreadChat} />

      {(state.warning !== null || state.unread > 0) && (
        <div className="-mt-4 flex flex-col gap-4 md:-mt-8">
          <Warning notice={state.warning} />
          <Unread count={state.unread} />
        </div>
      )}

      <header className="grid grid-cols-4 gap-x-4 md:grid-cols-12 md:gap-x-6">
        <h2 className="col-span-4 text-[1.5rem] font-bold leading-[1.2] tracking-[-0.035em] md:col-span-6 md:text-[1.75rem]">
          나의 사주와 인연
        </h2>
        <p className="col-span-4 mt-2 text-[15px] leading-6 text-[var(--sw-ink-2)] md:col-span-5 md:col-start-8 md:mt-0 md:self-end">
          저장한 사주를 확인하고 오늘의 인연을 만나보세요.
        </p>
      </header>

      {self === null ? <RegisterSelf /> : <SelfBlock self={self} />}

      <section aria-labelledby="sw-people" className="grid grid-cols-4 gap-x-4 gap-y-6 md:grid-cols-12 md:gap-x-6">
        <SectionIndex
          index="02"
          label="저장한 사람"
          trailing={
            people.length > 0 && (
              <div className="flex items-center gap-4">
                {!full && (
                  <Link href={previewHref('/me/people')} className={s.secondary}>
                    <Icon name="plus" size={18} />
                    사람 추가
                  </Link>
                )}
                <Link href={previewHref('/me/people')} className={s.tertiary}>
                  전체 관리
                  <Icon name="arrow" size={18} />
                </Link>
              </div>
            )
          }
        />

        <div className="col-span-4 flex items-baseline gap-3 md:col-span-12">
          <h2 id="sw-people" className="sr-only">
            저장한 사람
          </h2>
          <p className="flex items-baseline gap-1 tabular-nums" aria-label={`${people.length}/${PERSON_LIMIT}명`}>
            <span aria-hidden="true" className="text-[3.5rem] font-semibold leading-none tracking-[-0.05em] md:text-[4.5rem]">
              {people.length}
            </span>
            <span aria-hidden="true" className="text-[1.25rem] font-semibold tracking-[-0.02em] text-[var(--sw-ink-3)]">
              /{PERSON_LIMIT}명
            </span>
          </p>
        </div>

        <div className="col-span-4 min-w-0 md:col-span-12">
          {people.length === 0 ? (
            <AddFirst primary={self !== null} />
          ) : (
            <PeopleTable people={people} readings={state.readings} selfPersonId={self?.personId ?? null} />
          )}
          {full && <p className="mt-3 text-[13px] text-[var(--sw-ink-3)]">등록할 수 있는 10명을 다 채웠습니다.</p>}
        </div>
      </section>

      <nav aria-labelledby="sw-more" className="grid grid-cols-4 gap-x-4 gap-y-6 md:grid-cols-12 md:gap-x-6">
        <div className="col-span-4 md:col-span-12">
          <p id="sw-more" className={`${s.eyebrow} ${s.eyebrowInk} flex items-baseline gap-3`}>
            <span className="tabular-nums text-[var(--sw-accent)]">03</span>더 해 보기
          </p>
        </div>
        {[
          { href: '/', label: '다른 사람 사주 보기' },
          { href: '/compat', label: '궁합 보러 가기' },
          ...(self === null ? [] : [{ href: '/me/matching', label: '매칭에서 오늘의 인연 만나기' }]),
        ].map((link) => (
          <Link key={link.href} href={previewHref(link.href)} className={`${s.cell} col-span-4`}>
            {link.label}
            <Icon name="arrow" />
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** 경고 — 승인 문구 그대로. 왼쪽 4px 선과 제목 색이 말하고, 단추는 모양만 선다(가짜 경고다) */
function Warning({ notice }: { notice: WarningNotice | null }) {
  if (notice === null) return null;
  return (
    <section
      aria-label={WARNING_NOTICE_TITLE}
      className="grid grid-cols-4 gap-x-4 gap-y-3 border-l-4 border-[var(--sw-danger)] bg-[var(--sw-danger-wash)] py-5 pl-4 pr-4 md:grid-cols-12 md:gap-x-6 md:pl-6"
    >
      <h2 className="col-span-4 text-[17px] font-bold tracking-[-0.02em] text-[var(--sw-danger)] md:col-span-3">
        {WARNING_NOTICE_TITLE}
      </h2>
      <div className="col-span-4 flex flex-col gap-1 text-[15px] leading-6 md:col-span-6">
        {warningNoticeLines(notice).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <span className={`${s.primary} col-span-4 self-start md:col-span-3 md:justify-self-end`}>{WARNING_ACKNOWLEDGE_LABEL}</span>
    </section>
  );
}

/** 새 소식 — 위아래 먹선 사이의 한 줄. 수가 오른쪽에 크게 선다 */
function Unread({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Link
      href={previewHref('/me/requests')}
      className="group flex min-h-14 items-center justify-between gap-4 border-y border-[var(--sw-ink)] text-[15px] font-semibold hover:text-[var(--sw-accent)]"
    >
      <span>아직 확인하지 않은 새 소식이 있습니다.</span>
      <span className="flex shrink-0 items-center gap-3 text-[var(--sw-accent)]">
        <span className="text-[1.75rem] font-semibold leading-none tracking-[-0.04em] tabular-nums">
          {count}
          <span className="sr-only">건 안 읽음</span>
        </span>
        <Icon name="arrow" />
      </span>
    </Link>
  );
}

/** 내 사주 전 — 빈 격자가 명식이 설 자리를 먼저 보여준다. 할 일은 하나, 주 단추 하나 */
function RegisterSelf() {
  return (
    <section aria-labelledby="sw-register" className="grid grid-cols-4 gap-x-4 gap-y-8 md:grid-cols-12 md:gap-x-6">
      <SectionIndex index="01" label="내 사주" />
      <div className="col-span-4 flex flex-col gap-4 md:col-span-5">
        <h2 id="sw-register" className="text-[2rem] font-bold leading-[1.1] tracking-[-0.035em] md:text-[2.5rem]">
          내 사주 등록
        </h2>
        <p className="text-[15px] leading-6 text-[var(--sw-ink-2)]">
          출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.
        </p>
        <Link href={previewHref('/me')} className={`${s.primary} mt-2 self-start`}>
          내 명식 등록
          <Icon name="arrow" />
        </Link>
      </div>
      <ol aria-hidden="true" className="col-span-4 grid grid-cols-4 gap-2 md:col-span-6 md:col-start-7 md:gap-3">
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index} className="aspect-square border border-dashed border-[var(--sw-rule-2)]" />
        ))}
      </ol>
    </section>
  );
}

/** 사람 0명 — 목록 자리에 한 줄. 내 사주가 있으면 이것이 주 행동이고, 없으면 보조로 물러난다 */
function AddFirst({ primary }: { primary: boolean }) {
  return (
    <div className="flex flex-col gap-4 border-y border-dashed border-[var(--sw-rule-2)] py-8 md:flex-row md:items-center md:justify-between">
      <p className="text-[15px] leading-6 text-[var(--sw-ink-2)]">가족이나 친구의 출생 정보를 저장하고 관리하세요.</p>
      <Link href={previewHref('/me/people')} className={`${primary ? s.primary : s.secondary} self-start md:self-auto`}>
        <Icon name="plus" size={18} />
        사람 추가
      </Link>
    </div>
  );
}
