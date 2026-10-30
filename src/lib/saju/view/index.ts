import {
  BRANCH_INFO,
  FRAGMENT_TOPICS,
  PILLAR_POSITIONS,
  PILLAR_POSITION_KO,
  RELATION_KIND_KO,
  SPIRIT_BASIS_KO,
  STEM_INFO,
  TRANSFORMATION_BLOCKER_KO,
  TRANSFORMATION_VERDICT_KO,
  HIDDEN_STEM_ROLE_KO,
  assembleText,
  currentFortuneOf,
  directionParticipantsOf,
  orderedParticipants,
  toCivil,
  zoneIntervalAt,
  ELEMENT_KO,
  type ClaimStrength,
  type CompatWarning,
  type CompatWarningKind,
  type CurrentFortune,
  type DaeunAbsence,
  type DaeunSpan,
  type PillarPosition,
  type Relation,
  type Saju,
  type StarNature,
  type StarTarget,
  type Stem,
  type StemTransformation,
  type TransformationBlocker,
  type Utterance,
} from '../index';
import { endsWithBatchim } from '../text/batchim';

/**
 * **명식 결과를 그릴 때 화면이 하던 판단과 표** — 웹(`app/saju/`)과 앱(`mobile/src/chart/`)이 함께 쓴다.
 *
 * 웹 화면 안에 살던 것을 옮겼다. 두 화면이 각자 세면 같은 명식이 두 화면에서 다르게 선다. 이 파일은 React 를 모르고,
 * 어느 칸에 어느 값을 어떤 글자로 놓는가까지만 답한다. 모양은 각 화면의 것이다. 문단은 옆의 `notes.ts` 가 든다.
 */

/** 전통 표기 순서 — 시주가 왼쪽, 년주가 오른쪽 */
export const PILLAR_COLUMNS = [
  { key: 'hour', label: '시주' },
  { key: 'day', label: '일주' },
  { key: 'month', label: '월주' },
  { key: 'year', label: '년주' },
] as const;

export const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 한자 글자 뒤의 조사 — **읽는 소리의 받침을 따른다.**
 *
 * `未이 丑를 형` 이라고 적고 있었다. L3 계약이 문장 틀에서 슬롯 뒤 조사를 아예
 * 금지한 이유가 이것인데(`VARIABLE_PARTICLES`), 화면은 그 검사를 받지 않아 그대로
 * 새어 있었다. 삼형마다 두 글자 행이 셋씩 붙으면서 눈에 띄었다.
 *
 * 글자는 한자로 보이지만 읽는 사람은 '미'·'축' 으로 읽으므로 받침은 그 소리에서
 * 나온다. 계약이 막은 것은 **틀이 미리 고르는 것**이지, 값을 아는 쪽이 고르는 것은
 * 아니다 — 조립기가 이름을 이어 붙일 때 쓰는 판단과 같다(`joinNames`).
 */
const hasFinalConsonant = (char: string): boolean => {
  /*
    지지만 읽고 있었다. 천간을 그대로 넘기면 한자에는 받침이 없으므로 **언제나
    「가」·「를」** 이 나온다 — 壬(임)·辛(신)처럼 받침 있는 글자에서 틀린다. 조후가
    권한 글자를 문장에 넣기 시작하면서 걸렸다.
  */
  const ko =
    BRANCH_INFO[char as keyof typeof BRANCH_INFO]?.ko ??
    STEM_INFO[char as keyof typeof STEM_INFO]?.ko ??
    char;

  return endsWithBatchim(ko);
};

export const subjectParticle = (char: string) => (hasFinalConsonant(char) ? '이' : '가');

export const objectParticle = (char: string) => (hasFinalConsonant(char) ? '을' : '를');

/**
 * 관계 하나를 가리키는 키.
 *
 * 이름만으로는 모자란다. 같은 관계가 **자리만 달리해** 여러 번 나오고
 * (원국에 辰이 둘이면 월운 卯와 묘진해가 둘 성립한다), 계산판이 섞이면
 * 자리 이름마저 겹친다(원국 년주와 세운 년주가 둘 다 'year'). 글자가 아니라
 * 계산판+자리가 관계의 정체성이다.
 */
