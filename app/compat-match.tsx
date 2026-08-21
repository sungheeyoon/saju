'use client';

import { useState } from 'react';

import { buildMatchPreview } from '@/src/lib/matching';
import type { Compatibility, Saju } from '@/src/lib/saju';

import { CARD } from './saju-calculator';

/**
 * `match-v0` 를 화면에 세우는 자리.
 *
 * 여기서는 아무것도 계산하지 않는다 — 숫자와 문구는 전부 `buildMatchPreview` 가
 * 낸다. 화면이 제 손으로 가중치를 얹기 시작하면 정책 버전이 가리키는 것과
 * 사람이 본 것이 갈라진다.
 */
export function MatchResult({
  charts,
  compat,
  names,
}: {
  charts: Record<'a' | 'b', Saju>;
  compat: Compatibility;
  names: Record<'a' | 'b', string>;
}) {
  const preview = buildMatchPreview(charts, compat, names);
  const [asked, setAsked] = useState(false);

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex rounded-full bg-accent-wash px-2.5 py-1 text-xs font-medium text-accent">
          궁합 베타 · {preview.policyVersion}
        </span>
        <span className="text-xs text-muted">검증 중인 판정은 지표에서 제외</span>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[14rem_1fr] lg:items-center">
        <div className="rounded-xl bg-surface-sunken p-5 text-center">
          <p className="text-sm text-secondary">
            {names.a} × {names.b}
          </p>
          <p className="mt-2 text-5xl font-semibold tracking-tight tabular-nums">{preview.index}</p>
          <p className="mt-1 text-xs text-muted">100점 만점 베타 탐색 지표</p>
        </div>

        <div className="flex flex-col gap-4">
          {preview.dimensions.map((dimension) => (
            <div key={dimension.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{dimension.label}</span>
                <span className="tabular-nums text-secondary">{dimension.score}</span>
              </div>
              {/*
                막대는 값을 다시 읽는 그림일 뿐이다. 옆의 숫자가 원본이고, 폭은
                거기서 나온다 — 눈으로 어림한 길이를 값으로 읽지 않게 한다.
              */}
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-track">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${dimension.score}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">{dimension.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="text-sm font-semibold">먼저 보이는 신호</h3>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-secondary">
          {preview.highlights.map((highlight) => (
            <li key={highlight}>· {highlight}</li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs text-muted">{preview.caveat}</p>

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">상세 궁합 리포트</p>
          <p className="mt-1 text-xs text-muted">
            대화 방식 · 생활 리듬 · 마찰 지점 · 서로를 보완하는 방법
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAsked(true)}
          className="h-10 shrink-0 rounded-md bg-accent-strong px-5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          관심 있어요
        </button>
      </div>

      {/*
        아직 아무것도 받지 않기로 했으므로 화면도 그렇게 말한다. 신청을 받는 것처럼
        보이는 버튼이 실제로는 아무 데도 닿지 않는 상태를 만들지 않는다.
      */}
      {asked && (
        <p role="status" className="mt-3 rounded-lg bg-accent-wash px-4 py-3 text-sm text-accent">
          아직 만들고 있습니다. 지금은 신청을 받지 않고, 누른 것도 남기지 않습니다.
        </p>
      )}
    </section>
  );
}
