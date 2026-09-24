import Link from 'next/link';

import { WARNING_ACKNOWLEDGE_LABEL, WARNING_NOTICE_TITLE, warningNoticeLines, type WarningNotice } from '@/src/lib/account';

import type { VariantProps } from '..';
import type { ReadingEntry } from '../../../reading/current';
import { PERSON_LIMIT, type FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { Icon, type IconName } from './icons';
import { Badge, MenuBottom, MenuTop } from './menu';
import styles from './night.module.css';
import { PersonRow } from './person-row';
import { RegisterSelf, SelfHero } from './self-hero';
import { serif } from './tone';

/*
  **2차 · 밤하늘 — 다크 프리미엄.** 담는 것은 R(추천 조합)과 같고, 모양은 새로 그렸다.

  판 하나가 늘 밤이다 — 라이트 모드에서도 이 판만은 제 남색 면 위에 선다(색은 `night.module.css` 한 벌).
  위에서 아래로: 메뉴 → 경고 · 새 소식 → **나(여덟 글자가 주인공인 히어로)** → 저장한 사람(유리 행) →
  더 해 보기(타일 셋) → 폰의 하단 메뉴 모형. 금빛 채움 단추는 판마다 하나: 나의 판은 「사주풀이」, 빈 상태는
  그 한 가지 할 일. 나머지는 반투명 보조와 금빛 밑줄 텍스트다.
*/
export default function Variant({ state }: VariantProps) {
  const { self, people } = state;
  const selfId = self?.personId ?? null;
  const full = people.length >= PERSON_LIMIT;

  return (
    <div className={`${styles.sky} flex min-w-0 flex-col gap-8 px-4 py-5 sm:gap-12 sm:p-8`}>
      <MenuTop unread={state.unread} unreadChat={state.unreadChat} />

      {(state.warning !== null || state.unread > 0) && (
        <div className="flex flex-col gap-3">
          <Warning notice={state.warning} />
          <Unread count={state.unread} />
        </div>
      )}

      <header className="flex flex-col gap-2">
        <h2 className={`${serif.className} text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[2.5rem]`}>
          나의 사주와 인연
        </h2>
        <p className="text-[15px] text-[color:var(--n-text-2)]">저장한 사주를 확인하고 오늘의 인연을 만나보세요.</p>
      </header>

      {self === null ? <RegisterSelf /> : <SelfHero self={self} />}

      <section aria-labelledby="night-people" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <h2 id="night-people" className={`${serif.className} flex items-baseline gap-3 text-[1.375rem] font-semibold tracking-[-0.02em]`}>
            저장한 사람
            <span className="font-sans text-sm font-medium tabular-nums text-[color:var(--n-text-3)]">
              {people.length}/{PERSON_LIMIT}명
            </span>
          </h2>
          {people.length > 0 && (
            <div className="flex items-center gap-4">
              {!full && (
                <Link
                  href={previewHref('/me/people')}
                  className={`${styles.secondary} inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold`}
                >
                  <Icon name="plus" className="size-4" />
                  사람 추가
                </Link>
              )}
              <Link
                href={previewHref('/me/people')}
                className={`${styles.text} inline-flex min-h-11 items-center gap-1 text-sm font-semibold`}
              >
                전체 관리
                <Icon name="arrow" className="size-4" />
              </Link>
            </div>
          )}
        </div>

        {people.length === 0 ? (
          <AddFirst primary={self !== null} />
        ) : (
          <ol className="flex flex-col gap-2">
            {people.map((person) => (
              <PersonRow key={person.personId} person={person} selfPersonId={selfId} pair={pairOf(state.readings, selfId, person)} />
            ))}
          </ol>
        )}
        {full && <p className="text-[13px] text-[color:var(--n-text-2)]">등록할 수 있는 10명을 다 채웠습니다.</p>}
      </section>

      <nav aria-label="더 해 보기" className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        {EXPLORE.filter((link) => self !== null || link.href !== '/me/matching').map((link) => (
          <Link
            key={link.href}
            href={previewHref(link.href)}
            className={`${styles.glass} ${styles.row} flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold`}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/6 text-[color:var(--n-gold)]">
              <Icon name={link.icon} className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">{link.label}</span>
            <Icon name="arrow" className="size-4 text-[color:var(--n-text-3)]" />
          </Link>
        ))}
      </nav>

      <MenuBottom unreadChat={state.unreadChat} />
    </div>
  );
}

/** 더 해 보기 — 매칭은 내 사주가 있을 때만 선다 */
const EXPLORE: readonly { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: '다른 사람 사주 보기', icon: 'eye' },
  { href: '/compat', label: '궁합 보러 가기', icon: 'pair' },
  { href: '/me/matching', label: '매칭에서 오늘의 인연 만나기', icon: 'people' },
];

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

