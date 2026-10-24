import Link from 'next/link';

import { READING_STALE_LABEL } from '@/src/lib/reading/notes';

import { CompatFillLink } from '../../compat-fill-link';
import { STEM_PICTURE } from '../../ui/stem-symbol';
import { Icon } from '../../ui/icons';
import { STALE_CHIP } from '../../ui/surfaces';
import type { ReadingEntry } from '@/src/lib/reading';
import { withFromMe } from './from-me';
import { HOME_ROW, HOME_ROW_ACTION, HOME_ROW_INNER, HomeMark } from './home-list';
import { READING_CONTINUE_NOTE, SELF_READING_MAKING, TILE_READING_MAKING } from './making';
import { tileAnchor, type HomePerson } from './map/model';

/*
  **한 사람 = 흰 판 안의 줄 하나**(2026-10-25 홈 위계 정리 — 그 전에는 일간 파스텔 타일 2열이었다). 왼쪽의 작은 표시가 그 사람의
  일간 천간 그림이고 색은 그 표시만 입는다 — 오행 파스텔 면은 홈의 주인공(내 사주 카드) 하나에만 선다. 그림 이름(「햇빛」)은
  읽는 이름이 든다. 여덟 글자(한자)는 줄에 없다 — 「자세히」(상세)가 든다(운영자 2026-09-27).

  줄 전체가 상세로 가는 링크다(이름 링크의 `after:` 가 줄을 덮는다). 끝의 단추 둘(풀이 · 궁합)은 그 위에 떠서 따로 눌린다 —
  토스 홈 · 카카오톡 친구 줄의 끝 단추 꼴이다. **관계 지도의 원이 자바스크립트 없이 오는 자리**이기도 하다(`id`) — 그래서 이 줄이
  그 사람의 길을 전부 든다.
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
          <Link href={detailHref} className={`${HOME_ROW_ACTION} relative z-10 shrink-0`}>
            자세히
          </Link>
        </div>
      </li>
    );
  }

  const { saju } = person.chart;
  const dayMaster = saju.pillars.dayMaster;

  return (
    <li id={anchor} className={`${HOME_ROW} ${TARGET} relative`}>
      <div className={HOME_ROW_INNER}>
        <HomeMark stem={dayMaster} />

        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-baseline gap-1.5">
            <Name href={detailHref} label={person.label} />
            <span className="sr-only">일간 {STEM_PICTURE[dayMaster]}</span>
            {note !== '' && <span className="min-w-0 truncate text-fine text-muted">{note}</span>}
          </p>
          {/* 만드는 중이면 「풀이 없음」이 아니다 — 같은 줄의 단추가 그 일을 말하는 동안 이 줄이 반대말을 하지 않는다 */}
          <p className="truncate text-small leading-5">
            {reading === null ? (
              <span className="text-secondary">{making ? SELF_READING_MAKING : '풀이 없음'}</span>
            ) : (
              <>
                {!reading.fromCurrentChart && <span className={`mr-1 ${STALE_CHIP}`}>{READING_STALE_LABEL}</span>}
                <span className="text-secondary">{reading.metaphor ?? READING_CONTINUE_NOTE}</span>
              </>
            )}
          </p>
        </div>

        {/*
          끝의 단추 둘 — 폰 390px 에서 이름 칸을 남기려고 궁합 단추는 좁은 폭(400px 아래)에서 하트(점수가 있으면 점수)만 든다. 이름은
          `aria-label` 이 늘 든다.
        */}
        <div className="relative z-10 flex shrink-0 items-center gap-1.5">
          <Link
            href={fromMe ? withFromMe(`/me/readings/${person.personId}`) : `/me/readings/${person.personId}`}
            className={`${HOME_ROW_ACTION} whitespace-nowrap`}
          >
            {reading !== null ? '풀이 보기' : making ? TILE_READING_MAKING : '풀이 받기'}
          </Link>
          {/* 안 본 궁합은 같은 화면 위의 두 칸을 채운다(`CompatFillLink`) */}
          <CompatFillLink
            href={fromMe ? withFromMe(compat.href) : compat.href}
            className={`${HOME_ROW_ACTION} min-w-11 whitespace-nowrap`}
            aria-label={compat.score !== null ? `나와 궁합 ${compat.score}점` : '나와 궁합'}
          >
            <Icon name="taiji" className={`size-4 ${compat.score !== null ? 'max-[399px]:hidden' : ''}`} />
            {compat.score !== null ? (
              <span className="tabular-nums">{compat.score}점</span>
            ) : (
              <span className="max-[399px]:sr-only">궁합</span>
            )}
          </CompatFillLink>
        </div>
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
