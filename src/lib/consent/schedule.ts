import type { BetaDates, Operator } from './notice';

/** 지금 안내 한 벌 — 날짜와 **누가 약속하는가** */
export type BetaSchedule = {
  readonly scheduleId: number;
  readonly dates: BetaDates;
  readonly operator: Operator;
};

/**
 * 문이 읽어 온 일정 한 줄 — 이름은 이미 도메인의 말이다.
 *
 * DB 를 부르는 일과 snake_case 를 옮기는 일은 앱의 문(`app/beta-schedule.ts`)이 한다.
 * 여기 남는 것은 **셋이 다 있어야 안내가 선다**는 규칙 하나다. 운영자 칸이 `string` 만이
 * 아닌 것은 그 규칙이 빈 값과 `undefined` 를 재기 때문이다.
 */
export type ScheduleRow = {
  readonly scheduleId: number;
  readonly endsOn: string;
  readonly purgeBy: string;
  readonly purgeWithinDays: number;
  readonly operatorName: string | null | undefined;
  readonly operatorOfficer: string | null | undefined;
  readonly operatorContact: string | null | undefined;
};

/**
 * 적힌 값인가 — **`null` 만 보면 안 된다.**
 *
 * 타입 단언 뒤에 `=== null` 만 보고 있었다. 그러면 빈 문자열과, 마이그레이션보다 앱이
 * 먼저 배포됐을 때의 `undefined` 가 그대로 지나간다 — 「연락처가 있다」로 판정되면서
 * 화면에는 아무것도 안 적히는 자리가 된다. 없는 것보다 나쁘다.
 */
const filled = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * 일정 한 줄을 안내로 — 날짜와 **누가 약속하는가**. 하나라도 없으면 `null`.
 *
 * `null` 을 「모른다」로 흘려보내지 않는다. 부르는 화면은 날짜를 못 받으면 안내를 세울
 * 수 없고, 그러면 스스로 「아직 시작할 수 없습니다」를 말한다(ADR 0024).
 */
export function scheduleOf(row: ScheduleRow): BetaSchedule | null {
  /*
    **셋이 다 있어야 안내가 선다.** 날짜만 있고 연락처가 없으면 열람·정정·삭제를
    어디에 요구하는지 말할 수 없다 — 지키는 것이 없는 문장만 남는다. 반쪽은 안 낸다.
  */
  const name = filled(row.operatorName);
  const officer = filled(row.operatorOfficer);
  const contact = filled(row.operatorContact);
  if (name === null || officer === null || contact === null) return null;

  return {
    scheduleId: row.scheduleId,
    dates: {
      endsOn: row.endsOn,
      purgeBy: row.purgeBy,
      purgeWithinDays: row.purgeWithinDays,
    },
    operator: { name, officer, contact },
  };
}
