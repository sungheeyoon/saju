'use client';

import { useId, type ReactNode } from 'react';

import { Icon } from './icons';

/**
 * **폼의 몸 한 벌** — 이름표 · 적는 칸(쪽지) · 고르는 칸(미끄러지는 세그먼트) · 들어오는 칸의 움직임.
 *
 * 생년월일시 폼(`birth-form.tsx`)이 첫 화면 · 궁합 · 내 사주 등록 · 출생 정보 수정 · 사람 추가 다섯 곳에서 같은 몸으로
 * 서도록 여기 둔다. 칸은 **크림 종이 위에서도 흰 카드 위에서도** 같은 것으로 읽혀야 한다 — 그래서 면은 흰 쪽지(`bg-surface`)
 * 에 한 단계 짙은 테(`ring-border-strong`)이고, 초점은 먹색 테 + 옅은 크림 번짐 한 겹이다(새 색은 짓지 않는다, ADR 0109).
 *
 * 상태는 넷이다 — 쉼(흰 쪽지) · 초점(먹색 테와 번짐) · 채움(이름표 곁에 작은 체크가 톡 선다) · 어긋남(위험 색 테와
 * 짧은 흔들림). 움직임은 모두 `globals.css` 의 줄인 움직임 규칙을 따른다.
 */

/** 적는 칸의 쪽지 — 안의 `<input>` 은 투명하고, 초점은 쪽지가 두른다(`focus-within`) */
export const FIELD_SLIP =
  'group/slip flex min-h-12 w-full min-w-0 items-center rounded-2xl bg-surface ring-1 ring-border-strong transition-[box-shadow,background-color] duration-200 focus-within:ring-[1.5px] focus-within:ring-[color-mix(in_srgb,var(--accent)_62%,transparent)] focus-within:shadow-[0_0_0_5px_var(--accent-soft)] has-[[aria-invalid=true]]:ring-2 has-[[aria-invalid=true]]:ring-danger has-[[aria-invalid=true]]:shadow-[0_0_0_6px_var(--danger-wash)]';

/** 비어서 못 넘어간 칸 — 제출을 누른 뒤에만 선다(`BirthFields` 의 `showMissing`) */
export const FIELD_SLIP_MISSING = 'ring-2! ring-[color-mix(in_srgb,var(--danger)_65%,transparent)]! shadow-[0_0_0_5px_var(--danger-wash)]!';

/** 쪽지 안 한 줄 글 칸 */
export const FIELD_INPUT =
  'h-12 min-w-0 flex-1 bg-transparent px-4 text-base text-foreground outline-none placeholder:text-muted';

/**
 * 칸 위 이름표 — 13px 굵은 보조색. **답이 차면 곁에 작은 체크가 톡 선다**(`done`). 기본값이 있는 칸(성별 · 달력 ·
 * 출생지)은 체크를 안 단다 — 사람이 채운 것만 「채웠다」고 말한다.
 */
export function FieldLabel({
  id,
  htmlFor,
  children,
  done = false,
  hint,
  missing = false,
}: {
  id?: string;
  htmlFor?: string;
  children: ReactNode;
  done?: boolean;
  /** 이름표 오른쪽 끝의 작은 말 — 「24시간」 */
  hint?: ReactNode;
  missing?: boolean;
}) {
  const Tag = htmlFor === undefined ? 'span' : 'label';
  return (
    <span className="flex min-h-5 items-center gap-1.5 px-1">
      <Tag
        id={id}
        htmlFor={htmlFor}
        className={`text-[13px] font-semibold tracking-[-0.01em] transition-colors ${missing ? 'text-danger' : 'text-secondary'}`}
      >
        {children}
      </Tag>
      <span
        aria-hidden="true"
        className={`grid size-4 place-items-center rounded-full bg-accent text-on-accent transition-[opacity,scale] duration-300 ease-[cubic-bezier(.2,1.4,.4,1)] ${
          done ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
        }`}
      >
        <Icon name="check" className="size-2.5 stroke-[4]" />
      </span>
      {hint !== undefined && <span className="ml-auto text-xs text-muted">{hint}</span>}
    </span>
  );
}

export type SegmentOption<T extends string> = { value: T; label: string; hint?: string };

/**
 * **미끄러지는 세그먼트** — 고를 것이 둘 · 셋일 때. 펼쳐서 고르던 줄(시안 n)은 한 번 고르는 데 두 번 눌렀다 — 여기서는
 * 고를 것이 다 보이고 한 번에 고른다. 고른 쪽 아래로 흰 알약이 미끄러져 들어간다.
 *
 * 속은 **진짜 라디오 묶음**이다 — 화살표 이동과 한 번에 하나라는 규칙은 브라우저가 이미 안다. 라디오는 보이지 않게 칸
 * 전체를 덮고(눌리는 것도 초점을 받는 것도 라디오다), 초점 테는 칸이 두른다. 값이 빈 문자열이면 아직 안 고른 것이다 —
 * 알약이 서지 않는다(「고르지 않은 것을 골랐다고 치지 않는다」, `hourKnown` 이 셋인 까닭).
 *
 * `vertical` 은 항목이 길 때(시간 기준) 위아래로 쌓고 알약도 위아래로 미끄러진다.
 */
