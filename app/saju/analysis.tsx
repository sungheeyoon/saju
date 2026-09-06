import {
  CARD,
} from '../card';
import {
  ELEMENT_TONE,
} from '../element-tone';
import {
  ELEMENTS,
  ELEMENT_KO,
  ELEMENT_ROLE_KO,
  FOLLOWING_DIRECTION_KO,
  FOLLOWING_PATTERN_POLICY,
  FOLLOWING_PATTERN_STATUS_KO,
  HIDDEN_STEM_ROLE_KO,
  JUDGEMENT_KO,
  PILLAR_POSITION_KO,
  PRECEDENCE_REASON_KO,
  TRANSFORMATION_VERDICT_KO,
  UNRESOLVED_FACTOR_KO,
  type PillarPosition,
  type Saju,
  type StemTransformation,
} from '@/src/lib/saju';
import {
  subjectParticle,
} from './shared';


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
  */
  const boundStems = [
    ...transformations
      .filter((one) => one.verdict !== 'transformed')
      .reduce((grouped, one) => {
        const key = `${one.ko}:${one.verdict}`;
        const seats = grouped.get(key)?.seats ?? [];
        grouped.set(key, {
          ko: one.ko,
          verdict: one.verdict,
          seats: [...new Set([...seats, ...one.participants.map((at) => at.position)])],
        });
        return grouped;
      }, new Map<string, { ko: string; verdict: StemTransformation['verdict']; seats: PillarPosition[] }>())
      .values(),
  ];
  const sixCombinations = saju.relations.filter(
    (relation) => relation.kind === 'branchSixCombination',
  );

  if (bureaus.length === 0 && boundStems.length === 0 && sixCombinations.length === 0) return null;

  const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <h3 className="text-sm font-medium">세력에 반영한 합과 안 한 합</h3>

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
              {' '}— 천간합은 化했을 때만 옮깁니다({TRANSFORMATION_VERDICT_KO[transformation.verdict]} 자리)
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
    </div>
  );
}


/**
 * 오행 분포 — 크기 비교가 일이므로 단일 색조 막대.
 * 값을 전부 옆에 적으므로 표 역할도 겸한다(툴팁 불필요).
 */