export function relationKey(relation: Relation): string {
  return `${relation.kind}:${relation.ko}:${relation.participants
    .map((p) => `${p.chartId}.${p.position}`)
    .join('-')}`;
}

/**
 * 화면 하나가 그리는 데 필요한 것 — **한 번만 세고 나눠 쓴다.**
 *
 * 세 값 모두 명식과 기준 시각에서만 나온다. 각 칸이 제 손으로 세면 세운 표와 월운
 * 표가 각자 '지금' 을 판정하게 되고, 엔진이 "따로 세면 어긋난다"로 세운 규율이
 * 화면에서 되돌아온다.
 */
export type SajuViewModel = {
  readonly saju: Saju;
  readonly utterances: Utterance[];
  readonly now: CurrentFortune;
};

/**
 * 명식과 기준 시각에서 그릴 것을 짓는다 — **정의는 여기 하나다.**
 *
 * 서버 화면은 한 번 그리고 마니 그대로 부르고, 익명 계산기와 앱은 `useMemo` 로 감싸서
 * 부른다. 계산기는 폼 상태를 들고 있어 **타이핑마다 이 트리를 다시 그리는데**, 그때
 * `assembleText` 가 매번 도는 것은 눈에 보이는 느려짐이다. 그렇다고 이 함수를 화면
 * 안에서 `useMemo` 로 부르면 그 화면이 클라이언트가 되고, 그러면 저장된 사람 화면까지
 * 통째로 브라우저로 간다.
 *
 * 두 벌로 적지 않는 것이 요점이다 — 두 벌이 되면 한쪽만 고쳐지는 날 같은 명식이 두
 * 화면에서 다르게 선다.
 */
export function sajuViewModelOf(saju: Saju, viewedAt: number): SajuViewModel {
  const now = currentFortuneOf(saju, new Date(viewedAt));

  /*
    **현재운 문장은 더 이상 안 짓는다.** 그것을 세우던 카드가 없어졌다 — 어느 운이
    도는지는 표가 짚고, 겹치는 자리는 `now.overlaps` 가 그대로 든다. 문장을
    짓던 현재운 조립기도 함께 걷었다.
  */
  return {
    saju,
    utterances: assembleText(saju),
    now,
  };
}

/**
 * 기준 시각을 사람이 읽는 모양으로 — **한국 달력 시각이다**(`viewedOn`).
 *
 * `viewedAt` 을 그대로 찍으면 보는 사람의 시간대로 찍힌다. 절입일에는 시각이 달을
 * 가르므로, 시까지 적어야 같은 날짜에 두 답이 있는 것처럼 보이지 않는다.
 */
export function asOf(now: CurrentFortune): string {
  const { year, month, day, hour, minute } = now.viewedOn;
  return `${year}년 ${month}월 ${day}일 ${hour}시 ${minute}분`;
}

/**
 * 궁성(宮星) — 각 기둥이 상징하는 자리와 시기.
 *
 * 계산이 아니라 **표시 규칙**이다. 여덟 글자에서 나오는 값이 아니라 자리에
 * 붙은 관습적 의미라서, 엔진이 아니라 화면이 들고 있는다.
 *
 * 육친을 성별로 단정하지 않는다 — "월간은 부친" 같은 배정은 계통과 성별에
 * 따라 갈리므로 관계(부모·형제) 수준까지만 적는다. 연령 구간도 대략이다.
 */
export const PALACE: Record<PillarPosition, { meaning: string; period: string }> = {
  year: { meaning: '집안·뿌리', period: '초년' },
  month: { meaning: '부모·성장 환경', period: '청년' },
  day: { meaning: '일지는 가까운 관계를 보는 자리', period: '중년' },
  hour: { meaning: '자녀·삶의 결실', period: '말년' },
};

