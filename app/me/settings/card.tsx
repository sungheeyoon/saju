import Link from 'next/link';
import type { ReactNode } from 'react';

import { BUTTON_PRIMARY_SMALL, BUTTON_SECONDARY_SMALL } from '../../ui/buttons';
import { Icon } from '../../ui/icons';

/**
 * 계정 관리의 **무리 지은 목록 한 벌.**
 *
 * 이 화면은 성질이 다른 칸 여섯이 위에서 아래로 쌓인 자리다(프로필 · 상대 조건 · 인연 찾기 ·
 * 선택 동의 · 로그인 정보 · 탈퇴). 각 칸을 만든 날이 달라서 **같은 뜻의 부품이 카드마다 다른
 * 모양**을 쓰고 있었다 — 제목 굵기 둘, 버튼 네 벌, 구분선이 있는 카드와 없는 카드. 다섯이 겹치면
 * 같은 화면이 아니라 다섯 화면으로 보인다. 그래서 모양을 이 파일 한 곳에 둔다. 인연 찾기의 두
 * 칸(`discovery/manage.tsx`)도 이 파일을 불러 같은 모양으로 선다.
 *
 * ## 규칙 셋 (5차, 부드러움)
 *
 * 1. **무리는 제목과 한 장의 줄 목록이다.** 제목은 판 밖 위에, 줄은 한 장의 흰 판 안에 서고
 *    줄 사이는 실선 하나(설정 앱의 무리 지은 목록).
 * 2. **누름은 줄의 오른쪽이다.** 좁은 화면에서는 글 아래로 내려오고 차례는 그대로다. 다른 화면으로
 *    가는 줄은 줄 전체가 링크이고 끝에 셰브론이 선다(`SettingsLinkRow`).
 * 3. **버튼은 공용 단추의 작은 층이다**(`app/ui/buttons.ts`). 먹색은 시작하는 누름, 흰 알약은
 *    되돌릴 수 있는 누름, 붉은 글자는 되돌리기 어려운 누름.
 */

/** 시작하는 누름 — 한 무리에 하나뿐이다 */
export const SETTINGS_PRIMARY = BUTTON_PRIMARY_SMALL;

/** 되돌릴 수 있는 누름 */
export const SETTINGS_QUIET = BUTTON_SECONDARY_SMALL;

/**
 * 되돌리기 어려운 누름의 **여는 단추** — 흰 알약에 위험 색 글자. 되돌릴 수 없는 마지막 누름은
 * 채운 `BUTTON_DANGER` 가 든다(탈퇴 신청). 둘을 가르는 것은 「한 번 더 묻는가」다.
 */
export const SETTINGS_DANGER =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-danger hover:border-danger active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55';

/** 줄 하나의 껍데기 — 직접 `<fieldset>` 으로 감싸야 하는 자리가 있어 클래스도 내준다 */
export const SETTINGS_ROW =
  'flex flex-col gap-3 border-t border-border py-4 first:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6';

export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-1 px-1">
        <h2 className="text-[15px] font-bold leading-6 text-foreground">{title}</h2>
        {description !== undefined && (
          <p className="text-[13px] leading-5 text-secondary">{description}</p>
        )}
      </div>
      <div className="flex flex-col overflow-hidden rounded-[1.5rem] border border-border bg-surface px-4 py-1 sm:px-5 [&>[role=alert]]:pb-4">
        {children}
      </div>
    </section>
  );
}

/**
 * 줄 하나 — **왼쪽은 무엇에 대한 것인지, 오른쪽은 그것을 바꾸는 손잡이.**
 *
 * `help` 는 라벨 아래 한 줄이고 `note` 는 그 아래 작은 한 줄이다. 선택 동의의 「끄면
 * 지워진다」가 `note` 자리에 서고, 그래서 **누르기 직전에** 읽힌다(ADR 0028).
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
        {label !== undefined && <p className="text-[15px] font-semibold leading-6">{label}</p>}
        {help !== undefined && <p className="text-sm leading-6 text-secondary">{help}</p>}
        {note !== undefined && <p className="text-[13px] leading-5 text-muted">{note}</p>}
      </div>
      {children !== undefined && (
        <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:justify-end">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * 다른 화면으로 가는 줄 — **줄 전체가 누를 자리다.** 왼쪽에 그림(선택)과 이름, 오른쪽에 지금 값과
 * 셰브론. 누를 자리는 56px 을 넘는다.
 */
export function SettingsLinkRow({
  href,
  leading,
  label,
  help,
  value,
}: {
  href: string;
  leading?: ReactNode;
  label: ReactNode;
  help?: ReactNode;
  value?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="-mx-4 flex min-h-14 items-center gap-3 border-t border-border px-4 py-3 first:border-0 hover:bg-surface-soft sm:-mx-5 sm:px-5"
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold leading-6">{label}</span>
        {help !== undefined && <span className="text-[13px] leading-5 text-secondary">{help}</span>}
      </span>
      {value !== undefined && <span className="shrink-0 text-sm text-secondary">{value}</span>}
      <span aria-hidden="true" className="text-muted">
        <Icon name="chevron" className="size-4" />
      </span>
    </Link>
  );
}