export function ElementChart({ saju }: { saju: Saju }) {
  const { counts, scores, ratios, missing, strongest, glyphCount } = saju.analysis.elements;
  const needed = new Set(saju.analysis.strength.neededElements);
  const max = Math.max(...ELEMENTS.map((e) => ratios[e]), 0.0001);

  return (
    <section className={CARD}>
      <h2 className="text-base font-semibold">오행 분포</h2>
      <p className="mt-1 mb-4 text-xs text-secondary">
        개수는 {glyphCount === 8 ? '여덟' : '여섯'} 글자를 그대로 센 것(괄호 안은 그
        비중), 점수는 지장간을 사령 일수로 펼친 값입니다. 다른 만세력은 대개
        앞쪽 기준으로 %를 냅니다
        {glyphCount !== 8 && <span className="text-muted"> · 시주 제외</span>}
      </p>
      {/*
        **딱지 둘이 범례 없이 서 있었다.**

        「필요」는 억부가 가리키는 **방향**이라 신약이면 비겁·인성 둘 다 붙는다
        (`strength.neededElements`). 아래 억부 칸이 그중 **하나**를 후보로 고른 것이라,
        같은 낱말이 한 화면에서 두 넓이로 쓰인다 — 둘이 어긋난 것이 아닌데 범례가
        없으면 어긋나 보인다. 오신 배정에서 한신인 오행에 「필요」가 붙는 것도 이
        까닭이다.
      */}
      <p className="mb-4 text-xs text-muted">
        <span className="text-muted">최강</span> 은 점수가 가장 높은 오행,{' '}
        <span className="text-accent">필요</span> 는 억부가 가리키는 방향입니다 — 신약이면
        비겁·인성 둘, 신강이면 식상·재성·관성 셋이 함께 붙습니다. 아래 억부 칸은 그중
        하나를 후보로 고른 것입니다.
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
              <td className="py-1 whitespace-nowrap">
                <span className={`glyph inline-grid size-7 place-items-center rounded-lg ${ELEMENT_TONE[element].surface} ${ELEMENT_TONE[element].text}`}>{element}</span>{' '}
                <span className="text-secondary">{ELEMENT_KO[element]}</span>
                {element === strongest && <span className="ml-1.5 text-xs text-muted">최강</span>}
                {needed.has(element) && <span className="ml-1.5 text-xs text-accent">필요</span>}
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
                  <div className="h-2.5 min-w-0 flex-1 rounded-sm bg-track">
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


/** 신강·신약 — 임계값 대비 단일 비율이므로 메터. */
export function StrengthMeter({ saju }: { saju: Saju }) {
  const { strength, eokbu, johu, tonggwan, yongsinAgreement, precedence } = saju.analysis;
  const percent = strength.ratio * 100;
  const threshold = 50;

  return (
    <section className={`${CARD} flex flex-col`}>
      <h2 className="text-base font-semibold">신강 · 신약</h2>

      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold">
          {strength.verdict === 'strong' ? '신강' : '신약'}
        </span>
        <span className="text-sm text-secondary">세 기준 중 {strength.metCount}개 충족</span>
      </p>

      <div className="mt-4">
        <div className="relative h-3 rounded-sm bg-track">
          <div
            className="h-full rounded-r-[4px] bg-accent"
            style={{ width: `${percent}%` }}
          />
          <div
            className="absolute inset-y-[-3px] w-px bg-border-strong"
            style={{ left: `${threshold}%` }}
            aria-hidden
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-secondary">
          <span>
            보조 {strength.supportScore.toFixed(2)} · 소모 {strength.opposeScore.toFixed(2)}
          </span>
          <span className="tabular-nums">
            보조세력 {percent.toFixed(1)}%{' '}
            <span className="text-muted">(기준 {threshold}%)</span>
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        세력비에 태약·중화·태왕 같은 등급 이름은 붙이지 않습니다. 근거 있는 구간
        경계를 아직 확보하지 못했습니다. 아래 세 기준도 서로 겹칩니다 — 득세
        점수에 월지·일지가 이미 들어 있습니다.
      </p>

      <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
        {strength.criteria.map((criterion) => (
          <li key={criterion.key} className="flex gap-2">
            <span className={criterion.met ? 'text-accent' : 'text-muted'}>
              {criterion.met ? '○' : '✕'}
            </span>
            <span className="w-8 shrink-0">{criterion.label}</span>
            <span className="text-secondary">{criterion.detail}</span>
          </li>
        ))}
      </ul>

      <RootingNote saju={saju} />

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
            참고표
          </span>
          <span className="text-xs text-muted">조후 후보 천간</span>
          <span className="glyph text-lg font-medium">
            {(johu.halfStems ?? johu.stems).join(' · ')}
          </span>
          <span className="text-xs text-secondary">
            {johu.dayMaster}일간 · {johu.monthBranch}월
            {johu.half && (
              <>
                {' · '}
                {johu.half === 'first' ? '상반월' : '하반월'}
                {johu.midTerm && (
                  <span className="text-muted">
                    {' '}
                    ({johu.midTerm.name} {johu.half === 'first' ? '전' : '후'})
                  </span>
                )}
              </>
            )}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-secondary">{johu.note}</p>
        {johu.halfStems && (
          <p className="mt-1 text-xs text-secondary">
            이 칸은 상·하반월로 갈려서 그 절반의 후보만 위에 적었습니다. 전체 후보는{' '}
            <span className="glyph">{johu.stems.join(' · ')}</span> 입니다.
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          《궁통보감》 120조합의 조건 요약입니다. 상·하반월만 판정합니다 — 경계가
          중기(절기 +15°)라 천문으로 정해지기 때문입니다. &lsquo;수가 왕하면 戊&rsquo;
          같은 세력 조건은 문턱을 지어내야 해서 판정하지 않으므로, 확정 용신이 아니라
          후보와 조건을 함께 읽어야 합니다.
        </p>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
            시험
          </span>
          <span className="text-xs text-muted">억부 관점의 후보</span>
          <span className="glyph text-lg font-medium">{eokbu.suggestedElement}</span>
          <span className="text-sm font-medium">{ELEMENT_KO[eokbu.suggestedElement]}</span>
          <span className="text-sm text-secondary">{ELEMENT_ROLE_KO[eokbu.role]}</span>
          {!eokbu.presentInChart && (
            <span className="text-xs text-muted">여덟 글자에 없는 오행</span>
          )}
        </div>
        <p className="mt-1.5 text-xs text-secondary">{eokbu.reason}</p>

        {/*
          **두 칸이 서로 무슨 관계인지 말한다.**

          조후와 억부가 여태 나란히 서 있기만 했다. 하나는 「土를 쓰라」 하고 다른
          하나는 「壬·丙을 보라」 하는데, 그 둘이 같은 말인지는 읽는 사람이 오행 표를
          외워 맞춰 봐야 알 수 있었다 — 무작위 3000건에서 **어긋나는 명식이 43.2%** 다.

          **어느 쪽이 급한지는 여기서도 말하지 않는다.** 한랭·조열이 급하면 조후가
          억부를 제친다는 것이 여러 계통의 말이지만, 「얼마나 급해야」를 재는 자리가
          엔진에 없다(`YONGSIN_POLICY.johuAgainstEokbu`).
        */}
        <p className="mt-2 border-t border-border pt-2 text-xs text-secondary">
          <span className="font-medium">
            {yongsinAgreement.aligned ? '두 길이 같은 곳을 가리킵니다.' : '두 길이 다른 곳을 가리킵니다.'}
          </span>{' '}
          {yongsinAgreement.aligned ? (
            <>
              조후가 권한 글자 가운데{' '}
              <span className="glyph">{yongsinAgreement.sharedStems.join(' · ')}</span>
              {subjectParticle(yongsinAgreement.sharedStems[yongsinAgreement.sharedStems.length - 1])}{' '}
              억부와 같은 {ELEMENT_KO[yongsinAgreement.eokbuElement]}입니다.
            </>
          ) : (
            <>
              조후가 권한 <span className="glyph">{yongsinAgreement.johuStems.join(' · ')}</span> 중에는
              억부가 권한 {ELEMENT_KO[yongsinAgreement.eokbuElement]}
              {subjectParticle(ELEMENT_KO[yongsinAgreement.eokbuElement])} 없습니다.
            </>
          )}{' '}
          <span className="text-muted">
            어느 쪽을 먼저 보아야 하는지는 판정하지 않습니다 — 한랭·조열이 얼마나 급한지를
            재는 자리가 아직 없습니다.
          </span>
        </p>

        <p className="mt-2 text-xs text-muted">
          <strong className="font-medium">용신 확정값이 아닙니다.</strong> 억부는 용신을
          잡는 네 길 중 하나일 뿐이고, 아직 판정하지 않은 것이 남아 있습니다 —{' '}
          {eokbu.unresolved.map((factor) => UNRESOLVED_FACTOR_KO[factor]).join(', ')}.
          이 가운데 통근·투출은 <strong className="font-medium">사실만 위에 적어 두었고</strong>,
          그것이 쓸 만한 뿌리인지를 재는 판정만 아직 없습니다. 종격은 위 칸에서{' '}
          <strong className="font-medium">따로 판정하지만 이 후보에는 반영되지 않았습니다</strong> —
          문턱이 고전의 숫자가 아니라 이 엔진의 실험값이라, 억부와 정반대 답이 나오더라도
          뒤집지 않고 나란히 세웁니다. 위 조후표도 조건을 전부 자동 판정하지 않은
          참고값입니다.
          꺼리는 오행(기신)은 판정하지 않습니다 — 명식 전체에서 무엇이 병인지를 봐야
          정해지지 오행 상극표 한 줄로 나오는 것이 아니기 때문입니다. 다만 「이 후보를
          용신 자리에 놓으면 다섯 오행이 어디에 오는가」(희용기구한)는 표 조회라 계통이
          갈리지 않고, 그 배정은 화면에 세우지 않는 대신 AI 풀이 자료에 함께 실립니다.
        </p>
      </div>

      <TonggwanFacts tonggwan={tonggwan} />
      <PrecedenceTable precedence={precedence} />
    </section>
  );
}


/**
 * 판정 사이의 서열 — **어긋날 때 무엇을 보는가.**
 *
 * 이 칸이 없는 동안 화면은 답 넷을 나란히 세우고 아무 말도 안 했다. 「가종 후보」와
 * 「억부 木」을 함께 본 사람이 어느 쪽으로 읽을지는 그때그때 달랐고, 그것은 우리가
 * 정하지 않은 것이 아니라 **정해 놓고 안 알려 준 것**이다.
 *
 * 값은 엔진이 든다(`analysis.precedence`). 화면이 스위치를 다시 적으면 정책만 바뀌고
 * 이 표가 안 따라오는 날이 온다 — 바로 위 칸이 종격 대조 성적으로 그 일을 겪었다.
 */
function PrecedenceTable({ precedence }: { precedence: Saju['analysis']['precedence'] }) {
  const shaken = precedence.rows.filter((row) => row.disagrees === true);

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
          사실
        </span>
        <span className="text-xs text-muted">판정이 어긋날 때</span>
        <span className="text-sm font-medium">
          {JUDGEMENT_KO[precedence.primary]}를 봅니다
        </span>
        {shaken.length > 0 && (
          <span className="text-sm text-secondary">
            지금 어긋나는 것 {shaken.map((row) => row.ko).join(' · ')}
          </span>
        )}
      </div>

      <ul className="mt-2 flex flex-col gap-1 text-xs">
        {precedence.rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-baseline gap-x-2">
            <span className={`w-8 shrink-0 ${row.key === precedence.primary ? 'font-medium' : 'text-secondary'}`}>
              {row.ko}
            </span>
            <span className={row.overrides ? 'text-accent' : 'text-muted'}>
              {row.overrides ? '기준' : '안 뒤집음'}
            </span>
            <span className="text-muted">{PRECEDENCE_REASON_KO[row.reason]}</span>
            {/*
              **「어긋나지 않는다」와 「견줄 수 없다」를 가른다.** 격국은 상신을 오행으로
              내지 않고 통관은 판정이 없다 — 빈 값을 「같다」로 적으면 안 재 본 것이
              잰 것처럼 보인다.
            */}
            <span className="text-secondary">
              {row.disagrees === null
                ? '견줄 수 없음'
                : row.disagrees
                  ? '지금 억부와 어긋남'
                  : ''}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-muted">
        억부가 기준인 것은 <strong className="font-medium">용신을 잡는 네 길 중 유일하게
        외부 명조와 대조된 판정</strong>이기 때문입니다 — 그것도 시험값입니다. 이 서열은
        AI 풀이 자료에도 같이 실립니다.
      </p>
    </div>
  );
}


/**
 * 통관 재료 — **판정이 아니라 맞선 두 세력의 사실이다.**
 *
 * 억부는 언제나 답을 하나 낸다. 「무엇이 가장 무거운가」로 한쪽을 고르고 그 반대편을
 * 권하는데, **두 세력이 팽팽히 맞선 명식에서는 그 물음이 답을 못 낸다** — 어느 쪽을
 * 눌러도 나머지가 그대로 남는다. 고전이 그 자리에 쓰라고 한 것이 통관이고, 이 칸은
 * 그 자리인지 아닌지를 **읽는 사람이 판단할 재료**를 편다.
 *
 * 다섯 쌍을 다 내지 않고 가장 팽팽한 하나만 세운다. 다섯 줄을 세우면 이 칸이 화면에서
 * 가장 큰 자리를 차지하는데, 판정도 아닌 것이 그럴 자리는 아니다. 나머지 넷은 자료에
 * 그대로 실린다(`analysis.tonggwan`).
 */
function TonggwanFacts({ tonggwan }: { tonggwan: Saju['analysis']['tonggwan'] }) {
  const { tightest } = tonggwan;
  const percent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
          사실
        </span>
        <span className="text-xs text-muted">가장 팽팽한 대치</span>
        <span className="glyph text-lg font-medium">
          {tightest.controller} → {tightest.controlled}
        </span>
        <span className="text-sm text-secondary">
          {ELEMENT_KO[tightest.controller]}{' '}
          <span className="tabular-nums">{percent(tightest.shares.controller)}</span> ↔{' '}
          {ELEMENT_KO[tightest.controlled]}{' '}
          <span className="tabular-nums">{percent(tightest.shares.controlled)}</span>
        </span>
        {/*
          **기준을 칸 안에 적는다.** 위의 오행 분포 표는 여덟 글자를 그대로 센 개수 %
          이고 여기는 지장간까지 편 점수 % 다. 한 페이지에서 같은 오행이 13% 와 15.4%
          로 두 번 나오는데 어느 자로 잰 것인지가 이 칸에는 없었다.
        */}
        <span className="text-xs text-muted">점수 기준(지장간·국 반영)</span>
      </div>

      <p className="mt-1.5 text-xs text-secondary">
        사이를 잇는 것은 <span className="glyph">{tightest.bridge}</span>{' '}
        {ELEMENT_KO[tightest.bridge]}입니다({percent(tightest.shares.bridge)}) —{' '}
        {tightest.controller}는 {tightest.bridge}를 낳고 {tightest.bridge}는{' '}
        {tightest.controlled}를 낳습니다.{' '}
        {tightest.bridgePresence === 'revealed'
          ? '이 오행은 여덟 글자에 드러나 있습니다.'
          : tightest.bridgePresence === 'hidden'
            ? '다만 여덟 글자에는 드러나지 않고 지장간에만 있습니다 — 위 몫은 그 지장간까지 편 점수입니다.'
            : '그런데 이 오행이 지장간까지 봐도 한 톨 없습니다 — 이을 손이 없다는 뜻입니다.'}
      </p>

      <p className="mt-2 text-xs text-muted">
        <strong className="font-medium">맞선 것인지는 판정하지 않습니다.</strong> 얼마나
        맞서야 대치(相戰)인지, 대치면 억부를 제치는지가 계통마다 갈리기 때문입니다 — 종격이
        먼저 지나온 자리와 같습니다. 가벼운 쪽이{' '}
        <span className="tabular-nums">{percent(tightest.facing)}</span> 인데, 무작위 3000건에서
        이 값이 30% 를 넘는 명식은 10.2% 입니다. 나머지 네 쌍도 자료에는 그대로 실립니다.
      </p>
    </div>
  );
}


/**
 * 통근·투출 — 판정이 아니라 그 재료다.
 *
 * 억부가 "아직 판정하지 않았다"고 적는 것들(종격 여부·투간과 통근의 질)이
 * 모두 이 두 사실 위에서 갈린다. 판정을 못 하더라도 재료는 보여줄 수 있고,
 * 보여주면 왜 판정을 미뤘는지도 눈에 보인다.
 *
 * 뿌리의 강약은 매기지 않는다. 어느 자리의 어느 지장간에 며칠치인지까지가
 * 사실이고, "이 정도면 통근으로 친다"는 선이 계통마다 다르다.
 */
function RootingNote({ saju }: { saju: Saju }) {
  const { dayMaster, emergences } = saju.analysis.rootedness;
  const seat = (position: PillarPosition) => PILLAR_POSITION_KO[position].charAt(0);

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
          사실
        </span>
        <span className="text-xs text-muted">일간 {dayMaster.stem} 의 뿌리</span>
        {dayMaster.rooted ? (
          <>
            <span className="text-sm text-secondary">
              {dayMaster.roots
                .map(
                  (root) =>
                    `${seat(root.position)}지 ${root.branch}의 ${root.stem}` +
                    `(${HIDDEN_STEM_ROLE_KO[root.role]} ${root.days}일)`,
                )
                .join(' · ')}
            </span>
            <span className="text-sm font-medium tabular-nums">합 {dayMaster.totalDays}일</span>
          </>
        ) : (
          <span className="text-sm font-medium">없음 — 지지 어디에도 통근하지 않았습니다</span>
        )}
      </div>

      {emergences.length > 0 && (
        <p className="mt-1.5 text-xs text-secondary">
          투출{' '}
          {emergences
            .map(
              (emergence) =>
                `${seat(emergence.position)}지 ${emergence.branch}의 ${emergence.stem} → ` +
                emergence.revealedAt.map((position) => `${seat(position)}간`).join('·'),
            )
            .join(' / ')}
        </p>
      )}

      <p className="mt-2 text-xs text-muted">
        뿌리의 강약은 매기지 않습니다. 음양이 다른 뿌리(甲이 卯의 乙에 두는 것)와
        고지(辰戌丑未)의 중기도 거르지 않고 그대로 셉니다 — 어디까지 통근으로 볼지가
        계통마다 갈리기 때문입니다. 합충으로 뿌리가 상했는지도 보지 않습니다.
      </p>

      <FollowingCandidacyNote saju={saju} />
    </div>
  );
}


/**
 * 종격 후보의 조건 — 판정이 아니라 재료다.
 *
 * "종격 여부를 아직 판정하지 않는다"고만 적어 두면 무엇이 막혔는지 알 수 없다.
 * 어느 계통이든 종을 말하려면 먼저 보는 넷을 그대로 보여주고, 여기에 어디서
 * 선을 긋느냐가 계통 선택이라는 것까지 적는다.
 */
function FollowingCandidacyNote({ saju }: { saju: Saju }) {
  const { followingCandidacy: candidacy, following } = saju.analysis;
  const percent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;
  /** 문턱과 대조 성적은 **재는 자리가 들고 있는 값**을 그대로 읽는다 — 아래 주석 참조 */
  const { dominance } = FOLLOWING_PATTERN_POLICY;
  const { externalCheck } = dominance;
  const share = (ratio: number) => `${Math.round(ratio * 100)}%`;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
          시험
        </span>
        <span className="text-xs text-muted">종격</span>
        <span className="text-lg font-medium">
          {FOLLOWING_PATTERN_STATUS_KO[following.verdict]}
        </span>
        <span className="text-sm text-secondary">
          자당(비겁·인성) 몫{' '}
          <span className="tabular-nums">{percent(following.selfShare)}</span>
          <span className="text-muted">
            {' '}
            (밖으로 종 ≤{share(dominance.outwardMaxSelfShare)} · 안으로 종 ≥
            {share(dominance.inwardMinSelfShare)})
          </span>
          {following.direction && (
            <span className="ml-1.5">{FOLLOWING_DIRECTION_KO[following.direction]}</span>
          )}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
          사실
        </span>
        <span className="text-xs text-muted">판정의 재료</span>
        <span className="text-sm">
          일간 {candidacy.dayMasterRootless ? '무근' : '유근'}
          <span className="mx-1.5 text-muted">·</span>
          가장 무거운 세력 {ELEMENT_ROLE_KO[candidacy.dominant.role]}{' '}
          <span className="tabular-nums">{percent(candidacy.dominant.ratio)}</span>
          <span className="mx-1.5 text-muted">·</span>
          월령 {candidacy.monthCommandsDominant ? '그 세력이 잡음' : '다른 세력'}
          <span className="mx-1.5 text-muted">·</span>
          투간한 생부{' '}
          {candidacy.supportStems.length === 0 ? (
            '없음'
          ) : (
            <span className="glyph">
              {candidacy.supportStems.map((support) => support.stem).join(' ')}
            </span>
          )}
        </span>
      </div>

      <p className="mt-2 text-xs text-muted">
        <strong className="font-medium">문턱은 고전이 정한 숫자가 아닙니다.</strong> 무작위
        3000건의 세력 분포를 재고 정한 이 엔진의 실험값입니다. 종에는 방향이 둘이라
        축 하나의 양끝으로 잽니다 — 일간을 도울 것이 없으면 <strong className="font-medium">밖으로</strong>
        (종재·종살), 일간 편이 극왕하면 <strong className="font-medium">안으로</strong> 따릅니다.{' '}
        {/*
          **수치를 손으로 적지 않는다.** 여기 「14건 중 4건」이 적혀 있었다 — 규칙이 v2 로
          가고 대조 자료가 늘어나는 동안 화면만 v1 의 숫자에 남아 있었다. 재는 자리가
          값으로 들고 있는 것을(`externalCheck`) 화면이 다시 적으면, 엔진이 나아질 때마다
          화면은 조용히 틀린 말을 하게 된다.
        */}
        외부 자료에서 종격이라고 밝힌 명조 {externalCheck.claimedFollowing}건과 대조해{' '}
        <strong className="font-medium">{externalCheck.caught}건을 잡았습니다</strong> — 여전히
        덜 잡는 쪽으로 틀리고, 아니라고 적힌 쪽에서도 {externalCheck.falsePositives}건을
        종격으로 봅니다. 그래서 이 판정은 억부 후보를 뒤집지 않습니다. 진종·가종 어느
        쪽으로도 밀기 어려운 명식은 &lsquo;종격 후보&rsquo;로 남겨 둡니다.
      </p>
    </div>
  );
}
