'use client';

import { useState } from 'react';

import { isoOf, solarDateOf } from '@/src/lib/input/chart';
import { HOUR_UNKNOWN_LABEL, type Query } from '@/src/lib/input/query';
import { CALENDAR_KO, GENDER_KO } from '@/src/lib/saju';

import { BUTTON_SECONDARY_SMALL } from '../../ui/buttons';
import { EditInputForm } from '../edit-input';

/** 판 한 장 — 위 프로필 판과 같은 흰 판(`form.tsx` 의 `PANEL`) */
const PANEL = 'flex flex-col gap-4 rounded-card border border-border bg-surface p-5 sm:p-6';

/** 칸의 이름 — 닉네임 · 소개 칸의 이름과 같은 글자 크기 · 굵기(`form.tsx` 의 `LABEL`) */
const LABEL = 'text-small font-semibold text-secondary';

/**
 * **출생 정보** — 프로필 수정 화면의 셋째 판(2026-10-26 운영자 「생일 · 닉네임 등 고치기를 프로필 고치기 한 곳에」).
 *
 * 홈 카드 모서리의 연필이 열던 폼을 여기로 옮겼다 — 카카오톡 「프로필 편집」 · 당근 「프로필 수정」처럼 나에 대한 것을 한 화면에서
 * 고친다. **규칙은 그 폼(`EditInputForm`) 그대로다** — 같은 칸 · 「고치면 사주와 궁합을 새 정보로 다시 계산해요」 안내 · 여덟 글자가
 * 바뀌는 저장만 묻는 확인 창(`confirmsRequests`, 답을 기다리던 인연 요청이 무효가 되고 예약된 풀이권이 돌아온다 — PRD §6.2 · ADR 0028)
 * · 바뀐 것이 없으면 가라앉은 저장 · 「작성 그만두기」. 이름은 여기서 안 고친다 — 바로 위 닉네임 칸이 든다.
 *
 * 접어 둔다 — 지금 값을 줄로 보이고, 「수정」을 누르면 그 자리에 폼이 펴진다. 그 단추의 읽는 이름은 연필 때와 같은 「출생 정보 수정」이다.
 */
export function BirthSection({ personId, query }: { personId: string; query: Query }) {
  const [open, setOpen] = useState(false);

  const rows = [
    [
      '생년월일',
      `${
        query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date} · 양력 ${isoOf(solarDateOf(query))}`
      }${query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` ${query.time}`}`,
    ],
    ['성별', GENDER_KO[query.gender]],
    ['출생지', query.city],
    ['자시 규칙', query.rule === 'jo' ? '조자시 (23:00 경계)' : '야자시 (자정 경계)'],
  ] as const;

  /* 펴면 판 자리에 폼이 선다 — 폼이 제 판(머리 「수정하기」 · 재계산 안내)을 든다. 판 안에 판을 겹치지 않는다 */
  if (open) {
    return (
      <EditInputForm
        personId={personId}
        current={query}
        editableName={false}
        nameNote={false}
        confirmsRequests
        onDone={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    );
  }

  return (
    <section aria-labelledby="profile-birth" className={PANEL}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="profile-birth" className="text-body font-semibold text-foreground">
          출생 정보
        </h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-label="출생 정보 수정"
          className={`${BUTTON_SECONDARY_SMALL} shrink-0`}
        >
          수정
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-body">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className={LABEL}>{term}</dt>
            <dd className="min-w-0 break-keep tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
