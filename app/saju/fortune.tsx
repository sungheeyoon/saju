import {
  CARD,
} from '../card';
import {
  DAEUN_DIRECTION_KO,
  PILLAR_POSITIONS,
  PILLAR_POSITION_KO,
  TEN_GOD_KO,
  TWELVE_SPIRIT_ALIAS,
  TWELVE_SPIRIT_KO,
  TWELVE_STAGE_KO,
  toCivil,
  zoneIntervalAt,
  type CurrentFortune,
  type DaeunAbsence,
  type DaeunSpan,
  type PillarPosition,
  type Relation,
  type Saju,
} from '@/src/lib/saju';
import {
  HorizontalScrollHint,
  relationKey,
  round1,
  subjectParticle,
} from './shared';

const ageRangeLabel = (from: number, to: number) =>
  from === to ? `만 ${from}세` : `만 ${from}→${to}세`;

const koreaMonthDay = (date: Date) => {
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
function crossedChartsKo(relation: Relation, selfChartId: string): string | null {
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
function daeunSpanLabel(spans: readonly DaeunSpan[]): string | null {
  if (spans.length === 0) return null;
  return spans.map((span) => `${span.index}대운`).join('·');
}


/**
 * 걸친 대운이 없는 까닭 — **둘을 가른다.**
 *
 * 앞은 이 사람에 대한 사실이라 그대로 적고, 뒤는 우리가 뽑은 칸 수의 한계라
 * 그렇게 적는다. 하나로 묶으면 우리 표의 한계가 그 사람의 사실처럼 읽힌다.
 */
const DAEUN_ABSENCE_KO: Record<DaeunAbsence, string> = {
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
function groupOverlaps(
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

/**
 * 지금의 운이 **원국의 같은 자리를 다시 밟는 것** — 카드 하나가 이 칸만 남았다.
 *
 * 「지금의 운」 카드가 여기 있었다. 지금 도는 대운·세운·월운을 짚고, 그것이 원국과 맺는
 * 관계를 문장으로 폈다. 그중 **어느 운이 도는가는 아래 표가 이미 짚는다** — 표마다 지금
 * 칸에 표시가 붙는다. 같은 사실을 두 번 말하는 자리였다.
 *
 * 이 칸만 다르다. **여기서만 말하는 사실**이다.
 *
 * 원국에 이미 인신충이 있는 사람에게 이번 달 申이 또 오면, 그 달은 「새 충 하나」가
 * 아니라 **같은 자리를 두 번째로 치는 달**이다. 두 사실은 아래 표 안에 다 있지만 서로
 * 다른 줄에 있고, 줄이 스물에 가까우면 사람도 모델도 그 짝을 못 맞춘다.
 *
 * 엔진이 세어 준 것만 세운다(`now.overlaps`) — 화면이 다시 맞추면 표와 이 칸이 어긋나는
 * 날 어느 쪽이 맞는지 알 수 없다. 겹칠 것이 없으면 **아무것도 안 세운다.**
 */
export function NowOverlaps({ now }: { now: CurrentFortune }) {
  if (now.overlaps.length === 0) return null;

  return (
    <section className={CARD}>
      <h2 className="text-base font-semibold">지금이 원국의 같은 자리를 다시 밟는 것</h2>
      {/*
        **글자로 묶는다.** 운이 데려온 한 자가 원국의 어느 글자와 같으면 그 자리의
        관계가 통째로 겹치므로, 줄로 풀면 다섯 줄이 한 사실을 다섯 번 말한다. 겹치게
        만든 것은 그 **한 자**이고, 무엇이 겹쳤는지는 그 옆에 이름으로 선다.
      */}
      <ul className="mt-3 flex flex-col gap-1.5 text-sm">
        {[...groupOverlaps(now.overlaps)].map(([key, group]) => (
          <li key={key} className="flex flex-wrap items-baseline gap-x-2">
            <span className="glyph font-medium">{group.char}</span>
            <span className="text-secondary">
              {subjectParticle(group.char)} 원국{' '}
              {group.seats.map((seat) => PILLAR_POSITION_KO[seat]).join('·')}의 같은 자리를
              다시 밟습니다 —{' '}
              <span className="text-foreground">{group.names.join(' · ')}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        새로 센 것이 아니라 아래 표와 원국의 관계 표를 맞춰 본 것입니다 — 같은 종류가 같은
        자리에 다시 걸린 것만 셉니다.
      </p>
    </section>
  );
}


/**
 * 세운 — 해마다의 간지.
 *
 * 대운 표와 같은 모양으로 늘어놓되, 세운은 **원국·대운과 무엇을 하는가**가 본론이라
 * 관계를 칸 아래에 함께 적는다. 그 관계는 원국 안에서 닫힌 것을 뺀 것이다 —
 * 그건 해마다 같아서 세운 칸에 적을 이유가 없다.
 *
 * 해의 경계는 입춘이다. 1월에 일어난 일은 아직 전 해의 세운이라, 각 칸에
 * 입춘 날짜를 적어 둔다.
 */
export function SaeunTable({ saju, now }: { saju: Saju; now: CurrentFortune }) {
  const { entries } = saju.saeun;
  // 절입 시각을 여기서 다시 견주지 않는다 — 지금이 어느 해인지는 현재운이 이미 짚었다.
  // 그 해가 이 표 밖이면 어느 줄도 강조되지 않고, 그것이 맞는 답이다.
  const currentChartId = now.saeun.chartId;

  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">세운</h2>
        <p className="text-sm text-secondary">
          {entries[0].year}년 ~ {entries[entries.length - 1].year}년
        </p>
      </div>

      <p className="mt-1.5 text-xs text-secondary">
        해의 경계는 입춘입니다. 양력 1월에 일어난 일은 아직 전 해의 세운입니다.
      </p>

      <div className="mt-4 snap-x snap-proximity overflow-x-auto">
        <table className="w-full min-w-[52rem] table-fixed border-collapse text-center">
          <caption className="sr-only">해마다의 간지와 원국·대운과의 관계</caption>
          <thead>
            <tr>
              {entries.map((entry) => {
                const current = entry.chartId === currentChartId;
                return (
                  <th
                    key={entry.year}
                    className={`px-1 pb-2 text-xs font-normal ${current ? 'text-accent' : 'text-secondary'}`}
                  >
                    {entry.year}
                    {current && <span className="ml-1 text-[10px] font-medium">현재</span>}
                    <span className="block text-[11px] text-muted">
                      {ageRangeLabel(entry.ageAtStart, entry.ageAtEnd)}
                    </span>
                    {/*
                      그 해가 어느 대운 안에 있는가. 아래 관계 목록이 대운과 걸린 것을
                      함께 내므로, 어느 대운인지가 여기 없으면 딱지만 있고 대상이 없다.
                      한 해가 대운 경계를 넘으면 둘이 적힌다 — 실제로 두 대운이 지난다.
                    */}
                    <span className="block text-[10px] text-muted">
                      {daeunSpanLabel(entry.daeunSpans) ??
                        (entry.daeunAbsence ? DAEUN_ABSENCE_KO[entry.daeunAbsence] : '')}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              {entries.map((entry) => {
                const current = entry.chartId === currentChartId;
                return (
                  <td key={entry.year} className="snap-start px-1 align-top">
                    <div
                      className={`mx-auto flex min-h-[7.25rem] w-full max-w-24 flex-col items-center gap-0.5 rounded-lg border py-2.5 ${
                        current
                          ? 'border-accent bg-accent-wash'
                          : 'border-border bg-surface-sunken'
                      }`}
                    >
                    <span className="text-[10px] text-muted">
                      {TEN_GOD_KO[entry.tenGods.stem]}
                    </span>
                    <span className="glyph text-2xl leading-none">{entry.pillar.stem}</span>
                    <span className="glyph text-2xl leading-none">{entry.pillar.branch}</span>
                    <span className="text-[10px] text-muted">
                      {TEN_GOD_KO[entry.tenGods.branch]}
                    </span>
                    <span className="mt-1 text-[11px] text-secondary">
                      {TWELVE_STAGE_KO[entry.stage]}
                    </span>
                    <span className="text-[10px] text-muted">
                      {TWELVE_SPIRIT_ALIAS[entry.spirits.year] ??
                        TWELVE_SPIRIT_KO[entry.spirits.year]}
                    </span>
                    </div>

                    <ul className="mt-1.5 flex flex-col gap-0.5 text-[10px] text-secondary">
                      {entry.relations.map((relation) => {
                        const crossed = crossedChartsKo(relation, entry.chartId);
                        return (
                          <li key={relationKey(relation)}>
                            {relation.ko}
                            {/*
                              딱지가 둘 붙을 수 있다 — '사유축 금국 대운 합쳐서' 는 어디까지가
                              관계 이름인지 읽히지 않는다. 가운뎃점이 그것을 가른다.
                            */}
                            {crossed !== null && <span className="text-muted"> · {crossed}</span>}
                            {relation.scope === 'combinedFormation' && (
                              <span className="text-muted"> · 합쳐서</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <HorizontalScrollHint />

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        칸 안은 위에서부터 천간 십성 · 간지 · 지지 십성 · 12운성(일간 기준) ·
        12신살(년지 기준)입니다. 아래 목록은 그 해가{' '}
        <strong className="font-medium">원국과 그 해를 감싼 대운</strong>에 대해 맺는
        관계로, 원국 안에서만 성립하는 관계와 원국·대운 사이의 관계는 뺐습니다.
        대운과 걸린 줄에는 <span className="text-secondary">대운</span> 딱지가 붙습니다.
        머리의 <span className="text-secondary">N대운</span>은 그 해가 지나는
        대운이고, 대운 경계를 넘는 해에는 둘이 적힙니다.
      </p>
    </section>
  );
}


/**
 * 월운 — 한 해의 열두 달.
 *
 * 세운 표와 같은 모양이되 경계가 다르다. 달력 월이 아니라 절입이라, 각 칸에
 * 그 달이 시작되는 절과 날짜를 적는다 — 3월 3일이 아직 인월이라는 것이
 * 월운에서 가장 자주 어긋나는 지점이다.
 */
export function WolunTable({ saju, now }: { saju: Saju; now: CurrentFortune }) {
  const { year, entries } = saju.wolun;
  const currentChartId = now.wolun.chartId;

  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">월운</h2>
        <p className="text-sm text-secondary">{year}년 (사주년)</p>
      </div>

      <p className="mt-1.5 text-xs text-secondary">
        경계는 절입입니다. 달력 월이 아니라 절기가 달을 가릅니다 — 3월 초 경칩
        전까지는 아직 인월(寅月)입니다.
      </p>

      <div className="mt-4 snap-x snap-proximity overflow-x-auto">
        <table className="w-full min-w-[60rem] table-fixed border-collapse text-center">
          <caption className="sr-only">한 해 열두 달의 간지와 원국·세운과의 관계</caption>
          <thead>
            <tr>
              {entries.map((entry) => (
                <th
                  key={entry.chartId}
                  className={`px-1 pb-2 text-xs font-normal ${
                    entry.chartId === currentChartId ? 'text-accent' : 'text-secondary'
                  }`}
                >
                  {entry.startTerm.name}
                  {entry.chartId === currentChartId && (
                    <span className="ml-1 text-[10px] font-medium">현재</span>
                  )}
                  <span className="block text-[11px] text-muted">
                    {koreaMonthDay(entry.startTerm.date)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {entries.map((entry) => (
                <td key={entry.chartId} className="snap-start px-1 align-top">
                  <div
                    className={`mx-auto flex min-h-[7.25rem] w-full max-w-24 flex-col items-center gap-0.5 rounded-lg border py-2.5 ${
                      entry.chartId === currentChartId
                        ? 'border-accent bg-accent-wash'
                        : 'border-border bg-surface-sunken'
                    }`}
                  >
                    <span className="text-[10px] text-muted">
                      {TEN_GOD_KO[entry.tenGods.stem]}
                    </span>
                    <span className="glyph text-2xl leading-none">{entry.pillar.stem}</span>
                    <span className="glyph text-2xl leading-none">{entry.pillar.branch}</span>
                    <span className="text-[10px] text-muted">
                      {TEN_GOD_KO[entry.tenGods.branch]}
                    </span>
                    <span className="mt-1 text-[11px] text-secondary">
                      {TWELVE_STAGE_KO[entry.stage]}
                    </span>
                  </div>

                  <ul className="mt-1.5 flex flex-col gap-0.5 text-[10px] text-secondary">
                    {entry.relations.map((relation) => {
                      const crossed = crossedChartsKo(relation, entry.chartId);
                      return (
                        <li key={relationKey(relation)}>
                          {relation.ko}
                          {crossed !== null && <span className="text-muted"> · {crossed}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <HorizontalScrollHint />

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        아래 목록은 그 달이 <strong className="font-medium">원국과 세운과 대운</strong>에
        대해 맺는 관계입니다. 그 달이 끼지 않은 관계는 빼두었습니다 — 원국 안에서
        닫힌 것도, 원국·세운·대운끼리의 것도 여기 적을 이유가 없습니다. 원국 밖의
        글자가 낀 줄에는 <span className="text-secondary">세운</span>·
        <span className="text-secondary">대운</span> 딱지가 붙습니다.
      </p>
    </section>
  );
}


/**
 * 대운 — 10년마다 갈아입는 간지. 시간 순서가 있으므로 가로로 늘어놓는다.
 *
 * 나이는 만 나이(출생일로부터의 경과 연수)다. 세는나이로 적는 만세력과는
 * 한 살 차이가 나므로 화면에 밝혀 둔다.
 */
export function DaeunTable({ saju, now }: { saju: Saju; now: CurrentFortune }) {
  const { daeun } = saju;
  const currentChartId = now.daeun?.chartId;

  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">대운</h2>
        <p className="text-sm">
          <span className="font-medium">{DAEUN_DIRECTION_KO[daeun.direction]}</span>
          <span className="mx-1.5 text-muted">·</span>
          대운수 <span className="tabular-nums font-medium">{daeun.startAge}</span>
          {daeun.approximate && <span className="ml-1.5 text-xs text-muted">근사</span>}
        </p>
      </div>

      <p className="mt-1.5 text-xs text-secondary">
        {daeun.directionReason} {daeun.boundaryTerm.name} 절입까지{' '}
        {round1(daeun.daysToBoundary)}일이라 3으로 나눠 {round1(daeun.startAgeExact)}년입니다.
      </p>

      <div className="mt-4 snap-x snap-proximity overflow-x-auto">
        <table className="w-full min-w-[52rem] table-fixed border-collapse text-center">
          <caption className="sr-only">10년 단위 대운의 간지와 원국과의 관계</caption>
          <thead>
            <tr>
              {daeun.entries.map((entry) => {
                const current = entry.chartId === currentChartId;
                return (
                  <th
                    key={entry.chartId}
                    className={`px-1 pb-2 text-xs font-normal ${current ? 'text-accent' : 'text-secondary'}`}
                  >
                    {entry.startAge}세
                    {current && <span className="ml-1 text-[10px] font-medium">현재</span>}
                    <span className="block text-[11px] text-muted">{entry.startYear}년</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              {daeun.entries.map((entry) => {
                const current = entry.chartId === currentChartId;
                return (
                  <td key={entry.chartId} className="snap-start px-1 align-top">
                    <div
                      className={`mx-auto flex min-h-[7.25rem] w-full max-w-24 flex-col items-center gap-0.5 rounded-lg border py-2.5 ${
                        current ? 'border-accent bg-accent-wash' : 'border-border bg-surface-sunken'
                      }`}
                    >
                      <span className="text-[10px] text-muted">
                        {TEN_GOD_KO[entry.tenGods.stem]}
                      </span>
                      <span className="glyph text-2xl leading-none">{entry.pillar.stem}</span>
                      <span className="glyph text-2xl leading-none">{entry.pillar.branch}</span>
                      <span className="text-[10px] text-muted">
                        {TEN_GOD_KO[entry.tenGods.branch]}
                      </span>
                      <span className="mt-1 text-[11px] text-secondary">
                        {TWELVE_STAGE_KO[entry.stage]}
                      </span>
                      <span className="text-[10px] text-muted">
                        {TWELVE_SPIRIT_ALIAS[entry.spirits.year] ??
                          TWELVE_SPIRIT_KO[entry.spirits.year]}
                      </span>
                    </div>

                    <ul className="mt-1.5 flex flex-col gap-0.5 text-[10px] text-secondary">
                      {entry.relations.map((relation) => (
                        <li key={relationKey(relation)}>
                          {relation.ko}
                          {relation.scope === 'combinedFormation' && (
                            <span className="text-muted"> 합쳐서</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <HorizontalScrollHint />

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        칸 안은 위에서부터 천간 십성 · 간지 · 지지 십성 · 12운성(일간 기준) ·
        12신살(년지 기준)입니다. 아래 목록은 그 대운이 원국과 맺는 관계입니다.{' '}
        <strong className="font-medium">세운·월운과 걸리는 것은 세운·월운 표에 있습니다</strong>{' '}
        — 한 칸이 열 해라 함께 놓을 세운이 하나가 아니어서, 좁은 쪽이 자기를 감싼 대운을
        듭니다. 나이는 만 나이입니다.
        {daeun.approximate && ' 출생 시각을 몰라 정오 기준으로 계산해 대운수가 두어 달 흔들립니다.'}
      </p>
    </section>
  );
}
