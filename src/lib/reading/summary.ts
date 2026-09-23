import {
  BRANCH_INFO,
  ELEMENT_KO,
  SEASON_KO,
  STEM_INFO,
  type Branch,
  type Stem,
} from '../saju/constants';
import type { ChartEvidence } from '../saju/evidence';
import type { PillarPosition } from '../saju/position';
import type { Participant, ResolvedRelation } from '../saju/relations';

/**
 * 자료 앞에 서는 **한눈에 보이는 머리.**
 *
 * 지시문 조각(`./parts`)과 나란히 서지만 하는 일이 다르다 — 저쪽은 손으로 쓴 산문이고
 * 여기는 **근거를 읽어서 짓는 함수**다. 한 파일에 있을 때는 그 차이가 안 보였다.
 *
 * 엔진에서 이리로 온 까닭은 `./parts` 와 같다(ADR 0047).
 */

/**
 * 한눈에 보이는 머리 — **새 값이 아니라 아래 자료에서 뽑은 것.**
 *
 * 여덟 글자를 읽으려고 36KB 짜리 JSON 을 뒤지게 하지 않는다. 사람이 붙여 넣기 전에
 * 「이 사람 맞나」를 눈으로 확인하는 자리이기도 하고, 모델에게는 긴 자료를 읽기 전에
 * 좌표를 주는 자리다.
 *
 * **다시 세지 않는다.** 전부 `evidence` 의 필드를 읽어서 적는다 — 여기서 간지나 절기를
 * 새로 구하면 머리와 자료가 언젠가 어긋나고, 어긋난 날 어느 쪽이 맞는지 알 수 없다.
 * 화면의 운과 문장의 운을 한 곳에서 낸 것과 같은 규율이다.
 *
 * **사람을 이름으로 부르지 않는다.** `charts.a`·`charts.b` 라고 적는 것은 무뚝뚝해서가
 * 아니라, 이 머리가 하는 말이 사람에 대한 것이 아니라 **자료의 어느 자리**에 대한
 * 것이기 때문이다. 모델이 아래 JSON 에서 찾아갈 이름도 그것이다.
 */
/**
 * 머리가 실제로 읽는 자리만 — **잘린 자료도 같은 머리를 쓴다.**
 *
 * `ChartEvidence` 를 그대로 받으면 모델에 넘길 자료(`RedactedEvidence`·
 * `SharedEvidence`)가 이 함수를 못 부른다. 그러면 머리를 짓는 자리가 둘이 되고,
 * 둘은 언젠가 갈린다 — 갈리면 「한눈에」가 아래 자료와 다른 말을 하게 된다.
 */
type SummarizedChart = {
  pillars: Pick<ChartEvidence['pillars'], 'year' | 'month' | 'day' | 'hour' | 'dayMaster'> & {
    /** 인연 궁합 자료는 절입·사주년을 안 싣는다 — 없으면 머리에도 안 적는다 */
    meta: Partial<Pick<ChartEvidence['pillars']['meta'], 'monthTerm' | 'sajuYear' | 'hourKnown'>>;
  };
  /** 운을 아예 안 싣는 자료도 있다(Match 동의 범위 밖) — 그때는 이 키가 없다 */
  now?: ChartEvidence['now'] | null;
  /** 원국 안 관계와 신살도 공유 궁합 자료에는 없다 — 없으면 목록에도 안 선다 */
  relations?: readonly FactRelation[];
  sinsal?: Pick<ChartEvidence['sinsal'], 'emptiness' | 'stars'>;
};

/** 머리를 지을 수 있는 자료 — `Evidence` 도, 잘린 것도 이 모양을 만족한다 */
type Summarizable = {
  viewedAt: string;
  charts: { a: SummarizedChart; b: SummarizedChart | null };
  /** 두 원국 사이의 관계 — 한 사람짜리 자료에는 없다 */
  compatibility?: { relations: readonly FactRelation[] } | null;
};

/** 목록이 실제로 읽는 관계의 자리 — 인연 궁합 자료는 `id`·거리를 안 싣는다 */
type FactRelation = Pick<
  ResolvedRelation,
  'tier' | 'ko' | 'name' | 'full' | 'participants' | 'direction' | 'cycle' | 'contested'
>;

