import { ELEMENT_TONE } from '../element-tone';
import {
  BRANCH_INFO,
  ELEMENTS,
  ELEMENT_KO,
  STEM_INFO,
  type Element,
  type Saju,
} from '@/src/lib/saju';

/**
 * 로그인한 사람이 자기 명식을 보는 카드.
 *
 * 익명 화면의 `PillarChart` 와 **같은 것을 그리지 않는다.** 저쪽은 궁성·지장간·공망까지
 * 펴는 표이고, 여기는 「내 여덟 글자가 무엇이고 어느 기운으로 기울어 있는가」 한 눈이다.
 * 더 보려는 사람은 옆의 「전체 명식 자세히 보기」로 저쪽으로 간다.
 *
 * 그래서 이 카드가 드는 것은 셋뿐이다 — 천간·지지 여덟 글자, 각 글자의 오행, 그리고
 * 그 여덟(또는 여섯) 글자를 그대로 센 오행 분포. 셋 다 **여덟 글자에서 곧장 세어지는
 * 사실**이라, 이 자리에 판정이 서지 않는다.
 *
 * 색은 오행을 가리키지만 혼자 가리키지 않는다 — 글자마다 오행 이름이 함께 서 있다
 * (`app/element-tone.ts`).
 */
export function PillarCard({ label, saju }: { label: string; saju: Saju }) {
  const { pillars } = saju;
  const dayMasterElement = STEM_INFO[pillars.dayMaster].element;
  const dayMasterTone = ELEMENT_TONE[dayMasterElement];

  /** 전통 표기 순서 — 시주가 왼쪽, 년주가 오른쪽 */
  const columns = [
    { key: 'hour', label: '시', period: '말년', pillar: pillars.hour },
    { key: 'day', label: '일', period: '나', pillar: pillars.day },
    { key: 'month', label: '월', period: '청년', pillar: pillars.month },
    { key: 'year', label: '년', period: '초년', pillar: pillars.year },
  ] as const;

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">사주 여덟 글자</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">{label}의 명식</h2>
        </div>
        <p
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${dayMasterTone.border} ${dayMasterTone.surface}`}
        >
          <span className="text-muted">일간</span>
          <span className={`glyph text-base leading-none ${dayMasterTone.text}`}>
            {pillars.dayMaster}
          </span>
          <span>
            {STEM_INFO[pillars.dayMaster].ko} · {ELEMENT_KO[dayMasterElement]}
          </span>
        </p>
      </header>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {columns.map(({ key, label: position, period, pillar }) => (
          <div key={key} className="flex min-w-0 flex-col gap-1.5">
            <p className="text-center text-xs text-muted">
              {position}
              <span className="ml-1 hidden sm:inline">· {period}</span>
            </p>

            {/*
              시각을 모르면 시주가 **아예 없다.** 정오로 메워 午시를 내지 않는다 —
              빈 자리를 빈 자리로 그리는 것이 그 결정의 화면 쪽 절반이다.
            */}
            {pillar === null ? (
              <div className="flex h-full min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-border px-1 text-center">
                <span className="glyph text-2xl text-muted">?</span>
                <span className="mt-1 text-[11px] leading-4 text-muted">시각 모름</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Glyph glyph={pillar.stem} element={STEM_INFO[pillar.stem].element} ko={STEM_INFO[pillar.stem].ko} emphasis={key === 'day'} />
                <Glyph glyph={pillar.branch} element={BRANCH_INFO[pillar.branch].element} ko={BRANCH_INFO[pillar.branch].ko} emphasis={key === 'day'} />
              </div>
            )}
          </div>
        ))}
      </div>

      <ElementBar saju={saju} />
    </section>
  );
}

function Glyph({
  glyph,
  element,
  ko,
  emphasis,
}: {
  glyph: string;
  element: Element;
  ko: string;
  emphasis: boolean;
}) {
  const tone = ELEMENT_TONE[element];

  return (
    <div
      className={`flex flex-col items-center gap-0.5 rounded-xl border py-2.5 ${tone.border} ${tone.surface} ${
        emphasis ? 'ring-2 ring-foreground/15 ring-offset-2 ring-offset-surface' : ''
      }`}
    >
      <span className={`glyph text-3xl font-semibold leading-none ${tone.text}`}>{glyph}</span>
      <span className="text-[10px] leading-4 text-muted">
        {ko}
        <span className="ml-0.5">{ELEMENT_KO[element]}</span>
      </span>
    </div>
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
        <p className="text-[11px] text-muted">
          {glyphCount === 8 ? '여덟' : '여섯'} 글자를 그대로 셌습니다
          {glyphCount !== 8 && <span> · 시주 제외</span>}
        </p>
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
