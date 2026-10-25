import Link from 'next/link';
import type { ReactNode } from 'react';

import { isoOf, solarDateOf } from '@/src/lib/input/chart';
import { HOUR_UNKNOWN_LABEL, type Query } from '@/src/lib/input/query';
import { CALENDAR_KO, ELEMENTS, ELEMENT_PICTURE_KO, GENDER_KO, STEM_INFO, type Saju } from '@/src/lib/saju';

import { elementScope } from '../../ui/element-tone';
import { BUTTON_PRIMARY_FACE, BUTTON_SECONDARY_FACE } from '../../ui/buttons';
import { ElementSymbol } from '../../ui/element-symbol';
import { StemSymbol } from '../../ui/stem-symbol';
import { DayMasterChip } from '../people/chart-bits';
import { Icon } from '../../ui/icons';
import type { ReadingEntry } from '@/src/lib/reading';
import { withFromMe } from './from-me';
import { SELF_READING_MAKING } from './making';
import { LINK_PENDING_SPINNER, LinkPending } from '../../ui/link-pending';
import { TYPE_TITLE } from '../../ui/surfaces';
import type { HomeFace } from './self-face';
import { SelfProfile } from './self-profile';

/*
  **나 — 홈의 기준점.** 카드가 내 일간의 파스텔을 입는다(아래 사람 타일과 같은 규칙이라 「나도 이 목록의
  한 색」이 된다). 오행 분포 다섯 칸이 같은 색에 **상징과 이름**을 붙여 색만으로 말하지 않는다.

  **여덟 글자(한자)는 카드에 없다**(운영자 2026-09-27) — 처음 보는 사람에게 가장 어려운 덩어리였다. 나를 말하는 것은
  일간 딱지 · 천간 그림 · 비유 한 줄이 들고, 여덟 글자는 「만세력 보기」가 든다.

  **넓은 화면에서는 옆 칸(홈 탭은 받은 사주풀이)과 한 줄에 선다.** 격자가 칸을 늘이면 이 카드는 네 덩어리를 위아래로
  고르게 편다(`justify-between`) — 이름과 한 줄 평 → 저장된 출생 정보 →
  오행 분포 → 단추. 무엇으로 계산했나가 결과 앞에 선다. 단추 줄이 지도의 범례 띠와 같은 바닥선에 선다. 남는 높이가 한 틈에 몰리지 않고 덩어리 사이에 나뉜다.

  고치는 손잡이(「출생 정보 수정」)는 오른쪽 맨 위 모서리에 뜨고, 펴지는 폼은 머리 바로 아래에 선다 — 누르는
  곳과 펴지는 곳이 멀면 폰에서 눌러도 아무 일이 없는 것처럼 보였다.
*/

