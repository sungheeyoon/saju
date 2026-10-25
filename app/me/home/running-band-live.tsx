'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Icon } from '../../ui/icons';
import { TYPE_META } from '../../ui/surfaces';
import { watchRun, type PageVisibility } from '../reading/watch-run';
import { runningLinesNow } from './actions';
import { HOME_LIST, HOME_ROW, HOME_ROW_LINK } from './home-list';
import { READING_MAKING } from './making';
import type { RunningLine } from './running-line';
import { RUNNING_ASK_EVERY_MS, afterRunningAnswer } from './running-watch';

/** 이 탭이 보이는가 — 숨긴 탭에서는 묻지 않는다(`watchRun`) */
const documentVisibility: PageVisibility = {
  hidden: () => document.visibilityState === 'hidden',
  onChange: (listener) => {
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  },
};

/**
 * **만드는 중인 풀이** — 줄이 서 있는 동안만 몇 초마다 다시 묻는 작은 섬(ADR 0157).
 *
 * 서버가 처음 그린 단계에 머물면 홈에 있는 동안 「준비 중…」이 그대로 남았다(바깥 리뷰 P2). 계정 채널은 진행을 안 실어 온다 — 절이
 * 설 때 적히는 값(`note_reading_progress`)은 채널 트리거가 없다. 그래서 줄이 있을 때만 `runningLinesNow`(읽기 한 번)를 묻고, 줄이
 * 사라지면 홈을 한 번 다시 그리고, 비면 멈춘다. 숨긴 탭 · 떠난 화면에서는 안 묻는다(`watchRun`).
 */
export function RunningBandLive({ initial }: { initial: readonly RunningLine[] }) {
  const router = useRouter();
  const [lines, setLines] = useState(initial);
  const watching = initial.length > 0;

  useEffect(() => {
    if (!watching) return;
    let alive = true;
    let seen = initial;
    let stop: () => void = () => {};

    const ask = async () => {
      const answer = afterRunningAnswer(seen, await runningLinesNow());
      if (!alive) return;
      seen = answer.lines;
      setLines(answer.lines);
      if (answer.redraw) router.refresh();
      if (answer.stop) stop();
    };

    stop = watchRun({ ask, everyMs: RUNNING_ASK_EVERY_MS, visibility: documentVisibility });
    return () => {
      alive = false;
      stop();
    };
  }, [initial, watching, router]);

  if (lines.length === 0) return null;

  return (
    <section aria-label={`풀이 ${READING_MAKING}`}>
      {/* 아래 목록들과 같은 흰 판의 줄이다(`home-list.tsx`) — 둘 이상이면 한 판 안에 구분선으로 쌓는다 */}
      <ul className={HOME_LIST}>
        {lines.map((line) => (
          <li key={line.key} className={HOME_ROW}>
            <Link href={line.href} className={HOME_ROW_LINK}>
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-cream text-cream-ink">
                <Icon name="spark" className="size-5 animate-pulse motion-reduce:animate-none" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body font-semibold">
                  {line.name} {READING_MAKING}
                </span>
                <span className={`${TYPE_META} truncate`}>{line.stage}</span>
              </span>
              <Icon name="chevron" className="size-5 shrink-0 text-secondary" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
