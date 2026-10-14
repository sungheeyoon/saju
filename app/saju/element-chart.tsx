import {
  ELEMENT_TONE,
} from '../ui/element-tone';
import {
  ELEMENTS,
  ELEMENT_KO,
  PILLAR_POSITION_KO,
  TRANSFORMATION_BLOCKER_KO,
  TRANSFORMATION_VERDICT_KO,
  type PillarPosition,
  type Saju,
  type StemTransformation,
  type TransformationBlocker,
} from '@/src/lib/saju';
import {
  SectionTitle,
} from './fold';
import {
  ElementSymbol,
} from '../ui/element-symbol';
import { CARD } from '../ui/surfaces';


/**
 * 무엇이 세력을 옮겼고 무엇은 안 옮겼는가 — **한 줄로 선다.**
 *
 * 강약·억부·종격·격국·통관이 전부 **옮긴 뒤의 분포**에서 세력을 잰다. 그런데 무엇이
 * 옮겼는지는 유도 문장 여러 줄에 흩어져 있어서, 「왜 이 합은 반영하고 저 합은 안
 * 했나」를 알려면 그 줄을 다 읽고 역추적해야 했다.
 *
 * **옮기는 축은 국(局) 하나다.** 삼합·방합 계열만 무게를 기울인다 — 육합은 두 글자가
 * 묶이는 관계이지 세력을 만드는 축이 아니고, 천간합은 化했을 때만 옮긴다. 그 갈림을
 * 여기서 한 번에 보인다.
 *
 * 몫의 근거도 같은 줄에 적는다. 25% 는 자료에 맞춰 고른 값이 아니라 **완성된 국의
 * 절반**이고, 세 등급의 간격을 2배로 고정한 데서 나온다(`BUREAU_POLICY.pull`) — 등급
 * 사이의 비를 먼저 정하고 자료를 본다는 규율이다.
 */
