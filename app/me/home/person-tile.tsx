import Link from 'next/link';

import { READING_STALE_LABEL } from '@/src/lib/reading/notes';

import { STEM_PICTURE } from '../../ui/stem-symbol';
import { Icon } from '../../ui/icons';
import { STALE_CHIP } from '../../ui/surfaces';
import type { ReadingEntry } from '@/src/lib/reading';
import { withFromMe } from './from-me';
import { HOME_ROW, HOME_ROW_ACTION, HOME_ROW_ACTION_SLOT, HOME_ROW_INNER, HOME_ROW_VALUE, HomeMark } from './home-list';
import { READING_CONTINUE_NOTE, SELF_READING_MAKING, TILE_READING_MAKING } from './making';
import { tileAnchor, type HomePerson } from './map/model';

/*
  **한 사람 = 흰 판 안의 줄 하나**(2026-10-25 홈 위계 정리 — 그 전에는 일간 파스텔 타일 2열이었다). 왼쪽의 작은 표시가 그 사람의
  일간 천간 그림이고 색은 그 표시만 입는다 — 오행 파스텔 면은 홈의 주인공(내 사주 카드) 하나에만 선다. 그림 이름(「햇빛」)은
  읽는 이름이 든다. 여덟 글자(한자)는 줄에 없다 — 「자세히」(상세)가 든다(운영자 2026-09-27).

  줄 전체가 상세로 가는 링크다(이름 링크의 `after:` 가 줄을 덮는다). 끝의 둘(풀이 단추 · 궁합 값)은 그 위에 떠서 따로 눌린다.
  **관계 지도의 원이 자바스크립트 없이 오는 자리**이기도 하다(`id`) — 그래서 이 줄이 그 사람의 길을 전부 든다.

  **오른쪽은 폭이 고정된 두 칸이다**(2026-10-26 2차) — 단추(76px, 토스 계좌 줄의 「송금」)와 맨 끝의 값(48px, 토스증권 주식 줄의
  가격). 전에는 「풀이 보기」 · 「풀이 받기」 단추와 「67점」 · 태극 알약의 폭이 저마다 달라 줄마다 왼쪽 끝이 어긋났다.

  **둘째 줄은 내가 적은 메모(관계 · 생일)다**(카카오톡 친구 줄의 상태 메시지 자리). 메모가 이름 옆에 서던 동안 이름 · 단추 사이에
  끼어 몇 글자에서 잘렸다. 메모가 없으면 그 사람 풀이의 비유 한 줄, 그것도 없으면 둘째 줄 없이 이름만 가운데 선다 — 「풀이 없음」은
  바로 옆 「풀이 받기」 단추가 이미 말한다.
*/

/** 지도에서 건너온 줄을 짚는다 — 자바스크립트 없이 `#person-…` 로 왔을 때. 판이 테 밖을 자르므로 면으로 짚는다 */
const TARGET = 'scroll-mt-24 target:bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))]';

