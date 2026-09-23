import type { PillarPosition } from '../saju/position';
import { readingBody } from './display';

/**
 * **자리 검사** — 나온 글이 자리를 잘못 이었는가를 기계가 잴 수 있는 만큼만 잰다(G-33).
 *
 * 저장 검사(`checkReading`)가 아니다. 실호출 시험이 자리 색인을 올리기 전과 뒤에 같은 잣대로
 * 재려고 세운 것이고, 운영 파이프라인은 이것을 안 부른다 — 문장 안에서 두 낱말이 함께 서는
 * 것은 오조인일 수도, 맞는 대비일 수도 있어 막는 계약으로 쓰기엔 거칠다.
 *
 * 재는 넷은 9/1 실험의 hard 실패 둘(ADR 0099)과 색인이 새로 연 틈 둘이다.
 * - `wrong-place` — `월지 巳` 처럼 자리와 글자를 함께 적었는데 그 자리의 글자가 아니다
 * - `number-leak` — 목록의 번호(`R3` · `S1`)나 「자리 색인」이 글에 샜다. 번호는 모델에게 준 참조다
 * - `stem-sinsal-with-branch-relation` — 천간에만 걸린 신살과, 같은 기둥 지지의 관계를 한 문장에 묶었다
 * - `partial-as-complete` — 시간 미상인데 세 글자 중 일부인 합을 이뤘다고 단정했다
 */
export type PositionSlip = {
  readonly code: 'wrong-place' | 'number-leak' | 'stem-sinsal-with-branch-relation' | 'partial-as-complete';
  readonly detail: string;
};

type Pillar = { readonly stem: string; readonly branch: string } | null | undefined;

type CheckedChart = {
  readonly pillars: {
    readonly year: Pillar;
    readonly month: Pillar;
    readonly day: Pillar;
    readonly hour: Pillar;
    readonly meta?: { readonly hourKnown?: boolean };
  };
  readonly relations?: readonly {
    readonly tier: string;
    readonly ko: string;
    readonly full: boolean;
    readonly participants: readonly { readonly position: PillarPosition }[];
  }[];
  readonly sinsal?: {
    readonly stars: readonly {
      readonly ko: string;
      readonly hits: readonly { readonly position: PillarPosition; readonly target: string }[];
    }[];
  };
};

type Checked = { readonly charts: { readonly a: CheckedChart; readonly b: CheckedChart | null } };

const PLACE: Record<string, PillarPosition> = { 년: 'year', 월: 'month', 일: 'day', 시: 'hour' };
const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const PLACED = new RegExp(`([년월일시])(간|지)\\s*(?:의\\s*)?([${STEMS}${BRANCHES}])`, 'g');

/** 글을 문장으로 — 마침표 · 물음표 · 느낌표 · 줄바꿈에서 자른다 */
const sentencesOf = (markdown: string): string[] =>
  markdown.split(/(?<=[.!?。])\s+|\n+/).map((one) => one.trim()).filter((one) => one.length > 0);

/**
 * **사용자가 읽는 본문만 잰다**(`readingBody`). 검토용 근거 절(`### 근거`)은 화면에 안 나가고, 그 줄은 한
 * 결론이 기댄 사실을 늘어놓는 목록이지 두 사실을 한 자리에서 겹쳐 읽은 문장이 아니다. 2026-09-23 실호출에서
 * self · person 은 근거 줄 때문에만 잡혔고(본문에는 천덕귀인이 한 번도 안 나왔다), 인연 궁합은 번호를
 * 근거 칸과 점수 줄에만 적었다.
 */
export function positionSlips(output: string, evidence: Checked): PositionSlip[] {
  const markdown = readingBody(output);
  const charts = [evidence.charts.a, evidence.charts.b].filter((one): one is CheckedChart => one !== null);
  const slips: PositionSlip[] = [];

  /* 두 사람이면 글이 A · B 를 어떻게 부를지 모른다 — 그 자리에 둘 중 누구의 글자라도 있으면 맞다 */
  for (const match of markdown.matchAll(PLACED)) {
    const [whole, place, tier, char] = match;
    const position = PLACE[place];
    const found = charts.flatMap((chart) => {
      const pillar = chart.pillars[position];
      return pillar == null ? [] : [tier === '간' ? pillar.stem : pillar.branch];
    });
    if (found.length === 0) continue;
    const ok = found.includes(char);
    if (!ok) slips.push({ code: 'wrong-place', detail: whole });
  }

  for (const leak of markdown.match(/\[[RS]\d+\]|(?<![A-Za-z0-9])[RS]\d{1,2}(?![0-9A-Za-z])|자리 색인/g) ?? []) {
    slips.push({ code: 'number-leak', detail: leak });
  }

  const sentences = sentencesOf(markdown);
  for (const chart of charts) {
    const stemOnly = (chart.sinsal?.stars ?? []).filter(
      (star) => star.hits.length > 0 && star.hits.every((hit) => hit.target === 'stem'),
    );
    const branchRelations = (chart.relations ?? []).filter((relation) => relation.tier === 'branch');
    for (const star of stemOnly) {
      const at = new Set(star.hits.map((hit) => hit.position));
      const joined = branchRelations.filter((relation) =>
        relation.participants.some((participant) => at.has(participant.position)),
      );
      for (const sentence of sentences) {
        if (!sentence.includes(star.ko)) continue;
        const relation = joined.find((one) => sentence.includes(one.ko));
        if (relation !== undefined) {
          slips.push({
            code: 'stem-sinsal-with-branch-relation',
            detail: `${star.ko} + ${relation.ko} — ${sentence}`,
          });
        }
      }
    }

    if (chart.pillars.meta?.hourKnown === false) {
      for (const relation of (chart.relations ?? []).filter((one) => !one.full)) {
        for (const sentence of sentences) {
          if (!sentence.includes(relation.ko)) continue;
          if (/완성|이뤄|이룬|이루|갖춰|갖춘|온전/.test(sentence) && !/일부|절반|아니|않|없/.test(sentence)) {
            slips.push({ code: 'partial-as-complete', detail: `${relation.ko} — ${sentence}` });
          }
        }
      }
    }
  }

  return slips;
}
