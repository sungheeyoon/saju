import Link from 'next/link';
import { useId, type ReactNode } from 'react';

import { BUTTON_PRIMARY_SMALL, BUTTON_SECONDARY_SMALL } from '../../ui/buttons';
import { Icon } from '../../ui/icons';
import { Switch } from '../../ui/switch';

/**
 * 계정 관리의 **무리 지은 목록 한 벌** — 판(카드) 없이 이름 · 구분선 · 줄이다(2026-10-25, 설정 목록 재배치).
 *
 * 이 화면은 성질이 다른 무리 여럿이 위에서 아래로 쌓인 자리다(프로필 · 상대 조건 · 인연 찾기 · 알림 · 선택 동의 · 로그인 정보).
 * 무리마다 흰 카드를 세우고 줄마다 알약 단추(「끄기」 · 「켜기」 · 「로그아웃」 · 「탈퇴」)를 달았더니, 판 여섯과 알약 일곱이 같은
 * 무게로 서서 무엇이 상태이고 무엇이 행동인지가 안 갈렸다(2026-10-24 디자인 감사). 그래서 토스 · 당근 · iOS 설정의 목록을 따른다.
 *
 * ## 규칙 넷
 *
 * 1. **무리는 작은 이름과 위아래 구분선 사이의 줄 목록이다.** 판 · 그림자 · 둥근 모서리가 없다 — 줄 사이는 가는 선 하나.
 * 2. **곧 적용되는 켜고 끄기는 스위치다**(`SettingsSwitchRow`, `app/ui/switch.tsx`). 상태 글자와 누름이 한 자리다.
 * 3. **다른 화면으로 가는 줄은 줄 전체가 링크이고 끝에 「›」가 선다**(`SettingsLinkRow`).
 * 4. **로그아웃 · 탈퇴는 맨 아래의 글자 줄이다**(`SettingsTextRow`) — 알약이 아니다. 되돌리기 어려운 일은 그 뒤의 확인 창이 묻는다.
 *
 * 둘 중 하나를 고르는 자리(성별)와 짧은 링크는 여전히 `SettingsRow` 의 오른쪽 손잡이다.
 */

/** 시작하는 누름 — 한 무리에 하나뿐이다 */
export const SETTINGS_PRIMARY = BUTTON_PRIMARY_SMALL;

/** 되돌릴 수 있는 누름 */
export const SETTINGS_QUIET = BUTTON_SECONDARY_SMALL;

/** 줄 하나의 껍데기 — 직접 `<fieldset>` 으로 감싸야 하는 자리가 있어 클래스도 내준다 */
export const SETTINGS_ROW =
  'flex flex-col gap-3 border-t border-border py-4 first:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6';

/** 줄의 이름 · 아래 한 줄 · 그 아래 작은 한 줄 */
const ROW_LABEL = 'text-body font-semibold leading-6 text-foreground';
const ROW_HELP = 'text-small leading-5 text-secondary';
const ROW_NOTE = 'text-small leading-5 text-muted';

export function SettingsCard({ title, description, children }: { title?: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      {title !== undefined && (
        <div className="flex flex-col gap-0.5 pb-1">
          <h2 className="text-small font-bold leading-5 text-secondary">{title}</h2>
          {description !== undefined && <p className={ROW_NOTE}>{description}</p>}
        </div>
      )}
      <div className="flex flex-col border-y border-border [&>[role=alert]]:pb-4">{children}</div>
    </section>
  );
}

/**
 * 줄 하나 — **왼쪽은 무엇에 대한 것인지, 오른쪽은 그것을 바꾸는 손잡이.** 폰에서는 손잡이가 글 아래 오른쪽 끝으로 내려온다.
 *
 * `help` 는 라벨 아래 한 줄이고 `note` 는 그 아래 작은 한 줄이다.
 */
export function SettingsRow({
  label,
  help,
  note,
  children,
}: {
  label?: ReactNode;
  help?: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={SETTINGS_ROW}>
      <div className="flex min-w-0 flex-col gap-1 sm:flex-1">
        {label !== undefined && <p className={ROW_LABEL}>{label}</p>}
        {help !== undefined && <p className={ROW_HELP}>{help}</p>}
        {note !== undefined && <p className={ROW_NOTE}>{note}</p>}
      </div>
      {children !== undefined && <div className="flex flex-wrap items-center justify-end gap-3 sm:shrink-0">{children}</div>}
    </div>
  );
}

