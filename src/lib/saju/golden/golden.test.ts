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
  FOLLOWING_DIRECTION_KO,
  FAVOR_ROLE_KO,
  FOLLOWING_PATTERN_STATUS_KO,
  HIDDEN_COMBINATION_KIND_KO,
  FRAGMENT_POLICY,
  HIDDEN_STEM_ROLE_KO,
  FAVORABILITY_POLICY,
  JOHU_POLICY,
  NOW_POLICY,
  SINSAL_POLICY,
  STRENGTH_POLICY,
  STRUCTURE_OUTCOME_KO,
  STRUCTURE_POLICY,
  TONGGWAN_POLICY,
  YONGSIN_POLICY,
  SPIRIT_BASIS_KO,
  TEN_GOD_KO,
  TEXT_POLICY,
  TWELVE_SPIRIT_KO,
  TWELVE_STAGE_KO,
  computeSaju,
  directionParticipantsOf,
  formatPillars,
  formatRelation,
  type Relation,
  type Saju,
} from '@/src/lib/saju';
import { getSolarTerms } from '@/src/lib/saju/solarTerms';

const pad = (n: number) => String(n).padStart(2, '0');

/** 계산판 이름을 사람이 읽는 낱말로 — 'decade:4' → '대운' */
function chartKo(chartId: string): string {
  if (chartId === 'natal') return '원국';
  if (chartId.startsWith('decade:')) return '대운';
  if (chartId.startsWith('annual:')) return '세운';
  if (chartId.startsWith('monthly:')) return '월운';
  return chartId;
}

/**
 * 걸린 관계를 **어느 판과 걸렸는지로 묶어** 적는다.
 *
 * 한동안 전부 '원국과' 로 적었다. 세운 칸이 원국만 놓고 보던 동안은 맞는 말이었지만,
 * 월운이 세운을 함께 놓게 되고 이제 셋이 대운까지 놓게 되면서 **거짓이 됐다** —
 * 대운과 걸린 것과 원국과 걸린 것이 한 낱말 아래 섞이면 골든이 새 축을 못 지킨다.
 *
 * 자기 판은 이름에서 뺀다. 세운 줄에 '세운과' 라고 적힐 자리는 없다.
 */
