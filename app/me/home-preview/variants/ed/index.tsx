import Link from 'next/link';

import { WARNING_ACKNOWLEDGE_LABEL, WARNING_NOTICE_TITLE, warningNoticeLines, type WarningNotice } from '@/src/lib/account';

import type { VariantProps } from '..';
import { previewHref } from '../../shared/preview-href';
import { Arrow } from './arrow';
import { Contents } from './contents';
import { Cover, EmptyCover } from './cover';
import s from './ed.module.css';
import { figures, serifKr } from './fonts';
import { Masthead } from './masthead';

/*
  **2차 · 편집 디자인 — 홈은 잡지 한 권이다.** 제호(메뉴) → 표지(나) → 목차(저장한 사람) → 뒷면(더 해 보기).

  카드 · 그림자 · 둥근 상자를 전부 걷었다. 칸을 가르는 것은 선 셋뿐이다: 굵은 잉크 3px(권의 시작) · 잉크 1px(칸) ·
  머리카락 선(줄). 활자는 명조(Noto Serif KR) 디스플레이와 Pretendard 본문 두 벌, 숫자는 Fraunces. 담는 것과 길은
  R(`variants/r`)과 같다 — 모양만 다르다. 수치는 `NOTES.md`.
*/
export default function Variant({ state }: VariantProps) {
  const { self, people } = state;
  const selfId = self?.personId ?? null;

  return (
    <div className={`${s.root} ${serifKr.variable} ${figures.variable} flex min-w-0 flex-col gap-12 sm:gap-14 lg:gap-16`}>
      <div className="flex flex-col gap-6">
        <Masthead unread={state.unread} unreadChat={state.unreadChat} />
        <Warning notice={state.warning} />
        <Unread count={state.unread} />
      </div>

      {self === null ? <EmptyCover /> : <Cover self={self} />}

      <Contents people={people} readings={state.readings} selfId={selfId} />

      <BackMatter hasSelf={self !== null} />
    </div>
  );
}

/** 경고 안내 — 승인 문구 그대로(`shared/warning-banner.tsx` 와 같은 글). 모양만 편집물의 「정정 알림」 상자다 */
function Warning({ notice }: { notice: WarningNotice | null }) {
  if (notice === null) return null;
  return (
    <section aria-label={WARNING_NOTICE_TITLE} className="flex flex-col gap-4 border-y-[3px] border-danger py-5">
      <h2 className={`${s.entry} text-danger`}>{WARNING_NOTICE_TITLE}</h2>
      <div className="flex max-w-[40rem] flex-col gap-1 text-[0.9375rem] leading-6">
        {warningNoticeLines(notice).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <span className={`${s.primary} self-start`}>{WARNING_ACKNOWLEDGE_LABEL}</span>
    </section>
  );
}

/** 새 소식 — 제호 아래 한 줄. 원본 `UnreadStrip` 의 문구 그대로 */
function Unread({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Link
      href={previewHref('/me/requests')}
      className={`${s.row} ${s.hair} flex min-h-12 items-center gap-3 border-b border-b-border-strong px-1 text-[0.9375rem] font-semibold`}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-fire text-xs font-bold text-white">
        {count}
        <span className="sr-only">건 안 읽음</span>
      </span>
      <span className="min-w-0 flex-1">아직 확인하지 않은 새 소식이 있습니다.</span>
      <Arrow />
    </Link>
  );
}

/** 뒷면 — 남은 길 셋이 목차처럼 번호와 명조 제목으로 선다. 줄 전체가 누르는 자리(64px) */
function BackMatter({ hasSelf }: { hasSelf: boolean }) {
  const links = [
    { href: '/', label: '다른 사람 사주 보기' },
    { href: '/compat', label: '궁합 보러 가기' },
    ...(hasSelf ? [{ href: '/me/matching', label: '매칭에서 오늘의 인연 만나기' }] : []),
  ];
  return (
    <nav aria-label="더 해 보기" className={`${s.rule} flex flex-col pt-3`}>
      <p className={`${s.caption} pb-3`}>더 해 보기</p>
      <ul className="grid lg:grid-cols-3 lg:gap-x-8">
        {links.map((link, index) => (
          <li key={link.href} className={s.hair}>
            <Link href={previewHref(link.href)} className={`${s.row} flex min-h-16 items-center gap-4 py-3`}>
              <span aria-hidden="true" className={`${s.figure} text-base text-secondary`}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className={`${s.entry} ${s.back} min-w-0 flex-1`}>{link.label}</span>
              <Arrow size={20} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
