import Link from 'next/link';

import { CHAT_EMPTY_DETAIL, CHAT_EMPTY_TITLE } from '@/src/lib/chat';

import { previewHref } from '../../../shared/preview-href';
import { PRIMARY } from '../buttons';
import { rounded } from '../fonts';
import { ELEMENT_CLASS, Icon } from '../symbols';

/*
  **아직 방이 없을 때 — 비어 있다는 말보다 「여기에 두 사람의 말이 오간다」는 그림을 먼저 건넨다.**

  그림은 말풍선 둘: 나무 빛 하나, 불꽃 빛 하나가 서로를 향해 기울고 사이에 작은 하트가 뜬다. 색은 모두 이 시안의
  오행 팔레트 변수라 다크에서 함께 가라앉는다. 문구는 승인된 두 줄 그대로이고, 갈 길은 하나(매칭)다 —
  내 사주가 없으면 매칭을 못 하므로 그 자리에 등록이 선다.
*/
export function EmptyChat({ hasSelf }: { hasSelf: boolean }) {
  return (
    <section className="relative flex flex-col items-center gap-6 overflow-hidden rounded-[2rem] bg-[var(--cream)] px-6 py-10 text-center sm:py-14">
      <Illustration />
      <div className="flex max-w-md flex-col gap-2">
        <h2 className={`${rounded.className} text-[1.75rem] leading-[1.3] tracking-[-0.02em] text-foreground sm:text-[2rem]`}>
          {CHAT_EMPTY_TITLE}
        </h2>
        <p className="text-[15px] leading-6 text-secondary">{CHAT_EMPTY_DETAIL}</p>
      </div>
      {hasSelf ? (
        <Link href={previewHref('/me/matching')} className={PRIMARY}>
          <Icon name="people" className="size-[18px]" />
          매칭에서 오늘의 인연 만나기
        </Link>
      ) : (
        <Link href={previewHref('/me')} className={PRIMARY}>
          내 명식 등록
          <Icon name="arrow" className="size-4" />
        </Link>
      )}
    </section>
  );
}

function Illustration() {
  return (
    <svg aria-hidden="true" viewBox="0 0 260 170" className="h-auto w-[15rem] sm:w-[17rem]" strokeLinecap="round" strokeLinejoin="round">
      {/* 바닥의 옅은 해 */}
      <circle cx="130" cy="92" r="72" fill="var(--card)" opacity="0.7" />
      <path d="M40 150c28-8 58-10 90-10s62 2 90 10" fill="none" stroke="var(--cream-ink)" strokeWidth="1.6" opacity="0.25" />

      {/* 왼쪽 말풍선 — 나무 */}
      <g className={ELEMENT_CLASS.木} transform="rotate(-6 78 78)">
        <path
          d="M34 52a18 18 0 0 1 18-18h56a18 18 0 0 1 18 18v28a18 18 0 0 1-18 18H66l-16 14v-14a18 18 0 0 1-16-18Z"
          fill="var(--tile)"
          stroke="var(--ink)"
          strokeWidth="2"
        />
        <path d="M58 76V62" stroke="var(--ink)" strokeWidth="2" fill="none" />
        <path d="M58 66c-6 0-9-3.4-9-9 5.8 0 9 3.2 9 9Z" fill="var(--mid)" stroke="var(--ink)" strokeWidth="1.6" />
        <path d="M58 63c0-5.4 3.1-9 9-9 0 5.9-3.4 9-9 9Z" fill="var(--mid)" stroke="var(--ink)" strokeWidth="1.6" />
        <circle cx="82" cy="66" r="3" fill="var(--ink)" />
        <circle cx="94" cy="66" r="3" fill="var(--ink)" opacity="0.6" />
        <circle cx="106" cy="66" r="3" fill="var(--ink)" opacity="0.3" />
      </g>

      {/* 오른쪽 말풍선 — 불꽃 */}
      <g className={ELEMENT_CLASS.火} transform="rotate(5 182 104)">
        <path
          d="M226 88a18 18 0 0 0-18-18h-56a18 18 0 0 0-18 18v26a18 18 0 0 0 18 18h40l16 13v-13a18 18 0 0 0 18-18Z"
          fill="var(--tile)"
          stroke="var(--ink)"
          strokeWidth="2"
        />
        <path d="M152 96h40M152 108h26" stroke="var(--ink)" strokeWidth="3" fill="none" opacity="0.45" />
        <path
          d="M208 116c-5 0-8.2-3.2-8.2-7.6 0-4 2.8-6.2 4.2-9.4.8 2 1.8 3.1 3 3.6.3-2.6 2-5.5 4.7-7.5-.4 3.7 1.7 5.9 3.2 8.1 1.2 1.7 2 3.7 2 6 0 4.8-3.6 6.8-8.9 6.8Z"
          fill="var(--mid)"
          stroke="var(--ink)"
          strokeWidth="1.6"
        />
      </g>

      {/* 사이의 하트와 반짝임 */}
      <g className={ELEMENT_CLASS.火}>
        <path
          d="M132 40s-11-6.4-11-14.2a6.2 6.2 0 0 1 11-3.7 6.2 6.2 0 0 1 11 3.7c0 7.8-11 14.2-11 14.2Z"
          fill="var(--mid)"
          stroke="var(--ink)"
          strokeWidth="1.8"
        />
      </g>
      <g className={ELEMENT_CLASS.土} fill="var(--mid)" stroke="var(--ink)" strokeWidth="1.4">
        <path d="M230 36 232.4 43l7 2.4-7 2.4L230 55l-2.4-7.2-7-2.4 7-2.4Z" />
        <path d="M28 118l1.6 4.6 4.6 1.6-4.6 1.6L28 130.4l-1.6-4.6-4.6-1.6 4.6-1.6Z" />
      </g>
      <g className={ELEMENT_CLASS.水}>
        <circle cx="196" cy="30" r="4" fill="var(--mid)" stroke="var(--ink)" strokeWidth="1.4" />
      </g>
    </svg>
  );
}
