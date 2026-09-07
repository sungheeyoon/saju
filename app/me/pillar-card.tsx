import { ELEMENT_TONE } from '../element-tone';
import { CARD } from '../card';
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
 * 핵심 표에는 여덟 글자와 오행·십성·일간과 일지의 자리를 함께 두고, 그 아래에는
 * 여덟(또는 여섯) 글자를 그대로 센 오행 분포만 둔다. 지장간·운성·신살처럼 설명이
 * 필요한 상세값은 이어 보기에서 다루므로 홈 카드가 결과 전체를 되풀이하지 않는다.
 *
 * 색은 오행을 가리키지만 혼자 가리키지 않는다 — 글자마다 오행 이름이 함께 서 있다
 * (`app/element-tone.ts`).
 */
export function PillarCard({ label, saju }: { label: string; saju: Saju }) {
  const { pillars } = saju;
  const dayMasterElement = STEM_INFO[pillars.dayMaster].element;

  return (
    <section className={`${CARD} flex flex-col`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{label}의 사주팔자</h2>
          <p className="mt-0.5 text-xs text-secondary">위는 천간, 아래는 지지입니다</p>
        </div>
        <p className="rounded-full bg-accent-wash px-3 py-1 text-xs font-medium text-accent">
          일간 <span className="glyph">{pillars.dayMaster}</span> ·{' '}
          {STEM_INFO[pillars.dayMaster].ko}{ELEMENT_KO[dayMasterElement]}
        </p>
      </header>

      <PillarTable saju={saju} />

      <div className="mt-5">
        <ElementBar saju={saju} />
      </div>
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
