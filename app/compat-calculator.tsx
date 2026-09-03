'use client';

import { useEffect, useMemo, useRef, useState } from 'react';


import {
  analyzeCompatibility,
  type Compatibility,
  type CompatSide,
  type Saju,
} from '@/src/lib/saju';

import { chartOf } from './chart';
import { BirthFields } from './birth-form';
import { MatchResult } from './compat-match';
import { CompatView, SIDES, SIDE_LABEL } from './compat-view';
import { ScoringNote } from './match-index';
import { CopyLinkButton } from './copy-link';
import { CARD } from './card';
import { useHashParams, writeParams } from './hash-query';
import {
  DEFAULT_QUERY,
  mergeSearchParams,
  missingAnswer,
  missingForCalculation,
  PREFIX,
  queryFromSearchParams,
  toSearchParams,
  type Query,
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

  /*
    보는 시각도, 두 사람이 무슨 사이인가도 **여기서 잡지 않는다.**

    둘 다 넘길 자료(`EvidencePanel`)를 위한 값이었다 — 시각은 자료가 「지금 도는 운」을
    짚는 기준이고, 사이는 복사해 가는 프롬프트에 실리는 한 줄이다. 그 칸이 `/evidence`
    로 옮겨 가면서 함께 옮겼다. 여기 두고 왔으면 아무것도 바꾸지 않는 라디오가 결과
    화면에 남았을 것이다.

    이 화면이 그리는 것(두 명식·사이의 관계·`match-v0` 지표)은 시각을 묻지 않는다.
  */

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
            두 사람 사이에 보이는 관계와 서로의 오행을 어떻게 보완하는지 정리해 드립니다.
            직접 입력한 정보와 결과는 계정에 저장되지 않습니다.
          </p>
        </section>
      ) : result.ok ? (
        <CompatView
          charts={result.charts}
          compat={result.compat}
          names={result.names}
          /* 이 화면의 링크에는 두 사람의 입력이 통째로 실린다 — 그 사실을 버튼이 말한다 */
          notice={<CopyLinkButton />}
          /*
            익명 화면에는 AI 가 없다(저장도 계정도 없다). 그래서 사실 아래에 서는 것은
            결정론적 베타 지표뿐이고, 무엇을 보고 있는지는 각주가 말한다.
          */
          verdict={
            <>
              <MatchResult charts={result.charts} compat={result.compat} names={result.names} />
              <ScoringNote />
            </>
          }
        />
      ) : (
        <p role="alert" className={`${CARD} text-sm`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
