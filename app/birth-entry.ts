import { birthYearRefusal, missingAnswer, type Query } from '@/src/lib/input/query';

/**
 * 생년월일시 폼의 **입력 보조와 빈칸의 자리** — 화면이 쓰는 판단을 `.tsx` 밖에 둔다(vitest 가 닿게).
 *
 * 무엇이 빠졌는가의 판정은 여기서 새로 하지 않는다. `missingAnswer` 가 문장을 내고, 여기는 그 문장이 **폼의 어느 줄**
 * 에 서야 하는지만 가른다 — 판정하는 자리가 둘이 되면 버튼을 잠그는 쪽과 줄을 붉히는 쪽이 갈린다.
 */

/** 빈칸이 서는 줄 — 폼이 그 줄에 붉은 테와 문장을 단다 */
export type GapField = 'name' | 'date' | 'time';

export type Gap = { field: GapField; message: string };

/**
 * 첫 빈칸 하나와 그 줄. `missingAnswer` 가 묻는 차례(이름 → 생년월일 · 범위 → 출생 시각) 그대로다.
 *
 * 하나만 낸다 — 빈칸 셋을 한꺼번에 붉히면 아직 손대지 않은 줄까지 「틀렸다」로 읽힌다. 하나를 채우면 다음 것이 선다.
 */
export function gapOf(query: Query): Gap | null {
  const message = missingAnswer(query);
  if (message === null) return null;
  if (query.name.trim() === '') return { field: 'name', message };
  if (query.date === '' || birthYearRefusal(query) !== null) return { field: 'date', message };
  return { field: 'time', message };
}

/**
 * 붙여 넣은 글을 날짜 세 토막으로 — 못 읽으면 `null`.
 *
 * 메모 · 문자 · 주민등록 앞자리에서 옮겨 오는 모양을 받는다: `1990-05-15` · `1990.5.15` · `1990/05/15` · `19900515` ·
 * `1990년 5월 15일`. 범위는 여기서 따지지 않는다 — 칸이 제 범위를 알고(붉어진다), 날짜의 존재는 변환이 판정한다.
 * 두 자리 해(`90.05.15`)는 받지 않는다 — 1990 인지 2090 인지를 우리가 고르면 고르지 않은 것을 고른 셈이 된다.
 */
export function parseDateText(text: string): { year: string; month: string; day: string } | null {
  const trimmed = text.trim();

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  if (compact) return { year: compact[1], month: compact[2], day: compact[3] };

  const split = /^(\d{4})\s*(?:[-./]|년)\s*(\d{1,2})\s*(?:[-./]|월)\s*(\d{1,2})\s*(?:일)?\.?$/.exec(trimmed);
  if (split) return { year: split[1], month: split[2], day: split[3] };

  return null;
}

/**
 * 붙여 넣은 글을 시 · 분으로 — 24시간으로만 읽는다(`14:30` · `1430` · `14시 30분` · `14시`).
 *
 * 「오후 2시」는 받지 않는다 — 폼이 24시간으로만 묻는 까닭(오전 · 오후가 접히면 12시가 갈린다)이 붙여넣기에도 그대로다.
 */
export function parseTimeText(text: string): { hour: string; minute: string } | null {
  const trimmed = text.trim();

  const compact = /^(\d{2})(\d{2})$/.exec(trimmed);
  if (compact) return { hour: compact[1], minute: compact[2] };

  const colon = /^(\d{1,2})\s*:\s*(\d{1,2})$/.exec(trimmed);
  if (colon) return { hour: colon[1], minute: colon[2] };

  const korean = /^(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?$/.exec(trimmed);
  if (korean) return { hour: korean[1], minute: korean[2] ?? '00' };

  return null;
}

/**
 * 이 칸이 **다 적혔는가** — 다음 칸으로 넘어가도 되는가.
 *
 * 자릿수를 다 채웠거나, 한 자리만으로 더 적을 수 없을 때(월에 「5」 — 50월은 없다). 칸이 붉어지는 기준과 같다:
 * 덜 적은 것은 틀린 것이 아니고, 다 적은 것만 판정한다.
 */
export function isSettled(value: string, digits: number, max: number): boolean {
  return value !== '' && (value.length === digits || Number(value) * 10 > max);
}