/*
  **신살.** 각 항목은 「일간 庚」, 「년간 庚」처럼 자리·대상·글자를 한 덩어리로 적는다 — 카드 머리만 보고 자리를
  추론하게 하면 같은 신살이 두 번 찍힌 버그처럼 보인다.
*/
export const HIT_POSITION_KO: Record<PillarPosition, Record<StarTarget, string>> = {
  hour: { stem: '시간', branch: '시지', pillar: '시주' },
  day: { stem: '일간', branch: '일지', pillar: '일주' },
  month: { stem: '월간', branch: '월지', pillar: '월주' },
  year: { stem: '년간', branch: '년지', pillar: '년주' },
};

export const STAR_NATURE_KO: Record<StarNature, string> = {
  auspicious: '길신',
  inauspicious: '흉신',
  neutral: '특수',
};

/**
 * 12신살에서 옮겨 온 셋 — 기준마다 걸린 자리가 없을 수 있다.
 *
 * 걸린 자리가 없으면 항목이 아예 안 나오는데, 그러면 "계산했는데 없다"와
 * "여기서는 안 본다"가 화면에서 같아 보인다. 도화를 년지 기준으로만 보는
 * 만세력과 결과를 맞춰볼 때 바로 이 구분이 필요하다. 그래서 없는 기준을
 * 따로 적어 준다. 값은 12신살 결과에서 그대로 읽으므로 신살 표와 갈릴 수 없다.
 */
const RESTATED_SPIRIT_KO: Record<string, string> = {
  驛馬殺: '역마',
  年殺: '도화',
  華蓋殺: '화개',
};

export function missingSpiritNotes(saju: Saju): string[] {
  return saju.sinsal.twelveSpirits.flatMap((chart) => {
    const present = new Set(PILLAR_COLUMNS.map(({ key }) => chart.byPosition[key]));
    const missing = Object.entries(RESTATED_SPIRIT_KO)
      .filter(([spirit]) => !present.has(spirit as never))
      .map(([, ko]) => ko);

    if (missing.length === 0) return [];
    return [
      `${SPIRIT_BASIS_KO[chart.basis]} ${chart.basisBranch} 기준으로는 ${missing.join('·')}가 걸린 자리가 없습니다.`,
    ];
  });
}

/** 그 자리에 걸린 신살 — 천간·지지·간지는 항목 안의 작은 표식으로 밝힌다. */
export const starsAt = (saju: Saju, position: PillarPosition) =>
  saju.sinsal.stars.flatMap((star) =>
    star.hits.filter((hit) => hit.position === position).map((hit) => ({ star, hit })),
  );

/** 전통 분류마다 걸린 신살 이름 — 없는 분류는 안 선다 */
export const starNamesByNature = (saju: Saju) =>
  (Object.keys(STAR_NATURE_KO) as StarNature[]).flatMap((nature) => {
    const named = [...new Set(saju.sinsal.stars.filter((star) => star.nature === nature).map((star) => star.ko))];
    return named.length === 0 ? [] : [{ nature, ko: STAR_NATURE_KO[nature], named: named.join(' · ') }];
  });

/**
 * **같은 합이 두 줄로 서지 않게 묶는다** — 세력에 반영하지 않은 천간합.
 *
 * 한 글자를 둘이 물면 합도 둘로 세어진다(쟁합·투합). 그대로 나열하면 「정임합목 —
 * 합이불화」가 두 번 서고, 그것은 문장 층에서 방금 고친 것과 **같은 고장**이다.
 * 이름과 판정이 같은 것은 한 줄로 세우고 자리만 함께 든다.
 *
 * **막은 것도 자리처럼 합친다.** 쟁합으로 두 줄이 된 같은 합은 막은 까닭이 서로 다를
 * 수 있는데(한쪽만 떨어져 있는 경우), 한 줄로 세우면서 한쪽 것만 들면 **안 든 쪽의
 * 까닭이 조용히 사라진다.**
 */
