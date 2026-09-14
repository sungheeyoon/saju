import type { ReactNode } from 'react';

import { CARD } from '../../card';

/**
 * 계정 관리의 **카드 언어 한 벌.**
 *
 * 이 화면은 성질이 다른 칸 다섯이 위에서 아래로 쌓인 자리다(상대 조건 · 인연 찾기 ·
 * 선택 동의 · 로그인 정보 · 계정 삭제). 각 칸을 만든 날이 달라서 **같은 뜻의 부품이
 * 카드마다 다른 모양**을 쓰고 있었다:
 *
 * - 제목이 `font-semibold` 와 `font-bold` 로 갈렸다
 * - 버튼이 높이 40·44, 라운드 `lg`·`xl`, 글자 `medium`·`semibold` 로 네 가지였다
 * - 구분선이 어떤 카드에는 있고 어떤 카드에는 없었다
 * - 누름이 어떤 카드는 글 아래, 어떤 카드는 줄의 오른쪽에 섰다
 *
 * 하나하나는 작은데, 다섯이 겹치면 **같은 화면이 아니라 다섯 화면**으로 보인다. 그래서
 * 모양을 이 파일 한 곳에 둔다 — 다음에 칸이 하나 더 붙어도 같은 언어를 쓴다.
 *
 * ## 규칙 셋
 *
 * 1. **카드는 제목(+설명)과 줄의 목록이다.** 줄 사이는 실선 하나.
 * 2. **누름은 줄의 오른쪽이다.** 좁은 화면에서는 글 아래로 내려오고 차례는 그대로다.
 * 3. **버튼의 기하는 하나다**(`SETTINGS_*`). 갈리는 것은 색과 뜻뿐이다 —
 *    진한 것은 시작하는 누름, 테두리는 되돌릴 수 있는 누름, 붉게 물드는 것은 위험한 누름.
 */

const CONTROL =
  'inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:h-10';

/** 시작하는 누름 — 한 카드에 하나뿐이다 */
export const SETTINGS_PRIMARY = `${CONTROL} bg-accent text-on-accent hover:bg-accent-strong`;

/** 되돌릴 수 있는 누름 */
export const SETTINGS_QUIET = `${CONTROL} border border-border-strong hover:border-accent hover:text-accent`;

/** 되돌리기 어려운 누름 — 색은 손이 닿을 때만 든다 */
export const SETTINGS_DANGER = `${CONTROL} border border-border-strong hover:border-danger hover:text-danger`;

/** 줄 하나의 껍데기 — 직접 `<fieldset>` 으로 감싸야 하는 자리가 있어 클래스도 내준다 */
export const SETTINGS_ROW =
  'flex flex-col gap-3 border-t border-border py-4 first:border-0 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6';

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
    <section className={`${CARD} flex flex-col`}>
      <h2 className="text-base font-semibold">{title}</h2>
      {description !== undefined && (
        <p className="mt-1.5 text-sm leading-6 text-secondary">{description}</p>
      )}
      <div className={`flex flex-col ${description === undefined ? 'mt-3' : 'mt-4'}`}>
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
        {label !== undefined && <p className="text-sm font-semibold">{label}</p>}
        {help !== undefined && <p className="text-sm leading-6 text-secondary">{help}</p>}
        {note !== undefined && <p className="text-xs leading-5 text-muted">{note}</p>}
      </div>
      {children !== undefined && (
        <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:justify-end">
          {children}
        </div>
      )}
    </div>
  );
}