/**
 * 한 기둥을 **사람이 읽는 꼴로** — 한글 이름과 두 글자의 오행.
 *
 * 자료의 `pillars` 는 간지와 한글 이름만 들고 오행은 안 든다. 그러면 「인목은 나무다」를
 * 모델이 제 기억에서 꺼내 쓰게 되고, 그것은 이 프롬프트가 딱 하나 금지한 것(자료 밖을
 * 자료인 척하기)의 경계에 선다. 오행은 지지·천간에 붙은 **정의**라 새로 재는 값이 아니니,
 * 상수표에서 읽어 머리에 실어 준다 — 그러면 글이 자료를 읽고 쓴 것이 된다.
 *
 * 여기서는 **`ELEMENT_KO` 로 적는다.** 이 줄이 하는 일은 庚 을 金 으로 옮기는 수고를
 * 덜어 주는 것까지이고, 「금이냐 쇠냐」는 문장마다 다르므로 그 선택은 프롬프트가 두 벌을
 * 다 내주고 글 쓰는 쪽이 한다. 머리가 한 벌을 먼저 적으면 그것이 그대로 베껴진다.
 */
const plainPillar = (pillar: { stem: string; branch: string; ko: string }): string => {
  const stemElement = STEM_INFO[pillar.stem as Stem].element;
  const branchElement = BRANCH_INFO[pillar.branch as Branch].element;

  return `${pillar.ko}(${ELEMENT_KO[stemElement]}·${ELEMENT_KO[branchElement]})`;
};

function chartSummary(key: 'charts.a' | 'charts.b', chart: SummarizedChart): string {
  const { pillars, now } = chart;
  const { year, month, day, hour, dayMaster, meta } = pillars;

  const stem = STEM_INFO[dayMaster as Stem];
  const monthBranch = BRANCH_INFO[month.branch as Branch];

  const eight = [
    `년 ${year.name}`,
    `월 ${month.name}`,
    `일 ${day.name}`,
    hour === null ? '시 —(시간 미상)' : `시 ${hour.name}`,
  ].join(' · ');

  const plain = [
    `년 ${plainPillar(year)}`,
    `월 ${plainPillar(month)}`,
    `일 ${plainPillar(day)}`,
    hour === null ? '시 —(시간 미상)' : `시 ${plainPillar(hour)}`,
  ].join(' · ');

  const lines = [
    `\`${key}\``,
    `- 여덟 글자  ${eight}`,
    `- 한글과 오행  ${plain}`,
    [
      `- 일간 ${dayMaster}(${stem.yinYang === '陽' ? '양' : '음'}·${stem.element})`,
      `월지 ${month.branch}(${SEASON_KO[monthBranch.season]})`,
      ...(meta.monthTerm === undefined ? [] : [`절입 ${meta.monthTerm.name}`]),
      ...(meta.sajuYear === undefined ? [] : [`사주년 ${meta.sajuYear}`]),
    ].join(' · '),
  ];

  // 운이 안 실린 자료도 있다. 없는 것을 지어 적지 않고 줄을 빼기만 한다.
  if (now !== null && now !== undefined) {
    const daeun =
      now.daeun === null
        ? `대운 없음(${now.daeunAbsence})`
        : `대운 ${now.daeun.index} ${now.daeun.pillar.name}(만 ${now.daeun.startAge}→${now.daeun.endAge}세)`;

    const daeunPlain =
      now.daeun === null ? '대운 —' : `대운 ${plainPillar(now.daeun.pillar)}`;

    lines.push(
      `- 지금 만 ${now.age}세 — ${daeun} · 세운 ${now.saeun.pillar.name}(${now.saeun.year}) · 월운 ${now.wolun.pillar.name}(${now.wolun.startTerm.name})`,
      `- 운의 한글과 오행  ${daeunPlain} · 세운 ${plainPillar(now.saeun.pillar)} · 월운 ${plainPillar(now.wolun.pillar)}`,
    );
  }

  return lines.join('\n');
}

/** 자료 앞에 놓는 머리 전체 */
function summaryOf(evidence: Summarizable): string {
  const lines = [chartSummary('charts.a', evidence.charts.a)];
  if (evidence.charts.b !== null) lines.push(chartSummary('charts.b', evidence.charts.b));

  return `## 한눈에

아래 자료에서 뽑은 것이다 — **새로 더한 값이 아니다.** 어긋나 보이면 자료 쪽이 맞다.

${lines.join('\n\n')}

기준 시각 \`viewedAt\` = ${evidence.viewedAt}`;
}

/**
 * 자리 이름 — **천간과 지지를 갈라 적는다.**
 *
 * 「일주」라고 뭉치면 천간에 걸린 신살과 같은 기둥 지지의 충이 같은 자리로 읽힌다. 옛
 * 실험에서 난 대표적인 잘못된 연결이 그것이었다.
 */
