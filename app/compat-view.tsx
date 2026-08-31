'use client';

import type { ReactNode } from 'react';

import { GENDER_KO, type Compatibility, type CompatSide, type Saju } from '@/src/lib/saju';

import { BetweenSections } from './between-view';
import { CARD } from './card';
import { EvidencePanel } from './evidence-panel';
import { PILLAR_COLUMNS } from './saju-calculator';

/**
 * 궁합 **결과 영역** — 입력을 어디서 받았는지 모른다.
 *
 * 익명 화면은 주소의 `#` 뒤에서 입력을 읽어 브라우저가 계산하고, `/me/compat` 은
 * 저장된 판본 둘을 서버가 읽어 계산한다. **그 차이는 위층에서 끝나야 한다** —
 * 여기까지 내려오면 「저장된 것인가」를 묻는 분기가 결과 화면 곳곳에 생기고,
 * 그러면 같은 두 사람이 어디서 왔느냐에 따라 다른 결과 화면을 보게 된다
 * (ADR 0007 「이행」).
 *
 * 그래서 받는 것은 계산이 끝난 값 셋뿐이다. 어느 화면인지는 `notice` 하나로만
 * 드러난다 — 링크에 무엇이 실리는지가 두 화면에서 서로 다른 사실이라 그렇다.
 *
 * **Match 결과 화면은 이것을 쓰지 않는다.** 여기는 두 명식을 나란히 놓고 근거
 * 패널까지 여는 자리이고, 그쪽은 상대의 `Saju`·`ChartEvidence` 를 받지 않는다
 * (ADR 0010·0012). 관계 참가자를 합쳐 여덟 글자가 드러날 수는 있지만 둘이 함께 쓰는
 * 것은 사이에 대한 칸들뿐이다(`BetweenSections`).
 */

/**
 * 이름을 안 넣었을 때 쓰는 말. 넣으면 이름이 이 자리를 대신한다.
 *
 * "첫 번째 사람의 일지"는 **읽는 사람이 자기를 어디에 놓아야 할지 모른다.**
 * 궁합은 두 사람이 각자 자기 기준으로 읽는 것이라, 관계 한 줄에서 어느 글자가
 * 누구 것인지가 이름으로 붙어야 그 읽기가 가능해진다.
 */
export const SIDE_LABEL: Record<CompatSide, string> = { a: '첫 번째', b: '두 번째' };

export const SIDES: readonly CompatSide[] = ['a', 'b'];

export function CompatView({
  charts,
  compat,
  names,
  viewedAt,
  notice,
  verdict,
  foldFacts,
}: {
  charts: Record<CompatSide, Saju>;
  /** 두 사람을 부르는 말 — 입력한 이름이거나 '첫 번째 사람' */
  names: Record<CompatSide, string>;
  compat: Compatibility;
  /** 결과를 보는 기준 시각(ms) — 넘길 자료가 지금의 운을 이 시각으로 짚는다 */
  viewedAt: number;
  /**
   * 결과 맨 위에 서는 한 줄 — **화면마다 다른 사실을 말한다.**
   *
   * 익명 화면은 링크에 두 사람의 생년월일시가 담긴다고 말해야 하고, `/me/compat`
   * 은 저장된 판본을 본다고 말해야 한다. 둘 다 참인 문장 하나를 지어낼 수 없으므로
   * 여기서 판단하지 않고 받는다.
   */
  notice: ReactNode;
  /**
   * 사실 **아래에 서는 판정** — 화면마다 다른 것이 서는 자리다.
   *
   * 익명 화면에는 `match-v0` 카드가 서고, 로그인 화면에는 저장된 현재 결과가 선다.
   * 둘을 함께 세우지 않는 것이 요점이다 — **한 화면에 점수가 둘이면 사용자가 무엇을
   * 믿을지 정해야 하고**, 그 물음에 우리가 답을 갖고 있지 않다.
   *
   * `notice` 와 같은 규율이다. 화면마다 다른 사실은 여기서 판단하지 않고 받는다.
   */
  verdict: ReactNode;
  /**
   * 사실을 **접어 둘까** — 판정을 먼저 세울까.
   *
   * 익명 화면은 계산기다. 두 명식과 사이의 관계가 곧 결과물이라 그것이 먼저 선다.
   * 로그인 화면은 다르다 — 사람이 보러 온 것은 **읽어 주는 글**이고, 그 앞에 표
   * 스물몇 개를 세워 두면 글까지 내려오지 못한다.
   *
   * 접는 자리를 화면이 따로 그리지 않고 여기서 가르는 이유는 늘 같다. 두 번 그리면
   * 한쪽만 고쳐지고, 그때 두 화면이 서로 다른 것을 감춘다.
   */
  foldFacts?: boolean;
}) {
  const facts = (
    <>
      <ChartPair charts={charts} names={names} />
      <BetweenSections compat={compat} names={names} />
      <EvidencePanel a={charts.a} b={charts.b} viewedAt={viewedAt} />
    </>
  );

  if (foldFacts !== true) {
    return (
      <div className="flex flex-col gap-6">
        {notice}
        <ChartPair charts={charts} names={names} />
        <BetweenSections compat={compat} names={names} />
        {verdict}
        <EvidencePanel a={charts.a} b={charts.b} viewedAt={viewedAt} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {notice}
      {verdict}

      {/*
        **테스트 기간에만 여는 자리.**

        두 명식과 사이의 관계표는 우리가 계산이 맞는지 보려고 세운 것이지 사용자가
        보러 온 것이 아니다. 시험이 끝나면 이 칸은 통째로 내린다 — 그때 지울 것이
        하나이도록 한 덩어리로 접어 둔다.
      */}
      <details className="group rounded-2xl border border-border bg-surface">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold hover:text-accent">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">
              ▶
            </span>
            둘의 명식 보기
          </span>
          <span className="mt-1 block pl-6 text-xs font-normal text-muted">
            여덟 글자와 사이에 걸리는 관계를 자료 그대로 봅니다. 계산을 확인하는 자리입니다.
          </span>
        </summary>
        <div className="flex flex-col gap-6 border-t border-border px-5 py-5">{facts}</div>
      </details>
    </div>
  );
}

/** 두 명식을 나란히 — 여덟 글자만. 자세한 것은 각자의 원국 화면이 보여준다 */
function ChartPair({
  charts,
  names,
}: {
  charts: Record<CompatSide, Saju>;
  names: Record<CompatSide, string>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {SIDES.map((side) => {
        const saju = charts[side];
        return (
          <section key={side} className={CARD}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 className="text-base font-semibold">{names[side]}</h2>
              <span className="text-sm text-secondary">
                일간 {saju.pillars.dayMaster} · {GENDER_KO[saju.meta.gender]}
              </span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-center">
                <thead>
                  <tr>
                    {PILLAR_COLUMNS.map(({ key, label }) => (
                      <th
                        key={key}
                        className={`pb-1 text-xs font-normal ${
                          key === 'day' ? 'text-foreground' : 'text-muted'
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    {PILLAR_COLUMNS.map(({ key }) => {
                      const pillar = saju.pillars[key];
                      return (
                        <td key={key} className="glyph py-2 text-2xl">
                          {pillar ? pillar.name : '—'}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
