import type { VariantProps } from '../..';

/** 화면 자리 — 맡은 디자이너 에이전트가 채운다 */
export default function Screen({ state }: VariantProps) {
  return (
    <p className="rounded-[1.75rem] border border-border bg-surface-sunken p-5 text-sm text-muted">
      아직 만들지 않은 화면입니다 · 방 {state.rooms.length}개
    </p>
  );
}
