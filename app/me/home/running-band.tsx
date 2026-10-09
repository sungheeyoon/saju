import Link from 'next/link';

import { Icon } from '../../ui/icons';
import { TYPE_META } from '../../ui/surfaces';
import { READING_MAKING } from './making';
import { runningHref, runningName, runningStage } from './running-line';
import type { RunningReading } from './running';

/**
 * **만드는 중인 풀이** — 있을 때만 선다(ADR 0157).
 *
 * 풀이를 만드는 몇 분 동안 다른 화면으로 가도 되게 만들었는데(「이 화면을 벗어나도 풀이는 계속 만들어져요」), 홈은 그 일을 몰랐다
 * — 내 사주 카드가 같은 순간 「사주풀이 받기」를 권했다. 이제 줄마다 **무엇을 · 어디쯤** 만드는지 한 줄로 말하고, 누르면 그 풀이
 * 화면(같은 목차)으로 간다. 다 되면 소식이 서고(`reading_ready` · `reading_failed`), 그 소식이 계정 채널로 홈을 다시 그려 이 줄이
 * 사라진다(ADR 0155 의 `notifications`).
 *
 * 모양은 아래 「다른 사람 사주 보기」 · 안 읽은 소식 띠와 같은 줄이다. 둘 이상이면 차례로 쌓는다 — 최근 것이 앞이다.
 */
export function RunningReadings({ running }: { running: readonly RunningReading[] }) {
  if (running.length === 0) return null;

  return (
    <section aria-label={`풀이 ${READING_MAKING}`} className="flex flex-col gap-2">
      {running.map((one) => (
        <Link
          key={runningHref(one.target)}
          href={runningHref(one.target)}
          className="flex min-h-14 items-center gap-3 rounded-[1.25rem] border border-border bg-surface px-4 py-3 text-foreground hover:border-border-strong active:scale-[0.99]"
        >
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-cream text-cream-ink">
            <Icon name="spark" className="size-[18px] animate-pulse motion-reduce:animate-none" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-semibold">
              {runningName(one)} {READING_MAKING}
            </span>
            <span className={`${TYPE_META} truncate`}>{runningStage(one)}</span>
          </span>
          <Icon name="arrow" className="size-4 shrink-0 text-secondary" />
        </Link>
      ))}
    </section>
  );
}
