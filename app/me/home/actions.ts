'use server';

import { runningReadings } from './running';
import { runningLinesOf, type RunningLine } from './running-line';

/**
 * 홈의 「만드는 중」 줄을 **다시 묻는 자리**(ADR 0157) — 줄이 서 있는 동안 홈의 작은 섬이 몇 초마다 부른다.
 *
 * 읽기만 한다 — `my_running_readings` 한 번. 모델을 부르지 않고 아무것도 안 바꾼다. 로그인이 풀렸으면 DB 가 빈 목록을 낸다.
 *
 * @returns 못 읽었으면 `null` — 섬은 앞서 본 줄을 그대로 두고 다음에 다시 묻는다(부속 정보, ADR 0078)
 */
export async function runningLinesNow(): Promise<readonly RunningLine[] | null> {
  const running = await runningReadings();
  return running.ok ? runningLinesOf(running.value) : null;
}
