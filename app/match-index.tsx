import type { MatchPreview } from '@/src/lib/matching';

import { CARD } from './card';

/**
 * `match-v0` 를 화면에 세우는 자리 — **여기서는 아무것도 계산하지 않는다.**
 *
 * 숫자와 문구는 전부 `buildMatchPreview` 가 낸다. 화면이 제 손으로 가중치를 얹기
 * 시작하면 정책 버전이 가리키는 것과 사람이 본 것이 갈라진다.
 *
 * **셈이 끝난 값만 받는다.** 두 `Saju` 를 받지 않는 것이 요점이다 — 익명 화면은
 * 브라우저가 두 명식을 들고 있어도 되지만(자기가 입력한 것이다) Match 결과 화면은
 * 상대의 명식을 브라우저로 내려보내지 않는다(ADR 0008·0010). 받는 것을 `MatchPreview`
 * 하나로 좁히면 **그 규율이 타입에 적힌다** — 명식을 넘길 자리가 없다.
 */
export function MatchIndexCard({
  preview,
  names,
  children,
}: {
  preview: MatchPreview;
  /** 두 사람을 부르는 말 — 지표 위에 누구와 누구인지를 적는다 */
  names: Record<'a' | 'b', string>;
  /** 카드 아래에 덧붙는 것 — 화면마다 다르다(익명 화면의 신청 칸 같은 것) */
  children?: React.ReactNode;
}) {
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

      {children}
    </section>
  );
}

/**
 * 엔진과 지표의 경계 — **화면마다 다시 쓰지 않는다.**
 *
 * 익명 화면과 Match 결과 화면이 같은 지표를 세우므로 같은 각주가 붙어야 한다. 두
 * 곳에 손으로 적으면 한쪽만 고쳐지고, 그때 더 세게 말하는 쪽이 남는다.
 */
export function ScoringNote() {
  return (
    <p className="text-xs text-muted">
      <strong className="font-medium">사주 엔진은 점수를 내지 않습니다.</strong> 위 베타 지표는
      엔진이 낸 사실에 공개된 가중치를 얹은 제품용 비교값입니다. 맞춰볼 외부 기준이 아직
      없으므로 궁합의 정답이나 관계의 좋고 나쁨으로 읽지 않습니다.
    </p>
  );
}