const PLACE_KO: Record<PillarPosition, string> = { year: '년', month: '월', day: '일', hour: '시' };
const TARGET_KO = { stem: '간', branch: '지', pillar: '주' } as const;

/** 사실 하나가 걸린 자리 — 색인의 열쇠다. 판정 기준 글자는 걸린 자리가 아니라 여기 안 든다 */
type Spot = {
  readonly who: '' | 'A ' | 'B ';
  readonly position: PillarPosition;
  readonly target: keyof typeof TARGET_KO;
  readonly label: string;
};

/** 목록의 한 줄 — 번호와 걸린 자리를 함께 든다 */
type FactLine = { readonly text: string; readonly id: string; readonly spots: readonly Spot[] };

const WHO_ORDER = { '': 0, 'A ': 0, 'B ': 1 } as const;
const POSITION_ORDER: Record<PillarPosition, number> = { year: 0, month: 1, day: 2, hour: 3 };
const TARGET_ORDER: Record<keyof typeof TARGET_KO, number> = { stem: 0, branch: 1, pillar: 2 };

/**
 * **자리 색인** — 자리마다 걸린 사실의 **번호만** 모은다(G-33, 2026-09-23).
 *
 * 사실을 다시 적지 않는다. 색인이 사실을 되풀이하면 한 사실이 자리 수만큼 세어지고, 그것이
 * 9/1 실험의 색인이 못 막은 것이다(PRD §8.5). 여기 줄은 목록 줄을 가리키는 참조뿐이다.
 * 한 자리에 같은 번호가 두 번 서지 않는다.
 */
function positionIndexOf(lines: readonly FactLine[]): string[] {
  const byPlace = new Map<string, { spot: Spot; ids: string[] }>();
  for (const line of lines) {
    for (const spot of line.spots) {
      const found = byPlace.get(spot.label) ?? { spot, ids: [] };
      if (!found.ids.includes(line.id)) found.ids.push(line.id);
      byPlace.set(spot.label, found);
    }
  }
  return [...byPlace.values()]
    .sort(
      (x, y) =>
        WHO_ORDER[x.spot.who] - WHO_ORDER[y.spot.who] ||
        POSITION_ORDER[x.spot.position] - POSITION_ORDER[y.spot.position] ||
        TARGET_ORDER[x.spot.target] - TARGET_ORDER[y.spot.target],
    )
    .map(({ spot, ids }) => `- ${spot.label} : ${ids.join(' · ')}`);
}

/**
 * 계산판 이름을 사람 표시로 — **모르는 판은 멈춘다.**
 *
 * 한 사람짜리 자료의 원국은 `natal`, 두 사람짜리 자료의 원국 안 관계도 `natal`(그 사람의
 * 판), 두 원국 사이는 `natal:a`·`natal:b` 다. 운의 판(`decade:3` 같은 것)은 이 목록에 안
 * 싣는다 — 들어오면 원국의 같은 자리명과 섞이므로 A 로 적지 않고 던진다.
 */
function whoOf(chartId: string, own: '' | 'A ' | 'B '): '' | 'A ' | 'B ' {
  if (chartId === 'natal') return own;
  if (chartId === 'natal:a') return 'A ';
  if (chartId === 'natal:b') return 'B ';
  throw new Error(`자리 목록이 모르는 계산판이다: ${chartId}`);
}

/**
 * 관계 하나를 **한 줄로** — 삼합·방합·삼형도 참여자를 다 든 한 줄이다.
 *
 * 자리마다 줄을 쪼개면 한 사실이 여러 번 세어진다. 완성 여부·형의 이름·방향·순환·쟁합은
 * 자료에 있는 그대로 붙인다.
 */
function relationLine(relation: FactRelation, own: '' | 'A ' | 'B ', id: string): FactLine {
  const tier = relation.tier === 'stem' ? '간' : '지';
  const place = (p: Participant) => `${whoOf(p.chartId, own)}${PLACE_KO[p.position]}${tier} ${p.char}`;
  const spot = (p: Participant): Spot => ({
    who: whoOf(p.chartId, own),
    position: p.position,
    target: relation.tier === 'stem' ? 'stem' : 'branch',
    label: place(p),
  });

  const sides =
    relation.direction === null
      ? relation.participants.map(place).join(' ↔ ')
      : `${place(relation.direction.from)} → ${place(relation.direction.to)}`;
  const name = relation.name === null ? relation.ko : `${relation.ko}(${relation.name})`;
  const notes = [
    relation.full ? null : '세 글자 중 일부',
    relation.cycle === null
      ? null
      : `도는 차례 ${[...relation.cycle, relation.cycle[0]].map(place).join(' → ')}`,
    ...relation.contested.map(
      (contest) => `쟁합: ${place(contest.over)} 을 ${contest.rivals.map(place).join(' · ')} 도 함께 문다`,
    ),
  ].filter((note) => note !== null);

  return {
    text: `- [${id}] ${sides} : ${name}${notes.length > 0 ? ` (${notes.join(' / ')})` : ''}`,
    id,
    spots: relation.participants.map(spot),
  };
}

