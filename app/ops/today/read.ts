import { todayFiguresOf, type TodayFigures } from '@/src/lib/ops/today';

import { supabaseOnServer } from '../../auth/server-client';
import { dbFailure } from '../../db-error';
import { deniedAmong, type Denied } from '../denial';

/**
 * 오늘 · 이번 주의 숫자가 **브라우저로 내려오는 문** (G-110 ①, ADR 0183).
 *
 * `/ops/survey` 의 문(`app/ops/survey/read.ts`)과 같은 규율이다. **여기서 아무것도 세지 않는다** — 무엇을 어느 기간으로 세는가는
 * DB 의 `operator_today_figures` 하나가 정한다. 기간의 경계(서울 0시 · 서울 월요일 0시)도 DB 가 짓는다 — 서버의 시계는 UTC 라
 * 여기서 지으면 「오늘」이 아홉 시간 어긋난다.
 *
 * **운영자인지 여기서 안 묻는다** — 자료를 청해 거절당하는 것으로 안다(`42501`). 문이 읽을 때마다 DB 가 접속기록에 한 줄
 * (`today.figures`)을 적고, 거절은 아래 `deniedAmong` 이 같은 이름으로 적는다.
 */

export { DENIED } from '../denial';
export { figuresOf, todayFiguresOf, type Figures, type TodayFigures } from '@/src/lib/ops/today';

/**
 * 숫자가 이 화면의 본체라 못 읽으면 던진다 — 오류 경계가 받는다(ADR 0078).
 *
 * @returns 거절이면 `DENIED`.
 */
export async function operatorTodayFigures(): Promise<TodayFigures | Denied> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('operator_today_figures');
  const denied = await deniedAmong(supabase, 'today.figures', [{ error }]);
  if (denied) return denied;
  if (error) throw dbFailure(error, 'operator_today_figures');

  const figures = todayFiguresOf(data ?? []);
  if (figures === null) throw new Error('operator_today_figures: 오늘 · 이번 주 두 줄이 아니다');
  return figures;
}