export function SelfCard({
  personId,
  label,
  query,
  saju,
  reading,
  making = false,
  actions,
  face,
  compact = false,
}: {
  /**
   * 저장된 내 사주 — **`null` 이면 아직 저장 전**이다(ADR 0128). 사주 이어 보기가 「이 사주가 내 사주 맞나요?」를
   * 물을 때 같은 카드로 그 사람을 보인다. 그때는 고칠 손잡이(저장된 입력을 고친다)와 풀이 · 자세히 보기 단추가
   * 서지 않고, 그 자리에 `actions` 가 선다.
   */
  personId: string | null;
  label: string;
  query: Query;
  saju: Saju;
  /** 내 사주풀이 — 없으면 `null` */
  reading: ReadingEntry | null;
  /**
   * 내 사주풀이를 지금 만드는 중인가(ADR 0157) — 아직 글이 없을 때 단추가 「받기」 대신 이 일을 말한다. 이미 시작한 일을 새로
   * 시작하라고 권하지 않는다. 글이 있으면(다시 받는 중) 단추는 「보기」 그대로다 — 진행은 홈 맨 위의 줄이 말한다.
   */
  making?: boolean;
  /** 저장 전 카드의 단추 줄 — 저장된 카드에서는 안 쓴다 */
  actions?: ReactNode;
  /**
   * **홈의 동그란 내 프로필**(2026-10-26 운영자) — 주면 이름 왼쪽에 56px 원이 선다. 대표 사진이 있으면 그 사진, 없으면 내 일간의
   * 천간 그림이다. 누르면 「내 프로필」 시트(`self-profile.tsx`). 저장 전 카드(로그인 전 결과 · 사주 이어 보기)에는 아직 계정의
   * 얼굴이 없어 안 준다.
   */
  face?: HomeFace & { userId: string; nickname: string; intro: string | null };
  /**
   * **홈 탭의 줄인 판**(u2, 운영자 2026-09-29) — 폰에서 오행 분포 다섯 칸을 걷는다. 그 칸은 「만세력 보기」가 든다.
   * 출생 정보 한 줄은 남긴다 — 고친 입력이 홈 탭에서 보이게 2026-09-25 에 일부러 둔 줄이다. 폰 첫 화면에 카드 아래의 받은
   * 사주풀이와 저장한 사람 머리까지 들게 하려는 것이다. 넓은 화면은 그대로다.
   */
  compact?: boolean;
}) {
  const dayElement = STEM_INFO[saju.pillars.dayMaster].element;

  return (
    <section
      aria-label="내 사주"
      className={`${elementScope(dayElement)} relative flex h-full min-w-0 flex-col justify-between overflow-hidden rounded-card bg-[var(--tile)] sm:gap-6 sm:p-8 ${compact ? 'gap-3 p-4' : 'gap-4 p-5'}`}
    >
      <StemSymbol stem={saju.pillars.dayMaster} className="pointer-events-none absolute -bottom-10 -right-8 size-40 opacity-15 sm:size-56" />

      {/* 이름(가장 크게)과 바로 아래 한 줄 평 — 내 사주풀이의 비유. 풀이가 없으면 그 줄은 서지 않는다 */}
      <header className="relative flex min-w-0 flex-col gap-2 sm:gap-3">
        {/*
          머리의 높이는 정수 px 여야 한다 — 소수면 아래 결과 바로가기가 반 픽셀 자리에 서고 누르는 자리를 반 픽셀씩 재는 e2e
          (`e2e/target.ts`)가 44px 칸을 43.5 로 쟀다(#836). 원(56px)과 이름(35px)이 한 줄이라 56px 다
        */}
        {/* 오른쪽 위 일간 딱지 자리(80px)는 이 이름 줄에만 비운다 — 한 줄 평 · 출생 정보는 카드 안쪽 폭을 끝까지 쓴다(2026-10-26 운영자) */}
        <div className="flex min-w-0 items-center gap-3 pr-20">
          {face !== undefined && <SelfProfile {...face} stem={saju.pillars.dayMaster} />}
          {/*
            이름 — 고칠 수 없는 자리다. 닉네임은 프로필 수정 화면이 든다(원을 누르면 오는 시트의 「프로필 편집」). 한국어는 어절로
            끊고(`break-keep`), 띄어 쓰지 않은 긴 이름만 아무 데서나 끊는다(`overflow-wrap: anywhere`)
          */}
          <h2 className={`min-w-0 break-keep [overflow-wrap:anywhere] ${TYPE_TITLE}`}>{label}</h2>
        </div>
        {reading?.metaphor != null && (
          /*
            줄인 판은 폰에서 두 줄까지 — 카드 안쪽 폭을 끝까지 쓰고 어절로 끊으며(`break-keep`), 넘치면 둘째 줄 끝에서 말줄임이다
            (`line-clamp-2`, 토스 · 카카오톡의 두 줄 미리보기). 줄을 고르게 맞추는 `text-pretty` 는 안 쓴다 — 넘치지 않는데도 줄을 일찍
            꺾어 오른쪽이 비었다(운영자 「두 줄 넘어가면 … 이면 되는데 왜 우측 공간을 더 안 쓰나」, 2026-10-26)
          */
          <p
            className={`break-keep font-rounded text-lead leading-[1.5] text-foreground sm:text-xl ${compact ? 'max-sm:line-clamp-2' : ''}`}
          >
            <span className="sr-only">내 사주풀이의 비유 </span>
            <span aria-hidden="true" className="text-[var(--ink)]">“</span>
            {reading.metaphor}
            <span aria-hidden="true" className="text-[var(--ink)]">”</span>
          </p>
        )}
      </header>

      {/*
        **일간 딱지는 오른쪽 맨 위다**(2026-10-26 운영자 — 연필이 있던 자리). 출생 정보를 고치는 연필은 걷었다: 사진 · 닉네임 · 소개 ·
        출생 정보를 프로필 수정 화면(`/me/profile`) 한 곳에서 고친다 — 원을 누르면 「내 프로필」 시트, 그 안의 「프로필 편집」.
      */}
      <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
        <DayMasterChip stem={saju.pillars.dayMaster} />
      </div>

      <BirthLine query={query} saved={personId !== null} />

      <ElementCounts saju={saju} compact={compact} />

      {/*
        폰에서도 두 단추가 한 줄을 나눠 쓴다 — 세로로 쌓으면 단추 줄만 110px 였다. **반반이다**: 남는 폭을 나눠 갖게(`flex-1`) 두었더니
        글자가 긴 「만세력 보기」가 폭을 더 가져가 「사주풀이 받기」가 두 줄로 접혔다(2026-10-08). **360px 에서도 늘 한 줄 나란히다**
        (2026-10-26 운영자) — 홈 카드에는 「수정 전」 딱지를 두지 않는다(운영자 결정 — 단추 안 알약이 단추를 넓혀 두 줄로 깨뜨렸다. 풀이 글
        화면 · 보관함의 표시는 그대로). 380px 아래에서는 주 단추의 그림을 걷어 「풀이 만드는 중…」도 든다.
      */}
      {personId === null ? (
        <div className="relative flex flex-wrap items-center gap-2">{actions}</div>
      ) : (
        <div
          className="relative grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center"
        >
          <Link href={withFromMe('/me/readings/self')} className={`${BUTTON_PRIMARY_FACE} whitespace-nowrap px-3 sm:min-w-52 sm:px-5`}>
            <Icon name={reading === null ? 'spark' : 'reading'} className="size-[18px] max-[379px]:hidden" />
            {reading !== null ? '사주풀이 보기' : making ? SELF_READING_MAKING : '사주풀이 받기'}
          </Link>
          {/*
            **글자는 단추 한가운데다**(2026-10-26 운영자 「심각하다」). 누른 표시(`LinkPending`)는 늘 그려 두고 투명도만 바꾸는 16px
            고리라 흐름 안에 두면 안 보여도 틈과 함께 24px 를 차지해 글자가 왼쪽으로 12px 밀렸다 — 단추 오른쪽 안쪽에 띄운다(`absolute`).
            넓은 화면의 화살표는 누른 동안 숨겨 고리와 겹치지 않는다
          */}
          <Link
            href={`/me/people/${personId}`}
            className={`${BUTTON_SECONDARY_FACE} group relative whitespace-nowrap px-3 sm:px-5`}
          >
            만세력 보기
            <Icon name="arrow" className="hidden size-4 group-has-[[data-link-pending]]:invisible sm:block" />
            {/* 이 화면은 뼈대가 없어 다 그려질 때까지 여기 머문다 — 누른 것이 보이게 */}
            <LinkPending className={`${LINK_PENDING_SPINNER} absolute right-4 top-1/2 -mt-2 sm:right-5`} />
          </Link>
        </div>
      )}
    </section>
  );
}