/**
 * 한 원국의 신살과 공망 — **한 사실에 한 줄, 기준과 걸린 자리를 갈라서.**
 *
 * `[기준 …]` 은 판정에 쓴 글자이고 `:` 뒤가 실제로 걸린 자리다. 기준이 없는 신살(괴강 같은
 * 것)은 기준 칸을 비우고 지어 채우지 않는다. 같은 이름이라도 기준이 다르면 다른 사실이라
 * 합치지 않는다(화개살 년지 기준 · 일지 기준).
 *
 * 12신살은 네 자리마다 늘 하나씩 서므로 여기 안 싣는다 — 자료에는 그대로 있다.
 */
function sinsalLines(chart: SummarizedChart, who: '' | 'A ' | 'B '): Omit<FactLine, 'id'>[] {
  const { sinsal, pillars } = chart;
  if (sinsal === undefined) return [];

  const stars = sinsal.stars.map((star) => {
    const basis = star.basis === null ? '' : ` [기준 ${who}${star.basis.label} ${star.basis.char}]`;
    const spots = star.hits.map(
      (hit): Spot => ({
        who,
        position: hit.position,
        target: hit.target,
        label: `${who}${PLACE_KO[hit.position]}${TARGET_KO[hit.target]} ${hit.char}`,
      }),
    );
    return { text: `${star.ko}${basis} : ${spots.map((one) => one.label).join(' · ')}`, spots };
  });

  /* 공망은 원국에 그 지지가 실제로 놓였을 때만 줄이 선다 — 걸린 자리가 없으면 걸린 것이 없다 */
  const empties = sinsal.emptiness
    .filter((empty) => empty.positions.length > 0)
    .map((empty) => {
      const spots = empty.positions.map(
        (position): Spot => ({
          who,
          position,
          target: 'branch',
          label: `${who}${PLACE_KO[position]}지 ${pillars[position]!.branch}`,
        }),
      );
      return {
        text: `공망 [기준 ${who}${PLACE_KO[empty.basis]}주 ${empty.basisPillar} → ${empty.branches.join('·')}] : ${spots.map((one) => one.label).join(' · ')}`,
        spots,
      };
    });

  return [...stars, ...empties];
}

/*
  색인이 드는 새 글자 셋 — **2026-09-23 승인 대기**(G-33). 사람의 답을 받기 전에는 머지하지 않는다.
*/
const INDEX_TITLE = '자리 색인';
const INDEX_NOTE = (numbers: string) =>
  `줄 앞의 ${numbers} 은 사실의 번호다. 맨 아래 **${INDEX_TITLE}**은 자리마다 걸린 사실의 번호만 모은 것이다 — 새 사실이 아니고, 번호 하나는 사실 하나다.`;
const INDEX_RULE =
  '한 자리에 번호가 여럿 서도 사실마다 한 번만 해석하고, 같은 번호를 자리마다 되풀이해 세지 마라.';

/**
 * **자리가 붙은 사실 목록** — 관계와 신살을 어느 기둥의 천간·지지에 걸렸는지와 함께.
 *
 * 한눈에와 같은 규율이다 — **다시 세지 않고 모으지도 않는다.** 원본 사실 하나를 한 줄로
 * 옮길 뿐이다. 줄마다 번호가 붙고, 맨 아래 자리 색인이 그 번호를 자리별로 모은다
 * (G-33, 2026-09-23 — 사람의 새 결정이다. 9/1 실험은 색인의 실익을 못 보였다, PRD §8.5).
 * 색인은 번호만 들고 사실을 다시 적지 않는다.
 *
 * **자료가 든 만큼만 싣는다.** 공유 궁합 자료에는 원국 안 관계와 신살이 아예 없고
 * (`WITHHELD_PATHS`), 그러면 여기에도 두 원국 사이의 관계만 선다. 목록이 자료보다 넓으면
 * 동의 범위를 이 자리로 넘게 된다.
 *
 * **경로 이름을 안 적는다.** 줄은 사실만 들고, 경로는 사용자 본문에 새면 검사가 막는다.
 */