export function PersonTile({
  person,
  reading,
  compat,
  making = false,
  fromMe = false,
}: {
  person: HomePerson;
  /** 그 사람의 사주풀이 — 없으면 `null` */
  reading: ReadingEntry | null;
  /** 나와 궁합 — 이미 본 것이면 점수를 달고 그 글로 간다 */
  compat: { href: string; score: number | null };
  /** 그 사람의 사주풀이를 지금 만드는 중인가 — 글이 없을 때 「풀이 받기」 대신 이 일을 말한다(ADR 0157, 내 사주 카드와 같은 규칙) */
  making?: boolean;
  /** 홈 탭에 선 줄 — 결과로 가는 링크가 `from=me` 를 든다(`from-me.ts`) */
  fromMe?: boolean;
}) {
  const detailHref = `/me/people/${person.personId}`;
  const note = person.note?.trim() ?? '';
  const anchor = tileAnchor(person.personId);

  if (!person.chart.ok) {
    return (
      <li id={anchor} className={`${HOME_ROW} ${TARGET} relative`}>
        <div className={HOME_ROW_INNER}>
          <HomeMark />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0">
              <Name href={detailHref} label={person.label} />
            </p>
            <p className="truncate text-small leading-5 text-secondary">{person.chart.message}</p>
          </div>
          <div className="relative z-10 flex shrink-0 items-center gap-2">
            {/* 값 칸 자리 — 비워 두어 단추가 다른 줄의 단추와 한 줄에 선다 */}
            <span aria-hidden="true" className="w-16" />
            <Link href={detailHref} className={HOME_ROW_ACTION}>
              자세히
            </Link>
          </div>
        </div>
      </li>
    );
  }

  const { saju } = person.chart;
  const dayMaster = saju.pillars.dayMaster;
  /* 둘째 줄 — 메모가 먼저, 없으면 풀이의 비유, 만드는 중이면 그 일. 만드는 중에 「풀이 없음」 같은 반대말은 안 선다 */
  const second = note !== '' ? note : reading !== null ? (reading.metaphor ?? READING_CONTINUE_NOTE) : making ? SELF_READING_MAKING : null;

  return (
    <li id={anchor} className={`${HOME_ROW} ${TARGET} relative`}>
      <div className={HOME_ROW_INNER}>
        <HomeMark stem={dayMaster} />

        <div className="min-w-0 flex-1">
          <p className="flex min-w-0">
            <Name href={detailHref} label={person.label} />
            <span className="sr-only">일간 {STEM_PICTURE[dayMaster]}</span>
          </p>
          {second !== null && (
            <p className="truncate text-small leading-5 text-secondary">
              {reading !== null && !reading.fromCurrentChart && <span className={`mr-1 ${STALE_CHIP}`}>{READING_STALE_LABEL}</span>}
              {second}
            </p>
          )}
        </div>

        {/*
          **끝의 두 칸 — 값 · 단추**(2026-10-26 운영자). 「풀이 보기」 단추는 없다 — 줄(이름)을 누르면 그 사람 화면에서 풀이 · 궁합을 본다.
          - 나와 궁합을 봤으면 값 칸에 「84점 ☯」(면 없는 글자 — 값이다). 누르면 그 궁합풀이로 간다
          - 그 사람의 사주풀이를 아직 안 받았으면 단추 칸에 「풀이 받기」(만드는 중이면 「풀이 중…」) 하나
          둘 다면 둘 다. 하나라도 서면 두 칸 모두 같은 폭을 차지해 줄마다 세로로 한 줄에 선다. 둘 다 아니면 두 칸을 걷어 메모가 그 폭을 쓴다
        */}
        {(compat.score !== null || reading === null) && (
          <div className="relative z-10 flex shrink-0 items-center gap-2">
            {compat.score !== null ? (
              <Link
                href={fromMe ? withFromMe(compat.href) : compat.href}
                aria-label={`나와 궁합 ${compat.score}점`}
                className={`${HOME_ROW_VALUE} min-h-11 hover:underline`}
              >
                {compat.score}점
                <Icon name="taiji" className="size-4 text-secondary" />
              </Link>
            ) : (
              <span aria-hidden="true" className="w-16" />
            )}
            <span className={HOME_ROW_ACTION_SLOT}>
              {reading === null && (
                <Link
                  href={fromMe ? withFromMe(`/me/readings/${person.personId}`) : `/me/readings/${person.personId}`}
                  className={HOME_ROW_ACTION}
                >
                  {making ? TILE_READING_MAKING : '풀이 받기'}
                </Link>
              )}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

/** 이름 — 이 링크의 `after:` 가 줄 전체를 덮어 줄이 곧 상세 링크가 된다 */
function Name({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`max-w-full shrink-0 truncate text-body font-semibold text-foreground after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:outline focus-visible:after:-outline-offset-[3px] focus-visible:after:outline-[3px] focus-visible:after:outline-[color-mix(in_srgb,var(--accent)_55%,transparent)]`}
    >
      {label}
    </Link>
  );
}
