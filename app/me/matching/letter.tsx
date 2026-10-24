'use client';

import { useState } from 'react';

import { BUTTON_TERTIARY } from '../../ui/buttons';
import { Icon } from '../../ui/icons';

/** 이보다 긴 소개는 세 줄로 접어 두고 「더 보기」로 편다 — 소개가 카드를 늘어뜨리지 않게 */
const LETTER_FOLD_AT = 90;

/**
 * 소개 — 편지지 한 장. 길면 세 줄로 접어 두고 펴는 단추를 준다(소개가 카드를 늘어뜨리지 않게). 비었으면 비었다고만 말한다(서명 없이).
 * 접혀 있어도 글은 그대로 문서에 있다 — 보조기기는 끝까지 읽는다. 오늘의 인연 ⓘ 시트 · 옆 열과 상대 프로필 시트(`../partner-sheet.tsx`)가
 * 같은 한 장을 쓴다.
 */
export function Letter({ nickname, intro }: { nickname: string; intro: string | null }) {
  const [open, setOpen] = useState(false);
  const long = intro !== null && intro.length > LETTER_FOLD_AT;
  return (
    <figure className="flex flex-col gap-2 rounded-card bg-surface px-5 py-4 ring-1 ring-border">
      {intro !== null ? (
        <blockquote className={`font-rounded text-field leading-7 text-foreground ${long && !open ? 'line-clamp-3' : ''}`}>
          <Icon name="quote" className="mr-1.5 inline size-4 -translate-y-0.5 text-cream-ink" />
          {intro}
        </blockquote>
      ) : (
        <p className="text-note font-medium text-secondary">자기소개 없음</p>
      )}
      {/* 서명은 소개에 붙는다 — 소개가 없으면 「자기소개 없음」 아래에 이름만 남아 아무 말도 서명하지 않았다(화면 감사 2026-10-09) */}
      {intro !== null && (
        <div className="flex items-center justify-between gap-3">
          {long ? (
            <button type="button" aria-expanded={open} onClick={() => setOpen((was) => !was)} className={BUTTON_TERTIARY}>
              {open ? '접기' : '더 보기'}
            </button>
          ) : (
            <span />
          )}
          <figcaption className="font-rounded text-body text-cream-ink">— {nickname}</figcaption>
        </div>
      )}
    </figure>
  );
}
