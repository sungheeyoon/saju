'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import {
  CITY_LONGITUDES,
  ELEMENT_KO,
  ELEMENT_ROLE_KO,
  GENDER_KO,
  PILLAR_POSITION_KO,
  RELATION_KIND_KO,
  RELATION_SCOPE_KO,
  TEN_GOD_KO,
  analyzeCompatibility,
  compatSideOf,
  computeSaju,
  type Compatibility,
  type CompatSide,
  type Relation,
  type Saju,
} from '@/src/lib/saju';

import { BirthFields } from './birth-form';
import { CopyLinkButton } from './copy-link';
import { CARD, PILLAR_COLUMNS } from './saju-calculator';
import {
  DEFAULT_QUERY,
  TIME_BASIS,
  mergeSearchParams,
  missingAnswer,
  missingForCalculation,
  queryFromSearchParams,
  toSearchParams,
  type Query,
  type QueryPrefix,
} from './query';

/**
 * 궁합 — 두 원국을 나란히 놓고 **사이에 성립하는 것**만 본다.
 *
 * 원국 하나짜리 화면과 경로를 나눈 이유는 길이다. 명식·분석·관계·운·신살·보정이
 * 이미 한 화면인데 거기에 두 사람을 얹으면 무엇을 보러 왔는지 잃어버린다.
 *
 * **점수를 내지 않는다.** 엔진이 `COMPAT_POLICY.scoring: 'not-scored'` 인 것과
 * 같은 이유이고, 화면은 그 사실을 감추지 않고 맨 위에 적는다. 총점이 없으면
 * 허전해 보이지만, 없는 근거로 숫자를 만드는 것보다 낫다.
 *
 * 주소에는 입력 두 벌이 `a.` · `b.` 접두사로 들어간다. 코덱은 원국 화면과 같은
 * 것을 쓴다 — 같은 값을 넣었는데 다른 사주가 나오는 일을 막는다.
 */

/**
 * 이름을 안 넣었을 때 쓰는 말. 넣으면 이름이 이 자리를 대신한다.
 *
 * "첫 번째 사람의 일지"는 **읽는 사람이 자기를 어디에 놓아야 할지 모른다.**
 * 궁합은 두 사람이 각자 자기 기준으로 읽는 것이라, 관계 한 줄에서 어느 글자가
 * 누구 것인지가 이름으로 붙어야 그 읽기가 가능해진다.
 */
const SIDE_LABEL: Record<CompatSide, string> = { a: '첫 번째', b: '두 번째' };

/** 입력한 이름, 없으면 자리 이름 — 화면에서 사람을 부르는 유일한 통로다 */
const nameOf = (pair: Pair, side: CompatSide): string =>
  pair[side].name.trim() === '' ? `${SIDE_LABEL[side]} 사람` : pair[side].name.trim();

/**
 * 두 사람 중 **먼저 비어 있는 칸** 하나.
 *
 * 둘을 한꺼번에 늘어놓지 않는다. 고칠 곳을 하나씩 가리키는 편이 낫고, 앞사람
 * 이름이 비어 있으면 그 사람을 부를 이름도 아직 없다.
 */
const missingInPair = (
  pair: Pair,
  /** 폼은 이름까지 묻고, 이미 나눠 준 링크는 이름 없이도 열려야 한다 */
  check: (query: Query) => string | null = missingAnswer,
): string | null => {
  for (const side of SIDES) {
    const missing = check(pair[side]);
    if (missing !== null) return `${nameOf(pair, side)}의 ${missing}`;
  }
  return null;
};
const PREFIX: Record<CompatSide, QueryPrefix> = { a: 'a.', b: 'b.' };
const SIDES: readonly CompatSide[] = ['a', 'b'];

type Pair = Record<CompatSide, Query>;

type Result =
  | {
      ok: true;
      charts: Record<CompatSide, Saju>;
      compat: Compatibility;
      /**
       * 두 사람을 부르는 말 — **계산 결과와 한 값에 들어 있다.**
       *
       * 폼에서 따로 읽으면 이름만 고치는 동안 화면이 가리키는 사람과 계산된
       * 명식이 어긋난다. 같은 `pair` 에서 나와야 그 틈이 없다.
       */
      names: Record<CompatSide, string>;
    }
  | { ok: false; message: string };

