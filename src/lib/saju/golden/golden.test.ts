import { SunPosition } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';

import { pillarIndexOf } from '@/src/lib/saju/constants';
import { GOLDEN_CASES, type GoldenCase } from '@/src/lib/saju/golden/cases';
import {
  DAEUN_DIRECTION_KO,
  EMPTINESS_BASIS_KO,
  PILLAR_POSITION_KO,
  RELATION_POLICY,
  ELEMENT_KO,
  ELEMENT_ROLE_KO,
  JOHU_POLICY,
  SINSAL_POLICY,
  STRENGTH_POLICY,
  YONGSIN_POLICY,
  SPIRIT_BASIS_KO,
  TEN_GOD_KO,
  TWELVE_SPIRIT_KO,
  TWELVE_STAGE_KO,
  computeSaju,
  directionParticipantsOf,
  formatPillars,
  formatRelation,
  type Saju,
} from '@/src/lib/saju';
import { getSolarTerms } from '@/src/lib/saju/solarTerms';

const pad = (n: number) => String(n).padStart(2, '0');

function formatCase(golden: GoldenCase, saju: Saju): string {
  const { input, options } = golden;
  const { pillars, meta } = saju;
  const civil = pillars.meta.civilTime;

  const inputClock =
    input.hour === null ? '시각미상' : `${pad(input.hour)}:${pad(input.minute)}`;

  const flags = [
    `경도 ${options.useLongitude ? 'O' : 'X'}`,
    `균시차 ${options.useEquationOfTime ? 'O' : 'X'}`,
    `서머타임 ${options.useDst === false ? 'X' : 'O'}`,
    options.lateNightRule === 'ya' ? '야자시' : '조자시',
  ].join(' · ');

  const total = Math.round(meta.totalCorrectionMinutes * 10) / 10;

  const lines = [
    `[${golden.id}] ${golden.note}`,
    `  입력   ${input.year}-${pad(input.month)}-${pad(input.day)} ${inputClock}  (${flags})`,
    `  4주    ${formatPillars(pillars)}   시 일 월 년`,
    `         ${[pillars.hour, pillars.day, pillars.month, pillars.year].map((p) => p?.ko ?? '미상').join(' ')}`,
    `  일간   ${pillars.dayMaster}`,
    `  사주년 ${pillars.meta.sajuYear}   절기 ${pillars.meta.monthTerm.name} ~ ${pillars.meta.nextTerm.name}`,
    `  시각   ${inputClock} → ${pad(civil.hour)}:${pad(civil.minute)}  (${total >= 0 ? '+' : ''}${total}분)`,
  ];

  const { daeun } = saju;
  const distance = Math.round(daeun.daysToBoundary * 10) / 10;
  lines.push(
    `  대운   ${DAEUN_DIRECTION_KO[daeun.direction]} · 대운수 ${daeun.startAge}` +
      ` (${daeun.boundaryTerm.name}까지 ${distance}일)${daeun.approximate ? ' · 근사' : ''}`,
    `         ${daeun.entries
      .slice(0, 5)
      .map((entry) => `${entry.startAge} ${entry.pillar.name}`)
      .join(' / ')} …`,
  );

  for (const relation of saju.relations) {
    const arrow = directionParticipantsOf(relation);
    const notes = [
      relation.targetElement ? `→ ${relation.targetElement}` : null,
      relation.full ? null : '반쪽',
      relation.adjacent ? null : `${relation.distance}칸`,
      arrow ? `${arrow.from.char}→${arrow.to.char}` : null,
      relation.contested.length > 0 ? '쟁합' : null,
    ].filter((note): note is string => note !== null);

    lines.push(
      `  관계   ${formatRelation(relation)}${notes.length > 0 ? `  ${notes.join(' · ')}` : ''}`,
    );
  }

  // 표기 순서는 4주와 같은 시 일 월 년이다.
  const marksOrder = ['hour', 'day', 'month', 'year'] as const;
  const mark = (value: string | null) => (value ?? '—').padEnd(4);

  lines.push(
    `  운성   ${marksOrder
      .map((position) => {
        const stage = saju.stages.byDayMaster[position];
        return mark(stage && TWELVE_STAGE_KO[stage]);
      })
      .join(' ')}  (일간 기준)`,
  );

  for (const chart of saju.sinsal.twelveSpirits) {
    lines.push(
      `  신살   ${marksOrder
        .map((position) => {
          const spirit = chart.byPosition[position];
          return mark(spirit && TWELVE_SPIRIT_KO[spirit]);
        })
        .join(' ')}  (${SPIRIT_BASIS_KO[chart.basis]} ${chart.basisBranch} 기준)`,
    );
  }

  for (const emptiness of saju.sinsal.emptiness) {
    const where =
      emptiness.positions.length === 0
        ? '걸린 자리 없음'
        : emptiness.positions.map((p) => PILLAR_POSITION_KO[p]).join('·');
    lines.push(
      `  공망   ${emptiness.branches.join('')}  (${EMPTINESS_BASIS_KO[emptiness.basis]}` +
        ` ${emptiness.basisPillar} 기준) — ${where}`,
    );
  }

  for (const star of saju.sinsal.stars) {
    const where = star.hits
      .map((hit) => `${hit.char}(${PILLAR_POSITION_KO[hit.position].charAt(0)})`)
      .join(' ');
    const basis = star.basis ? `  ← ${star.basis.label} ${star.basis.char}` : '';
    const nature = {
      auspicious: '길신',
      inauspicious: '흉신',
      neutral: '특수',
    }[star.nature];
    lines.push(`  ${nature}   ${star.ko.padEnd(6)} ${where}${basis}`);
  }

  const { strength, eokbu, johu } = saju.analysis;
  lines.push(
    `  강약   ${strength.verdict} · 보조세력 ${(strength.ratio * 100).toFixed(1)}%` +
      `  ${strength.criteria.map((c) => `${c.label}${c.met ? 'O' : 'X'}`).join(' ')}`,
    `  억부   후보 ${ELEMENT_KO[eokbu.suggestedElement]}(${eokbu.suggestedElement})` +
      ` ${ELEMENT_ROLE_KO[eokbu.role]} · ${eokbu.status}/${eokbu.confidence}` +
      ` · 원국에 ${eokbu.presentInChart ? '있음' : '없음'}`,
    `  조후   후보 ${johu.stems.join('·')} · ${johu.status}  ${johu.note}`,
  );

  // 세운은 골든 케이스마다 출생년부터 세 해만 찍는다 — 열 해를 다 찍으면
  // 스냅샷이 세운으로 뒤덮여 나머지 회귀가 묻힌다.
  for (const entry of saju.saeun.entries.slice(0, 3)) {
    const crossed = entry.relations.map((r) => r.ko).join(' ');
    lines.push(
      `  세운   ${entry.year} ${entry.pillar.name}` +
        ` 만 ${entry.ageAtStart}→${entry.ageAtEnd}세` +
        `  ${TEN_GOD_KO[entry.tenGods.stem]}/${TEN_GOD_KO[entry.tenGods.branch]}` +
        ` ${TWELVE_STAGE_KO[entry.stage]}${crossed ? `  원국과 ${crossed}` : ''}`,
    );
  }

  // 월운은 열두 달 중 첫 세 달만. 전부 찍으면 스냅샷이 월운으로 뒤덮인다.
  for (const entry of saju.wolun.entries.slice(0, 3)) {
    const crossed = entry.relations.map((r) => r.ko).join(' ');
    lines.push(
      `  월운   ${entry.year}-${String(entry.monthOrder).padStart(2, '0')} ${entry.pillar.name}` +
        ` ${entry.startTerm.name}` +
        `  ${TEN_GOD_KO[entry.tenGods.stem]}/${TEN_GOD_KO[entry.tenGods.branch]}` +
        ` ${TWELVE_STAGE_KO[entry.stage]}${crossed ? `  ${crossed}` : ''}`,
    );
  }

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
      '  대운   외부 예시 2건과 방향·출발 간지·대운수 모두 일치',
      '           1945-08-15 남 乙酉년 甲申월 → 역행, 첫 대운 癸未',
      '           1950-06-25 남 庚寅년 壬午월 → 순행, 첫 대운 癸未, 대운수 4',
      '           3일=1년, 나머지 1일 버림·2일 올림(반올림), 시·분까지 셈 — 일치',
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
      '    영향 범위(측정값): 기본값을 ya 로 뒤집어도 이 스냅샷에서',
      '    2건만 변한다 — ipchun-before, ipchun-after. 둘 다 23시대 입력이다.',
      '    23:00~24:00 바깥은 두 설이 항상 일치한다.',
      '',
      '  대운  방향은 양남음녀 순행·음남양녀 역행, 대운수는 절입까지 ÷ 3.',
      '        나이는 만 나이(경과 연수)다. 세는나이로 적는 만세력과 한 살 차이가 난다.',
      '        성별이 필수 입력이라 모든 케이스에 대운이 붙는다(기본 남자).',
      '',
      '  관계  성립하는 형충회합을 열거만 한다 — 길흉도, 합의 성사 여부도 판정하지 않는다.',
      '        거리를 조건으로 걸지 않고 밝히기만 한다(붙은 것만 보는 학파는 걸러 쓰면 된다).',
      '        반합·부분 삼형·반방합은 반쪽으로 표시해 함께 낸다. 지장간은 보지 않는다.',
      '        쟁합·투합은 사실만 표시하고 그래서 합이 깨지는지는 말하지 않는다.',
      '        →X 는 합화 오행(성사되면 무엇이 되는가)이지 합화했다는 뜻이 아니다.',
      '        寅→巳 는 형의 방향이다. 삼형의 순환에서 나오며 세 글자가 다 모이면 없다.',
      '',
      // 규칙이 바뀌면 스냅샷 맨 위에서 먼저 드러난다.
      ...Object.entries(RELATION_POLICY).map(
        ([key, value]) => `          ${key.padEnd(22)} ${value}`,
      ),
      '',
      '  운성·신살  12운성은 음간을 역행시킨다(음양순역). 뒤집는 계통은 양포태다.',
      '        공망은 일주·년주 기준을, 12신살은 년지·일지 기준을 모두 낸다.',
      '        신살은 채택한 고전 기준을 정책에 밝힌다 — 역마·도화·화개는 12신살에서 온다.',
      '',
      ...Object.entries(SINSAL_POLICY).map(
        ([key, value]) => `          ${key.padEnd(22)} ${value}`,
      ),
      '',
      '  신강·신약  득령(월지)·득지(일지)·득세(지장간 사령 일수 가중)로 잰다.',
      '        12운성은 점수에 넣지 않는다 — 乙의 장생 午에는 木의 뿌리가 없고,',
      '        甲의 건록 寅이 강한 것은 이름이 아니라 통근이라 이미 세고 있다.',
      '',
      ...Object.entries(STRENGTH_POLICY).map(
        ([key, value]) => `          ${key.padEnd(22)} ${value}`,
      ),
      '',
      '  용신  억부는 시험값(experimental/low), 조후는 궁통보감 120칸 참고표(reference)다.',
      '        조후도 원국·상하순 조건을 자동 판정하지 않았으므로 후보와 조건을 함께 읽는다.',
      '        종격·격국·합충·투간과 통근의 질을 보지 않아 어느 쪽도 확정 용신이 아니다.',
      '        기신도 내지 않는다 — 오행 상극표 한 줄로 정해지는 것이 아니다.',
      '        세력비에 태약·중화·태왕 같은 등급 이름도 붙이지 않는다(경계 출처 없음).',
      '',
      ...Object.entries(YONGSIN_POLICY).map(
        ([key, value]) => `          ${key.padEnd(22)} ${value}`,
      ),
      ...Object.entries(JOHU_POLICY).map(
        ([key, value]) => `          johu.${key.padEnd(17)} ${value}`,
      ),
      '',
      '  세운  해의 경계는 입춘이다. 간지는 연주 도출과 같은 함수에서 나온다.',
      '        원국과의 관계는 세운이 낀 것만 — 원국 안에서 닫힌 관계는 해마다 같다.',
      '        계산판이 섞이면 기둥 사이의 거리라는 것이 없어 distance 가 null 이다.',
      '',
      '  월운  경계는 절입이다. 월간은 오호둔, 월지는 절기 — 월주 도출과 같은 함수다.',
      '        관계는 원국·세운을 함께 놓고 보되 그 달이 낀 것만 남긴다.',
      '',
      '  시간 미상  채택: 시주를 뽑지 않는다 (unknown-hour-* 케이스)',
      '',
      '    정오를 넣으면 시주가 午시로 나와 "모름"이 "낮 12시"로 둔갑한다.',
      '    연·월·일주는 정오 기준으로 뽑되 시주는 null 로 비우고, 절입일에',
      '    걸린 경우에는 월주를 확정할 수 없다고 경고한다.',
      '',
      '    절입일 판정은 경도 보정을 뺀 표준시 날짜로 한다. 섞어 읽으면',
      '    자정 부근 절입(1984 입춘 02-05 00:18)이 하루 앞으로 밀린다.',
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

  it('모든 케이스가 성립하는 간지를 낸다', () => {
    for (const { golden, saju } of results) {
      for (const key of ['year', 'month', 'day', 'hour'] as const) {
        const pillar = saju.pillars[key];
        if (pillar === null) {
          // 비어도 되는 자리는 시주뿐이고, 그것도 시간 미상일 때만이다.
          expect(key, golden.id).toBe('hour');
          expect(saju.meta.hourKnown, golden.id).toBe(false);
          continue;
        }
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
    expect(jo.pillars.hour!.branch).toBe('子');
    expect(ya.pillars.hour!.branch).toBe('子');
    expect(jo.pillars.day.name).not.toBe(ya.pillars.day.name);

    // 자정을 넘으면 두 설이 일치한다
    expect(formatPillars(find('jasi-0000-jo').pillars)).toBe(
      formatPillars(find('jasi-0000-ya').pillars),
    );
  });

  it('시지 경계는 정각에 새 시지로 넘어간다', () => {
    expect(find('hour-0859').pillars.hour!.branch).toBe('辰');
    expect(find('hour-0900').pillars.hour!.branch).toBe('巳');
    expect(find('jasi-2259-jo').pillars.hour!.branch).toBe('亥');
    expect(find('jasi-0100').pillars.hour!.branch).toBe('丑');
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

  it('시간 미상은 시주만 비우고 나머지 세 주는 그대로 낸다', () => {
    const unknown = find('unknown-hour-plain');
    const noon = computeSaju(
      { year: 2025, month: 6, day: 15, hour: 12, minute: 0, second: 0, gender: 'male' },
      { useLongitude: true, useEquationOfTime: false, useDst: true },
    );

    expect(unknown.pillars.hour).toBeNull();
    expect(unknown.meta.hourKnown).toBe(false);
    expect(unknown.analysis.tenGods.hour).toBeNull();

    expect(unknown.pillars.year.name).toBe(noon.pillars.year.name);
    expect(unknown.pillars.month.name).toBe(noon.pillars.month.name);
    expect(unknown.pillars.day.name).toBe(noon.pillars.day.name);
  });

  it('시간 미상이 절입일에 걸리면 월주를 확정할 수 없다고 알린다', () => {
    const onTermDay = find('unknown-hour-on-term-day');
    expect(onTermDay.meta.warnings.some((w) => w.includes('입춘 절입일'))).toBe(true);

    // 절입일이 아니면 그 경고는 없고, 시주 없음 경고만 남는다.
    const plain = find('unknown-hour-plain');
    expect(plain.meta.warnings.some((w) => w.includes('절입일'))).toBe(false);
    expect(plain.meta.warnings.some((w) => w.includes('시주를 뽑지 않았습니다'))).toBe(true);
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
