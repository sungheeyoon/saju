'use client';

import { useOptimistic, useState, useTransition } from 'react';

import { OPTIONAL_CONSENTS } from '@/src/lib/consent';

import { setOptionalConsent } from './actions';
import {
  IMPROVEMENT_OFF_CONFIRM,
  IMPROVEMENT_OFF_IRREVERSIBLE,
  IMPROVEMENT_OFF_PENDING,
  IMPROVEMENT_OFF_TITLE,
  asksBeforeTurningOff,
} from './consent-off';
import { SettingsSwitchRow } from './settings/card';
import { actionAnswer } from '../ui/action-answer';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { FailureLine } from '../ui/failure-line';

type ConsentKey = 'improvement' | 'contact';

/**
 * 선택 동의를 켜고 끄는 자리 — **스위치 한 벌이고, 끄는 것이 곧 지움인 줄은 끄기 전에 묻는다.**
 *
 * 「끄면 앞으로 안 받는다」로만 읽히면 사용자는 이미 남긴 답이 남아 있다는 것을 모른다. 그래서 지움 문장은 스위치 바로 아래
 * 제 줄(`note`)에 선다(ADR 0022). 그래도 스위치는 누르면 곧 적용되는 손잡이라, 개선 활용을 끄는 누름만은 확인 창을 한 번 거친다 —
 * 판정은 `consent-off.ts`(ADR 0022 「2026-10-25 덧」). 창의 첫 초점은 「취소」, 보내는 동안은 닫히지 않고, 거절되면 창이 열린 채
 * 그 줄이 선다(`ConfirmDialog`, ADR 0166).
 *
 * ## 낱말은 「켜고 끄기」다
 *
 * 처리 안내가 「선택 동의는 계정 관리 화면에서 **켜고 끄실** 수 있습니다」라고 약속한다(ADR 0026). 「철회하기」 같은 서류의 말을
 * 화면이 쓰면 안내를 읽고 찾아온 사람이 그 자리를 못 알아본다. **끄는 일 자체는 그대로 있다** — 없애면 처리방침이 약속한 것이
 * 화면에 없게 된다.
 *
 * ## 켜기와 끄기는 같은 무게다
 *
 * 스위치는 켜짐 · 꺼짐이 한 모양이라 어느 쪽으로도 밀지 않는다(2026-10-10 화면 점검 B6 의 「켜기는 먹색, 끄기는 빨강」을 걷은 까닭과
 * 같다). 위험 색은 확인 창의 「끄고 삭제하기」에만 선다 — 그 누름이 되돌릴 수 없는 삭제다.
 *
 * 누르면 스위치가 곧 넘어가고(`useOptimistic`), 저장이 거절되면 서버가 든 값으로 돌아오며 까닭이 선다.
 */
export function ConsentControls({ improvement, contact }: { improvement: boolean; contact: boolean }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askFailure, setAskFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [shown, show] = useOptimistic<Record<ConsentKey, boolean>, { key: ConsentKey; next: boolean }>(
    { improvement, contact },
    (now, { key, next }) => ({ ...now, [key]: next }),
  );

  const save = (key: ConsentKey, next: boolean, fromDialog: boolean) => {
    setFailure(null);
    setAskFailure(null);
    startSaving(async () => {
      show({ key, next });
      const result = await actionAnswer(setOptionalConsent(key, next));
      if (result.ok) {
        if (fromDialog) setAsking(false);
      } else if (fromDialog) {
        setAskFailure(result.message);
      } else {
        setFailure(result.message);
      }
    });
  };

  const flip = (key: ConsentKey, next: boolean) => {
    if (asksBeforeTurningOff(key, next)) {
      setFailure(null);
      setAskFailure(null);
      setAsking(true);
      return;
    }
    save(key, next, false);
  };

  const improvementErasure = OPTIONAL_CONSENTS.find((one) => one.key === 'improvement')?.erasure;

  return (
    <>
      {OPTIONAL_CONSENTS.map((one) => (
        <SettingsSwitchRow
          key={one.key}
          label={one.label}
          help={one.detail}
          note={one.erasure}
          checked={shown[one.key]}
          onChange={(next) => flip(one.key, next)}
          busy={saving}
        />
      ))}

      {failure !== null && <FailureLine className="border-t border-border pt-4">{failure}</FailureLine>}

      <ConfirmDialog
        open={asking}
        onClose={() => {
          setAsking(false);
          setAskFailure(null);
        }}
        title={IMPROVEMENT_OFF_TITLE}
        confirmLabel={saving ? IMPROVEMENT_OFF_PENDING : IMPROVEMENT_OFF_CONFIRM}
        onConfirm={() => save('improvement', false, true)}
        danger
        busy={saving}
        failure={askFailure}
      >
        <p>{improvementErasure}</p>
        <p className="text-small leading-5 text-muted">{IMPROVEMENT_OFF_IRREVERSIBLE}</p>
      </ConfirmDialog>
    </>
  );
}