export function Segmented<T extends string>({
  name,
  options,
  value,
  onPick,
  disabled = false,
  vertical = false,
  compact = false,
  missing = false,
}: {
  /** 묶음 이름 — 낭독기가 부르고 시험이 찾는다 */
  name: string;
  options: readonly SegmentOption<T>[];
  value: T | '';
  onPick: (value: T) => void;
  disabled?: boolean;
  vertical?: boolean;
  /** 곁가지 물음(달력) — 낮고 작은 글자. 누를 자리는 그대로 44px 이다 */
  compact?: boolean;
  missing?: boolean;
}) {
  const group = useId();
  const index = options.findIndex((option) => option.value === value);
  const n = options.length;
  const inset = compact ? '0.25rem' : '0.5rem';

  return (
    <div
      role="radiogroup"
      aria-label={name}
      aria-disabled={disabled || undefined}
      className={`relative grid ${compact ? 'rounded-[0.9rem] p-0.5' : 'rounded-2xl p-1'} bg-surface-sunken ring-1 ring-border transition-[box-shadow] ${
        missing ? FIELD_SLIP_MISSING : ''
      } ${disabled ? 'opacity-45' : ''}`}
      style={vertical ? undefined : { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      {/* 고른 자리의 흰 알약 — 자리를 옮길 때 미끄러진다 */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute ${compact ? 'left-0.5 top-0.5 rounded-[0.75rem]' : 'left-1 top-1 rounded-xl'} bg-surface shadow-soft ring-1 ring-border transition-[transform,opacity] duration-300 ease-[cubic-bezier(.3,1.25,.4,1)] ${
          index < 0 ? 'opacity-0' : 'opacity-100'
        }`}
        style={
          vertical
            ? { width: `calc(100% - ${inset})`, height: `calc((100% - ${inset}) / ${n})`, transform: `translateY(${Math.max(index, 0) * 100}%)` }
            : { height: `calc(100% - ${inset})`, width: `calc((100% - ${inset}) / ${n})`, transform: `translateX(${Math.max(index, 0) * 100}%)` }
        }
      />
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className={`relative flex min-h-11 cursor-pointer items-center gap-x-2 rounded-xl px-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:-outline-offset-1 has-[:focus-visible]:outline-[color-mix(in_srgb,var(--accent)_45%,transparent)] ${
              vertical ? 'justify-between py-2' : 'flex-col justify-center py-1.5 text-center'
            } ${disabled ? 'cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name={group}
              aria-label={option.label}
              checked={checked}
              disabled={disabled}
              onChange={() => onPick(option.value)}
              className="absolute inset-0 cursor-pointer appearance-none rounded-xl opacity-0 disabled:cursor-not-allowed"
            />
            <span
              className={`${compact ? 'text-[14px]' : 'text-[15px]'} leading-5 transition-colors duration-200 ${
                checked ? 'font-semibold text-foreground' : 'font-medium text-secondary'
              }`}
            >
              {option.label}
            </span>
            {option.hint !== undefined && (
              <span className={`text-[11.5px] leading-4 ${checked ? 'text-secondary' : 'text-muted'}`}>{option.hint}</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

/**
 * **들어오는 칸** — 새로 선 칸(시 · 분 · 고급 설정의 속 · 출생지 고르기)이 위에서 살짝 내려앉으며 선다.
 * 빠질 때는 그냥 빠진다(지운 칸을 붙잡아 두면 화면 읽기와 시험이 그 칸을 아직 있다고 읽는다).
 */
export const ENTER = 'animate-[field-in_260ms_cubic-bezier(.2,.8,.2,1)_both]';

/**
 * **준비됐다는 표시** — 주 단추 안 끝의 화살표. 답할 것이 다 차면 왼쪽에서 미끄러져 들어온다(`ready`). 단추를 잠그지 않는
 * 화면(첫 화면)에서도 「이제 눌러도 된다」를 글 없이 말한다. 단추의 이름은 바뀌지 않는다(그림은 `aria-hidden`).
 */
export function ReadyArrow({ ready }: { ready: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid overflow-hidden transition-[width,opacity,margin] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
        ready ? 'w-[18px] opacity-100' : '-ml-2 w-0 opacity-0'
      }`}
    >
      <Icon name="arrow" className={`size-[18px] transition-transform duration-300 ${ready ? 'translate-x-0' : '-translate-x-2'}`} />
    </span>
  );
}

/** 다 찬 순간 주 단추가 한 번 숨을 쉰다 — `ready` 일 때만 단다(클래스가 붙는 순간 한 번 돈다) */
export const READY_BREATH = 'animate-[ready-breath_900ms_ease-out_1]';
