/**
 * 한국 음력 표를 생성해 src/lib/saju/lunar/lunarTable.generated.ts 로 쓴다.
 *
 *   node scripts/generate-lunar-table.mjs
 *
 * 런타임에 계산하지 않고 표를 뽑아 커밋하는 이유는 ADR 0002 에 있다. 여기서는
 * **무엇을 계산했는가**만 적는다.
 *
 * 규칙은 한국천문연구원의 「음력 운용지침」(2017-07-01 시행)이다. 지침의 전문과
 * 근거는 다음 논문의 부록 A.1 에 실려 있고, 이 스크립트의 검증 자료도 같은
 * 논문의 표에서 가져왔다.
 *
 *   박한얼·민병희·안영숙, 「한국 음력의 운용과 계산법 연구」,
 *   Publications of the Korean Astronomical Society 32(3), 2017, 407~420.
 *   https://doi.org/10.5303/PKAS.2017.32.3.407
 *
 * 지침이 정하는 것은 넷이다.
 *
 * 1. 달의 시작은 **합삭(合朔)이 든 날**이다. 삭 시각 자체가 아니라 그 시각이
 *    속한 날짜가 초하루가 된다.
 * 2. 날짜는 **한국표준시(동경 135°) 기준**으로 정하고, **일광절약시간제의
 *    시각은 역법 계산에 적용하지 않는다**(지침 제3조).
 * 3. 역법 계산의 기점은 동지다. **동지가 든 달을 11월**로 한다.
 * 4. 음력 11월부터 다음 해 11월 전까지 **열세 달**이 들어가면 그 사이 **첫
 *    무중월**(중기가 없는 달)이 윤달이다. 두 번째 무중월부터는 윤달이 아니다.
 *
 * 표준시가 동경 127°30′ 이던 1954-03-21 ~ 1961-08-09 구간에 대해 논문은
 * 「합삭 시각이 0시~0시 30분 사이에 있는 경우가 없어 결과적으로 음력 날짜는
 * 동일했다」고 적는다. 인용만 하면 자료가 바뀌었을 때 조용히 틀리므로 이
 * 스크립트가 **직접 재고, 하나라도 있으면 생성을 멈춘다**.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { SearchMoonPhase, SearchSunLongitude, SunPosition } from 'astronomy-engine';

/**
 * 표에 담을 음력 연도 — 양 끝을 모두 포함한다.
 *
 * 하한이 1900 이 아니라 1912 인 것은 자료의 한계다. 논문 4.1 절: 1912년부터는
 * 계산한 음력 날짜가 역서와 **모두** 일치하지만, 1911년 이전에는 여덟 건이
 * 어긋난다(Table 6). 당시 조선·대한제국의 역서가 독자 표준자오선이 아니라
 * 중국 역을 따랐기 때문이다. 그 구간은 계산으로 복원되지 않으므로 넣지 않는다.
 */
const FIRST_LUNAR_YEAR = 1912;
const LAST_LUNAR_YEAR = 2100;

/** 한국표준시 — 동경 135°. 서머타임은 역법 계산에 넣지 않는다. */
const KST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;

/**
 * 12중기의 황경 — 동지(270°)에서 시작해 30° 간격.
 *
 * 절(節)이 아니라 기(氣)다. 사주의 월주는 절로 갈리지만(`solarTerms.ts`),
 * 음력의 달 이름과 윤달은 중기로 갈린다. 같은 24기의 서로 다른 절반이다.
 */
const ZHONGQI = [
  { name: '동지', longitude: 270 },
  { name: '대한', longitude: 300 },
  { name: '우수', longitude: 330 },
  { name: '춘분', longitude: 0 },
  { name: '곡우', longitude: 30 },
  { name: '소만', longitude: 60 },
  { name: '하지', longitude: 90 },
  { name: '대서', longitude: 120 },
  { name: '처서', longitude: 150 },
  { name: '추분', longitude: 180 },
  { name: '상강', longitude: 210 },
  { name: '소설', longitude: 240 },
];

const DONGJI_LONGITUDE = 270;

