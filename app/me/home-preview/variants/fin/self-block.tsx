import Link from 'next/link';

import { BRANCH_INFO, CALENDAR_KO, ELEMENTS, ELEMENT_KO, STEM_INFO, type Saju } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { ELEMENT_TONE } from '../../../../element-tone';
import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { BUTTON, Block, Chevron, Icon, IconCircle, TYPE } from './ui';

/*
  **나는 이 화면의 기준점이고, 여덟 글자가 주인공이다.**

  1차의 요약 카드는 여덟 글자를 20px 칸에 담고 일주 이름(「○○ 일주」)을 앞에 세웠다. 여기서는 이름을 빼고
  글자를 40~48px 로 키워 은행 앱의 「잔액」 자리에 둔다 — 화면에서 가장 먼저 읽히는 것이 내 명식이다.
  오행은 막대 하나와 큰 숫자 다섯으로 편다(토스의 「큰 숫자 · 작은 라벨」). 색은 혼자 말하지 않는다 —
  기둥마다 아래에 오행 이름이, 분포에는 한자와 한글 이름이 붙는다.
*/

export function SelfBlock({ self }: { self: FixtureSelf }) {
  const { query, saju } = self;
  return (
    <Block label="내 사주" className="flex flex-col gap-6 px-5 pb-5 pt-6 sm:px-6 sm:pb-6">
      <header>
        <p className={TYPE.caption}>
          {query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date}`}
          {query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${query.time}`}
        </p>
        <h2 className={`mt-1 ${TYPE.heading}`}>{self.label}의 사주팔자</h2>
      </header>

      <Pillars saju={saju} />
      <Elements saju={saju} />

      <div className="flex flex-col gap-2">
        <SelfReading self={self} />
        <Link href={previewHref(`/me/people/${self.personId}`)} className={BUTTON.secondary}>
          사주 자세히 보기
        </Link>
      </div>
    </Block>
  );
}

/** 네 기둥 — 시 · 일 · 월 · 년. 일주 칸만 옅은 면을 깐다 */
function Pillars({ saju }: { saju: Saju }) {
  return (
    <ol className="grid grid-cols-4 gap-1 text-center" aria-label="여덟 글자">
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = saju.pillars[key];
        const day = key === 'day';
        return (
          <li
            key={key}
            className={`flex min-w-0 flex-col items-center gap-2 rounded-2xl py-3 ${day ? 'bg-[var(--fin-accent-weak)]' : ''}`}
          >
            <span className={`text-[0.75rem] font-semibold ${day ? 'text-[var(--fin-accent-text)]' : 'text-[var(--fin-faint)]'}`}>
              {label}
            </span>
            {pillar === null ? (
              <span className="flex min-h-[6.25rem] items-center px-1 text-[0.75rem] leading-tight text-[var(--fin-faint)] sm:min-h-[7.25rem]">
                {HOUR_UNKNOWN_LABEL}
              </span>
            ) : (
              <>
                <span
                  className="flex flex-col items-center gap-1"
                  aria-label={`${label} ${pillar.stem}${pillar.branch}, ${ELEMENT_KO[STEM_INFO[pillar.stem].element]} · ${ELEMENT_KO[BRANCH_INFO[pillar.branch].element]}`}
                >
                  <span aria-hidden="true" className={`${TYPE.display} ${ELEMENT_TONE[STEM_INFO[pillar.stem].element].text}`}>
                    {pillar.stem}
                  </span>
                  <span aria-hidden="true" className={`${TYPE.display} ${ELEMENT_TONE[BRANCH_INFO[pillar.branch].element].text}`}>
                    {pillar.branch}
                  </span>
                </span>
                <span aria-hidden="true" className="text-[0.75rem] font-medium text-[var(--fin-faint)]">
                  {ELEMENT_KO[STEM_INFO[pillar.stem].element]} · {ELEMENT_KO[BRANCH_INFO[pillar.branch].element]}
                </span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** 오행 분포 — 막대 하나와 큰 숫자 다섯. 0 도 적는다 */
function Elements({ saju }: { saju: Saju }) {
  const { counts, glyphCount } = saju.analysis.elements;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[0.9375rem] font-semibold text-[var(--fin-sub)]">오행 분포</h3>
        {glyphCount !== 8 && <span className={TYPE.caption}>출생 시각을 몰라 시주는 제외했습니다</span>}
      </div>
      <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {ELEMENTS.filter((element) => counts[element] > 0).map((element) => (
          <span key={element} className={ELEMENT_TONE[element].bar} style={{ flexGrow: counts[element] }} />
        ))}
      </div>
      <ul className="grid grid-cols-5 gap-1">
        {ELEMENTS.map((element) => {
          const count = counts[element];
          const none = count === 0;
          return (
            <li key={element} className="flex flex-col items-center gap-0.5">
              <span className="text-[0.75rem] font-semibold">
                <span className={`glyph ${none ? 'text-[var(--fin-faint)]' : ELEMENT_TONE[element].text}`}>{element}</span>
                <span className="ml-1 text-[var(--fin-faint)]">{ELEMENT_KO[element]}</span>
              </span>
              <span
                className={`text-[1.5rem] font-bold leading-tight tabular-nums tracking-[-0.03em] ${none ? 'text-[var(--fin-faint)] opacity-60' : ''}`}
              >
                {count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 내 사주풀이 — 있으면 비유 한 줄을 크게 싣는 줄, 없으면 이 덩어리의 주 단추 */
function SelfReading({ self }: { self: FixtureSelf }) {
  const href = previewHref('/me/readings/self');
  const { reading } = self;

  if (reading === null) {
    return (
      <Link href={href} className={BUTTON.primary}>
        <Icon name="spark" className="size-5" stroke={2} />
        사주풀이 받기
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="-mx-2 flex items-center gap-4 rounded-2xl px-2 py-3 transition-transform hover:bg-[var(--fin-press)] active:scale-[0.985] active:bg-[var(--fin-press)]"
    >
      <IconCircle tone="accent">
        <Icon name="reading" />
      </IconCircle>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[0.8125rem] font-semibold text-[var(--fin-accent-text)]">사주풀이 보기</span>
          {!reading.fromCurrentChart && <OldChart />}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[1.0625rem] font-semibold leading-snug tracking-[-0.02em]">
          {reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}
        </span>
      </span>
      <Chevron />
    </Link>
  );
}

export function OldChart() {
  return (
    <span className="shrink-0 rounded-md bg-warning-wash px-1.5 py-0.5 text-[0.6875rem] font-bold text-warning">이전 명식</span>
  );
}

/** 내 사주 전 — 할 일이 이것 하나라 이 화면의 유일한 주 단추다 */
export function RegisterSelf() {
  return (
    <Block label="내 사주" className="flex flex-col gap-6 px-5 pb-5 pt-6 sm:px-6 sm:pb-6">
      <div className="flex flex-col gap-4">
        <IconCircle tone="accent">
          <Icon name="user" className="size-6" />
        </IconCircle>
        <div>
          <p className={TYPE.caption}>내 사주</p>
          <h2 className={`mt-1 ${TYPE.heading}`}>내 사주 등록</h2>
          <p className={`mt-2 ${TYPE.body}`}>
            출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.
          </p>
        </div>
      </div>
      <Link href={previewHref('/me')} className={BUTTON.primary}>
        내 명식 등록
      </Link>
    </Block>
  );
}