function crossedLabel(selfChartId: string, relations: readonly Relation[]): string {
  const groups = new Map<string, string[]>();

  for (const relation of relations) {
    const others = [
      ...new Set(
        relation.participants.map((p) => p.chartId).filter((id) => id !== selfChartId),
      ),
    ]
      .map(chartKo)
      .join('·');
    groups.set(others, [...(groups.get(others) ?? []), relation.ko]);
  }

  return [...groups].map(([where, kos]) => `  ${where}과 ${kos.join(' ')}`).join('');
}

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

  /**
   * 대운 칸도 세운·월운 칸과 **같은 줄로** 찍는다.
   *
   * 위 두 줄은 방향·대운수·간지 순서만 든다. 칸이 십성·운성·신살·관계를 들게 됐는데
   * 그것을 찍지 않으면 **새로 생긴 값 넷이 골든 밖에 있게 되고**, 이 저장소에서
   * 규칙이 지켜지는 방법이 골든이다. 세 해·세 달만 찍는 것과 같은 이유로 셋만 찍는다.
   */
  for (const entry of daeun.entries.slice(0, 3)) {
    lines.push(
      `  대운칸 ${entry.index} ${entry.pillar.name}` +
        ` 만 ${entry.startAge}→${entry.endAge}세` +
        `  ${TEN_GOD_KO[entry.tenGods.stem]}/${TEN_GOD_KO[entry.tenGods.branch]}` +
        ` ${TWELVE_STAGE_KO[entry.stage]}` +
        ` ${TWELVE_SPIRIT_KO[entry.spirits.year]}` +
        crossedLabel(entry.chartId, entry.relations),
    );
  }

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

  const { strength, eokbu, johu, rootedness, rootQuality, followingCandidacy, following } =
    saju.analysis;
  const { structure, favorability, hiddenCombinations } = saju.analysis;
  const { bureaus, effectiveElements } = saju.analysis;
  const { tonggwan, yongsinAgreement } = saju.analysis;
  const { dayMaster: rooting } = rootedness;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  lines.push(
    `  강약   ${strength.verdict} · 보조세력 ${(strength.ratio * 100).toFixed(1)}%` +
      `  ${strength.criteria.map((c) => `${c.label}${c.met ? 'O' : 'X'}`).join(' ')}`,
    `  억부   후보 ${ELEMENT_KO[eokbu.suggestedElement]}(${eokbu.suggestedElement})` +
      ` ${ELEMENT_ROLE_KO[eokbu.role]} · ${eokbu.status}/${eokbu.confidence}` +
      ` · 원국에 ${eokbu.presentInChart ? '있음' : '없음'}`,
    `  조후   후보 ${johu.stems.join('·')} · ${johu.status}` +
      `${johu.half ? ` · ${johu.half === 'first' ? '상반월' : '하반월'}(${johu.midTerm?.name})` : ''}` +
      `${johu.halfStems ? ` → ${johu.halfStems.join('·')}` : ''}  ${johu.note}`,
    // 뿌리는 억부·종격이 먹고 들어가는 사실이라 값이 흔들리면 여기서 먼저 보인다.
    `  뿌리   일간 ${rooting.stem} ` +
      (rooting.rooted
        ? `${rooting.roots
            .map((root) => `${root.branch}${root.stem}${root.days}일`)
            .join(' ')} · 합 ${rooting.totalDays}일`
        : '무근'),
    // 종격 후보의 조건 — 판정이 아니라 사실이라 값이 흔들리면 여기서 보인다.
    `  종후보  ${followingCandidacy.dayMasterRootless ? '무근' : '유근'}` +
      ` · ${ELEMENT_ROLE_KO[followingCandidacy.dominant.role]}` +
      ` ${(followingCandidacy.dominant.ratio * 100).toFixed(1)}%` +
      ` · 월령 ${followingCandidacy.monthCommandsDominant ? '장악' : '아님'}` +
      ` · 투간 생부 ${followingCandidacy.supportStems.map((s) => s.stem).join('') || '없음'}`,
    // 뿌리의 질 — 사실 층(위 `뿌리`)과 갈리는 자리가 여기서 보인다.
    `  뿌리질  ${round(rootQuality.dayMaster.strength)}` +
      `${following.effectivelyRootless ? ' (남은 것 없음)' : ''}` +
      `  ${rootQuality.dayMaster.roots.map((g) => `${g.root.branch}${g.root.stem}=${round(g.strength)}`).join(' ') || '뿌리 없음'}`,
    // 국과 합화 — 세력을 옮긴 것이 있으면 여기에 한 줄로 남는다.
    `  국·합화 ${bureaus.map((b) => `${b.ko}(${b.element} ${round(b.pull)})`).join(' ') || '국 없음'}` +
      ` · ${effectiveElements.transformations.map((t) => `${t.ko}:${t.verdict}`).join(' ') || '천간합 없음'}` +
      ` · 이동 ${round(effectiveElements.shifts.reduce((sum, shift) => sum + shift.amount, 0))}`,
    // 격국 — 월령에서 무엇을 잡았고 성패의 조건이 무엇인가.
    `  격국   ${structure.ko} · ${STRUCTURE_OUTCOME_KO[structure.outcome]} · ${structure.status}` +
      ` · ${structure.source.stem}(${HIDDEN_STEM_ROLE_KO[structure.source.role]})` +
      `${structure.revealed ? ' 투출' : ' 미투출'}` +
      `${structure.monthClashed ? ' · 월령충' : ''}` +
      `  성 ${structure.formingFactors.map((f) => f.name).join('·') || '없음'}` +
      ` / 패 ${structure.breakingFactors.map((f) => f.name).join('·') || '없음'}`,
    // 오신 — 억부 후보를 용신 자리에 놓으면 나머지 넷이 어디에 오는가.
    `  오신   ${favorability.seats.map((seat) => `${FAVOR_ROLE_KO[seat.role]} ${ELEMENT_KO[seat.element]}(${seat.count})`).join(' · ')}`,
    // 조후 후보가 원국 어디에 있는가 — 「丙이 없으면」의 앞부분만 센다.
    `  조후후보 ${johu.candidates.map((c) => `${c.stem}=${c.presence}`).join(' ')}`,
    // 암합 — 관계 표에 섞지 않으므로 여기서 따로 센다.
    `  암합   ${hiddenCombinations.length}건` +
      `${hiddenCombinations.length > 0 ? `  ${hiddenCombinations.map((c) => `${c.ko}(${HIDDEN_COMBINATION_KIND_KO[c.kind]})`).join(' ')}` : ''}`,
    `  종격   ${FOLLOWING_PATTERN_STATUS_KO[following.verdict]} · ${following.status}` +
      ` · 자당 ${(following.selfShare * 100).toFixed(1)}%` +
      `${following.direction ? ` ${FOLLOWING_DIRECTION_KO[following.direction]}` : ''}` +
      ` · 뿌리점수 ${round(following.rootScore)}`,
    // 통관 — 가장 팽팽한 쌍과 그 사이. 판정이 아니라 사실이라 값이 흔들리면 여기서 보인다.
    `  통관   ${tonggwan.tightest.controller}剋${tonggwan.tightest.controlled}` +
      ` · 가벼운 쪽 ${(tonggwan.tightest.facing * 100).toFixed(1)}%` +
      ` · 사이 ${tonggwan.tightest.bridge}${tonggwan.tightest.bridgePresent ? '' : '(없음)'}`,
    // 억부와 조후가 같은 것을 가리키는가 — 어느 쪽이 우선인지는 여전히 말하지 않는다.
    `  대조   억부 ${yongsinAgreement.eokbuElement} ↔ 조후 ${yongsinAgreement.johuStems.join('')}` +
      ` · ${yongsinAgreement.aligned ? `겹침 ${yongsinAgreement.sharedStems.join('')}` : '어긋남'}`,
  );

  // 세운은 골든 케이스마다 출생년부터 세 해만 찍는다 — 열 해를 다 찍으면
  // 스냅샷이 세운으로 뒤덮여 나머지 회귀가 묻힌다.
  for (const entry of saju.saeun.entries.slice(0, 3)) {
    lines.push(
      `  세운   ${entry.year} ${entry.pillar.name}` +
        ` 만 ${entry.ageAtStart}→${entry.ageAtEnd}세` +
        `  ${TEN_GOD_KO[entry.tenGods.stem]}/${TEN_GOD_KO[entry.tenGods.branch]}` +
        ` ${TWELVE_STAGE_KO[entry.stage]}` +
        crossedLabel(entry.chartId, entry.relations),
    );
  }

  // 월운은 열두 달 중 첫 세 달만. 전부 찍으면 스냅샷이 월운으로 뒤덮인다.
  for (const entry of saju.wolun.entries.slice(0, 3)) {
    lines.push(
      `  월운   ${entry.year}-${String(entry.monthOrder).padStart(2, '0')} ${entry.pillar.name}` +
        ` ${entry.startTerm.name}` +
        `  ${TEN_GOD_KO[entry.tenGods.stem]}/${TEN_GOD_KO[entry.tenGods.branch]}` +
        ` ${TWELVE_STAGE_KO[entry.stage]}` +
        crossedLabel(entry.chartId, entry.relations),
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
      '        칸 안은 세운·월운 칸과 같은 모양이다 — 십성·12운성·12신살·관계.',
      '        관계는 원국만 놓고 본다: 한 칸이 열 해라 함께 놓을 세운이 하나가 아니다.',
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
      '        산출법이 갈리는 신살은 채택한 기준을 정책에 밝힌다 — 역마·도화·화개는 12신살에서,',
      '        귀문·원진은 관계 표에서 옮겨 온다.',
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
      '        종격·격국은 따로 판정하되 억부를 뒤집지 않는다. 투간과 통근의 질은 아직 안 본다.',
      '        기신은 여전히 판정하지 않는다 — 대신 고른 용신에서 오신 자리를 배정한다.',
      '        그 배정은 표 조회라 갈리지 않고, 갈리는 것은 그 앞(용신을 무엇으로 잡았는가)이다.',
      '        세력비에 태약·중화·태왕 같은 등급 이름도 붙이지 않는다(경계 출처 없음).',
      '',
      ...Object.entries(YONGSIN_POLICY).map(
        ([key, value]) => `          ${key.padEnd(22)} ${value}`,
      ),
      ...Object.entries(JOHU_POLICY).map(
        ([key, value]) => `          johu.${key.padEnd(17)} ${value}`,
      ),
      // 오신 배정은 억부 아래에 딸린 판정이라 같은 묶음에 찍는다. 여태 아무
      // 골든도 이 정책을 안 찍고 있었는데, 문장 계약이 '기신' 금지의 근거로
      // 이것을 가리키게 되면서 diff 에 안 보이는 값이면 곤란해졌다.
      ...Object.entries(FAVORABILITY_POLICY).map(
        ([key, value]) => `          favor.${key.padEnd(16)} ${value}`,
      ),
      '',
      '  격국  월령의 지장간 중 투출한 것으로 격을 잡는다 — 없으면 정기다(잡기격이 여기서 나온다).',
      '        성패는 참·거짓 하나가 아니라 조건의 목록이다. 이루는 것과 깨는 것이 섞이면 미정이다.',
      '        억부도 조후도 뒤집지 않는다 — 종격과 같은 자리인데 외부 대조는 아직 0건이다.',
      '',
      ...Object.entries(STRUCTURE_POLICY).map(
        ([key, value]) => `          ${key.padEnd(22)} ${typeof value === 'object' ? JSON.stringify(value) : value}`,
      ),
      '',
      '  통관  맞선 다섯 쌍과 그 사이를 잇는 오행을 세기만 한다 — 얼마나 맞서야 대치인가는 계통이 갈린다.',
      '        판정이 없으므로 억부를 뒤집을 일도 없다. 문턱을 고를 때 쓸 모집단 분포만 재어 둔다.',
      '',
      ...Object.entries(TONGGWAN_POLICY).map(
        ([key, value]) => `          ${key.padEnd(22)} ${typeof value === 'object' ? JSON.stringify(value) : value}`,
      ),
      '',
      '  세운  해의 경계는 입춘이다. 간지는 연주 도출과 같은 함수에서 나온다.',
      '        관계는 원국과 그 해를 감싼 대운을 함께 놓고 보되 그 해가 낀 것만 남긴다.',
      '        계산판이 섞이면 기둥 사이의 거리라는 것이 없어 distance 가 null 이다.',
      '',
      '  월운  경계는 절입이다. 월간은 오호둔, 월지는 절기 — 월주 도출과 같은 함수다.',
      '        관계는 원국·세운·대운을 함께 놓고 보되 그 달이 낀 것만 남긴다.',
      '',
      '  현재운  "그중 어느 칸이 지금인가"는 여덟 글자에서 나오지 않고 보는 시각에서 나온다.',
      '        엔진은 그 시각을 스스로 묻지 않고 넘겨받는다 — Date.now() 를 부르면 순수 함수가',
      '        아니게 되고 미리 그려진 페이지의 하이드레이션도 깨진다.',
      '        경계를 재는 방법이 갈린다: 세운·월운은 절대 시각, 대운은 만 나이다.',
      '        간지·절입·관계를 새로 세지 않는다. 관계는 대운·세운·월운 칸에서 옮겨 담기만 한다.',
      '',
      ...Object.entries(NOW_POLICY).map(
        ([key, value]) => `          ${key.padEnd(22)} ${value}`,
      ),
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
      '  해석 문장  L3 는 계약·스키마·말뭉치·조립기까지다 — 생성기는 없다(문장은 text.snapshot.txt).',
      '        문장의 강도는 조각이 적지 않고 읽은 근거에서 나온다(여럿이면 가장 낮은 것).',
      '        사실 → 유도 → 후보 → 참고 순으로 약해지고, 사실이 아니면 완충 표현이 필요하다.',
      '        종격 문장의 상한은 외부 대조 게이트를 따라간다 — 게이트가 닫혀 있으면 후보까지다.',
      '        시간 미상이면 한 칸 내리고, "없다"는 주장은 시주가 뒤집을 수 있어 아예 막는다.',
      '',
      ...Object.entries(TEXT_POLICY).map(
        ([key, value]) => `          ${key.padEnd(22)} ${value}`,
      ),
      '',
      '        조각은 근거도 방향도 적지 않는다 — 주제가 적고 조각은 표현만 고른다.',
      '        변종은 빌드 타임에 전수로 도는 유한 목록이고, 명리 용어는 슬롯으로만 들어온다.',
      '',
      ...Object.entries(FRAGMENT_POLICY).map(
        ([key, value]) => `          ${key.padEnd(22)} ${value}`,
      ),
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
