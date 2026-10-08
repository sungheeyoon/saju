'use client';

import { useEffect, useState, useTransition } from 'react';

import type { PushRowState } from '@/src/lib/push';

import { readPushRowState, turnOffPush, turnOnPush } from '../push/browser';
import { SETTINGS_PRIMARY, SETTINGS_QUIET, SettingsCard, SettingsRow } from './card';

/**
 * 계정 관리의 「새 메시지 알림」 — **이 기기에서** 켜고 끈다(ADR 0156). 기본은 꺼짐이다.
 *
 * 상태는 브라우저만 안다(권한 · 구독)라서 그린 뒤에 잰다. 재는 동안은 줄만 세우고 누름은 안 세운다 — 켜진 사람에게
 * 「켜기」가 잠깐 서면 두 번 누르게 된다. 판정은 `src/lib/push` 의 `pushRowState` 하나다.
 *
 * 문구는 시안이다(운영자 승인 대기) — 확정되면 문구 대장에 줄이 선다.
 */
const COPY = {
  label: '새 메시지 알림',
  checking: '알림 설정을 확인하는 중…',
  off: '앱을 보고 있지 않을 때 새 메시지가 오면 이 기기로 알려 드려요.',
  on: '이 기기로 새 메시지 알림을 받고 있어요.',
  privacy: '알림에는 메시지 내용과 보낸 사람이 보이지 않아요.',
  denied: '이 브라우저에서 알림이 차단되어 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요.',
  unsupported: '이 브라우저에서는 알림을 받을 수 없어요.',
  iosNotInstalled: 'iPhone · iPad 는 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요. 공유 버튼에서 「홈 화면에 추가」를 누른 뒤 그 앱으로 열어 주세요.',
  turnOn: '알림 켜기',
  turningOn: '켜는 중…',
  turnOff: '알림 끄기',
  turningOff: '끄는 중…',
  notAllowed: '알림을 허용하지 않아 켜지 못했어요.',
  failedOn: '알림을 켜지 못했어요. 다시 시도해 주세요.',
  failedOff: '알림을 끄지 못했어요. 다시 시도해 주세요.',
} as const;

const HELP: Record<PushRowState, string> = {
  off: COPY.off,
  on: COPY.on,
  denied: COPY.denied,
  unsupported: COPY.unsupported,
  'ios-not-installed': COPY.iosNotInstalled,
};

export function PushRow() {
  const [state, setState] = useState<PushRowState | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  useEffect(() => {
    let live = true;
    void readPushRowState().then((read) => {
      if (live) setState(read);
    });
    return () => {
      live = false;
    };
  }, []);

  /* 권한 요청은 누름 안에서 곧장 나가야 한다(Safari) — 이 함수와 `turnOnPush` 사이에 await 가 없다 */
  const toggle = (on: boolean) => {
    setFailure(null);
    startWorking(async () => {
      const result = on ? await turnOnPush() : await turnOffPush();
      setState(result.state);
      if (!result.ok) {
        setFailure(result.reason === 'denied' ? COPY.notAllowed : on ? COPY.failedOn : COPY.failedOff);
      }
    });
  };

  return (
    <SettingsCard title="알림">
      <SettingsRow
        label={COPY.label}
        help={state === null ? COPY.checking : HELP[state]}
        note={state === 'off' || state === 'on' ? COPY.privacy : undefined}
      >
        {state === 'off' && (
          <button type="button" onClick={() => toggle(true)} disabled={working} className={SETTINGS_PRIMARY}>
            {working ? COPY.turningOn : COPY.turnOn}
          </button>
        )}
        {state === 'on' && (
          <button type="button" onClick={() => toggle(false)} disabled={working} className={SETTINGS_QUIET}>
            {working ? COPY.turningOff : COPY.turnOff}
          </button>
        )}
      </SettingsRow>
      {failure !== null && (
        <p role="alert" className="border-t border-border pt-4 text-sm text-danger">
          {failure}
        </p>
      )}
    </SettingsCard>
  );
}