export function boundStemsOf(saju: Saju) {
  return [
    ...saju.analysis.effectiveElements.transformations
      .filter((one) => one.verdict !== 'transformed')
      .reduce((grouped, one) => {
        const key = `${one.ko}:${one.verdict}`;
        const { seats = [], blockers = [] } = grouped.get(key) ?? {};
        grouped.set(key, {
          ko: one.ko,
          verdict: one.verdict,
          seats: [...new Set([...seats, ...one.participants.map((at) => at.position)])],
          blockers: [...new Set([...blockers, ...one.blockers])],
        });
        return grouped;
      }, new Map<string, {
        ko: string;
        verdict: StemTransformation['verdict'];
        seats: PillarPosition[];
        blockers: TransformationBlocker[];
      }>())
      .values(),
  ];
}

/** 세력에 반영하지 않은 육합 */
export const sixCombinationsOf = (saju: Saju) =>
  saju.relations.filter((relation) => relation.kind === 'branchSixCombination');

export const percentOfRatio = (ratio: number) => `${Math.round(ratio * 100)}%`;

/** 국 하나가 옮긴 몫의 줄 — 그 국이 실제로 옮긴 것만 괄호에 적는다 */
export function bureauMoveLine(saju: Saju, bureauKo: string): string | null {
  const moved = saju.analysis.effectiveElements.shifts.filter((shift) => shift.cause === bureauKo);
  if (moved.length === 0) return null;
  return `(${moved.map((shift) => `${shift.from}→${shift.to} ${shift.amount.toFixed(2)}`).join(' · ')})`;
}

/** 천간합이 앉은 자리 — 「년간·월간」 */
export const boundSeatsLine = (seats: readonly PillarPosition[]) =>
  seats.map((seat) => PILLAR_POSITION_KO[seat].replace('주', '간')).join('·');

/**
 * 막은 까닭 — **이 줄이 없으면 판정만 하고 끝난다.** 「합이불화」는 결과의 이름이지 까닭이 아니다.
 * `transformed` 를 걸러 낸 줄이라 `blockers` 는 반드시 하나 이상이다(판정이 그 배열의 길이에서 나온다).
 */
export const blockedLine = (
  verdict: StemTransformation['verdict'],
  blockers: readonly TransformationBlocker[],
) =>
  `천간합은 化했을 때만 옮깁니다(${TRANSFORMATION_VERDICT_KO[verdict]} 자리: ${blockers
    .map((blocker) => TRANSFORMATION_BLOCKER_KO[blocker])
    .join(', ')})`;

/**
 * 그 오행의 개수 몫 — 「1」과 「13%」가 붙어 「113%」로 읽혔다. 괄호가 두 값을 가른다.
 */
export const countShareLine = (count: number, glyphCount: number) => `(${Math.round((count / glyphCount) * 100)}%)`;

/** 뿌리 자리 이름의 첫 글자 — 「년」 · 「일」 */
const seatOf = (position: PillarPosition) => PILLAR_POSITION_KO[position].charAt(0);

/** 일간의 뿌리 줄 */
export const rootsLine = (saju: Saju) =>
  saju.analysis.rootedness.dayMaster.roots
    .map(
      (root) =>
        `${seatOf(root.position)}지 ${root.branch}의 ${root.stem}` +
        `(${HIDDEN_STEM_ROLE_KO[root.role]} ${root.days}일)`,
    )
    .join(' · ');

/** 투출 줄 */
export const emergencesLine = (saju: Saju) =>
  saju.analysis.rootedness.emergences
    .map(
      (emergence) =>
        `${seatOf(emergence.position)}지 ${emergence.branch}의 ${emergence.stem} → ` +
        emergence.revealedAt.map((position) => `${seatOf(position)}간`).join('·'),
    )
    .join(' / ');

/** 신강 기준 — 세력비가 이 값을 넘는가를 그림이 짚는다 */
export const STRENGTH_THRESHOLD = 50;

/** 소수 한 자리 백분율 — 대치 · 종격 칸의 몫 */
export const percent1 = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

/** 관계 표의 첫 칸들 */
export const relationCells = (relation: Relation) => ({
  kind: RELATION_KIND_KO[relation.kind],
  chars: orderedParticipants(relation).map((p) => p.char).join(''),
  seats: orderedParticipants(relation).map((p) => PILLAR_POSITION_KO[p.position].charAt(0)).join('·'),
});

