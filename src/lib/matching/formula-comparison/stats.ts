import { mulberry32 } from '../../saju/population';

/**
 * 비교기의 통계 — 평균 · 표준편차 · 분위 · 순위 상관 · 상위 겹침 · 동점률 · AUC · 부트스트랩 구간. 의존 없이 여기
 * 한 벌만 둔다.
 */

export const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? Number.NaN : xs.reduce((sum, x) => sum + x, 0) / xs.length;

export function sd(xs: readonly number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** 가장 가까운 순위 분위(보간 없음) — 정수 점수에서 정수를 낸다 */
export function quantile(xs: readonly number[], q: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
}

/** 같은 값은 평균 순위 */
export function ranks(xs: readonly number[]): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(xs.length);
  for (let start = 0; start < order.length; ) {
    let end = start;
    while (end + 1 < order.length && order[end + 1][0] === order[start][0]) end++;
    const rank = (start + end) / 2 + 1;
    for (let k = start; k <= end; k++) out[order[k][1]] = rank;
    start = end + 1;
  }
  return out;
}

function pearson(xs: readonly number[], ys: readonly number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}

export const spearman = (xs: readonly number[], ys: readonly number[]): number =>
  pearson(ranks(xs), ranks(ys));

/**
 * 두 점수로 뽑은 상위 `k` 가 몇 명 겹치는가. 동점은 앞 번호(먼저 뽑힌 후보)가 이긴다 — 두 점수에 같은 규칙이라
 * 동점이 많은 공식이 순서 탓에 덜 겹쳐 보이지 않는다.
 */
export function topOverlap(a: readonly number[], b: readonly number[], k: number): number {
  const top = (xs: readonly number[]) =>
    new Set(
      xs
        .map((x, i) => [x, i] as const)
        .sort((p, q) => q[0] - p[0] || p[1] - q[1])
        .slice(0, k)
        .map(([, i]) => i),
    );
  const ta = top(a);
  return [...top(b)].filter((i) => ta.has(i)).length;
}

/** 두 쌍을 무작위로 골랐을 때 같은 값일 확률 — Σ p² */
export function collisionRate(xs: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let sum = 0;
  for (const c of counts.values()) sum += (c / xs.length) ** 2;
  return sum;
}

/** 양성이 음성보다 높을 확률(동점 반) — 표본이 어느 쪽이든 비면 `NaN` */
export function auc(positives: readonly number[], negatives: readonly number[]): number {
  if (positives.length === 0 || negatives.length === 0) return Number.NaN;
  let wins = 0;
  for (const p of positives) for (const n of negatives) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (positives.length * negatives.length);
}

/**
 * AUC 의 부트스트랩 95% 구간 — 양성 · 음성을 **따로** 복원 추출한다(층화). 표본이 양성 19 · 음성 9 처럼 작고
 * 한쪽으로 기울어 있으면 한데 섞어 뽑을 때 음성이 둘셋만 든 표본이 나와 구간이 제 크기보다 넓어진다. 분위는
 * 백분위(2.5 · 97.5)이고 시드를 박아 다시 돌려도 같은 값이 나온다.
 */
export function bootstrapAucInterval(
  positives: readonly number[],
  negatives: readonly number[],
  draws = 2000,
  seed = 20260925,
): { low: number; high: number } {
  if (positives.length === 0 || negatives.length === 0) return { low: Number.NaN, high: Number.NaN };
  const random = mulberry32(seed);
  const resample = (xs: readonly number[]) => xs.map(() => xs[Math.floor(random() * xs.length)]);
  const aucs = Array.from({ length: draws }, () => auc(resample(positives), resample(negatives)));
  return { low: quantile(aucs, 0.025), high: quantile(aucs, 0.975) };
}
