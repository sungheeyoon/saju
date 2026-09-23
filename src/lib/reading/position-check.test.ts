import { describe, expect, it } from 'vitest';

import { CITY_LONGITUDES, computeSaju } from '../saju';
import { positionSlips, readingEvidenceOf } from '.';

/** 자리 검사(G-33) — 실호출 시험이 쓰는 잣대를 모델 없이 잰다 */
const VIEWED_AT = new Date('2026-08-23T04:00:00Z');
const A = computeSaju(
  { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, gender: 'male' },
  { longitude: CITY_LONGITUDES.부산, useLongitude: true },
);
const solo = readingEvidenceOf('self', { a: A }, VIEWED_AT).evidence;
const codes = (markdown: string, evidence = solo) => positionSlips(markdown, evidence).map((one) => one.code);

describe('자리 검사', () => {
  it('자리와 글자가 맞으면 아무것도 안 잡는다', () => {
    expect(codes('월지 巳 와 년지 午 가 이어집니다. 월간의 辛 도 봅니다.')).toEqual([]);
  });

  it('그 자리에 없는 글자를 적으면 잡는다', () => {
    expect(codes('월지 午 가 중심입니다.')).toEqual(['wrong-place']);
  });

  it('목록의 번호나 「자리 색인」이 글에 새면 잡는다', () => {
    expect(codes('[R1] 에서 보듯 오미합화가 섭니다. S3 도 있습니다. 자리 색인을 보면')).toEqual([
      'number-leak',
      'number-leak',
      'number-leak',
    ]);
  });

  /* 천덕귀인은 A 의 월간 辛 에만 걸리고, 사오미 화방은 월지 巳 가 든다 — 9/1 실험의 오조인 모양이다 */
  it('천간에만 걸린 신살과 같은 기둥 지지의 관계를 한 문장에 묶으면 잡는다', () => {
    expect(codes('천덕귀인이 사오미 화방의 기운을 받쳐 줍니다.')).toEqual(['stem-sinsal-with-branch-relation']);
    expect(codes('천덕귀인이 있습니다. 사오미 화방도 섭니다.')).toEqual([]);
  });

  /* 검토용 근거 절은 화면에 안 나간다 — 결론이 기댄 사실의 목록이고, 번호를 적어도 사용자에게 안 샌다 */
  it('근거 절은 재지 않는다', () => {
    expect(
      codes(
        '본문입니다.\n\n### 근거\n귀인과 기회 — 결론 「…」 | 자료: charts.a.sinsal.stars 천덕귀인 [사실] · relations R2 사오미 화방 [사실] | 넘어간 것: …',
      ),
    ).toEqual([]);
  });

  it('시간 미상에서 일부만 선 합을 이뤘다고 단정하면 잡는다', () => {
    const hourless = computeSaju({ year: 1991, month: 6, day: 2, hour: null, gender: 'female' });
    const evidence = readingEvidenceOf('self', { a: hourless }, VIEWED_AT).evidence;
    const { a } = evidence.charts;
    const partial = 'relations' in a ? a.relations.find((relation) => !relation.full) : undefined;
    expect(partial, '표본에 일부만 선 합이 있어야 한다').toBeDefined();

    expect(codes(`${partial!.ko}이 완성되어 기운이 모입니다.`, evidence)).toEqual(['partial-as-complete']);
    expect(codes(`${partial!.ko}은 세 글자 중 일부만 선 모양입니다.`, evidence)).toEqual([]);
  });
});