function positionFactsOf(evidence: Summarizable): string | null {
  const { a, b } = evidence.charts;
  const solo = b === null;
  const charts: ['' | 'A ' | 'B ', SummarizedChart][] = solo ? [['', a]] : [['A ', a], ['B ', b]];

  /* 두 사람이면 원국 안과 사이를 갈라 적는다 — 섞이면 A 끼리의 합이 두 사람 사이 일로 읽힌다 */
  const facts: FactLine[] = [];
  const relations: string[] = [];
  const nextRelation = () => `R${facts.filter((line) => line.id.startsWith('R')).length + 1}`;
  const group = (title: string, found: readonly FactRelation[], own: '' | 'A ' | 'B ') => {
    const lines = found.map((relation) => {
      const line = relationLine(relation, own, nextRelation());
      facts.push(line);
      return line.text;
    });
    if (lines.length === 0) return;
    relations.push(...(solo ? lines : [title, ...lines]));
  };
  for (const [who, chart] of charts) group(`(${who.trim()} 원국 안)`, chart.relations ?? [], who);
  group('(두 사람 사이)', evidence.compatibility?.relations ?? [], '');

  const sinsal = charts
    .flatMap(([who, chart]) => sinsalLines(chart, who))
    .map((line, at) => {
      const numbered = { ...line, id: `S${at + 1}`, text: `- [S${at + 1}] ${line.text}` };
      facts.push(numbered);
      return numbered.text;
    });

  const carriesRelations =
    charts.some(([, chart]) => chart.relations !== undefined) ||
    evidence.compatibility !== undefined;
  const carriesSinsal = charts.some(([, chart]) => chart.sinsal !== undefined);
  if (!carriesRelations && !carriesSinsal) return null;

  const people = solo ? '' : '\nA 는 `charts.a`, B 는 `charts.b` 다.';
  const index = positionIndexOf(facts);
  const blocks = [
    carriesRelations ? `관계\n${relations.length > 0 ? relations.join('\n') : '- 없음'}` : null,
    carriesSinsal ? `신살\n${sinsal.length > 0 ? sinsal.join('\n') : '- 없음'}` : null,
    index.length > 0 ? `${INDEX_TITLE}\n${index.join('\n')}` : null,
  ].filter((block) => block !== null);
  const numbers = carriesSinsal ? '`[R1]`·`[S1]`' : '`[R1]`';

  return `## 자리가 붙은 사실

아래 자료의 ${carriesSinsal ? '관계와 신살(12신살 제외)·공망을' : '관계를'} **한 사실에 한 줄로, 걸린 자리와 함께** 옮긴 것이다. 간은 천간, 지는 지지, 주는 기둥 전체다. ${INDEX_NOTE(numbers)}${carriesSinsal ? ' 신살의 \`[기준 …]\` 은 판정에 쓴 글자이고 \`:\` 뒤가 실제로 걸린 자리다 — 기준 글자는 걸린 자리가 아니다.' : ''}${people}

${carriesSinsal ? '관계나 신살을' : '관계를'} 해석할 때 **어느 기둥의 천간인지 지지인지 확인하고, 서로 다른 자리의 사실을 임의로 잇지 마라.** 두 사실을 겹쳐 읽을 수 있는 것은 같은 자리 — 같은 사람, 같은 기둥, 같은 천간 또는 지지 — 에 실제로 함께 걸렸을 때뿐이다. ${INDEX_RULE}

${blocks.join('\n\n')}`;
}

/**
 * 아무 몸통에나 머리를 끼운다 — **9단계 프롬프트도 같은 자리에 끼운다.**
 *
 * 자리를 찾는 법이 암묵이라 테스트가 잠근다. 프롬프트는 전부 `# 역할` 문단으로 열고
 * 그다음이 `## ` 로 시작하는 절이다 — 그 경계에 끼운다.
 */
export function withSummary(
  body: string,
  evidence: Summarizable,
  /**
   * 자리가 붙은 사실 목록을 싣는가 — **모든 kind 가 싣는다**(G-33, 2026-09-23). 2026-09-15 부터는 두 궁합만
   * 실었다. 끄는 자리는 목록 자체를 재는 시험만 쓴다.
   */
  options: { positionFacts: boolean } = { positionFacts: true },
): string {
  const [role, ...rest] = body.split(/\n\n(?=## )/);

  const facts = options.positionFacts ? positionFactsOf(evidence) : null;
  const head = facts === null ? [summaryOf(evidence)] : [summaryOf(evidence), facts];

  return [role, ...head, ...rest].join('\n\n');
}
