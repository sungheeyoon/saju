import { runningLinesOf } from './running-line';
import { RunningBandLive } from './running-band-live';
import type { RunningReading } from './running';

/**
 * **만드는 중인 풀이** — 있을 때만 선다(ADR 0157).
 *
 * 풀이를 만드는 몇 분 동안 다른 화면으로 가도 되게 만들었는데(「이 화면을 벗어나도 풀이는 계속 만들어져요」), 홈은 그 일을 몰랐다
 * — 내 사주 카드가 같은 순간 「사주풀이 받기」를 권했다. 이제 줄마다 **무엇을 · 어디쯤** 만드는지 한 줄로 말하고, 누르면 그 풀이
 * 화면(같은 목차)으로 간다.
 *
 * 줄의 글자는 서버가 짓고(절 이름은 브라우저로 안 가는 프롬프트 모듈에 있다), 홈에 머무는 동안은 작은 섬이 몇 초마다 다시 묻는다
 * (`running-band-live.tsx`). 다 되면 소식이 서고 계정 채널이 홈을 다시 그린다(ADR 0155 의 `notifications`) — 섬도 줄이 사라진 것을
 * 보면 한 번 다시 그린다. 다시 그린 홈이 새 줄을 내려보내면 섬은 그 줄로 새로 선다(`key`).
 *
 * 모양은 아래 「다른 사람 사주 보기」 · 안 읽은 소식 띠와 같은 줄이다. 둘 이상이면 차례로 쌓는다 — 최근 것이 앞이다.
 */
export function RunningReadings({ running }: { running: readonly RunningReading[] }) {
  if (running.length === 0) return null;
  const lines = runningLinesOf(running);
  return <RunningBandLive key={lines.map((line) => `${line.key}:${line.stage}`).join('|')} initial={lines} />;
}
