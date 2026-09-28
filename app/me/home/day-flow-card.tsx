import { ELEMENT_PICTURE_KO, type Stem } from '@/src/lib/saju';

import { elementScope } from '../../ui/element-tone';
import { ElementSymbol } from '../../ui/element-symbol';
import { TYPE_SECTION } from '../../ui/surfaces';
import { dayFlowOf } from './day-flow';

/**
 * **이번 달 흐름** — 오늘 한 줄과 앞뒤 열나흘의 띠(ADR 0129). 계산과 문장은 `day-flow.ts` 가 든다.
 *
 * 띠의 한 칸은 그날 일진 천간의 오행 색이다 — 같은 오행이면 내 일간에게 같은 계열의 십성이라, 색이 곧 「이 날은 어느
 * 계열의 날인가」다. **색은 정보를 혼자 지지 않는다**(`element-tone.ts`) — 칸마다 날짜가 서고, 화면 밖에서는 날짜와
 * 오행 이름을 읽는다. 오늘 칸은 테두리로 가른다.
 *
 * 서버가 그린다. 이 화면은 로그인을 읽는 동적 화면이라 서버의 「지금」이 곧 연 순간이다 — 날짜는 서울 달력이다.
 */
export function DayFlowCard({ dayMaster, now }: { dayMaster: Stem; now: Date }) {
  const flow = dayFlowOf(dayMaster, now);
  const { today } = flow;

  return (
    <section aria-labelledby="home-day-flow" className="flex h-full min-w-0 flex-col gap-4 rounded-[2rem] border border-border bg-surface p-5 sm:gap-5 sm:p-8">
      <h2 id="home-day-flow" className={TYPE_SECTION}>
        이번 달 흐름
      </h2>

      <div className={`${elementScope(today.element)} flex items-start gap-3 rounded-[1.5rem] bg-[var(--tile)] p-4`}>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface">
          <ElementSymbol element={today.element} className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--ink)]">
            <time dateTime={today.iso}>오늘 · {today.label}</time>
          </p>
          <p className="mt-1 text-[15px] leading-6 text-foreground">{today.line}</p>
        </div>
      </div>

      <ol aria-label="앞뒤 열나흘" className="mt-auto grid grid-cols-7 gap-1 sm:gap-1.5">
        {flow.days.map((day) => (
          <li
            key={day.iso}
            aria-current={day.today ? 'date' : undefined}
            className={`${elementScope(day.element)} flex flex-col items-center gap-0.5 rounded-xl bg-[var(--tile)] py-1.5 ${
              day.today ? 'ring-2 ring-foreground ring-offset-1 ring-offset-surface' : ''
            }`}
          >
            <ElementSymbol element={day.element} className="size-4" />
            <time dateTime={day.iso} className="text-[12px] font-semibold tabular-nums text-[var(--ink)]">
              <span className="sr-only">{day.month}월 </span>
              {day.day}
              <span className="sr-only">일 {ELEMENT_PICTURE_KO[day.element]}</span>
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}
