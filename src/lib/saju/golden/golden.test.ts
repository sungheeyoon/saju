import { SunPosition } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';

import { pillarIndexOf } from '@/src/lib/saju/constants';
import { GOLDEN_CASES, type GoldenCase } from '@/src/lib/saju/golden/cases';
import { computeSaju, formatPillars, type Saju } from '@/src/lib/saju';
import { getSolarTerms } from '@/src/lib/saju/solarTerms';

const pad = (n: number) => String(n).padStart(2, '0');

function formatCase(golden: GoldenCase, saju: Saju): string {
  const { input, options } = golden;
  const { pillars, meta } = saju;
  const civil = pillars.meta.civilTime;

  const flags = [
    `경도 ${options.useLongitude ? 'O' : 'X'}`,
    `균시차 ${options.useEquationOfTime ? 'O' : 'X'}`,
    `서머타임 ${options.useDst === false ? 'X' : 'O'}`,
    options.lateNightRule === 'ya' ? '야자시' : '조자시',
  ].join(' · ');

  const total = Math.round(meta.totalCorrectionMinutes * 10) / 10;

  const lines = [
    `[${golden.id}] ${golden.note}`,
    `  입력   ${input.year}-${pad(input.month)}-${pad(input.day)} ${pad(input.hour)}:${pad(input.minute)}  (${flags})`,
    `  4주    ${formatPillars(pillars)}   시 일 월 년`,
    `         ${[pillars.hour, pillars.day, pillars.month, pillars.year].map((p) => p.ko).join(' ')}`,
    `  일간   ${pillars.dayMaster}`,
    `  사주년 ${pillars.meta.sajuYear}   절기 ${pillars.meta.monthTerm.name} ~ ${pillars.meta.nextTerm.name}`,
    `  시각   ${pad(input.hour)}:${pad(input.minute)} → ${pad(civil.hour)}:${pad(civil.minute)}  (${total >= 0 ? '+' : ''}${total}분)`,
  ];

  for (const correction of meta.corrections) {
    const minutes = Math.round(correction.minutes * 10) / 10;
    lines.push(
      `  보정   ${correction.label.padEnd(8)} ${minutes === 0 ? '—' : `${minutes >= 0 ? '+' : ''}${minutes}분`}  ${correction.detail}`,
    );
  }

  for (const warning of meta.warnings) {
    lines.push(`  경고   ${warning}`);
  }

  return lines.join('\n');
}

const results = GOLDEN_CASES.map((golden) => ({
  golden,
  saju: computeSaju(golden.input, golden.options),
}));