/**
 * 관계 표의 비고 칸 — 있는 것만 값이 선다.
 *
 * 세 글자가 다 모인 삼형은 화살표 하나로 못 적는다 — 고리(`cycle`)로 적고 첫 글자로 되돌아오는 것까지 보인다.
 * 시작점은 고전이 부르는 차례일 뿐이라 "丑이 먼저"라는 뜻이 아니다.
 *
 * 「두 글자」는 '반쪽' 이라고 적던 자리다. `full: false` 의 뜻은 그대로이고(이 관계가 세 글자 구조에서 둘만 담았다)
 * 낱말만 낡았다 — 삼형 안의 두 글자 형을 따로 내기로 하면서, 바로 위에 未 가 서 있는데도 "반쪽" 이 붙는 자리가 생겼다.
 */
export function relationRemarks(relation: Relation) {
  const arrow = directionParticipantsOf(relation);
  const ordered = orderedParticipants(relation);
  return {
    target: relation.targetElement ? `합화 오행 ${ELEMENT_KO[relation.targetElement]}` : null,
    arrow: arrow
      ? `${arrow.from.char}${subjectParticle(arrow.from.char)} ${arrow.to.char}${objectParticle(arrow.to.char)} 형`
      : null,
    cycle: relation.cycle ? ordered.map((p) => p.char).concat(ordered[0].char).join('→') : null,
    twoLetters: relation.full ? null : '두 글자',
    distance: relation.adjacent ? null : `${relation.distance}칸 떨어짐`,
    contested: relation.contested.length > 0 ? `쟁합 · ${relation.contested[0].over.char}를 두고 다툼` : null,
  };
}

export const ageRangeLabel = (from: number, to: number) =>
  from === to ? `만 ${from}세` : `만 ${from}→${to}세`;

export const koreaMonthDay = (date: Date) => {
  const local = toCivil(date, zoneIntervalAt(date).totalOffsetMinutes);
  return `${local.month}/${local.day}`;
};

/**
 * 이 관계가 **어느 판과 걸렸는가** — 자기 판과 원국은 적지 않는다.
 *
 * 세운·월운 칸은 이제 원국만 놓고 보지 않는다. 세운은 자기를 감싼 대운을, 월운은
 * 그 위에 세운까지 놓고 본다. 종류(`ko`)만 찍으면 **원국과 걸린 것과 대운과 걸린
 * 것이 한 줄로 읽히고**, 그 둘은 같은 무게가 아니다 — 하나는 타고난 판과 걸린
 * 것이고 하나는 십 년만 서는 글자와 걸린 것이다.
 *
 * 원국을 안 적는 것은 그것이 바탕이기 때문이다. 관계 대부분이 원국과 걸리므로
 * 다 적으면 딱지가 배경이 되어 아무것도 가르지 못한다. 여기 딱지가 붙은 줄만
 * 원국 밖의 글자가 낀 것이다.
 */
export function crossedChartsKo(relation: Relation, selfChartId: string): string | null {
  const names = new Set<string>();

  for (const participant of relation.participants) {
    const { chartId } = participant;
    if (chartId === selfChartId || chartId === 'natal') continue;
    names.add(
      chartId.startsWith('decade:') ? '대운' : chartId.startsWith('annual:') ? '세운' : '월운',
    );
  }

  return names.size > 0 ? [...names].join('·') : null;
}

/** 걸친 대운을 한 줄로 — 경계를 넘으면 둘이다 */
export function daeunSpanLabel(spans: readonly DaeunSpan[]): string | null {
  if (spans.length === 0) return null;
  return spans.map((span) => `${span.index}대운`).join('·');
}

/**
 * 걸친 대운이 없는 까닭 — **둘을 가른다.**
 *
 * 앞은 이 사람에 대한 사실이라 그대로 적고, 뒤는 우리가 뽑은 칸 수의 한계라
 * 그렇게 적는다. 하나로 묶으면 우리 표의 한계가 그 사람의 사실처럼 읽힌다.
 */