function computeOne(query: Query): Saju {
  const [year, month, day] = query.date.split('-').map(Number);
  const [hour, minute] = query.time.split(':').map(Number);
  const { useLongitude, useEquationOfTime } = TIME_BASIS[query.basis];

  return computeSaju(
    query.hourKnown === false
      ? { year, month, day, hour: null, gender: query.gender }
      : { year, month, day, hour, minute, second: 0, gender: query.gender },
    {
      lateNightRule: query.rule,
      longitude: CITY_LONGITUDES[query.city],
      useLongitude,
      useEquationOfTime,
      saeun: { fromYear: query.saeunFrom, count: 10 },
    },
  );
}

function calculate(pair: Pair): Result {
  // 버튼을 잠그는 쪽과 같은 답을 본다 — 판정은 `missingAnswer` 한 곳뿐이다.
  const missing = missingInPair(pair, missingForCalculation);
  if (missing !== null) return { ok: false, message: missing };

  // 엔진이 던지는 메시지를 그대로 보여준다. 검증 규칙을 화면에 복제하면
  // 두 곳이 어긋나는 순간 사용자만 헷갈린다.
  try {
    const charts = { a: computeOne(pair.a), b: computeOne(pair.b) };

    return {
      ok: true,
      charts,
      compat: analyzeCompatibility(charts.a, charts.b),
      names: { a: nameOf(pair, 'a'), b: nameOf(pair, 'b') },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '계산에 실패했습니다.',
    };
  }
}

const pairFrom = (params: URLSearchParams): Pair | null => {
  const a = queryFromSearchParams(params, PREFIX.a);
  const b = queryFromSearchParams(params, PREFIX.b);
  // 한 사람만 적힌 주소로는 궁합을 낼 수 없다 — 빈 폼으로 시작한다.
  return a && b ? { a, b } : null;
};

