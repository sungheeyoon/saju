import type { ReactNode } from 'react';

import { ELEMENT_TONE } from '../element-tone';
import { PillarTable } from '../saju/pillars';
import {
  ELEMENTS,
  ELEMENT_KO,
  STEM_INFO,
  type Saju,
} from '@/src/lib/saju';

/**
 * 로그인한 사람이 자기 명식을 보는 카드.
 *
 * 익명 결과의 `PillarChart` 와 **같은 핵심 표를 그린다.** 저쪽은 그 아래에 궁성·지장간·
 * 공망까지 펴고, 여기는 「내 여덟 글자가 무엇이고 어느 기운으로 기울어 있는가」까지만
 * 보여 준다. 더 보려는 사람은 「전체 명식 자세히 보기」로 저쪽으로 간다.
 *
 * ## 저장한 사람 카드와 **같은 모양으로 선다**
 *
 * 이 화면은 저장한 사람 목록과 같은 것을 보여 주면서 생김새가 달랐다 — 명식 한 벌,
 * 출생 정보 한 벌, 그 사이에 떠 있는 링크 하나가 각자 다른 상자였다. 지금은 한 카드
 * 안에 세 층으로 선다: **누구인가**(일간을 한자 아래에 붙인 머리) · **여덟 글자와
 * 오행·저장된 출생 정보**(본문) · **이어 보는 길**(아래 띠). 고치는 손잡이는 오른쪽 위
 * 모서리로 물러난다.
 *
 * 색은 오행을 가리키지만 혼자 가리키지 않는다 — 글자마다 오행 이름이 함께 서 있다
 * (`app/element-tone.ts`).
 */
export function PillarCard({
  label,
  saju,
  corner,
  details,
  footer,
}: {
  label: string;
  saju: Saju;
  /** 오른쪽 위 모서리에 뜨는 손잡이 — 지금은 「출생 정보 수정」 하나다 */
  corner?: ReactNode;
  /** 저장된 출생 정보 — 판본을 읽는 일은 화면이 하고 카드는 자리만 든다 */
  details?: ReactNode;
  /** 아래 띠 — 이 명식을 이어 보는 길 */
  footer?: ReactNode;
}) {
  const { pillars } = saju;
  const dayMaster = STEM_INFO[pillars.dayMaster];
  const dayTone = ELEMENT_TONE[dayMaster.element];

  return (
    <section className="relative rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="relative p-5 sm:p-6">
        <div className="flex items-start gap-4">
          {/* 일간은 **그 글자 아래에** 붙는다 — 오른쪽 위는 손대는 자리가 쓴다 */}
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <div
              className={`grid size-16 place-items-center rounded-2xl border ${dayTone.border} ${dayTone.surface}`}
              aria-label={`일간 ${pillars.dayMaster}, ${dayMaster.ko}${ELEMENT_KO[dayMaster.element]}`}
            >
              <span className={`glyph text-[2rem] font-bold leading-none ${dayTone.text}`} aria-hidden="true">
                {pillars.dayMaster}
              </span>
            </div>
            <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${dayTone.surface} ${dayTone.text}`}>
              {dayMaster.ko}{ELEMENT_KO[dayMaster.element]} 일간
            </span>
          </div>

          <div className="min-w-0 flex-1 pr-12 pt-0.5">
            <p className="eyebrow">내 사주</p>
            <h2 className="mt-0.5 text-xl font-bold tracking-[-0.03em]">{label}의 사주팔자</h2>
            {/* 그 너머(지장간·공망·운)는 **아래 띠가 말한다** — 같은 말을 카드가 두 번 하지 않는다 */}
            <p className="mt-1.5 text-sm text-secondary">여덟 글자와 오행의 기울기를 봅니다.</p>
          </div>
        </div>

        {/*
          **여는 자리가 누르는 자리 바로 아래다.**

          이 칸이 `{details}` 다음에 있었다. 손잡이는 `absolute` 로 오른쪽 위에 떠
          있으니 **누르는 곳은 카드 머리이고 펴지는 곳은 카드 밑바닥**이었고, 폰에서
          그 사이가 1,100px 이라 눌러도 화면 안에서는 아무 일도 안 일어난 것으로 보였다.
          접힌 칸은 자기를 여는 손잡이 옆에 서야 한다.
        */}
        {corner}

        <PillarTable saju={saju} />

        <div className="mt-5">
          <ElementBar saju={saju} />
        </div>

        {details}
      </div>

      {footer}
    </section>
  );
}

/**
 * 오행 분포 한 줄 — **개수를 그대로 센 것**이다.
 *
 * 지장간을 사령 일수로 편 점수는 여기 서지 않는다. 그 숫자는 「무엇을 세었는가」를
 * 함께 읽어야 뜻이 생기고, 그 설명은 익명 화면의 오행 카드가 이미 들고 있다.
 * 여기서 두 벌을 나란히 두면 어느 쪽이 「내 오행」인지 사용자가 정해야 한다.
 */
function ElementBar({ saju }: { saju: Saju }) {
  const { counts, glyphCount } = saju.analysis.elements;

  /**
   * 막대는 **가장 많은 오행에 맞춰 편다.**
   *
   * 여덟 글자를 분모로 두면 가장 많아 봐야 서넛이라 다섯 막대가 다 같이 낮게 눕고,
   * 그러면 「무엇이 많고 무엇이 없는가」가 눈에 안 들어온다. 옆의 숫자가 실제 개수를
   * 들고 있으므로 높이는 견주기만 하면 된다 — 익명 화면의 오행 막대도 같은 셈이다.
   */
  const tallest = Math.max(...ELEMENTS.map((element) => counts[element]), 1);

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-secondary">오행 분포</p>
        {glyphCount !== 8 && <p className="text-[11px] text-muted">출생 시각을 몰라 시주는 제외했습니다</p>}
      </div>

      <ul className="grid grid-cols-5 gap-1.5">
        {ELEMENTS.map((element) => {
          const tone = ELEMENT_TONE[element];
          const count = counts[element];

          return (
            <li key={element} className="flex flex-col items-center gap-1">
              {/*
                「없다」를 회색으로만 말하지 않는다. 막대가 비어 있는 것과 0 이라고
                적힌 것이 함께 서야, 색을 못 가르는 화면에서도 없는 것이 없어 보인다.
              */}
              <div className="flex h-14 w-full items-end justify-center rounded-lg bg-surface-sunken px-2 py-1">
                <div
                  className={`w-full rounded-sm ${count === 0 ? '' : tone.bar}`}
                  style={{ height: `${(count / tallest) * 100}%` }}
                />
              </div>
              <p className="text-[11px] leading-4 text-secondary">
                <span className={`glyph ${count === 0 ? 'text-muted' : tone.text}`}>{element}</span>{' '}
                {ELEMENT_KO[element]}
              </p>
              <p className={`text-[11px] leading-3 tabular-nums ${count === 0 ? 'text-muted' : 'font-semibold'}`}>
                {count}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
