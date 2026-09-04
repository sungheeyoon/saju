'use client';

import type { ReactNode } from 'react';

import { GENDER_KO, type Compatibility, type CompatSide, type Saju } from '@/src/lib/saju';

import { BetweenSections } from './between-view';
import { CARD } from './card';

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
 * **Match 결과 화면은 이것을 쓰지 않는다.** 여기는 두 명식을 나란히 놓는 자리이고,
 * 그쪽은 상대의 `Saju` 를 받지 않는다(ADR 0010·0012). 관계 참가자를 합쳐 여덟 글자가
 * 드러날 수는 있지만 둘이 함께 쓰는 것은 사이에 대한 칸들뿐이다(`BetweenSections`).
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
  notice,
  verdict,
  analysis,
}: {
  charts: Record<CompatSide, Saju>;
  /** 두 사람을 부르는 말 — 입력한 이름이거나 '첫 번째 사람' */
  names: Record<CompatSide, string>;
  compat: Compatibility;
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
   * 분석 표를 **어떻게 두는가** — 접어 두는가, 아예 안 세우는가.
   *
   * ## 갈리는 것은 화면이 아니라 화면 안의 무엇인가다
   *
   * 두 종류가 섞여 있다(ADR 0035).
   *
   * - **사용자 것** — 두 사람의 여덟 글자, 오행이 서로를 어떻게 채우는지,
   *   사이를 묻는 칸, 저장해서 풀이로 가는 다리
   * - **우리 것** — 관계 표와 그 표에서 세운 발화. 프롬프트와 근거를 손보면서
   *   무엇이 나왔는지 대조하는 **엔진 중간 결과**다
   *
   * 사용자 앞에 표 스물몇 개가 먼저 서면 아래로 못 내려간다. 그래서 우리 것은
   * 먼저 서지 않는다 — 다만 **두 화면이 하는 일이 달라서 방식이 갈린다.**
   *
   * - `folded` — 익명 화면(`/compat`). 계산기이고, 우리도 여기서 두 결과를 나란히
   *   놓고 본다. 없애면 그 자리를 잃으므로 **접는다.** 펴면 그대로 다 나온다
   * - `hidden` — 저장한 두 사람 화면(`/me/compat`). 사람이 보러 온 것은 읽어 주는
   *   글이고, 접은 칸도 그 앞에 「펼치면 뭔가 더 있다」는 자리를 하나 만든다
   *   (ADR 0025). 여덟 글자는 그대로 선다 — 이 화면은 글을 만들기 **전에** 서는
   *   만세력이기 때문이다(ADR 0036)
   *
   * **기본값을 두지 않는다.** 없으면 새로 생기는 화면이 아무 말 없이 다 펼친 쪽에
   * 선다. 가르는 자리를 화면이 따로 그리지 않고 여기 두는 이유도 같다 — 두 번
   * 그리면 한쪽만 고쳐지고, 그때 두 화면이 서로 다른 것을 감춘다.
   *
   * **숨김 뒤에 자격을 걸지 않는다.** 이건 보안이 아니라 편집이다. 접힌 자료는
   * 응답에 그대로 실린다 — 자르는 것이 아니다.
   */
  analysis: 'folded' | 'hidden';
}) {
  return (
    <div className="flex flex-col gap-6">
      {notice}
      <ChartPair charts={charts} names={names} />
      {analysis === 'folded' && <FoldedAnalysis compat={compat} names={names} />}
      {verdict}
    </div>
  );
}

/**
 * 접어 둔 분석 — **기본은 접힘이고, 펴면 그대로 다 나온다.**
 *
 * 접이칸이 제 이름으로 무엇이 들었는지 말한다. 「계산을 확인하는 자리입니다」처럼
 * **자기 용도를 적지 않는다** — 그 문장이 붙어 있던 칸은 사용자에게 「내가 볼 것이
 * 아니다」로 읽혔고, 그러면 접어 둔 뜻이 아니라 치워 둔 뜻이 된다.
 *
 * 딱지를 마크업으로만 재는 검사는 태그 한 겹에 조용히 0을 내므로, e2e 는 이 칸을
 * **실제로 눌러** 안에 든 것을 본다.
 */
function FoldedAnalysis({
  compat,
  names,
}: {
  compat: Compatibility;
  names: Record<CompatSide, string>;
}) {
  return (
    <details className="group">
      {/*
        **마커를 우리가 그린다.** `display` 를 `list-item` 이 아닌 값으로 주면 브라우저가
        기본 삼각형을 지우고, 그러면 눌러야 하는 자리인지가 화면에 안 남는다. 펼침
        상태는 `<summary>` 가 스스로 알리므로 이 글자는 화면에만 선다.
      */}
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-border bg-surface-sunken px-5 py-4 hover:border-accent [&::-webkit-details-marker]:hidden">
        <span>
          <span className="text-base font-semibold">두 원국을 맞대어 본 표</span>
          <span className="mt-0.5 block text-xs leading-5 text-muted">
            사이에 걸리는 관계와, 그 표에서 말할 수 있는 것.
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-sm text-secondary">
          <span className="group-open:hidden">펼치기</span>
          <span className="hidden group-open:inline">접기</span>
        </span>
      </summary>

      <div className="mt-6 flex flex-col gap-6">
        <BetweenSections compat={compat} names={names} />
      </div>
    </details>
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
