import {
  STEM_INFO,
  civilDayNumber,
  dayPillarFromDayNumber,
  koreaDateOf,
  tenGodOf,
  type CivilDate,
  type Element,
  type Stem,
  type TenGod,
} from '@/src/lib/saju';

/**
 * **이번 달 흐름 — 날마다의 일진(日辰)이 내 일간에게 무엇인가.**
 *
 * 비용이 0 이고 AI 가 없다(ADR 0129). 새로 세는 것도 없다 — 그날의 일주는 엔진이 출생 일주를 세는 그 함수
 * (`dayPillarFromDayNumber`)이고, 내 일간에서 본 그 일주 천간의 자리는 원국 · 세운 · 월운이 쓰는 그 십성
 * (`tenGodOf`)이다. 여기서 더하는 것은 **십성 열 가지마다 한 줄**뿐이다.
 *
 * ## 하루는 서울의 자정에서 갈린다
 *
 * 출생 일주는 자시를 어떻게 셀지가 계통의 선택이지만(`LateNightRule`), 달력이 날마다 적는 일진은 날짜 하나에
 * 하나다 — 만세력 일진표가 그렇다. 그래서 「오늘」은 서울 달력의 날짜이고 그 날짜의 일주가 그날의 일진이다.
 * 서버의 시계는 UTC 라 날짜를 `koreaDateOf` 로 읽는다(현재운이 쓰는 도우미). 밤 23시에 연 사람에게 다음 날
 * 일진을 보이지 않는다.
 *
 * ## 무엇을 말하지 않는가
 *
 * 한 줄은 **그 십성의 뜻**을 하루에 옮긴 말이다. 길흉을 매기지 않고, 원국의 다른 글자와 만나 무엇이 되는지(합충 ·
 * 용신)는 보지 않는다 — 그것까지 보면 규칙 한 줄이 아니라 풀이다. 같은 십성이면 누구에게나 같은 줄이 선다.
 */

/** 오늘 앞뒤로 띠에 서는 날 — 앞 엿새 · 오늘 · 뒤 이레, 열나흘 */
export const FLOW_DAYS_BEFORE = 6;
export const FLOW_DAYS_AFTER = 7;

/**
 * 십성마다 한 줄 — 그 자리의 **뜻**을 오늘에 옮긴 말(`TEN_GOD_GROUP_PLAIN_KO` 의 두 도막을 하루의 말로).
 * 편 · 정은 같은 계열 안에서 세기와 방향이 갈린다 — 편은 치우쳐 세고, 정은 고르게 맞물린다.
 */
export const TEN_GOD_DAY_LINE: Record<TenGod, string> = {
  比肩: '나와 같은 기운이 곁에 서는 날입니다. 내 뜻대로 밀고 나가는 힘이 붙습니다.',
  劫財: '나와 닮은 기운이 겨루듯 들어오는 날입니다. 내 몫은 챙기되 서두르지 않는 편이 좋습니다.',
  食神: '안에 있던 것이 순하게 흘러나오는 날입니다. 만들고 먹고 쉬는 일에 마음이 갑니다.',
  傷官: '말과 재주가 밖으로 튀어나오는 날입니다. 하고 싶은 말은 한 번 고른 뒤에 꺼내 보세요.',
  偏財: '손에 닿는 일이 넓게 퍼지는 날입니다. 새로 벌이기보다 크게 둘러보기 좋습니다.',
  正財: '차근차근 쌓는 일이 보람을 주는 날입니다. 미뤄 둔 정리와 계산에 좋습니다.',
  偏官: '바깥에서 나를 누르는 힘이 드는 날입니다. 맞서기보다 버틸 자리를 고르세요.',
  正官: '약속과 규칙이 나를 세워 주는 날입니다. 맡은 일을 반듯하게 마무리하기 좋습니다.',
  偏印: '생각이 깊어지고 혼자 있고 싶어지는 날입니다. 배우거나 궁리하는 일에 마음이 갑니다.',
  正印: '나를 받쳐 주는 기운이 드는 날입니다. 도움을 청하거나 배우는 일이 순하게 풀립니다.',
};

export type FlowDay = {
  /** `YYYY-MM-DD` — `<time dateTime>` 과 열쇠 */
  readonly iso: string;
  readonly month: number;
  readonly day: number;
  /** 그날 일주의 천간 — 띠의 색은 이 천간의 오행이다 */
  readonly stem: Stem;
  readonly element: Element;
  /** 내 일간에서 본 그날 천간의 십성 */
  readonly tenGod: TenGod;
  readonly today: boolean;
};

export type DayFlow = {
  /** 오늘 — 띠 안의 한 칸과 같은 값 */
  readonly today: FlowDay & { readonly line: string; readonly label: string };
  /** 띠 — 앞 엿새 · 오늘 · 뒤 이레 */
  readonly days: readonly FlowDay[];
};

/** 그 시각의 서울 달력 날짜 */
export function seoulDateOf(instant: Date): CivilDate {
  const { year, month, day } = koreaDateOf(instant);
  return { year, month, day };
}

/** 1970-01-01 = 0 인 일련일 → 달력 날짜 */
function civilOf(dayNumber: number): CivilDate {
  const utc = new Date(dayNumber * 86_400_000);
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

const pad = (value: number): string => String(value).padStart(2, '0');

function flowDayOf(dayMaster: Stem, dayNumber: number, today: boolean): FlowDay {
  const date = civilOf(dayNumber);
  const pillar = dayPillarFromDayNumber(dayNumber);
  return {
    iso: `${date.year}-${pad(date.month)}-${pad(date.day)}`,
    month: date.month,
    day: date.day,
    stem: pillar.stem,
    element: STEM_INFO[pillar.stem].element,
    tenGod: tenGodOf(dayMaster, pillar.stem),
    today,
  };
}

/** 「9월 29일 화요일」 — 인사 줄과 같은 표기(`Intl`, 한국어) */
function dayLabel(date: CivilDate): string {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'UTC',
  });
}

/** 내 일간과 지금 시각 → 오늘 한 줄과 열나흘 띠 */
export function dayFlowOf(dayMaster: Stem, now: Date): DayFlow {
  const date = seoulDateOf(now);
  const todayNumber = civilDayNumber(date);
  const days = Array.from({ length: FLOW_DAYS_BEFORE + 1 + FLOW_DAYS_AFTER }, (_, index) => {
    const offset = index - FLOW_DAYS_BEFORE;
    return flowDayOf(dayMaster, todayNumber + offset, offset === 0);
  });
  const today = days[FLOW_DAYS_BEFORE];
  return {
    today: { ...today, line: TEN_GOD_DAY_LINE[today.tenGod], label: dayLabel(date) },
    days,
  };
}