/**
 * 경고 안내 — `shared/warning-banner.tsx` 와 같은 승인 문구를 밤 면에 옮겼다. 단추는 모양만 선다.
 * 이 판의 다른 금 채움과 겹치지 않게, 경고의 단추는 산호색 채움이다 — 경고는 이 화면에서 가장 먼저 해야 할 일이다.
 */
function Warning({ notice }: { notice: WarningNotice | null }) {
  if (notice === null) return null;
  return (
    <section
      aria-label={WARNING_NOTICE_TITLE}
      className="flex flex-col gap-3 rounded-2xl border border-[color:var(--n-coral)]/50 bg-[var(--n-coral-wash)] p-5"
    >
      <h2 className="flex items-center gap-2 text-base font-bold text-[color:var(--n-coral)]">
        <span aria-hidden="true" className="grid size-5 place-items-center rounded-full border border-current text-xs">
          !
        </span>
        {WARNING_NOTICE_TITLE}
      </h2>
      <div className="flex flex-col gap-1 text-[15px] leading-relaxed text-[color:var(--n-text)]">
        {warningNoticeLines(notice).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <span className="inline-flex min-h-11 items-center self-start rounded-xl bg-[var(--n-coral)] px-5 text-sm font-bold text-[#240b05]">
        {WARNING_ACKNOWLEDGE_LABEL}
      </span>
    </section>
  );
}

/** 새 소식 — `shared/unread-strip.tsx` 의 문구 그대로, 유리 띠에 금 점 */
function Unread({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Link
      href={previewHref('/me/requests')}
      className={`${styles.glass} ${styles.row} flex min-h-13 items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold`}
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[var(--n-gold)] shadow-[0_0_10px_var(--n-gold)]" />
      <span className="min-w-0 flex-1">아직 확인하지 않은 새 소식이 있습니다.</span>
      <Badge count={count} />
      <Icon name="arrow" className="size-4 text-[color:var(--n-text-3)]" />
    </Link>
  );
}

/** 사람 0명 — 별자리 한 점으로 비워 둔 자리. 내 사주가 없으면 주 행동을 「내 명식 등록」에 양보한다 */
function AddFirst({ primary }: { primary: boolean }) {
  return (
    <div className={`${styles.empty} flex flex-col items-start gap-5 rounded-[1.75rem] p-6 sm:flex-row sm:items-center sm:p-8`}>
      <svg aria-hidden="true" viewBox="0 0 96 56" className="h-14 w-24 shrink-0">
        <path d="M8 44 30 18 54 30 86 10" fill="none" stroke="var(--n-gold)" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="2 3" />
        <circle cx="8" cy="44" r="2.5" fill="var(--n-gold)" />
        <circle cx="30" cy="18" r="1.8" fill="var(--n-text-2)" />
        <circle cx="54" cy="30" r="1.8" fill="var(--n-text-2)" />
        <circle cx="86" cy="10" r="3" fill="none" stroke="var(--n-gold)" strokeWidth="1.2" />
      </svg>
      <p className="flex-1 text-[15px] leading-relaxed text-[color:var(--n-text-2)]">
        가족이나 친구의 출생 정보를 저장하고 관리하세요.
      </p>
      <Link
        href={previewHref('/me/people')}
        className={`${primary ? styles.primary : styles.secondary} inline-flex min-h-12 items-center justify-center gap-2 self-stretch rounded-2xl px-6 text-[15px] font-bold sm:self-auto`}
      >
        <Icon name="plus" className="size-4.5" />
        사람 추가
      </Link>
    </div>
  );
}