function WeightShifts({ saju }: { saju: Saju }) {
  const { bureaus, effectiveElements } = saju.analysis;
  const { transformations, shifts } = effectiveElements;

  /*
    **같은 합이 두 줄로 서지 않게 묶는다.**

    한 글자를 둘이 물면 합도 둘로 세어진다(쟁합·투합). 그대로 나열하면 「정임합목 —
    합이불화」가 두 번 서고, 그것은 문장 층에서 방금 고친 것과 **같은 고장**이다.
    이름과 판정이 같은 것은 한 줄로 세우고 자리만 함께 든다.

    **막은 것도 자리처럼 합친다.** 쟁합으로 두 줄이 된 같은 합은 막은 까닭이 서로 다를
    수 있는데(한쪽만 떨어져 있는 경우), 한 줄로 세우면서 한쪽 것만 들면 **안 든 쪽의
    까닭이 조용히 사라진다.**
  */
  const boundStems = [
    ...transformations
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
  const sixCombinations = saju.relations.filter(
    (relation) => relation.kind === 'branchSixCombination',
  );

  if (bureaus.length === 0 && boundStems.length === 0 && sixCombinations.length === 0) return null;

  const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

  return (
    /*
      **접는다.** 이 칸이 답하는 것은 「왜 이 숫자냐」이고, 그것은 표를 보다가 걸렸을 때
      찾는 물음이지 표를 열자마자 하는 물음이 아니다. 접은 칸도 자리를 하나 만들지만
      (ADR 0025), 여기서는 그 자리 하나가 스무 줄보다 싸다.

      **머리의 눌리는 높이는 44px 이고 자리는 전과 같다.** 글자 한 줄(20px)이던 머리를 `min-h-11`
      로 키우고 위아래 `-my-3` 으로 그만큼을 돌려준다 — 위의 `pt-3` 과 아래 판 사이로 내밀 뿐,
      글자와 판은 한 픽셀도 안 움직인다.
    */
    <details className="group mt-4 border-t border-border pt-3">
      <summary className="relative -my-3 flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="text-xs text-muted transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        세력에 반영한 합과 안 한 합
      </summary>

      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {bureaus.map((bureau) => {
          const moved = shifts.filter((shift) => shift.cause === bureau.ko);
          return (
            <li key={`${bureau.kind}-${bureau.element}`} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-accent">반영</span>
              <span className="font-medium">{bureau.ko}</span>
              <span className="text-secondary">
                → <span className="glyph">{bureau.element}</span> {ELEMENT_KO[bureau.element]}{' '}
                {percent(bureau.pull)} 만큼 기울임
                {moved.length > 0 && (
                  <span className="text-muted">
                    {' '}
                    ({moved
                      .map((shift) => `${shift.from}→${shift.to} ${shift.amount.toFixed(2)}`)
                      .join(' · ')})
                  </span>
                )}
              </span>
            </li>
          );
        })}

        {boundStems.map((transformation) => (
          <li key={`${transformation.ko}-${transformation.verdict}`} className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-muted">안 함</span>
            <span className="font-medium">{transformation.ko}</span>
            <span className="text-secondary">
              {transformation.seats.map((seat) => PILLAR_POSITION_KO[seat].replace('주', '간')).join('·')}
              {' '}— 천간합은 化했을 때만 옮깁니다({TRANSFORMATION_VERDICT_KO[transformation.verdict]} 자리:{' '}
              {/*
                **막은 까닭이 여기 서지 않으면 이 줄은 판정만 하고 끝난다.** 「합이불화」는
                결과의 이름이지 까닭이 아니라서, 그것만 읽은 사람은 왜 이 합은 안 옮겼고
                저 합은 옮겼는지를 여전히 역추적해야 한다 — 이 카드가 없애려던 바로 그 일이다.

                `transformed` 를 걸러 낸 줄이라 `blockers` 는 반드시 하나 이상이다
                (판정이 그 배열의 길이에서 나온다).
              */}
              {transformation.blockers
                .map((blocker) => TRANSFORMATION_BLOCKER_KO[blocker])
                .join(', ')})
            </span>
          </li>
        ))}

        {sixCombinations.length > 0 && (
          <li className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-muted">안 함</span>
            <span className="font-medium">
              {sixCombinations.map((relation) => relation.ko).join(' · ')}
            </span>
            <span className="text-secondary">
              육합은 두 글자가 묶이는 관계이지 세력을 만드는 국(局)이 아닙니다
            </span>
          </li>
        )}
      </ul>

      <p className="mt-2 text-xs text-muted">
        무게를 기울이는 것은 <strong className="font-medium">국(삼합·방합) 하나</strong>입니다.
        몫은 완성된 국이 절반(50%), 왕지를 낀 두 글자가 그 절반(25%), 왕지가 빠진 붙은 두
        글자가 다시 그 절반(12.5%) — <strong className="font-medium">자료에 맞춰 고른 값이
        아니라</strong> 등급 사이의 비(2배)를 먼저 정하고 나온 이 엔진의 실험값입니다. 월령을
        잡았거나 화신이 투간했으면 깎지 않고, 왕지가 충을 맞으면 절반으로 깎습니다.
        글자를 바꾸지는 않습니다 — 辰이 수국에 들어도 그 안의 土가 0 이 되지는 않습니다.
      </p>
    </details>
  );
}


/**
 * 오행 분포 — 크기 비교가 일이므로 단일 색조 막대.
 * 값을 전부 옆에 적으므로 표 역할도 겸한다(툴팁 불필요).
 */
export function ElementChart({ saju }: { saju: Saju }) {
  const { counts, scores, ratios, missing, strongest, glyphCount } = saju.analysis.elements;
  const max = Math.max(...ELEMENTS.map((e) => ratios[e]), 0.0001);

  return (
    <section className={CARD}>
      <SectionTitle>오행 분포</SectionTitle>
      {/*
        **여기는 설명하는 자리가 아니라 자료를 내는 자리다.**

        문단 둘이 서 있었다. 하나는 세 열이 무엇인지, 하나는 딱지 둘의 범례였다. 그중
        범례는 **딱지를 옮겨서** 없앴다 — 「필요」는 억부가 가리키는 방향이라 이 표가
        아니라 용신 칸의 값이고, 거기서는 옆에 선 후보가 그 뜻을 말해 준다.
        「최강」은 낱말이 스스로 말한다.

        열 이름은 한 줄로 남긴다. 「점수 1.10」이 무엇인지 모르면 그 칸은 자료가 아니라
        정체 모를 수다 — 자를 밝히는 것은 설명이 아니다.
      */}
      <p className="mt-1 mb-4 text-xs text-secondary">
        개수는 {glyphCount === 8 ? '여덟' : '여섯'} 글자, 점수는 지장간까지 편 값입니다
        {glyphCount !== 8 && <span className="text-muted"> · 시주 제외</span>}
      </p>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">오행별 개수와 지장간 가중 점수</caption>
        <thead className="text-xs text-muted">
          <tr>
            <th className="pb-1.5 text-left font-normal whitespace-nowrap">오행</th>
            <th className="pb-1.5 pl-3 text-right font-normal whitespace-nowrap">개수</th>
            <th className="pb-1.5 pl-3 text-right font-normal whitespace-nowrap">점수</th>
            <th className="w-full pb-1.5 pl-3 text-left font-normal whitespace-nowrap">비중</th>
          </tr>
        </thead>
        <tbody>
          {ELEMENTS.map((element) => (
            <tr key={element}>
              <td className="py-1.5 whitespace-nowrap">
                <span className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 align-middle ${ELEMENT_TONE[element].surface}`}>
                  <span className="grid size-7 place-items-center rounded-full bg-surface">
                    <ElementSymbol element={element} className="size-5" />
                  </span>
                  <span className={`glyph text-base font-bold ${ELEMENT_TONE[element].text}`}>{element}</span>
                  <span className={`text-small font-semibold ${ELEMENT_TONE[element].text}`}>{ELEMENT_KO[element]}</span>
                </span>
                {element === strongest && <span className="ml-1.5 text-xs text-muted">최강</span>}
              </td>
              <td
                className={`py-1 pl-3 text-right tabular-nums whitespace-nowrap ${
                  counts[element] === 0 ? 'text-muted' : ''
                }`}
              >
                {/*
                  **「1」과 「13%」가 붙어 「113%」로 읽혔다.** 여백만 두고 구분자가
                  없었는데, 오른쪽 정렬에 `tabular-nums` 라 두 수가 한 수처럼 보인다.
                  괄호가 두 값을 가른다.
                */}
                {counts[element]}
                <span className="ml-1.5 text-xs text-muted">
                  ({Math.round((counts[element] / glyphCount) * 100)}%)
                </span>
              </td>
              <td className="py-1 pl-3 text-right tabular-nums text-secondary">
                {scores[element].toFixed(2)}
              </td>
              <td className="py-1 pl-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 min-w-0 flex-1 rounded-full bg-track">
                    <div
                      className={`h-full rounded-full ${ELEMENT_TONE[element].bar}`}
                      style={{ width: `${(ratios[element] / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums text-secondary">
                    {Math.round(ratios[element] * 100)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <WeightShifts saju={saju} />

      {/*
        **「없다」도 자를 밝힌다.** 이 줄은 개수 기준이라 지장간에만 있는 오행이 여기
        선다 — 바로 위 표에서 그 오행의 점수가 0 이 아닌 것을 함께 보게 된다. 대치 칸이
        같은 자리에서 「8.0%」와 「한 자도 없다」를 동시에 말하던 것과 같은 종류다.
      */}
      {missing.length > 0 && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-secondary">
          여덟 글자에 없는 오행 {missing.map((e) => ELEMENT_KO[e]).join(', ')}
          <span className="text-muted"> (지장간에는 있을 수 있습니다 — 점수 칸을 보세요)</span>
          {glyphCount !== 8 && (
            <span className="text-muted"> · 시주에 있었을지는 알 수 없습니다</span>
          )}
        </p>
      )}
    </section>
  );
}