describe('골든 테스트', () => {
  it('경계 케이스 결과가 고정되어 있다', async () => {
    const header = [
      '사주 만세력 골든 스냅샷',
      '',
      '이 파일은 vitest 가 생성합니다. 값을 바꾸려면 코드를 고치고 `npx vitest -u` 로 갱신하세요.',
      '리팩터링으로 결과가 달라지면 이 파일의 diff 로 드러납니다.',
      '',
      '── 외부 대조 기록 (2026-08-15) ──────────────────────────────',
      '',
      '  절기   KASI 2025 달력자료와 일치',
      '           망종 6/5 18:57, 소서 7/7 05:05 ↔ 엔진 18:56:40 / 05:04:51',
      '',
      '  일주   독립 자료와 일치 (앵커 2000-01-01 = 戊午 검증됨)',
      '           2024-01-01 甲子 / 2024-02-29 癸亥 / 1988-07-15 辛未',
      '           2025-06-15 乙卯 / 2025-12-31 甲戌',
      '',
      '  표준시 1954-03-21, 1961-08-10 자오선 전환 일치 (135° ↔ 127.5°)',
      '           1987~88 서머타임 시행 및 1시간 앞당김 일치',
      '',
      '  주의   조자시 케이스(year-end-jo, jasi-2300-jo)의 일주는 다음 날 값이다.',
      '           달력 일진과 직접 비교하면 하루 어긋난 것처럼 보인다.',
      '           예: year-end-jo 는 2025-12-31 23:30 → 일주 乙亥(=2026-01-01).',
      '           2025-12-31 자체의 일진은 甲戌이 맞고 엔진도 그렇게 계산한다.',
      '',
      '── 정책 결정 (검증 대상 아님) ───────────────────────────────',
      '',
      '  자시 규칙  채택: 조자시(jo) — 일주 경계 23:00',
      '',
      '    이것은 계산의 옳고 그름이 아니라 명리학 학파의 채택 기준이다.',
      '    KASI 일진표는 "그 날의 간지"를 줄 뿐, "23시 출생자를 어느 날로',
      '    볼 것인가"에는 답하지 않으므로 역법 자료로는 판정할 수 없다.',
      '    바꾸려면 DEFAULT_LATE_NIGHT_RULE 한 줄이고, 호출부에서',
      '    lateNightRule 로 케이스별 재정의도 가능하다.',
      '',
      '    영향 범위(측정값): 기본값을 ya 로 뒤집으면 이 스냅샷 31건 중',
      '    2건만 변한다 — ipchun-before, ipchun-after. 둘 다 23시대 입력이다.',
      '    23:00~24:00 바깥은 두 설이 항상 일치한다.',
      '',
      `케이스 ${GOLDEN_CASES.length}건`,
      '='.repeat(78),
      '',
    ].join('\n');

    const body = results.map(({ golden, saju }) => formatCase(golden, saju)).join('\n\n');

    await expect(`${header}${body}\n`).toMatchFileSnapshot('./golden.snapshot.txt');
  });

  it('케이스 id 가 중복되지 않는다', () => {
    const ids = GOLDEN_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('모든 케이스가 성립하는 간지 4개를 낸다', () => {
    for (const { golden, saju } of results) {
      for (const key of ['year', 'month', 'day', 'hour'] as const) {
        const pillar = saju.pillars[key];
        expect(pillarIndexOf(pillar.stem, pillar.branch), `${golden.id} ${key}`).toBe(
          pillar.index,
        );
      }
      expect(saju.pillars.dayMaster, golden.id).toBe(saju.pillars.day.stem);
    }
  });

  it('모든 케이스가 표준자오선 보정 기록을 남긴다', () => {
    for (const { golden, saju } of results) {
      expect(
        saju.meta.corrections.some((c) => c.kind === 'standardMeridian'),
        golden.id,
      ).toBe(true);
    }
  });
});

describe('골든 테스트 — 규칙별 기대', () => {
  const find = (id: string) => {
    const result = results.find((r) => r.golden.id === id);
    if (!result) throw new Error(`케이스 없음: ${id}`);
    return result.saju;
  };

  it('입춘이 연주를 가른다', () => {
    expect(find('ipchun-before').pillars.year.name).toBe('甲辰');
    expect(find('ipchun-after').pillars.year.name).toBe('乙巳');
    expect(find('ipchun-before').pillars.meta.sajuYear).toBe(2024);
    expect(find('ipchun-after').pillars.meta.sajuYear).toBe(2025);
  });

  it('경도 보정은 연주·월주를 흔들지 않는다', () => {
    const raw = find('ipchun-after');
    const corrected = find('ipchun-longitude-stable');
    expect(corrected.pillars.year.name).toBe(raw.pillars.year.name);
    expect(corrected.pillars.month.name).toBe(raw.pillars.month.name);
  });

  it('절기가 월지를 가른다', () => {
    expect(find('gyeongchip-before').pillars.month.branch).toBe('寅');
    expect(find('gyeongchip-after').pillars.month.branch).toBe('卯');
    expect(find('sohan-before').pillars.month.branch).toBe('子');
    expect(find('sohan-after').pillars.month.branch).toBe('丑');
    expect(find('daeseol').pillars.month.branch).toBe('子');
  });

  it('1월 초는 사주년이 전년으로 남는다', () => {
    expect(find('sohan-before').pillars.meta.sajuYear).toBe(2025);
    expect(find('sohan-after').pillars.meta.sajuYear).toBe(2025);
  });

  it('조자시와 야자시가 23시대에만 갈린다', () => {
    const jo = find('jasi-2300-jo');
    const ya = find('jasi-2300-ya');
    expect(jo.pillars.hour.branch).toBe('子');
    expect(ya.pillars.hour.branch).toBe('子');
    expect(jo.pillars.day.name).not.toBe(ya.pillars.day.name);

    // 자정을 넘으면 두 설이 일치한다
    expect(formatPillars(find('jasi-0000-jo').pillars)).toBe(
      formatPillars(find('jasi-0000-ya').pillars),
    );
  });

  it('시지 경계는 정각에 새 시지로 넘어간다', () => {
    expect(find('hour-0859').pillars.hour.branch).toBe('辰');
    expect(find('hour-0900').pillars.hour.branch).toBe('巳');
    expect(find('jasi-2259-jo').pillars.hour.branch).toBe('亥');
    expect(find('jasi-0100').pillars.hour.branch).toBe('丑');
  });

  it('표준자오선 시기에 따라 경도 보정량이 달라진다', () => {
    const longitudeOf = (id: string) =>
      find(id).meta.corrections.find((c) => c.kind === 'longitude')!.minutes;

    expect(longitudeOf('meridian-1954-before')).toBeCloseTo(-32.09, 1);
    expect(longitudeOf('meridian-1954-after')).toBeCloseTo(-2.09, 1);
    expect(longitudeOf('meridian-1961-before')).toBeCloseTo(-2.09, 1);
    expect(longitudeOf('meridian-1961-after')).toBeCloseTo(-32.09, 1);
  });

  it('서머타임 전환일의 모호·부재 시각을 경고한다', () => {
    expect(find('dst-gap').meta.warnings.some((w) => w.includes('존재하지 않'))).toBe(true);
    expect(find('dst-ambiguous').meta.warnings.some((w) => w.includes('두 번'))).toBe(true);
  });

  it('일주 앵커가 2024-01-01 = 갑자일과 맞는다', () => {
    expect(find('gapja-day').pillars.day.name).toBe('甲子');
  });
});

describe('절기 시각 자체 검증', () => {
  /** 두 황경의 각도 차이 (0~180) */
  function angleDiff(a: number, b: number): number {
    const diff = Math.abs(((a - b) % 360) + 360) % 360;
    return Math.min(diff, 360 - diff);
  }

  it('반환된 시각의 태양 황경이 목표와 일치한다', () => {
    // 절기 계산이 실제로 수렴했는지를 독립적으로 확인한다.
    // (탐색 결과를 되짚어 태양 위치를 다시 구해 비교)
    for (const year of [1950, 1990, 2025, 2060]) {
      for (const term of getSolarTerms(year)) {
        const actual = SunPosition(term.date).elon;
        expect(
          angleDiff(actual, term.longitude),
          `${year} ${term.name} (목표 ${term.longitude}°, 실제 ${actual.toFixed(6)}°)`,
        ).toBeLessThan(1e-4);
      }
    }
  });

  it('절기 간격이 29~32일 사이다', () => {
    const terms = getSolarTerms(2025);
    for (let i = 1; i < terms.length; i += 1) {
      const days = (terms[i].date.getTime() - terms[i - 1].date.getTime()) / 86_400_000;
      expect(days, `${terms[i - 1].name} → ${terms[i].name}`).toBeGreaterThan(29);
      expect(days).toBeLessThan(32);
    }
  });

  it('해가 바뀌어도 절기가 이어진다', () => {
    const y2025 = getSolarTerms(2025);
    const y2026 = getSolarTerms(2026);
    const gap =
      (y2026[0].date.getTime() - y2025[y2025.length - 1].date.getTime()) / 86_400_000;
    expect(gap).toBeGreaterThan(29); // 소한 → 입춘
    expect(gap).toBeLessThan(32);
  });
});
