import { useState } from 'react';

import { IMPROVEMENT_OFF_CONFIRM, IMPROVEMENT_OFF_IRREVERSIBLE, IMPROVEMENT_OFF_PENDING, IMPROVEMENT_OFF_TITLE, asksBeforeTurningOff } from '@consent/off';
import { OPTIONAL_CONSENTS } from '@consent/notice';

import { ConfirmDialog, DialogText } from '@/ui/confirm-dialog';

import { FailureLine, SwitchRow } from './parts';
import { setOptionalConsent } from './settings';

type ConsentKey = 'improvement' | 'contact';

/**
 * 선택 동의를 켜고 끄는 자리 — 웹 `app/me/consent-controls.tsx` 와 같다. 끄는 것이 곧 지움인 줄(개선 활용)만 끄기 전에 묻고(ADR 0022),
 * 판정은 함께 쓰는 `asksBeforeTurningOff` 다. 누르면 곧 넘어가고, 거절되면 앞 값으로 돌아오며 까닭이 선다.
 */
export function ConsentControls({ improvement, contact }: { improvement: boolean; contact: boolean }) {
  const [shown, setShown] = useState<Record<ConsentKey, boolean>>({ improvement, contact });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askFailure, setAskFailure] = useState<string | null>(null);

  const save = async (key: ConsentKey, next: boolean, fromDialog: boolean) => {
    const before = shown[key];
    setFailure(null);
    setAskFailure(null);
    setSaving(true);
    if (!fromDialog) setShown((now) => ({ ...now, [key]: next }));
    const result = await setOptionalConsent(key, next);
    setSaving(false);
    if (result.ok) {
      if (fromDialog) {
        setShown((now) => ({ ...now, [key]: next }));
        setAsking(false);
      }
      return;
    }
    if (fromDialog) {
      setAskFailure(result.message);
      return;
    }
    setShown((now) => ({ ...now, [key]: before }));
    setFailure(result.message);
  };

  const flip = (key: ConsentKey, next: boolean) => {
    if (asksBeforeTurningOff(key, next)) {
      setFailure(null);
      setAskFailure(null);
      setAsking(true);
      return;
    }
    void save(key, next, false);
  };

  const erasure = OPTIONAL_CONSENTS.find((one) => one.key === 'improvement')?.erasure;

  return (
    <>
      {OPTIONAL_CONSENTS.map((one) => (
        <SwitchRow
          key={one.key}
          label={one.label}
          help={one.detail}
          note={one.erasure}
          checked={shown[one.key as ConsentKey]}
          onChange={(next) => flip(one.key as ConsentKey, next)}
          busy={saving}
        />
      ))}
      {failure !== null && <FailureLine inset>{failure}</FailureLine>}
      <ConfirmDialog
        open={asking}
        onClose={() => {
          setAsking(false);
          setAskFailure(null);
        }}
        title={IMPROVEMENT_OFF_TITLE}
        confirmLabel={saving ? IMPROVEMENT_OFF_PENDING : IMPROVEMENT_OFF_CONFIRM}
        onConfirm={() => void save('improvement', false, true)}
        danger
        busy={saving}
        failure={askFailure}
        irreversible={IMPROVEMENT_OFF_IRREVERSIBLE}
      >
        <DialogText>{erasure}</DialogText>
      </ConfirmDialog>
    </>
  );
}
