import Link from 'next/link';

import { WARNING_ACKNOWLEDGE_LABEL, WARNING_NOTICE_TITLE, warningNoticeLines, type WarningNotice } from '@/src/lib/account';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import type { VariantProps } from '..';
import { PERSON_LIMIT } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { BottomBar, TopBar } from './menu';
import { orbitModelOf } from './model';
import { OrbitView, type OrbitCopy } from './orbit-view';
import { PeopleList } from './people-list';
import { Arrow, BUTTON, Plus } from './ui';

/*
  **2차 · 관계 지도 — 나를 중심에 두고 사람들이 둘레를 돈다.**

  1차 아홉 시안은 모두 「내 카드 한 장 + 사람 목록」을 위아래로 쌓았다. 여기서는 홈의 주인공을 **지도**로
  바꾼다. 가운데 내 일간 글자가 크게 서고, 저장한 사람이 두 궤도에 앉는다. 이미 본 궁합은 선과 점수로
  보이고, 안 본 관계에는 선을 긋지 않는다 — 판정을 지어내지 않는다. 사람을 누르면 옆 판(폰은 아래 판)에
  그 사람의 여덟 글자와 행동 셋이 열린다. 지도 아래 목록은 링크만으로 도는 기본 경로다.

  문구는 전부 이 파일의 `COPY` 에 모았다 — 새 것과 기존 것의 구분은 `NOTES.md` 의 표가 든다.
*/

const COPY: OrbitCopy = {
  hourUnknown: HOUR_UNKNOWN_LABEL,
  noHourNote: '출생 시각을 몰라 시주는 제외했습니다',
  elementsTitle: '오행 분포',
  readingGet: '사주풀이 받기',
  readingGetSub: '기질과 삶의 흐름을 읽어보세요',
  readingSee: '사주풀이 보기',
  readingSeeSub: '만들어 둔 풀이를 이어서 읽어보세요',
  oldChart: '이전 명식',
  detail: '사주 자세히 보기',
  compatWithMe: '나와 궁합',
  compat: '궁합',
  registerTitle: '내 사주 등록',
  registerBody: '출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.',
  registerAction: '내 명식 등록',
  me: '나',
  legendInner: '풀이나 궁합을 본 사람',
  legendOuter: '저장만 한 사람',
  legendLine: '이미 본 궁합과 점수',
  addFirstBody: '가족이나 친구의 출생 정보를 저장하고 관리하세요.',
  addPerson: '사람 추가',
  selfEyebrow: '내 사주',
  personEyebrow: '저장한 사람',
  noReading: '풀이 없음',
};

export default function Variant({ state }: VariantProps) {
  const model = orbitModelOf(state);
  const { self, people } = state;
  const full = people.length >= PERSON_LIMIT;
  const addHref = previewHref('/me/people');
  /* 할 일이 사람 추가 하나뿐일 때(내 사주는 있고 사람이 0명)만 채운 단추다 */
  const addIsPrimary = self !== null && people.length === 0;

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <TopBar unread={state.unread} unreadChat={state.unreadChat} />
      <Warning notice={state.warning} />

      <header className="flex flex-col gap-3">
        {state.unread > 0 && (
          <Link
            href={previewHref('/me/requests')}
            className="group inline-flex min-h-11 items-center gap-2.5 self-start rounded-full border border-accent/30 bg-accent-wash py-1.5 pl-1.5 pr-4 text-sm font-semibold text-accent transition hover:border-accent active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="grid size-7 place-items-center rounded-full bg-fire text-xs font-bold text-white">
              {state.unread}
              <span className="sr-only">건 안 읽음</span>
            </span>
            아직 확인하지 않은 새 소식이 있습니다.
            <Arrow />
          </Link>
        )}
        <h2 className="text-[2rem] font-bold leading-[1.15] tracking-[-0.045em] sm:text-[2.5rem]">나의 사주와 인연</h2>
        <p className="text-[15px] leading-6 text-secondary">저장한 사주를 확인하고 오늘의 인연을 만나보세요.</p>
      </header>

      <OrbitView model={model} copy={COPY} addHref={addHref} registerHref={previewHref('/me')} canAdd={!full} />

      <section aria-labelledby="orbit-people" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h3 id="orbit-people" className="flex items-baseline gap-2 text-xl font-bold tracking-[-0.03em]">
            저장한 사람
            <span className="text-sm font-semibold tabular-nums text-muted">
              {people.length}/{PERSON_LIMIT}명
            </span>
          </h3>
          <div className="flex items-center gap-3">
            {people.length > 0 && (
              <Link href={addHref} className={BUTTON.tertiary}>
                전체 관리 <Arrow />
              </Link>
            )}
            {!full && (
              <Link href={addHref} className={`${addIsPrimary ? BUTTON.primary : BUTTON.secondary} min-h-11 px-4`}>
                <Plus /> 사람 추가
              </Link>
            )}
          </div>
        </div>
        {people.length > 0 && (
          <PeopleList
            people={model.people}
            hasSelf={self !== null}
            copy={{ reading: '풀이', compat: '궁합', noReading: COPY.noReading, oldChart: COPY.oldChart }}
          />
        )}
        {full && <p className="text-[13px] text-muted">등록할 수 있는 10명을 다 채웠습니다.</p>}
      </section>

      <nav aria-label="더 해 보기" className="grid gap-3 sm:grid-cols-3">
        {[
          { href: '/', label: '다른 사람 사주 보기' },
          { href: '/compat', label: '궁합 보러 가기' },
          ...(self === null ? [] : [{ href: '/me/matching', label: '매칭에서 오늘의 인연 만나기' }]),
        ].map((link) => (
          <Link key={link.href} href={previewHref(link.href)} className={`${BUTTON.secondary} justify-between text-left`}>
            {link.label} <Arrow />
          </Link>
        ))}
      </nav>

      <BottomBar unreadChat={state.unreadChat} />
    </div>
  );
}

/** 경고 안내 — 승인된 문구 그대로(ADR 0108). 원본의 「확인했습니다」는 서버 액션이라 여기서는 모양만 선다 */
function Warning({ notice }: { notice: WarningNotice | null }) {
  if (notice === null) return null;
  return (
    <section
      aria-label={WARNING_NOTICE_TITLE}
      className="flex flex-col gap-4 rounded-[1.5rem] border border-danger/40 bg-danger-wash p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6"
    >
      <div className="flex min-w-0 gap-3">
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-danger text-base font-bold text-surface">
          !
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="text-[17px] font-bold text-danger">{WARNING_NOTICE_TITLE}</h2>
          {warningNoticeLines(notice).map((line) => (
            <p key={line} className="text-[15px] leading-6 text-foreground">
              {line}
            </p>
          ))}
        </div>
      </div>
      <span className={`${BUTTON.primary} shrink-0 self-start sm:self-end`}>{WARNING_ACKNOWLEDGE_LABEL}</span>
    </section>
  );
}
