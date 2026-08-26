import { CARD } from '../../card';
import { currentReading, lastReadingRun } from './current';
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
export async function ReadingSection({ target }: { target: ReadingTarget }) {
  const [reading, run] = await Promise.all([currentReading(target), lastReadingRun(target)]);

  return (
    <section className={`${CARD} flex flex-col gap-5`}>
      <ReadingPanel
        target={target}
        initialReading={reading}
        initialFailed={run?.status === 'failed'}
        allowMockFallback={process.env.NODE_ENV !== 'production'}
      />
    </section>
  );
}
