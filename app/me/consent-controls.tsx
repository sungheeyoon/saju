'use client';

import { useState, useTransition } from 'react';

import { OPTIONAL_CONSENTS } from '@/src/lib/consent';

import { setOptionalConsent } from './actions';
import { ROW_STATUS, SETTINGS_QUIET, SettingsRow } from './settings/card';

/**
 * 선택 동의를 켜고 끄는 자리 — **끄는 것이 곧 지움이라는 것을 그 자리에서 말한다.**
 *
 * 「끄면 앞으로 안 받는다」로만 읽히면 사용자는 이미 남긴 답이 남아 있다는 것을 모른다.
 * 끄는 버튼 옆에 적어야 누르기 전에 안다(ADR 0022).
 *
 * ## 버튼은 「철회하기」가 아니라 「끄기」다
 *
 * 「동의하기 / 철회하기」라고 적혀 있었다. 그건 서류의 말이지 누르는 것의 이름이 아니다 —
 * 사용자가 여기서 하는 일은 **켜고 끄는 것**이고, 처리 안내도 그 낱말로 약속한다
 * (「선택 동의는 계정 관리 화면에서 **켜고 끄실** 수 있습니다」). 화면이 안내와 다른
 * 낱말을 쓰면, 안내를 읽고 찾아온 사람이 그 자리를 못 알아본다(ADR 0026).
 *
 * **끄는 일 자체는 그대로 있다.** 없애면 처리방침이 약속한 것이 화면에 없게 된다.
 *
 * ## 켜기와 끄기는 같은 무게다
 *
 * 「켜기」는 먹색 주 단추, 「끄기」는 위험 빨강이었다 — 켜는 쪽으로 미는 비대칭이고, 빨강은 다시 켜면 되는 일을
 * 탈퇴처럼 보이게 했다(2026-10-10 화면 점검 B6). 둘 다 되돌릴 수 있는 누름이라 같은 보조 단추(`SETTINGS_QUIET`)다.
 * 끄면 지워진다는 것은 색이 아니라 줄 아래 글(`note`)이 말한다. 위험 색은 되돌릴 수 없는 일(탈퇴 · 차단)에만 쓴다.
 *
 * ## 줄의 모양은 이 파일이 안 정한다
 *
 * 카드 언어는 `settings/card.tsx` 한 벌이다(제목 · 설명 · 줄 · 누름의 기하). 여기서
 * 또 정하면 같은 화면의 칸 다섯이 서로 조금씩 다른 모양으로 서고, 그것이 이 화면이
 * 「다섯 화면」처럼 보이던 까닭이었다.
 */
export function ConsentControls({
  improvement,
  contact,
}: {
  improvement: boolean;
  contact: boolean;
}) {
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const now: Record<string, boolean> = { improvement, contact };

  const flip = (key: 'improvement' | 'contact', next: boolean) => {
    setFailure(null);
    startSaving(async () => {
      const result = await setOptionalConsent(key, next);
      if (!result.ok) setFailure(result.message);
    });
  };

  return (
    <>
      {OPTIONAL_CONSENTS.map((one) => {
        const on = now[one.key] === true;
        return (
          <SettingsRow key={one.key} label={one.label} help={one.detail} note={one.erasure}>
            {/* 지금 값은 글자로 선다 — 점의 색만으로 켜짐을 말하지 않는다 */}
            <span className={`${ROW_STATUS} inline-flex items-center gap-1.5 text-[13px] font-semibold text-secondary`}>
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${on ? 'bg-foreground' : 'border border-border-strong'}`}
              />
              {on ? '현재 동의 중' : '현재 동의하지 않음'}
            </span>
            <button
              type="button"
              onClick={() => flip(one.key, !on)}
              disabled={saving}
              className={SETTINGS_QUIET}
            >
              {on ? '끄기' : '켜기'}
            </button>
          </SettingsRow>
        );
      })}

      {failure !== null && (
        <p role="alert" className="border-t border-border pt-4 text-sm leading-6 text-danger">
          {failure}
        </p>
      )}
    </>
  );
}