export const DAEUN_ABSENCE_KO: Record<DaeunAbsence, string> = {
  'before-first': '대운 전',
  'beyond-table': '표 밖',
};

/**
 * 겹침을 **운이 데려온 글자로 묶는다.**
 *
 * 운의 한 자가 원국의 어느 글자와 같으면 그 자리에 걸려 있던 관계가 **통째로** 겹친다 —
 * 대운 寅이 시지 寅과 같아서 다섯 관계가 한꺼번에 겹치는 것이 그것이다. 줄로 풀면 다섯
 * 줄이 한 사실을 다섯 번 말하고, 그러면 파묻힌 줄을 꺼내려고 만든 칸이 다시 목록이 된다.
 *
 * 엔진이 낸 값을 다시 세지 않는다 — `overlaps` 를 **모으기만** 한다.
 */
export function groupOverlaps(
  overlaps: CurrentFortune['overlaps'],
): Map<string, { char: string; seats: PillarPosition[]; names: string[] }> {
  const grouped = new Map<string, { char: string; seats: PillarPosition[]; names: string[] }>();

  for (const overlap of overlaps) {
    const key = `${overlap.from.chartId}:${overlap.from.char}`;
    const found = grouped.get(key) ?? { char: overlap.from.char, seats: [], names: [] };

    grouped.set(key, {
      char: found.char,
      // 자리는 년→시 차례로 — 모은 순서는 관계가 세어진 순서라 사람이 읽는 차례가 아니다.
      seats: [...new Set([...found.seats, ...overlap.natalSeats])].sort(
        (a, b) => PILLAR_POSITIONS.indexOf(a) - PILLAR_POSITIONS.indexOf(b),
      ),
      names: [...new Set([...found.names, overlap.ko])],
    });
  }

  return grouped;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const clockLine = (hour: number, minute: number) => `${pad(hour)}:${pad(minute)}`;

export const signedMinutes = (n: number) => `${round1(n) >= 0 ? '+' : ''}${round1(n)}분`;

/** 요청한 값이 아니라 실제로 적용된 보정에서 읽는다 */
export function appliedBasisOf(saju: Saju): 'trueSolar' | 'localMean' | 'record' {
  const applied = new Set(saju.meta.corrections.map((correction) => correction.kind));
  if (applied.has('equationOfTime')) return 'trueSolar';
  return applied.has('longitude') ? 'localMean' : 'record';
}

/** L3 발화 중 표의 **각주 자리**에 놓는 것 — 목록에 두면 같은 문장이 두 번 찍힌다 */
export const TOPIC_TABLE_FOOTNOTE = 'relation.coverage';

/** 어느 주제의 발화인가 — 표가 든 것은 빼고 목록에 넘긴다 */
export const said = (
  utterances: readonly Utterance[],
  pick: (topic: string) => boolean,
): Utterance[] => utterances.filter((utterance) => pick(utterance.request.topic));

/**
 * 침묵은 **세어서 한 줄로** 알린다.
 *
 * 골든은 침묵을 `×` 한 줄씩 찍는다 — 그래야 "사실이 없다"와 "말하지 않기로 했다"가
 * 따로 보인다. 화면은 그 구분을 읽는 사람에게 물을 일이 아니라서 항목으로 세우지
 * 않지만, **조용히 사라지게 두지도 않는다.** 시각을 아는 사람은 다섯 줄을 보고
 * 모르는 사람은 세 줄을 보는데 왜 둘인지 아무 데도 안 적히면, 그것이야말로 모르는
 * 것을 모른다고 말하지 않는 것이다.
 */
export const silentNoteOf = (utterances: readonly Utterance[]): string | null => {
  const silent = utterances.filter((utterance) => utterance.strength === 'silent');
  if (silent.length === 0) return null;

  return `출생 시각을 몰라 말하지 않은 것이 ${silent.length}가지 있어요.`;
};

/**
 * 조각이 아직 없어 비어 있는 자리는 **화면에 내지 않는다.**
 *
 * 침묵과 다르다. 침묵은 우리가 말하지 않기로 한 것이라 읽는 사람에게 알릴 값이
 * 있지만, 조각 없음은 우리 작업 목록이다(`missingFragmentsOf`). 그것을 사용자에게
 * 보이면 "여기 뭔가 있는데 안 보여준다"로 읽힌다.
 */
export const spokenOf = (utterances: readonly Utterance[]) =>
  utterances.filter((utterance) => utterance.text !== null);

/** 말할 것이 없을 때의 한 줄 */
export const NOTHING_TO_SAY = '이 자리에서 말할 수 있는 것이 없어요.';

/** 이 발화가 표의 줄인가 — 줄은 본문 색으로, 문장은 보조 색으로 선다 */
export const isRowUtterance = (utterance: Utterance) => FRAGMENT_TOPICS[utterance.request.topic].form === 'row';

export type SpokenStrength = Exclude<ClaimStrength, 'silent'>;

/**
 * L3 발화 중 **표가 이미 든 것.**
 *
 * 조립기는 고르지 않는다(`ASSEMBLE_POLICY.selection: 'all-facts-speak'`). 줄이는
 * 것은 화면의 몫인데, 계약이 "줄인다면 그것도 정책 값으로 적는다"고 못박아 두었다.
 * 여기가 그 값이다 — 관계는 종류·글자·자리를 열로 가르는 표가 원국·궁합 양쪽에 이미
 * 있고, 같은 값을 문장 목록에 한 번 더 내면 읽는 사람은 다른 값인 줄 알고 두 번 읽는다.
 *
 * `relation.coverage` 는 버리지 않는다. 두 표의 각주가 각각 손으로 "시주를 몰라
 * 시주가 걸린 관계는 빠져 있습니다"라고 적고 있었는데, 궁합 쪽은 **누구인지를 못
 * 적었다.** 그 자리에 발화를 그대로 놓는다.
 */
export const TOPICS_THE_TABLE_HOLDS: readonly string[] = [
  'relation.present',
  'relation.coverage',
];

/**
 * 발화가 **이미, 그리고 더 낫게** 말하는 궁합 경고.
 *
 * 엔진 경고는 사람을 이름으로 못 부른다 — 이름이 계산에 안 들어가기로 했으므로
 * '두 번째 사람의' 까지다. L3 는 `CompatPerson.label` 을 받아 '지영의' 라고 부르고,
 * 관계 표 각주와 문장 옆이라는 **제자리**에서 말한다.
 *
 * - `hour-unknown-relations` → `relation.coverage` 가 표 각주에서 이름을 부른다.
 * - `hour-unknown-elements` → 없는 오행을 **아예 말하지 않는다**(`absence` 가 잠근다).
 *   경고의 전제("없는 오행이 부풀어 보인다")가 성립하려면 화면이 그것을 보여 주고
 *   있어야 하는데, 이제 보여 주지 않는다.
 *
 * **지우지 않고 걸러 낸다.** 카드째 걷어내면 나중에 생길 다른 경고까지 조용히
 * 사라진다 — 아는 종류만 빼고 모르는 것은 그대로 선다.
 */
const WARNINGS_SAID_BY_UTTERANCES: readonly CompatWarningKind[] = [
  'hour-unknown-relations',
  'hour-unknown-elements',
];

/** 발화가 대신 말하지 않는 경고만 — 화면이 그대로 든다 */
export const warningsToShow = (warnings: readonly CompatWarning[]): CompatWarning[] =>
  warnings.filter((warning) => !WARNINGS_SAID_BY_UTTERANCES.includes(warning.kind));

/** 천간 열의 그림 이름 — 웹의 `app/ui/stem-symbol.tsx` 와 앱의 그림이 같은 낱말을 쓴다(운영자 2026-09-26) */
export const STEM_PICTURE: Record<Stem, string> = {
  甲: '나무',
  乙: '덩굴',
  丙: '햇빛',
  丁: '등불',
  戊: '산',
  己: '밭',
  庚: '강철',
  辛: '보석',
  壬: '바다',
  癸: '빗물',
};