/** 오행 분포 — 다섯 칸, 상징 · 이름 · 개수. 0 인 칸은 점선으로 비운다 */
function ElementCounts({ saju, compact }: { saju: Saju; compact: boolean }) {
  const { counts, glyphCount } = saju.analysis.elements;
  return (
    <div className={`relative flex flex-col gap-2 sm:gap-3 ${compact ? 'max-sm:hidden' : ''}`}>
      <p className="text-small font-semibold text-secondary">오행 분포</p>
      <ul aria-label="오행 분포" className="grid grid-cols-5 gap-1.5 sm:gap-3">
        {ELEMENTS.map((element) => {
          const count = counts[element];
          return (
            <li
              key={element}
              className={`${elementScope(element)} flex flex-col items-center gap-1 rounded-cell px-1 py-3 sm:gap-1.5 sm:py-5 ${
                count === 0 ? 'border border-dashed border-[color-mix(in_srgb,var(--foreground)_22%,transparent)]' : 'bg-surface'
              }`}
            >
              <ElementSymbol element={element} className="size-7 sm:size-10" />
              <span className="text-fine font-medium text-secondary sm:text-note">{ELEMENT_PICTURE_KO[element]}</span>
              <span className={`text-heading font-bold leading-none tabular-nums sm:text-title ${count === 0 ? 'text-secondary' : 'text-[var(--ink)]'}`}>
                {count}
              </span>
            </li>
          );
        })}
      </ul>
      {glyphCount !== 8 && <p className="text-fine text-secondary">출생 시각을 몰라 시주는 빼고 봤어요</p>}
    </div>
  );
}

/**
 * 출생 정보 — **이 사주가 무엇으로 계산됐나.** 저장된 카드는 「저장된」, 저장 전 카드는 「입력한」 출생 정보다. 폰에서는 상자를 벗고 한 줄(생년월일 · 출생지)로 선다
 * (2026-09-25) — 카드 한 장이 첫 화면에 들어야 해서다. 아예 빼면 고친 입력이 홈 어디에도 안 보인다. 성별과 자시
 * 규칙은 넓은 화면에만 서고, 폰에서는 「만세력 보기」에 있다. 두 폭이 **같은 글 한 벌**을 입는다.
 *
 * 음력으로 넣었으면 적은 그대로와 바뀐 양력을 함께 보여준다. 양력만 보이면 사용자가 자기 입력을 못
 * 알아보고, 원본만 보이면 우리가 무엇으로 계산했는지 모른다(ADR 0002).
 */
function BirthLine({ query, saved }: { query: Query; saved: boolean }) {
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

  return (
    <section className="relative -mt-2 sm:mt-0 sm:rounded-card sm:bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] sm:px-4 sm:py-3">
      {/*
        저장 전 카드(로그인 전 결과 · 사주 이어 보기, `personId === null`)에는 저장된 것이 없다 — 방금 입력한 값이다(ADR 0157).
      */}
      <h3 className="sr-only text-small font-semibold text-secondary sm:not-sr-only">{saved ? '저장된 출생 정보' : '입력한 출생 정보'}</h3>
      <dl className="flex flex-wrap gap-x-1.5 text-small leading-5 text-secondary sm:mt-1.5 sm:grid sm:grid-cols-[auto_1fr_auto_1fr] sm:gap-x-5 sm:gap-y-1 sm:text-note sm:leading-6">
        {rows.map(([term, value], at) => (
          <div key={term} className={at === 0 || at === 2 ? 'contents' : 'hidden sm:contents'}>
            <dt className="sr-only text-secondary sm:not-sr-only">{term}</dt>
            <dd className={`min-w-0 tabular-nums sm:text-foreground ${at === 2 ? "before:mr-1.5 before:content-['·'] sm:before:content-none" : ''}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
