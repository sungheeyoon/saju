import type { VariantProps } from '..';

/** 시안 자리 — 맡은 디자이너 에이전트가 채운다 */
export default function Variant({ state }: VariantProps) {
  return (
    <p className="rounded-[1.75rem] border border-border bg-surface-sunken p-5 text-sm text-muted">
      아직 만들지 않은 시안입니다 · 사람 {state.people.length}명
    </p>
  );
}
