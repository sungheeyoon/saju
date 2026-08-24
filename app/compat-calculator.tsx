'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  GENDER_KO,
  PILLAR_POSITION_KO,
  RELATION_KIND_KO,
  RELATION_SCOPE_KO,
  analyzeCompatibility,
  assembleCompatText,
  compatSideOf,
  resolveRelation,
  type Compatibility,
  type CompatSide,
  type ResolvedRelation,
  type Saju,
  type Utterance,
} from '@/src/lib/saju';

import { chartOf } from './chart';
import { BirthFields } from './birth-form';
import { MatchResult } from './compat-match';
import { CopyLinkButton } from './copy-link';
import { EvidencePanel } from './evidence-panel';
import { CARD } from './card';
import { useHashParams, writeParams } from './hash-query';
import { PILLAR_COLUMNS } from './saju-calculator';
import {
  TOPICS_THE_TABLE_HOLDS,
  TOPIC_TABLE_FOOTNOTE,
  UtteranceList,
  said,
  warningsToShow,
} from './utterances';
import {
  DEFAULT_QUERY,
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

function calculate(pair: Pair): Result {
  // 버튼을 잠그는 쪽과 같은 답을 본다 — 판정은 `missingAnswer` 한 곳뿐이다.
  const missing = missingInPair(pair, missingForCalculation);
  if (missing !== null) return { ok: false, message: missing };

  // 엔진이 던지는 메시지를 그대로 보여준다. 검증 규칙을 화면에 복제하면
  // 두 곳이 어긋나는 순간 사용자만 헷갈린다.
  try {
    const charts = { a: chartOf(pair.a), b: chartOf(pair.b) };

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
  const searchParams = useHashParams();
  const submitted = useMemo(() => pairFrom(searchParams), [searchParams]);

  const [form, setForm] = useState<Pair>(submitted ?? { a: DEFAULT_QUERY, b: DEFAULT_QUERY });

  /**
   * 결과를 **보는** 시각. 제출할 때마다 새로 잡는다.
   *
   * 원국 화면과 같은 규율이다(`SajuCalculator`) — 엔진은 시각을 스스로 묻지 않고
   * (`NOW_POLICY.viewingInstant`) `Date.now()` 를 부르는 곳은 화면 한 곳이다.
   * 링크로 바로 들어왔으면 첫 렌더 시각이 그 값이다.
   */
  const [viewedAt, setViewedAt] = useState(() => Date.now());

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
    setViewedAt(Date.now());
    writeParams(params, submitted === null ? 'push' : 'replace');
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
            어떻게 채우는지를 보여줍니다. 그 사실 아래에, 사실만 입력으로 쓰는 베타
            매칭 지표가 함께 섭니다.
          </p>
        </section>
      ) : result.ok ? (
        <CompatView
          charts={result.charts}
          compat={result.compat}
          names={result.names}
          viewedAt={viewedAt}
        />
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
  viewedAt,
}: {
  charts: Record<CompatSide, Saju>;
  compat: Compatibility;
  /** 두 사람을 부르는 말 — 입력한 이름이거나 '첫 번째 사람' */
  names: Record<CompatSide, string>;
  /** 결과를 보는 기준 시각(ms) — 넘길 자료가 지금의 운을 이 시각으로 짚는다 */
  viewedAt: number;
}) {
  // L3 는 `Compatibility` 와 사람마다 이름 하나만 받는다. `Saju` 를 통째로 넘기면
  // 문장이 다시 계산할 길이 생기고, 화면의 궁합과 문장의 궁합이 언젠가 어긋난다.
  // 시각을 알았는가는 넘기지 않는다 — 궁합이 이미 값으로 든다.
  const utterances = assembleCompatText(compat, {
    a: { label: names.a },
    b: { label: names.b },
  });

  return (
    <div className="flex flex-col gap-6">
      <CopyLinkButton />
      <ChartPair charts={charts} names={names} />
      <BetweenRelations
        compat={compat}
        names={names}
        coverage={said(utterances, (topic) => topic === TOPIC_TABLE_FOOTNOTE)}
      />
      <SaidBetween
        utterances={said(utterances, (topic) => !TOPICS_THE_TABLE_HOLDS.includes(topic))}
      />

      {/*
        엔진 경고 중 **발화가 대신 말하지 않는 것만** 여기 선다. 시간 미상 둘은
        L3 가 이름을 부르며 제자리에서 말하므로 빠진다 — 엔진은 사람을 이름으로
        부를 수 없고('두 번째 사람의'), 그것은 이름을 계산에 넣지 않기로 한
        결정의 대가다. 카드째 걷어내지 않은 것은 나중에 생길 경고를 조용히 지우지
        않기 위해서다(`WARNINGS_SAID_BY_UTTERANCES`).
      */}
      {warningsToShow(compat.warnings).length > 0 && (
        <section className={CARD}>
          <h2 className="text-base font-semibold">주의</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-secondary">
            {warningsToShow(compat.warnings).map((warning) => (
              <li key={warning.kind}>{warning.text}</li>
            ))}
          </ul>
        </section>
      )}

      <MatchResult charts={charts} compat={compat} names={names} />

      <EvidencePanel a={charts.a} b={charts.b} viewedAt={viewedAt} />

      <p className="text-xs text-muted">
        <strong className="font-medium">사주 엔진은 점수를 내지 않습니다.</strong> 위 베타 지표는
        엔진이 낸 사실에 공개된 가중치를 얹은 제품용 비교값입니다. 맞춰볼 외부 기준이 아직
        없으므로 궁합의 정답이나 관계의 좋고 나쁨으로 읽지 않습니다.
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
  compat,
  names,
  coverage,
}: {
  compat: Compatibility;
  names: Record<CompatSide, string>;
  /** 목록의 한계는 목록이 든다 — 시각을 둘 다 알면 비어 있다 */
  coverage: Utterance[];
}) {
  /**
   * 인덱스를 푼 꼴로 한 번만 바꾸고 그것만 읽는다.
   *
   * 화면은 여태 `orderedParticipants` 로 그때그때 풀었고 그것으로 충분했다.
   * 부족해진 것은 `relation.cycle` 을 인덱스인 채로 읽는 자리가 남아 있어서다 —
   * 같은 관계를 한 줄에서는 글자로, 다른 줄에서는 인덱스로 읽으면 어느 쪽이
   * 배치에 딸린 값인지 화면만 보고는 알 수 없다.
   */
  const relations: ResolvedRelation[] = compat.relations.map(resolveRelation);

  const dayToDay = relations.filter(
    (relation) =>
      relation.participants.length === 2 &&
      relation.participants.every((participant) => participant.position === 'day'),
  );

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-base font-semibold">두 원국 사이의 관계</h2>
        <p className="text-sm text-secondary">
          {relations.length === 0 ? '걸리는 것이 없습니다' : `${relations.length}개`}
        </p>
      </div>

      {dayToDay.length > 0 && (
        <div className="mt-3 rounded-md border border-border bg-surface-sunken p-3">
          <p className="text-xs text-muted">일지끼리 — 부부 자리로 읽는 자리입니다</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-sm">
            {dayToDay.map((relation) => (
              <li key={relation.id}>
                <span className="glyph">
                  {relation.participants.map((participant) => participant.char).join(' ')}
                </span>{' '}
                <span className="font-medium">{relation.ko}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {relations.length > 0 && (
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
              {relations.map((relation) => (
                <tr key={relation.id} className="border-t border-border align-top">
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
                      // 완전 삼형은 고리라 `↔`(짝) 가 아니라 `→`(도는 순서) 로 잇는다.
                      .join(relation.cycle ? ' → ' : ' ↔ ')}
                    {relation.cycle && <span className="text-muted"> → 처음으로</span>}
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

      {/*
        손으로 적던 자리다: "시주를 모르는 쪽이 있어 실제보다 적게 나옵니다."
        **누구인지를 못 적었다** — 한쪽만 모르는 것과 둘 다 모르는 것은 같은 칸이지만
        같은 문장이 아니고, 그것을 아는 것은 발화 쪽이다(`relation.coverage`).
      */}
      {coverage.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <UtteranceList utterances={coverage} />
        </div>
      )}

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        각자의 원국 안에서 닫힌 관계는 빠져 있습니다 — 그건 각자의 명식이 이미 보여준
        사실입니다. 두 사람의 기둥 사이에는 거리라는 것이 없어 몇 칸 떨어졌는지는 적지
        않습니다. 성립 여부만 적고 좋고 나쁨은 판정하지 않습니다.
      </p>
    </section>
  );
}

/**
 * 두 사람 사이에 대해 **말할 수 있는 것** — L3 가 낸 발화를 그대로 놓는다.
 *
 * 여기 있던 카드 셋(십성 · 오행 보완 · 억부 부합)은 같은 값을 손으로 쓴 산문과
 * 각주로 냈다. 문제는 **같은 문제를 다른 규율로 다뤘다**는 것이다 — 화면은 시간
 * 미상을 아래쪽 경고 카드로 알렸고, 계약은 강도를 내리거나 입을 닫기로 했다.
 * 둘을 나란히 두면 시각을 모르는 명식에서 카드는 "없습니다"라고 말하고 문장은
 * 침묵한다. 그래서 카드를 걷어내고 발화를 그대로 놓는다.
 *
 * **정책 고지는 화면이 든다.** 점수를 내지 않는다거나 억부가 확정 용신이 아니라는
 * 말은 이 명식에 대한 주장이 아니라 저장소가 무엇을 하지 않기로 했는가라서,
 * 명식마다 나오는 발화에 얹을 것이 아니다.
 */
function SaidBetween({ utterances }: { utterances: Utterance[] }) {
  return (
    <section className={CARD}>
      <h2 className="text-base font-semibold">두 사람 사이에 대해 말할 수 있는 것</h2>

      <div className="mt-3">
        <UtteranceList utterances={utterances} />
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 text-xs text-muted">
        <p>
          왼쪽 딱지는 <strong className="font-medium">얼마나 세게 말할 수 있는가</strong>입니다.
          여덟 글자에서 곧장 세어진 것은 사실, 우리가 고른 문턱을 거친 것은 유도, 아직
          시험 중인 규칙은 후보입니다. 근거보다 세게 말하지 않는지는 계약이 검사합니다.
        </p>
        <p>
          십성은 일간끼리만 본 값이라 양쪽이 서로 다를 수 있고, 육친(누가 누구의 무엇인가)
          으로 단정하지 않습니다. 오행은 있고 없음만 셉니다 — 부족을 채우는 쪽이 좋다는
          읽기와 용신에 맞아야 한다는 읽기가 갈려서 좋고 나쁨으로 환산하지 않습니다.
        </p>
        <p>
          억부 부합은 <strong className="font-medium">각자의 억부 판정을 그대로 물려받은
          값</strong>입니다. 억부는 용신을 잡는 네 길 중 하나일 뿐이라 확정 용신이 아니고,
          &lsquo;상대가 내 용신을 갖고 있다&rsquo;로 읽으면 안 됩니다.
        </p>
      </div>
    </section>
  );
}
