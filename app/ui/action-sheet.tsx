'use client';

import { useEffect, useRef } from 'react';

import { BUTTON_SECONDARY } from './buttons';
import { Icon, type IconName } from './icons';
import { closeSheet, openSheet } from './sheet';

/** 고르는 줄 하나 — 위험한 일(지우기)은 `tone: 'danger'` 로 붉게, 다른 줄과 선 하나로 떨어져 선다 */
export type ActionChoice = { icon: IconName; label: string; tone?: 'danger'; run: () => void };

/**
 * **아래에서 올라오는 고르기 판** — 한 대상(사진 한 장)에 할 일 몇 가지를 고르는 자리(2026-10-24, ADR 0109 추기).
 *
 * 카카오톡의 「프로필 사진 설정」처럼 대상을 누르면 폰에서는 화면 바닥에서 판이 올라오고, 줄을 고르거나 「취소」 · Esc ·
 * 바깥 누름으로 닫힌다. 엄지가 닿는 자리이고 줄이 44px 를 넘는다 — 사진 위에 뜨던 작은 띄움 판(`MENU_PANEL`)은 옆 사진을
 * 가리고 폰의 하단 독에 끝 줄이 덮였다(ADR 0168). 넓은 화면(lg)은 시트 한 벌(`openSheet`)과 같이 가운데 작은 판이다.
 *
 * - 위험한 줄은 맨 아래, 선 하나 뒤에 붉게 선다. 그 줄을 골라도 여기서 지우지 않는다 — 부르는 쪽이 확인 창을 연다(ADR 0205).
 * - 줄을 고르면 판을 **곧바로** 닫고 그 일을 한다 — 기기의 사진 창(`input.click()`)은 누름 안에서만 열리므로 닫는 움직임을
 *   기다리지 않는다. 닫히면 브라우저가 초점을 연 자리(사진 칸)로 돌려놓는다.
 * - 닫기는 「취소」다(대장 01). 머리의 X 도 제목도 없다 — 카카오톡 · 안드로이드의 판처럼 줄이 곧 무엇을 하는 판인지 말한다. 판 머리에
 *   사진만 덩그러니 세웠더니 무엇을 말하는지 모르겠다고 했다(운영자 2026-10-24).
 */
export function ActionSheet({
  open,
  onClose,
  label,
  choices,
}: {
  open: boolean;
  /** 어느 길로 닫혀도 한 번 — 부르는 쪽은 여기서 값을 내린다 */
  onClose: () => void;
  /** 보조기기가 읽는 판의 이름 */
  label: string;
  choices: readonly ActionChoice[];
}) {
  const sheet = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = sheet.current;
    if (node === null) return;
    if (open) openSheet(node);
    else if (node.open) node.close();
  }, [open]);

  const quiet = choices.filter((one) => one.tone !== 'danger');
  const danger = choices.filter((one) => one.tone === 'danger');

  const choose = (choice: ActionChoice) => {
    sheet.current?.close();
    choice.run();
  };

  const row = (choice: ActionChoice) => (
    <button
      key={choice.label}
      type="button"
      onClick={() => choose(choice)}
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left text-lead font-semibold hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--accent)_55%,transparent)] ${
        choice.tone === 'danger' ? 'text-danger' : 'text-foreground'
      }`}
    >
      <Icon name={choice.icon} className="size-5 shrink-0" />
      {choice.label}
    </button>
  );

  return (
    <dialog
      ref={sheet}
      aria-label={label}
      onClick={(event) => {
        /* 판 안의 누름이 뒤의 사진 칸으로 번지지 않게 — 바깥(어두운 면)이면 닫는다 */
        event.stopPropagation();
        if (event.target === event.currentTarget) closeSheet(sheet.current);
      }}
      onCancel={(event) => {
        event.preventDefault();
        closeSheet(sheet.current);
      }}
      onClose={(event) => {
        event.stopPropagation();
        onClose();
      }}
      className="mx-auto mb-0 mt-auto w-full max-w-[28rem] rounded-t-paper bg-background p-0 text-foreground backdrop:bg-black/40 lg:my-auto lg:w-[22rem] lg:rounded-paper lg:shadow-float"
    >
      <div className="flex flex-col gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 lg:p-4">
        <span aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-border-strong lg:hidden" />
        <div className="flex flex-col rounded-card bg-surface p-1.5">
          {quiet.map(row)}
          {danger.length > 0 && quiet.length > 0 && <hr className="mx-3 my-1 border-border" />}
          {danger.map(row)}
        </div>
        <button type="button" onClick={() => closeSheet(sheet.current)} className={`${BUTTON_SECONDARY} w-full`}>
          취소
        </button>
      </div>
    </dialog>
  );
}
