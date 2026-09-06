import {
  BRANCH_INFO,
  ELEMENT_KO,
  SEASON_KO,
  STEM_INFO,
  type Branch,
  type Stem,
} from '../saju/constants';
import type { ChartEvidence } from '../saju/evidence';

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
export type SummarizedChart = {
  pillars: Pick<ChartEvidence['pillars'], 'year' | 'month' | 'day' | 'hour' | 'dayMaster'> & {
    meta: Pick<ChartEvidence['pillars']['meta'], 'monthTerm' | 'sajuYear'>;
  };
  /** 운을 아예 안 싣는 자료도 있다(Match 동의 범위 밖) — 그때는 이 키가 없다 */
  now?: ChartEvidence['now'] | null;
};

/** 머리를 지을 수 있는 자료 — `Evidence` 도, 잘린 것도 이 모양을 만족한다 */
export type Summarizable = {
  viewedAt: string;
  charts: { a: SummarizedChart; b: SummarizedChart | null };
};

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
    `- 일간 ${dayMaster}(${stem.yinYang === '陽' ? '양' : '음'}·${stem.element}) · 월지 ${month.branch}(${SEASON_KO[monthBranch.season]}) · 절입 ${meta.monthTerm.name} · 사주년 ${meta.sajuYear}`,
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
 * 아무 몸통에나 머리를 끼운다 — **9단계 프롬프트도 같은 자리에 끼운다.**
 *
 * 자리를 찾는 법이 암묵이라 테스트가 잠근다. 프롬프트는 전부 `# 역할` 문단으로 열고
 * 그다음이 `## ` 로 시작하는 절이다 — 그 경계에 끼운다.
 */
export function withSummary(body: string, evidence: Summarizable): string {
  const [role, ...rest] = body.split(/\n\n(?=## )/);

  return [role, summaryOf(evidence), ...rest].join('\n\n');
}