export function CompatCalculator() {
  const searchParams = useSearchParams();
  const submitted = useMemo(() => pairFrom(searchParams), [searchParams]);

  const [form, setForm] = useState<Pair>(submitted ?? { a: DEFAULT_QUERY, b: DEFAULT_QUERY });

  const shown = useRef(searchParams.toString());
  useEffect(() => {
    const current = searchParams.toString();
    if (current === shown.current) return;
    shown.current = current;
    setForm(pairFrom(searchParams) ?? { a: DEFAULT_QUERY, b: DEFAULT_QUERY });
  }, [searchParams]);

  const result = useMemo(() => (submitted === null ? null : calculate(submitted)), [submitted]);

  const missing = missingInPair(form);


  const submit = (next: Pair) => {
    const params = mergeSearchParams(
      toSearchParams(next.a, PREFIX.a),
      toSearchParams(next.b, PREFIX.b),
    ).toString();

    shown.current = params;
    if (submitted === null) window.history.pushState(null, '', `?${params}`);
    else window.history.replaceState(null, '', `?${params}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(form);
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {SIDES.map((side) => (
            <fieldset key={side} className={`${CARD} flex flex-col gap-4`}>
              <legend className="px-1 text-sm font-medium">{nameOf(form, side)}</legend>
              <BirthFields
                value={form[side]}
                onChange={(next) => setForm((current) => ({ ...current, [side]: next }))}
                idPrefix={side}
                namePlaceholder={SIDE_LABEL[side]}
              />
            </fieldset>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={missing !== null}
            className="h-11 w-full rounded-md bg-accent-strong px-5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-auto"
          >
            {submitted === null ? '궁합 보기' : '결과 업데이트'}
          </button>

          {/* 왜 눌리지 않는지 버튼 옆에서 말한다 — 잠긴 버튼만 두면 이유를 찾아야 한다 */}
          {missing !== null && <p className="text-sm text-secondary">{missing}</p>}
        </div>
      </form>

      {result === null ? (
        <section className={`${CARD} bg-surface-sunken`}>
          <h2 className="text-base font-semibold">두 사람의 생년월일시를 입력해 주세요</h2>
          <p className="mt-1.5 text-sm text-secondary">
            두 원국 <strong className="font-medium">사이에</strong> 성립하는 관계와, 서로의 오행을
            어떻게 채우는지를 보여줍니다. 점수는 내지 않습니다.
          </p>
        </section>
      ) : result.ok ? (
        <CompatView charts={result.charts} compat={result.compat} names={result.names} />
      ) : (
        <p role="alert" className={`${CARD} text-sm`}>
          {result.message}
        </p>
      )}
    </div>
  );
}

function CompatView({
  charts,
  compat,
  names,
}: {
  charts: Record<CompatSide, Saju>;
  compat: Compatibility;
  /** 두 사람을 부르는 말 — 입력한 이름이거나 '첫 번째 사람' */
  names: Record<CompatSide, string>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <CopyLinkButton />
      <ChartPair charts={charts} names={names} />
      <BetweenRelations charts={charts} compat={compat} names={names} />
      <SupportCards charts={charts} compat={compat} names={names} />

      {compat.warnings.length > 0 && (
        <section className={CARD}>
          <h2 className="text-base font-semibold">주의</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-secondary">
            {compat.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted">
        <strong className="font-medium">점수를 내지 않습니다.</strong> 궁합 점수는 맞춰볼 외부
        기준이 없어 이 저장소의 다른 판정들(억부는 시험값, 강약은 등급 없음)보다도 근거가
        약합니다. 무엇과 무엇이 어떻게 걸렸는지만 내고, 무게는 읽는 사람이 정합니다.
      </p>
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

/**
 * 사이 관계 — 거리 대신 **자리**로 말한다.
 *
 * 두 사람의 기둥 사이에는 선형 거리가 없어 엔진이 `distance` 를 `null` 로 낸다.
 * 대신 누구의 어느 자리인지를 적는다. 일지끼리 걸린 것은 따로 앞세운다 — 그건
 * 계산이 아니라 자리에 붙은 관습적 의미라 화면의 몫이다.
 */
function BetweenRelations({
  charts,
  compat,
  names,
}: {
  charts: Record<CompatSide, Saju>;
  compat: Compatibility;
  names: Record<CompatSide, string>;
}) {
  const dayToDay = compat.relations.filter(
    (relation) =>
      relation.participants.length === 2 &&
      relation.participants.every((participant) => participant.position === 'day'),
  );

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-base font-semibold">두 원국 사이의 관계</h2>
        <p className="text-sm text-secondary">
          {compat.relations.length === 0 ? '걸리는 것이 없습니다' : `${compat.relations.length}개`}
        </p>
      </div>

      {dayToDay.length > 0 && (
        <div className="mt-3 rounded-md border border-border bg-surface-sunken p-3">
          <p className="text-xs text-muted">일지끼리 — 부부 자리로 읽는 자리입니다</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-sm">
            {dayToDay.map((relation) => (
              <li key={relationKey(relation)}>
                <span className="glyph">
                  {relation.participants.map((participant) => participant.char).join(' ')}
                </span>{' '}
                <span className="font-medium">{relation.ko}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {compat.relations.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="pb-1.5 font-normal whitespace-nowrap">종류</th>
                <th className="pb-1.5 pl-3 font-normal whitespace-nowrap">글자</th>
                <th className="pb-1.5 pl-3 font-normal whitespace-nowrap">이름</th>
                <th className="pb-1.5 pl-3 font-normal whitespace-nowrap">누구의 어느 자리</th>
              </tr>
            </thead>
            <tbody>
              {compat.relations.map((relation) => (
                <tr key={relationKey(relation)} className="border-t border-border align-top">
                  <td className="py-1.5 whitespace-nowrap text-secondary">
                    {RELATION_KIND_KO[relation.kind]}
                  </td>
                  <td className="glyph py-1.5 pl-3 whitespace-nowrap">
                    {relation.participants.map((participant) => participant.char).join(' ')}
                  </td>
                  <td className="py-1.5 pl-3 whitespace-nowrap">{relation.ko}</td>
                  <td className="py-1.5 pl-3 text-xs text-secondary">
                    {relation.participants
                      .map((participant) => {
                        const side = compatSideOf(participant.chartId);
                        // 계산판을 못 알아보면 이름 대신 그 이름표를 보인다 —
                        // 한쪽으로 기본값을 주면 남의 기둥이 조용히 내 것으로 적힌다.
                        const who = side === null ? participant.chartId : names[side];

                        return `${who} ${PILLAR_POSITION_KO[participant.position]}`;
                      })
                      .join(' ↔ ')}
                    {relation.scope === 'combinedFormation' && (
                      <span className="ml-1.5 text-accent">
                        {RELATION_SCOPE_KO.combinedFormation}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        각자의 원국 안에서 닫힌 관계는 빠져 있습니다 — 그건 각자의 명식이 이미 보여준
        사실입니다. 두 사람의 기둥 사이에는 거리라는 것이 없어 몇 칸 떨어졌는지는 적지
        않습니다. 성립 여부만 적고 좋고 나쁨은 판정하지 않습니다.
        {charts.a.meta.hourKnown && charts.b.meta.hourKnown ? '' : ' 시주를 모르는 쪽이 있어 실제보다 적게 나옵니다.'}
      </p>
    </section>
  );
}

const relationKey = (relation: Relation) =>
  `${relation.kind}:${relation.ko}:${relation.participants
    .map((participant) => `${participant.chartId}${participant.position}${participant.char}`)
    .join('-')}`;

/** 오행 보완 · 십성 · 억부 부합 — 사실 세 벌 */
function SupportCards({
  charts,
  compat,
  names,
}: {
  charts: Record<CompatSide, Saju>;
  compat: Compatibility;
  names: Record<CompatSide, string>;
}) {
  const percent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={CARD}>
        <h2 className="text-base font-semibold">서로를 무엇으로 보는가</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          <li>
            <span className="text-secondary">첫 번째가 본 두 번째</span>{' '}
            <span className="font-medium">{TEN_GOD_KO[compat.tenGods.aSeesB]}</span>
          </li>
          <li>
            <span className="text-secondary">두 번째가 본 첫 번째</span>{' '}
            <span className="font-medium">{TEN_GOD_KO[compat.tenGods.bSeesA]}</span>
          </li>
        </ul>
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
          일간끼리만 본 값이고 서로 다를 수 있습니다 — 甲이 본 辛은 정관이지만 辛이 본
          甲은 정재입니다. 육친(누가 누구의 무엇인가)으로 단정하지 않습니다.
        </p>
      </section>

      <section className={CARD}>
        <h2 className="text-base font-semibold">모자란 오행을 채우는가</h2>
        <ul className="mt-3 flex flex-col gap-3 text-sm">
          {SIDES.map((side) => {
            const support = compat.elementSupport[side];
            return (
              <li key={side}>
                <p className="text-secondary">
                  {names[side]}에게 없는 오행{' '}
                  {support.missing.length === 0 ? (
                    <span className="text-foreground">없음 — 다섯 오행이 다 있습니다</span>
                  ) : (
                    <span className="glyph text-foreground">{support.missing.join(' ')}</span>
                  )}
                </p>
                {support.missing.length > 0 && (
                  <p className="mt-0.5 text-xs">
                    <span className="text-muted">상대가 채움</span>{' '}
                    <span className="glyph">{support.supplied.join(' ') || '없음'}</span>
                    <span className="mx-1.5 text-muted">·</span>
                    <span className="text-muted">둘 다 없음</span>{' '}
                    <span className="glyph">{support.stillMissing.join(' ') || '없음'}</span>
                  </p>
                )}
                <p className="mt-0.5 text-xs text-muted">
                  가장 약한 오행 {ELEMENT_KO[support.weakest.element]} 는 상대 원국에서{' '}
                  {percent(support.weakest.partnerRatio)} 입니다
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
          있고 없음만 셉니다. 부족을 채우는 쪽이 좋다는 읽기와 용신에 맞아야 한다는 읽기가
          갈려서, 좋고 나쁨으로 환산하지 않습니다.
        </p>
      </section>

      <section className={`${CARD} lg:col-span-2`}>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="text-base font-semibold">억부 후보를 상대가 갖고 있는가</h2>
          <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
            시험
          </span>
        </div>

        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {SIDES.map((side) => {
            const match = compat.eokbuMatch[side];
            return (
              <li key={side} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-secondary">{names[side]}</span>
                <span className="glyph text-lg font-medium">{match.element}</span>
                <span>{ELEMENT_KO[match.element]}</span>
                <span className="text-secondary">{ELEMENT_ROLE_KO[match.role]}</span>
                <span className={match.presentInPartner ? '' : 'text-muted'}>
                  → 상대 원국에 {match.presentInPartner ? '있음' : '없음'}
                </span>
                <span className="text-xs text-muted tabular-nums">
                  {percent(match.partnerRatio)}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
          <strong className="font-medium">각자의 억부 판정을 그대로 물려받은 값입니다.</strong>{' '}
          억부는 용신을 잡는 네 길 중 하나일 뿐이고, 아직 판정하지 않은 것이 남아 있습니다 —{' '}
          {charts.a.analysis.eokbu.unresolved.length}가지. 확정 용신이 아니므로 &lsquo;상대가 내
          용신을 갖고 있다&rsquo;로 읽으면 안 됩니다.
        </p>
      </section>
    </div>
  );
}