/**
 * 켜고 끄는 줄 — **글은 왼쪽, 스위치는 폰에서도 같은 줄 오른쪽이다.** 스위치의 이름은 `label` 이고(`aria-labelledby`), 아래 두 줄은
 * 설명(`aria-describedby`)이다. `label` 이 없으면 `name` 이 보이지 않는 이름이다 — 무리 이름이 곧 그 줄의 이름일 때.
 *
 * 끄면 지워지는 것처럼 누르기 직전에 읽혀야 하는 말은 `note` 자리에 선다(ADR 0028).
 */
export function SettingsSwitchRow({
  label,
  name,
  help,
  note,
  checked,
  onChange,
  busy,
  disabled,
}: {
  label?: ReactNode;
  name?: string;
  help?: ReactNode;
  note?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const described = [help !== undefined ? `${id}-help` : null, note !== undefined ? `${id}-note` : null]
    .filter((one) => one !== null)
    .join(' ');
  return (
    <div className="flex items-center gap-4 border-t border-border py-4 first:border-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {label !== undefined && (
          <p id={`${id}-label`} className={ROW_LABEL}>
            {label}
          </p>
        )}
        {help !== undefined && (
          <p id={`${id}-help`} className={ROW_HELP}>
            {help}
          </p>
        )}
        {note !== undefined && (
          <p id={`${id}-note`} className={ROW_NOTE}>
            {note}
          </p>
        )}
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        busy={busy}
        disabled={disabled}
        labelledBy={label !== undefined ? `${id}-label` : undefined}
        label={name}
        describedBy={described === '' ? undefined : described}
      />
    </div>
  );
}

/**
 * 다른 화면으로 가는 줄 — **줄 전체가 누를 자리다.** 왼쪽에 그림(선택)과 이름, 오른쪽에 「›」. 누를 자리는 56px 을 넘는다.
 */
export function SettingsLinkRow({
  href,
  leading,
  label,
  help,
  note,
  trailing,
}: {
  href: string;
  leading?: ReactNode;
  label: ReactNode;
  help?: ReactNode;
  note?: ReactNode;
  /** 화살표 앞에 작게 서는 글자 — 그 줄이 지금 무엇을 기다리는지(예: 사진이 없을 때 「사진 추가」) */
  trailing?: ReactNode;
}) {
  return (
    /* 구분선은 바깥 줄이 든다 — 누를 자리(둥근 칸)에 선을 달면 선이 모서리를 따라 휜다 */
    <div className="border-t border-border py-1 first:border-0">
      <Link
        href={href}
        className="-mx-2 flex min-h-14 items-center gap-3 rounded-cell px-2 py-2 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {leading}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`truncate ${ROW_LABEL}`}>{label}</span>
          {help !== undefined && <span className={ROW_HELP}>{help}</span>}
          {note !== undefined && <span className={ROW_NOTE}>{note}</span>}
        </span>
        {trailing !== undefined && <span className="shrink-0 text-small font-semibold text-secondary">{trailing}</span>}
        <span aria-hidden="true" className="text-muted">
          <Icon name="chevron" className="size-4" />
        </span>
      </Link>
    </div>
  );
}

/**
 * 글자 줄 — **로그아웃 · 탈퇴처럼 화면을 떠나는 누름.** 줄 전체가 단추이고 알약이 없다. `quiet` 는 맨 아래의 작은 회색 줄(탈퇴) —
 * 토스(설정 「하단의 '탈퇴하기'」) · 카카오톡(설정 › 개인/보안 › … › 탈퇴)처럼 눈에 덜 띄는 자리에 두되 찾을 수는 있게.
 */
export const SETTINGS_TEXT_ROW =
  '-mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center rounded-cell px-2 text-left text-body font-semibold text-foreground hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent aria-disabled:cursor-default aria-disabled:opacity-55';

export const SETTINGS_TEXT_ROW_QUIET =
  '-mx-2 inline-flex min-h-11 min-w-11 items-center self-start rounded-cell px-2 text-small font-medium text-muted underline-offset-4 hover:text-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