/**
 * 훑는 구간.
 *
 * 음력 1912년의 달 이름을 정하려면 그 앞 동지(1911년 12월)가 필요하고, 음력
 * 2100년을 닫으려면 그 뒤 동지(2101년 12월)까지 가야 한다. 표에 남는 것보다
 * 양쪽으로 한 해씩 넓게 훑는다.
 */
const SCAN_FROM = new Date(Date.UTC(FIRST_LUNAR_YEAR - 2, 9, 1));
const SCAN_TO = new Date(Date.UTC(LAST_LUNAR_YEAR + 2, 2, 1));

/** 표를 뽑은 천체력의 판본 — `exports` 맵이 package.json 을 막아 파일로 읽는다 */
function ephemerisVersion() {
  const manifest = new URL('../node_modules/astronomy-engine/package.json', import.meta.url);
  return JSON.parse(readFileSync(manifest, 'utf8')).version;
}

/** 절대 시각이 속한 한국표준시 날짜 — 1970-01-01 을 0 으로 세는 일련번호 */
function kstDayNumber(instant) {
  return Math.floor((instant.getTime() + KST_OFFSET_MS) / DAY_MS);
}

/** 일련번호를 'YYYY-MM-DD' 로 — 그 번호의 날 자체가 한국표준시 날짜다 */
function isoDate(dayNumber) {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

/** 한국표준시 자정으로부터 몇 초 떨어져 있는가 — 음수면 자정 **전** */
function secondsFromKstMidnight(instant) {
  const withinDay = (instant.getTime() + KST_OFFSET_MS) % DAY_MS;
  const seconds = Math.round(withinDay / 1000);
  return seconds > 43_200 ? seconds - 86_400 : seconds;
}

function kstTimestamp(instant) {
  return new Date(instant.getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

/** 구간 안의 모든 합삭 */
function findNewMoons() {
  const found = [];
  let cursor = SCAN_FROM;

  while (cursor < SCAN_TO) {
    const time = SearchMoonPhase(0, cursor, 40);
    if (!time) throw new Error(`합삭을 찾지 못했습니다: ${cursor.toISOString()}`);
    found.push(time.date);
    // 삭망월은 29.27~29.83일이다. 25일 뒤부터 다시 찾으면 건너뛰지 않는다.
    cursor = new Date(time.date.getTime() + 25 * DAY_MS);
  }
  return found;
}

/** 구간 안의 모든 중기 — 훑기 시작점의 황경에서 다음 30° 배수부터 순환한다 */
function findZhongqi() {
  const found = [];
  let cursor = SCAN_FROM;
  // 어느 중기부터 시작할지는 훑기 시작점의 태양 황경이 정한다. 목록의 첫
  // 항목(동지)부터 찾으면 시작점에 따라 한 바퀴를 헛돈다.
  const startLongitude = (Math.ceil(SunPosition(SCAN_FROM).elon / 30) * 30) % 360;
  let index = ZHONGQI.findIndex((q) => q.longitude === startLongitude);
  if (index < 0) throw new Error(`중기 시작점을 찾지 못했습니다: ${startLongitude}°`);

  while (cursor < SCAN_TO) {
    const { name, longitude } = ZHONGQI[index % ZHONGQI.length];
    const time = SearchSunLongitude(longitude, cursor, 40);
    if (!time) throw new Error(`중기를 찾지 못했습니다: ${name} ${cursor.toISOString()}`);
    found.push({ name, longitude, date: time.date });
    // 중기 간격은 29.4~31.5일이다.
    cursor = new Date(time.date.getTime() + 25 * DAY_MS);
    index += 1;
  }
  return found;
}

/**
 * 삭에서 삭까지를 한 달로 끊는다. 마지막 삭은 끝을 모르므로 버린다.
 */
function buildMonths(newMoons) {
  const months = [];
  for (let i = 0; i + 1 < newMoons.length; i += 1) {
    const startDay = kstDayNumber(newMoons[i]);
    const endDay = kstDayNumber(newMoons[i + 1]) - 1;
    months.push({
      startDay,
      endDay,
      length: endDay - startDay + 1,
      newMoon: newMoons[i],
    });
  }
  return months;
}

function monthIndexContaining(months, dayNumber) {
  const index = months.findIndex((m) => m.startDay <= dayNumber && dayNumber <= m.endDay);
  if (index < 0) throw new Error(`달을 찾지 못했습니다: ${isoDate(dayNumber)}`);
  return index;
}

/**
 * 달마다 이름을 붙인다 — 동지월을 11월로 놓고 세되, 열세 달이면 첫 무중월이 윤달.
 */
function nameMonths(months, zhongqi) {
  for (const month of months) {
    month.zhongqi = zhongqi.filter(
      (q) => month.startDay <= kstDayNumber(q.date) && kstDayNumber(q.date) <= month.endDay,
    );
  }

  const dongjiMonthIndexes = zhongqi
    .filter((q) => q.longitude === DONGJI_LONGITUDE)
    .map((q) => monthIndexContaining(months, kstDayNumber(q.date)));

  for (let i = 0; i + 1 < dongjiMonthIndexes.length; i += 1) {
    const from = dongjiMonthIndexes[i];
    const to = dongjiMonthIndexes[i + 1];
    const span = to - from;

    if (span !== 12 && span !== 13) {
      throw new Error(`동지에서 동지까지가 ${span}달입니다: ${isoDate(months[from].startDay)}`);
    }

    // 「첫 번째 무중월」의 기준은 음력 1월이 아니라 음력 11월이다. 11월 자신은
    // 동지를 품고 있으므로 결코 무중월이 아니고, 다음 11월은 세지 않는다.
    let leapIndex = -1;
    if (span === 13) {
      for (let j = from + 1; j < to; j += 1) {
        if (months[j].zhongqi.length === 0) {
          leapIndex = j;
          break;
        }
      }
      if (leapIndex < 0) {
        throw new Error(`열세 달인데 무중월이 없습니다: ${isoDate(months[from].startDay)}`);
      }
    }

    let number = 11;
    let previous = 11;
    for (let j = from; j < to; j += 1) {
      if (j === leapIndex) {
        // 윤달은 새 이름을 받지 않는다. 앞 달의 이름을 다시 쓰고 순번을 넘기지 않는다.
        months[j].number = previous;
        months[j].leap = true;
        continue;
      }
      months[j].number = number;
      months[j].leap = false;
      previous = number;
      number = (number % 12) + 1;
    }
  }

  return months.filter((month) => month.number !== undefined);
}

/**
 * 이름 붙은 달들을 음력 연도로 묶는다. 윤달이 아닌 1월이 해를 연다.
 */
function buildYears(months) {
  const years = [];

  for (let i = 0; i < months.length; i += 1) {
    if (months[i].number !== 1 || months[i].leap) continue;

    const monthsOfYear = [months[i]];
    let j = i + 1;
    while (j < months.length && !(months[j].number === 1 && !months[j].leap)) {
      monthsOfYear.push(months[j]);
      j += 1;
    }
    // 마지막 해는 다음 정월을 못 봤으므로 12/13 달이 다 찼는지 알 수 없다. 버린다.
    if (j >= months.length) break;

    const leapMonth = monthsOfYear.find((m) => m.leap);
    const year = new Date(months[i].startDay * DAY_MS).getUTCFullYear();
    // 음력 11·12월은 양력으로 다음 해에 걸치기도 한다. 달이 자기 음력 연도를
    // 들고 있지 않으면 그 달을 가리키는 이름이 한 해 어긋난다.
    for (const month of monthsOfYear) month.lunarYear = year;
    years.push({
      year,
      startDay: months[i].startDay,
      leapMonth: leapMonth ? leapMonth.number : 0,
      monthDays: monthsOfYear.map((m) => m.length),
      months: monthsOfYear,
    });
  }

  return years;
}

// ---------------------------------------------------------------------------
// 검증 — 인용한 사실을 직접 잰다
// ---------------------------------------------------------------------------

/**
 * 표준자오선이 동경 127°30′ 이던 두 구간에서 삭이 0시~0시 30분 사이에 드는가.
 *
 * 하나라도 있으면 「그 시절에도 지금 표준시로 계산해서 같다」는 근거가 무너지고,
 * 이 표는 그 달부터 역서와 어긋난다. 그때는 표를 내지 않고 멈추는 것이 맞다.
 */
const HALF_HOUR_MERIDIAN_PERIODS = [
  { from: '1908-04-01', to: '1911-12-31', basis: '관보 제3994호' },
  { from: '1954-03-21', to: '1961-08-09', basis: '대통령령 제876호' },
];

function findMeridianSensitiveNewMoons(months) {
  const sensitive = [];
  for (const period of HALF_HOUR_MERIDIAN_PERIODS) {
    const from = Date.parse(`${period.from}T00:00:00Z`) / DAY_MS;
    const to = Date.parse(`${period.to}T00:00:00Z`) / DAY_MS;
    for (const month of months) {
      if (month.startDay < from || month.startDay > to) continue;
      const seconds = secondsFromKstMidnight(month.newMoon);
      // 0시 0분 ~ 0시 30분. 30분 늦은 시계로 읽으면 전날이 된다.
      if (seconds >= 0 && seconds < 1800) {
        sensitive.push({ period, month, seconds });
      }
    }
  }
  return sensitive;
}

/** 자정에서 이만큼 안쪽이면 ΔT 불확도로 날짜가 갈릴 수 있다 */
const NEAR_MIDNIGHT_SECONDS = 120;

function findNearMidnight(items, toInstant) {
  return items
    .map((item) => ({ item, seconds: secondsFromKstMidnight(toInstant(item)) }))
    .filter(({ seconds }) => Math.abs(seconds) <= NEAR_MIDNIGHT_SECONDS);
}

// ---------------------------------------------------------------------------

const newMoons = findNewMoons();
const zhongqi = findZhongqi();
const named = nameMonths(buildMonths(newMoons), zhongqi);
const allYears = buildYears(named);

const meridianSensitive = findMeridianSensitiveNewMoons(named);
if (meridianSensitive.length > 0) {
  for (const { period, month, seconds } of meridianSensitive) {
    console.error(
      `표준자오선이 갈리는 삭: ${kstTimestamp(month.newMoon)} KST (자정 +${seconds}초) ` +
        `— ${period.from}~${period.to} (${period.basis})`,
    );
  }
  throw new Error(
    '동경 127°30′ 구간에서 삭이 0시~0시 30분에 들었습니다. ' +
      '지금 표준시로 계산한 이 표는 그 시절 역서와 어긋납니다.',
  );
}

const years = allYears.filter((y) => y.year >= FIRST_LUNAR_YEAR && y.year <= LAST_LUNAR_YEAR);

if (years.length !== LAST_LUNAR_YEAR - FIRST_LUNAR_YEAR + 1) {
  throw new Error(`음력 연도가 비어 있습니다: ${years.length}개`);
}

const nearMidnightNewMoons = findNearMidnight(
  named.filter((m) => m.lunarYear >= FIRST_LUNAR_YEAR && m.lunarYear <= LAST_LUNAR_YEAR),
  (m) => m.newMoon,
).map(({ item, seconds }) => ({
  newMoonKst: kstTimestamp(item.newMoon),
  secondsFromMidnight: seconds,
  lunarDate: `${item.lunarYear}-${item.leap ? 'L' : ''}${String(item.number).padStart(2, '0')}-01`,
  solarDate: isoDate(item.startDay),
}));

const nearMidnightDongji = findNearMidnight(
  zhongqi.filter((q) => {
    const year = q.date.getUTCFullYear();
    return q.longitude === DONGJI_LONGITUDE && year >= FIRST_LUNAR_YEAR && year <= LAST_LUNAR_YEAR;
  }),
  (q) => q.date,
).map(({ item, seconds }) => ({
  dongjiKst: kstTimestamp(item.date),
  secondsFromMidnight: seconds,
  solarDate: isoDate(kstDayNumber(item.date)),
}));

const provenance = {
  firstYear: FIRST_LUNAR_YEAR,
  lastYear: LAST_LUNAR_YEAR,
  rule: '한국천문연구원 음력 운용지침 (2017-07-01 시행)',
  ruleSource: 'PKAS 32(3), 2017, 407~420, 부록 A.1 · https://doi.org/10.5303/PKAS.2017.32.3.407',
  meridian: '동경 135° (한국표준시, 일광절약시간 미적용)',
  ephemeris: `astronomy-engine ${ephemerisVersion()}`,
  node: process.versions.node,
  generatedAt: new Date().toISOString().slice(0, 10),
};

const rows = years
  .map((y) => {
    const leap = y.leapMonth === 0 ? '' : ` · 윤${y.leapMonth}월`;
    const total = y.monthDays.reduce((a, b) => a + b, 0);
    return (
      `  // ${y.year}${leap} · ${total}일\n` +
      `  { startSolar: '${isoDate(y.startDay)}', leapMonth: ${y.leapMonth},` +
      ` monthDays: [${y.monthDays.join(', ')}] },`
    );
  })
  .join('\n');

const output = `// 이 파일은 scripts/generate-lunar-table.mjs 가 생성합니다. 직접 수정하지 마세요.
// 규칙: ${provenance.rule}
// 출처: ${provenance.ruleSource}
// 기준: ${provenance.meridian}
// 생성: ${provenance.ephemeris} · Node ${provenance.node} · ${provenance.generatedAt}
// 재생성: node scripts/generate-lunar-table.mjs
//
// 표를 다시 뽑으면 KASI 논문의 표와 대조하는 시험(lunarTable.generated.test.ts)이
// 먼저 깨진다. 그 시험이 이 표의 근거이므로 숫자를 손으로 맞추지 말 것.

import type { NearMidnightDongji, NearMidnightNewMoon, RawLunarYear, LunarTableProvenance } from './lunarTypes';

export const LUNAR_TABLE_PROVENANCE: LunarTableProvenance = ${JSON.stringify(provenance, null, 2)};

/** 음력 ${FIRST_LUNAR_YEAR}~${LAST_LUNAR_YEAR}년. 배열 순서가 곧 연도다(첫 항목이 ${FIRST_LUNAR_YEAR}년). */
export const LUNAR_YEARS_RAW: readonly RawLunarYear[] = [
${rows}
];

/**
 * 삭이 한국표준시 자정에서 ${NEAR_MIDNIGHT_SECONDS}초 안쪽에 든 달.
 *
 * 여기 실린 달은 초하루가 하루 앞뒤로 갈릴 **여지**가 있는 자리다. 값을 지우지
 * 않고 **어디가 얇은지를 값으로 남긴다**.
 *
 * 다만 얇다고 다 불확실한 것은 아니다. 갈리게 하는 것은 ΔT(지구시와 세계시의 차)의
 * 불확도인데, ΔT 는 과거에 대해서는 **관측값**이라 1초 안팎이고 미래로 갈수록
 * 추정값이 되어 커진다. KASI 가 「날짜를 특정하기 어려운 경우」를 2050년부터
 * 조사한 이유가 그것이다(Table 2). 그러므로 과거 쪽 항목들은 여유가 50초를
 * 넘으므로 확정이고, 실제로 흔들리는 것은 뒤쪽 몇이다.
 */
export const NEAR_MIDNIGHT_NEW_MOONS: readonly NearMidnightNewMoon[] = ${JSON.stringify(nearMidnightNewMoons, null, 2)};

/** 같은 이유로 동지 시각이 자정에 붙은 해 — 동지월이 11월이므로 음력 전체가 밀릴 수 있다. */
export const NEAR_MIDNIGHT_DONGJI: readonly NearMidnightDongji[] = ${JSON.stringify(nearMidnightDongji, null, 2)};
`;

writeFileSync(
  new URL('../src/lib/saju/lunar/lunarTable.generated.ts', import.meta.url),
  output,
);

const leapCount = years.filter((y) => y.leapMonth !== 0).length;
console.log(
  `음력 ${FIRST_LUNAR_YEAR}~${LAST_LUNAR_YEAR}년 ${years.length}해 (윤달 ${leapCount})` +
    ` → lunarTable.generated.ts`,
);
console.log(
  `자정 ±${NEAR_MIDNIGHT_SECONDS}초 안쪽: 삭 ${nearMidnightNewMoons.length}건 · 동지 ${nearMidnightDongji.length}건`,
);
