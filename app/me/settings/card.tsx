import Link from 'next/link';
import { useId, type ReactNode } from 'react';

import { Icon } from '../../ui/icons';
import { Switch } from '../../ui/switch';

/**
 * 계정 관리의 **무리 지은 목록 한 벌** — 회색 바탕 위에 흰 무리가 쌓이고, 무리 사이는 회색 띠다(2026-10-26, #838 운영자 피드백).
 *
 * 토스 · 카카오톡 · 당근의 설정을 다시 봤다(그림과 출처는 #838 본문). 셋 다 **줄이 화면 끝까지 가고 글자만 안쪽에 선다** — 앞의
 * 판(2026-10-25)은 줄 전체를 화면 안쪽 기둥에 넣고 위아래 구분선을 그 기둥 폭으로 그어서, 구분선이 화면 안쪽에서 시작해 안쪽에서
 * 끝났고 흰 바탕과 화면 바탕이 거의 같은 색이라 무리가 바탕에 녹았다. 그래서 토스 TDS 의 목록 규칙을 그대로 따른다.
 *
 * ## 규칙 다섯
 *
 * 1. **무리는 흰 면(`bg-surface-raised`)이고 폰에서는 화면 끝까지 간다.** 넓은 화면에서만 기둥 안의 카드 모서리를 입는다.
 * 2. **무리 사이는 16px 회색 띠다** — 화면 바탕이 가라앉은 면(`bg-surface-sunken`)이고 무리 사이 틈(`gap-4`)이 곧 띠다. TDS `Border`
 *    의 「구간을 나눈다면 `height16`」.
 * 3. **글자는 양쪽 24px 안쪽에 선다**(`px-6`) — TDS `ListRow` · `Border` 의 `padding24`. 무리 안의 줄 사이에는 선을 긋지 않는다(토스 설정).
 * 4. **무리 이름은 무리 면 안 맨 위의 작은 회색 글자다**(TDS `ListHeader` · 카카오톡 「친구 등록 관리」) — 바탕 위에 따로 떠 있지 않다.
 * 5. **켜고 끄기는 스위치, 다른 화면으로 가는 줄은 줄 전체가 링크와 「›」, 로그아웃은 글자 줄, 탈퇴는 맨 아래 바탕 위의 작은 회색 글자.**
 */

/** 줄 하나의 안쪽 여백 — 글자는 양쪽 24px 안쪽(TDS `padding24`) */
const ROW_PAD = 'px-6';

/** 줄의 이름 · 아래 한 줄 · 그 아래 작은 한 줄 */
const ROW_LABEL = 'text-body font-semibold leading-6 text-foreground';
const ROW_HELP = 'text-small leading-5 text-secondary';
const ROW_NOTE = 'text-small leading-5 text-muted';

/** 무리 한 덩이 — 흰 면, 폰에서는 화면 끝까지 */
export const SETTINGS_GROUP = 'flex flex-col bg-surface-raised py-2 sm:rounded-card';

export function SettingsGroup({
  title,
  description,
  children,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={SETTINGS_GROUP}>
      {title !== undefined && (
        <div className={`flex flex-col gap-0.5 ${ROW_PAD} pb-1 pt-3`}>
          <h2 className="text-small font-semibold leading-5 text-secondary">{title}</h2>
          {description !== undefined && <p className={ROW_NOTE}>{description}</p>}
        </div>
      )}
      <div className="flex flex-col [&>[role=alert]]:px-6 [&>[role=alert]]:pb-3">{children}</div>
    </section>
  );
}

/**
 * 줄 하나 — **왼쪽은 무엇에 대한 것인지, 오른쪽은 그것을 바꾸는 손잡이.** 손잡이가 없으면 글만 선다.
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
    <div className={`flex min-h-14 items-center gap-4 ${ROW_PAD} py-3`}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {label !== undefined && <p className={ROW_LABEL}>{label}</p>}
        {help !== undefined && <p className={ROW_HELP}>{help}</p>}
        {note !== undefined && <p className={ROW_NOTE}>{note}</p>}
      </div>
      {children !== undefined && <div className="flex shrink-0 items-center gap-3">{children}</div>}
    </div>
  );
}

/**
 * 켜고 끄는 줄 — **글은 왼쪽, 스위치는 같은 줄 오른쪽이다**(카카오톡 「친구」 설정의 줄과 같은 꼴). 스위치의 이름은 `label` 이고
 * (`aria-labelledby`), 아래 두 줄은 설명(`aria-describedby`)이다. `label` 이 없으면 `name` 이 보이지 않는 이름이다.
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
    <div className={`flex min-h-14 items-center gap-4 ${ROW_PAD} py-3`}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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
 * 다른 화면으로 가는 줄 — **줄 전체가 누를 자리다**(화면 끝에서 끝까지). 왼쪽에 그림(선택)과 이름, 오른쪽에 「›」.
 */
export function SettingsLinkRow({
  href,
  leading,
  label,
  help,
  note,
  trailing,
  big = false,
}: {
  href: string;
  leading?: ReactNode;
  label: ReactNode;
  help?: ReactNode;
  note?: ReactNode;
  /** 화살표 앞에 작게 서는 글자 — 그 줄이 지금 무엇을 기다리는지(예: 사진이 없을 때 「사진 추가」) */
  trailing?: ReactNode;
  /** 맨 위 프로필 줄 — 이름이 한 단 크다(카카오톡 · 당근 설정의 맨 위 내 프로필) */
  big?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 ${ROW_PAD} ${big ? 'min-h-20 py-4' : 'min-h-14 py-3'} hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent`}
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`truncate ${big ? 'text-lead font-bold leading-6 text-foreground' : ROW_LABEL}`}>{label}</span>
        {help !== undefined && <span className={`truncate ${ROW_HELP}`}>{help}</span>}
        {note !== undefined && <span className={ROW_NOTE}>{note}</span>}
      </span>
      {trailing !== undefined && <span className="shrink-0 text-small font-semibold text-secondary">{trailing}</span>}
      <span aria-hidden="true" className="text-muted">
        <Icon name="chevron" className="size-4" />
      </span>
    </Link>
  );
}

/**
 * 글자 줄 — **로그아웃처럼 화면을 떠나는 누름.** 줄 전체가 단추이고 알약이 없다.
 */
export const SETTINGS_TEXT_ROW = `flex min-h-14 w-full items-center ${ROW_PAD} text-left text-body font-semibold text-foreground hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent aria-disabled:cursor-default aria-disabled:opacity-55`;

/**
 * 탈퇴 — **맨 아래 무리 밖, 회색 바탕 위의 작은 회색 글자다.** 토스(설정 맨 아래 「탈퇴하기」) · 당근(설정 맨 아래 「탈퇴하기」)처럼
 * 찾을 수는 있되 눈에 덜 띄는 자리. 글자는 줄의 글자와 같은 24px 안쪽에 선다.
 */
export const SETTINGS_TEXT_ROW_QUIET =
  'mx-4 inline-flex min-h-11 min-w-11 items-center self-start rounded-cell px-2 text-small font-medium text-muted underline-offset-4 hover:text-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:mx-4';
