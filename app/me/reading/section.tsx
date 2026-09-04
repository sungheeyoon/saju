import type { ReactNode } from 'react';

import { CARD } from '../../card';
import { currentReading, improvementConsented, lastReadingRun, readingCredits } from './current';
import { ReadingPanel } from './panel';
import type { ReadingTarget } from './pipeline';

/**
 * 현재 결과가 서는 칸 — **자기 풀이와 공유 궁합이 같은 것을 쓴다.**
 *
 * 화면마다 따로 그리면 언젠가 한 곳에만 「새로 만들면 지금 것이 사라진다」가 빠진다.
 * 비공개 궁합만 아직 사용자 화면에 붙이지 않았고, 붙일 때도 이 컴포넌트를 그대로
 * 쓴다 — 파이프라인은 이미 세 kind 를 다 받는다.
 *
 * **읽기만 한다.** 이 칸이 그려지는 것으로 AI 가 불리지 않는다 — 부르는 길은 버튼
 * 하나뿐이다(`GenerateButton`).
 */
export async function ReadingSection({
  target,
  heading,
  layout,
  automatic,
  ask,
}: {
  target: ReadingTarget;
  /**
   * 이 칸의 제목 — 안 주면 kind 가 정한다.
   *
   * `person` 은 「{이름}의 사주풀이」라서 부르는 쪽만 알 수 있다. 여기서 이름을 다시
   * 읽어 오면 화면이 이미 들고 있는 것을 한 번 더 묻게 된다.
   */
  heading?: string;
  /** 카드로 서는가, 그 글을 읽으러 온 페이지인가 — `ReadingPanel` 이 그 뜻을 든다 */
  layout?: 'card' | 'page';
  /**
   * 이 글을 **동의가 만드는가** (ADR 0038). 성공 경로에는 누를 것이 없다 —
   * 뜻은 `ReadingPanel` 이 든다.
   */
  automatic?: boolean;
  /** 다음 풀이를 위해 먼저 정할 것 — 만드는 버튼 옆에 선다 */
  ask?: ReactNode;
}) {
  /*
    **잔액은 대상을 모른다.** 사람마다 하나뿐이라 세 화면이 같은 값을 읽는다 — 그래서
    `argsOf` 를 안 받는다. 여기서 함께 읽는 것은 이 값이 필요한 시점이 글을 읽을 때가
    아니라 **만들지 말지를 정할 때**이고, 그 자리가 이 칸이기 때문이다.
  */
  const [reading, run, credits, consented] = await Promise.all([
    currentReading(target),
    lastReadingRun(target),
    readingCredits(),
    improvementConsented(),
  ]);

  return (
    <section className={`${CARD} flex flex-col gap-5`}>
      <ReadingPanel
        target={target}
        initialReading={reading}
        initialFailed={run?.status === 'failed'}
        /*
          **도는 시도를 화면이 알고 열린다.** 만드는 일이 누름의 요청에서 떨어져 나온
          뒤로, 새로고침하고 돌아오거나 다른 기기에서 열어도 만들던 것은 계속 돈다.
          모르면 화면이 「아무것도 안 하고 있다」고 말하게 된다.
        */
        initialRunning={run?.status === 'running'}
        credits={credits}
        consented={consented}
        heading={heading ?? (target.kind === 'self' ? '나의 사주풀이' : '두 사람의 궁합 풀이')}
        allowMockFallback={process.env.NODE_ENV !== 'production'}
        layout={layout}
        automatic={automatic}
        ask={ask}
      />
    </section>
  );
}
