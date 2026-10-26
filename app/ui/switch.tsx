'use client';

/**
 * **스위치 한 벌** — 누르면 곧 켜지고 꺼지는 설정 하나(ADR 0109 추기 2026-10-25).
 *
 * 켜고 끄는 것을 알약 단추(「끄기」 · 「켜기」)로 세우면 지금 상태(「현재 동의 중」)와 누를 것(「끄기」)이 둘로 서서, 사람은 어느
 * 쪽이 지금인지 한 번 더 읽어야 했다(2026-10-24 디자인 감사). 스위치는 한 자리가 상태이자 손잡이다 — 토스 TDS · 당근 SEED ·
 * Apple HIG · Material 3 가 모두 「곧 적용되는 두 상태」에만 쓴다. 저장 단추가 따로 있는 폼 · 둘 중 하나를 고르는 자리(성별)에는
 * 쓰지 않는다.
 *
 * - **접근성은 `role="switch"` · `aria-checked` 다.** 이름은 옆 글자가 든다(`aria-labelledby`) — 이름에 「켜짐」 · 「스위치」를 넣지
 *   않는다(TDS 「추가로 지원해야 하는 접근성」). 상태는 보조기기가 「켬 · 끔」으로 읽는다.
 * - **색만으로 상태를 말하지 않는다** — 손잡이의 자리(왼쪽 · 오른쪽)가 함께 바뀐다.
 * - **누를 자리는 44px 이다.** 판(32px 높이)은 그대로 두고 투명한 덮개(`after:`)만 위아래로 내민다 — 성별 칸과 같은 방식.
 * - **보내는 동안(`busy`)은 누름을 받지 않는다** — `disabled` 가 아니라 `aria-disabled` 라 초점이 그 자리에 남는다(키보드로 누른
 *   사람의 초점이 사라지지 않게).
 */
export function Switch({
  checked,
  onChange,
  busy = false,
  disabled = false,
  id,
  labelledBy,
  label,
  describedBy,
}: {
  checked: boolean;
  /** 눌렀을 때 바뀔 값으로 부른다 */
  onChange: (next: boolean) => void;
  busy?: boolean;
  disabled?: boolean;
  id?: string;
  /** 옆에 선 이름의 id — 있으면 이것이 이름이다 */
  labelledBy?: string;
  /** 옆에 선 이름이 없을 때만 */
  label?: string;
  describedBy?: string;
}) {
  const inert = busy || disabled;
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={labelledBy === undefined ? label : undefined}
      aria-describedby={describedBy}
      aria-busy={busy || undefined}
      aria-disabled={inert || undefined}
      onClick={() => {
        if (!inert) onChange(!checked);
      }}
      className={`relative inline-flex h-8 w-[3.25rem] shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors after:absolute after:-inset-y-1.5 after:-inset-x-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface aria-disabled:cursor-default ${
        checked ? 'bg-accent' : 'bg-border-strong'
      } ${disabled ? 'opacity-55' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`size-7 rounded-full shadow-soft transition-transform motion-reduce:transition-none ${
          checked ? 'translate-x-5 bg-on-accent' : 'translate-x-0 bg-surface'
        } ${busy ? 'animate-pulse' : ''}`}
      />
    </button>
  );
}
