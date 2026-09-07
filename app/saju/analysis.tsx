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
  TRANSFORMATION_BLOCKER_KO,
  TRANSFORMATION_VERDICT_KO,
  UNRESOLVED_FACTOR_KO,
  type PillarPosition,
  type Saju,
  type StemTransformation,
  type TransformationBlocker,
} from '@/src/lib/saju';
import {
  subjectParticle,
} from './shared';
import {
  CardTabs,
} from './card-tabs';
import {
  ClaimStrengthLegend,
} from '../utterances';


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
    */
    <details className="group mt-4 border-t border-border pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
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
      <h2 className="text-base font-semibold">오행 분포</h2>
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
              <td className="py-1 whitespace-nowrap">
                <span className={`glyph inline-grid size-7 place-items-center rounded-lg ${ELEMENT_TONE[element].surface} ${ELEMENT_TONE[element].text}`}>{element}</span>{' '}
                <span className="text-secondary">{ELEMENT_KO[element]}</span>
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


/** 신강·신약 — 보조세력 비율과 득령·득지·득세 판정을 한 흐름으로 보여준다. */
export function StrengthMeter({ saju }: { saju: Saju }) {
  const { strength } = saju.analysis;
  const percent = strength.ratio * 100;
  const threshold = 50;
  const isStrong = strength.verdict === 'strong';

  return (
    <section className={`${CARD} flex flex-col`}>
      <div>
        <h2 className="text-base font-semibold">신강 · 신약</h2>
        <p className="mt-0.5 text-xs text-secondary">보조세력과 득령·득지·득세를 함께 봅니다</p>
      </div>

      <div className="mt-4 rounded-2xl bg-surface-soft p-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p className="text-xs font-medium text-muted">현재 판정</p>
          <div className="mt-1 flex items-baseline gap-2">
            <strong className="text-3xl font-semibold">{isStrong ? '신강' : '신약'}</strong>
            <span className="text-sm text-secondary">세 기준 중 {strength.metCount}개 충족</span>
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-1 sm:mt-0 sm:text-right">
          <span className="text-3xl font-semibold tabular-nums text-foreground">{percent.toFixed(1)}</span>
          <span className="text-sm font-medium text-foreground">%</span>
          <span className="ml-1 text-xs text-muted">보조세력</span>
        </div>
      </div>

      <div className="mt-5">
        <div
          className="relative h-3 overflow-visible rounded-full bg-track"
          role="img"
          aria-label={`보조세력 ${percent.toFixed(1)}%, 신강 기준 ${threshold}%`}
        >
          <div
            className="h-full rounded-full bg-foreground/55"
            style={{ width: `${percent}%` }}
          />
          <div
            className="absolute inset-y-[-4px] w-0.5 bg-foreground/45"
            style={{ left: `${threshold}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-muted sm:text-xs">
          <span>소모 우세</span>
          <span>신강 기준 {threshold}%</span>
          <span>보조 우세</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-border px-3 py-2.5">
          <p className="text-[11px] text-muted">일간을 돕는 힘</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{strength.supportScore.toFixed(2)}</p>
          <p className="text-[10px] text-secondary">비겁·인성</p>
        </div>
        <div className="rounded-xl border border-border px-3 py-2.5">
          <p className="text-[11px] text-muted">일간을 소모하는 힘</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{strength.opposeScore.toFixed(2)}</p>
          <p className="text-[10px] text-secondary">식상·재성·관성</p>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold">판정 근거</h3>
          <span className="text-xs text-muted">득령 · 득지 · 득세</span>
        </div>
      </div>
      <ul className="mt-2 grid gap-2 sm:grid-cols-3">
        {strength.criteria.map((criterion) => (
          <li
            key={criterion.key}
            className={`rounded-xl border p-3 ${
              criterion.met ? 'border-border-strong bg-surface-sunken' : 'border-border bg-surface-soft'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{criterion.label}</span>
              {/*
                **충족에 강조색을 안 쓴다.** 세력비와 게이지를 중립색으로 내린 것과 같은
                까닭이다 — 신강·신약은 좋고 나쁨이 아니므로, 세 기준 중 하나를 「달성」한
                것처럼 보이는 초록이 여기만 남으면 그 판단이 반만 적용된 것이 된다.
                가르는 일은 채움의 세기가 한다.
              */}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                criterion.met
                  ? 'bg-foreground/85 text-background'
                  : 'bg-surface-sunken text-muted'
              }`}>
                {criterion.met ? '충족' : '미충족'}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-secondary">{criterion.detail}</p>
          </li>
        ))}
      </ul>

      {/*
        **한 줄만 남긴다.** 여기 세 문장이 있었다 — 등급 이름을 안 붙이는 까닭, 구간
        경계를 못 잡은 사정, 세 기준이 겹친다는 사실. 앞의 둘은 **없는 것에 대한 해명**이라
        화면에 안 세운다(안 붙은 등급을 사용자가 기다리고 있지 않다). 남은 하나는 바로 위
        세 줄을 읽는 방법이라 그 옆에 선다.
      */}
      <p className="mt-2 text-xs text-muted">
        세 기준은 서로 겹칩니다 — 득세 점수에 월지·일지가 이미 들어 있습니다.
      </p>

      <RootingNote saju={saju} />
    </section>
  );
}


/**
 * 용신 — **한 답이 아니라 관점마다의 후보다.**
 *
 * 이 다섯이 신강·신약 카드 하나에 들어 있었다. 조후·억부·종격·통관·서열이 각자 딱지와
 * 해명 문단을 달고 세로로 쌓여, 카드 하나가 화면 두 개 높이였다 — 「신강인가 신약인가」를
 * 보러 온 사람이 그 답 아래로 스무 문단을 지나야 했다.
 *
 * **가르는 선은 「무엇을 재는가」다.** 강약은 일간의 세기 하나를 재고, 여기 다섯은 전부
 * 「그래서 무엇을 쓰나」에 서로 다른 길로 답한다. 답이 갈릴 수 있다는 것이 이 카드의
 * 내용이므로, 한 판씩 골라 보는 것이 나란히 쌓는 것보다 그 사실을 잘 말한다.
 *
 * **확정하지 않는다.** 어느 길이 먼저인지는 엔진이 판정하지 않고(`YONGSIN_POLICY`),
 * 서열 판은 그 규칙을 값으로 든다.
 */
export function YongsinCard({ saju }: { saju: Saju }) {
  const { eokbu, johu, tonggwan, yongsinAgreement, precedence } = saju.analysis;

  return (
    <CardTabs
      id="yongsin"
      anchorId="yongsin"
      title="용신 후보"
      note="관점마다 답이 다를 수 있어 확정하지 않고 나란히 둡니다."
      tablistLabel="용신 관점"
      initial="eokbu"
      tabs={[
        { key: 'eokbu', label: '억부', panel: <EokbuNote eokbu={eokbu} agreement={yongsinAgreement} /> },
        { key: 'johu', label: '조후', panel: <JohuNote johu={johu} /> },
        { key: 'following', label: '종격', panel: <FollowingCandidacyNote saju={saju} /> },
        { key: 'tonggwan', label: '통관', panel: <TonggwanFacts tonggwan={tonggwan} /> },
        { key: 'precedence', label: '서열', panel: <PrecedenceTable precedence={precedence} /> },
      ]}
      /*
        **딱지 범례가 여기 산다.**

        「이 명식에 대해 말할 수 있는 것」 카드가 들고 있었다. 그 카드를 걷으면서 범례만
        남길 자리를 찾았는데, 「시험」과 「참고표」가 실제로 붙는 곳이 이 다섯 판이다
        (「사실」은 낱말이 스스로 말한다). 설명이 그 딱지 옆에 있는 것이 화면 맨 위에
        모여 있는 것보다 낫다 — 고지를 모아 두면 읽는 사람이 그 덩어리를 건너뛴다.

        판 **밖에** 둔다. 안에 두면 다섯 판이 같은 문단을 다섯 번 들고, 그러면 판을
        옮길 때마다 같은 글이 다시 나타나 각주가 본문처럼 읽힌다.
      */
      footnote={<ClaimStrengthLegend />}
    />
  );
}


/** 조후 — 《궁통보감》 조건 요약. **확정 용신이 아니라 후보와 조건이다.** */
function JohuNote({ johu }: { johu: Saju['analysis']['johu'] }) {
  return (
    <div>
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
      {/*
        **줄인다.** 상·하반월만 판정하는 까닭(경계가 천문으로 정해진다)과 세력 조건을
        판정하지 않는 까닭이 각각 한 문장씩 있었다. 남는 것은 **사용자가 알아야 읽는 법이
        바뀌는 것** 하나다 — 이것은 확정 용신이 아니다.
      */}
      <p className="mt-2 text-xs text-muted">
        세력 조건(&lsquo;수가 왕하면 戊&rsquo;)은 판정하지 않으므로, 확정 용신이 아니라
        후보와 조건을 함께 읽어야 합니다.
      </p>
    </div>
  );
}


/** 억부 — 세력에서 나온 후보 하나와, 조후와 같은 곳을 가리키는지. */
function EokbuNote({
  eokbu,
  agreement,
}: {
  eokbu: Saju['analysis']['eokbu'];
  agreement: Saju['analysis']['yongsinAgreement'];
}) {
  return (
    <div>
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

        조후와 억부가 여태 나란히 서 있기만 했다. 하나는 「土를 쓰라」 하고 다른 하나는
        「壬·丙을 보라」 하는데, 그 둘이 같은 말인지는 읽는 사람이 오행 표를 외워 맞춰
        봐야 알 수 있었다 — 무작위 3000건에서 **어긋나는 명식이 43.2%** 다.

        판이 갈린 뒤로 이 줄이 더 필요해졌다. 조후는 이제 옆 탭에 있어 함께 보이지 않는다.
      */}
      <p className="mt-2 border-t border-border pt-2 text-xs text-secondary">
        <span className="font-medium">
          {agreement.aligned ? '조후와 같은 곳을 가리킵니다.' : '조후와 다른 곳을 가리킵니다.'}
        </span>{' '}
        {agreement.aligned ? (
          <>
            조후가 권한 글자 가운데{' '}
            <span className="glyph">{agreement.sharedStems.join(' · ')}</span>
            {subjectParticle(agreement.sharedStems[agreement.sharedStems.length - 1])}{' '}
            억부와 같은 {ELEMENT_KO[agreement.eokbuElement]}입니다.
          </>
        ) : (
          <>
            조후가 권한 <span className="glyph">{agreement.johuStems.join(' · ')}</span> 중에는
            억부가 권한 {ELEMENT_KO[agreement.eokbuElement]}
            {subjectParticle(ELEMENT_KO[agreement.eokbuElement])} 없습니다.
          </>
        )}{' '}
        <span className="text-muted">어느 쪽이 먼저인지는 「서열」 판이 답합니다.</span>
      </p>

      {/*
        **열두 문장이 두 문장이 됐다.**

        여기 있던 것은 대부분 **아직 판정하지 않은 것들의 목록**이었다 — 기신을 왜 안
        내는지, 희용기구한을 왜 화면에 안 세우는지, 통근·투출을 어디까지 쟀는지. 그것들은
        각자 제 자리(통근 칸·서열 판)에서 이미 말하고 있고, 여기서 다시 세면 **읽는 사람이
        후보 하나를 보려고 아직 없는 것 여섯을 지나야 한다.**

        남기는 것은 이 후보를 잘못 읽지 않게 하는 둘이다: 확정이 아니라는 것과, 무엇이
        아직 안 재어졌는가.
      */}
      <p className="mt-2 text-xs text-muted">
        <strong className="font-medium">용신 확정값이 아닙니다.</strong> 억부는 용신을 잡는
        네 길 중 하나이고, 아직 판정하지 않은 것이 남아 있습니다 —{' '}
        {eokbu.unresolved.map((factor) => UNRESOLVED_FACTOR_KO[factor]).join(', ')}.
      </p>
    </div>
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
    <div>
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
    <div>
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
    <details className="group mt-4 border-t border-border pt-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        뿌리와 투출 자세히 보기
        <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="pb-2 pt-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">사실</span>
          <span className="text-xs text-muted">일간 {dayMaster.stem}의 뿌리</span>
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
          뿌리의 강약은 매기지 않습니다. 음양이 다른 뿌리와 고지의 중기도 거르지 않고
          그대로 셉니다. 어디까지 통근으로 볼지는 계통마다 갈리며, 합충으로 뿌리가
          상했는지도 여기서는 판정하지 않습니다.
        </p>
      </div>
    </details>
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
    <div>
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
