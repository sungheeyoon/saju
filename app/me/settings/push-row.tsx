'use client';

import { useEffect, useState, useTransition } from 'react';

import {
  pushPrivacyNoteShown,
  pushToggleFailure,
  type PushRowState,
  type PushToggleFailure,
} from '@/src/lib/push';

import { readPushRowState, turnOffPush, turnOnPush } from '../push/browser';
import { SETTINGS_PRIMARY, SETTINGS_QUIET, SettingsCard, SettingsRow } from './card';
import { FailureLine } from '../../ui/failure-line';

/**
 * 계정 관리의 「새 메시지 알림」 — **이 기기에서** 켜고 끈다(ADR 0156). 기본은 꺼짐이다.
 *
 * 상태는 브라우저만 안다(권한 · 구독)라서 그린 뒤에 잰다. 재는 동안은 설명 줄을 비우되 꺼짐의 자리(설명 · 무엇이 안 보이나)를
 * 보이지 않게 지켜 다 잰 뒤 줄이 밀리지 않고, 누름은 안 세운다 — 켜진 사람에게 「켜기」가 잠깐 서면 두 번 누르게 된다. 판정은
 * `src/lib/push` 의 `pushRowState` · `pushPrivacyNoteShown` · `pushToggleFailure` 다.
 *
 * 문구는 운영자 확정이다(2026-10-10, 문구 대장 33).
 */
const COPY = {
  label: '새 메시지 알림',
  off: '켜면 이 기기로 새 메시지 알림을 받아요.',
  on: '이 기기의 알림이 켜져 있어요.',
  privacy: '알림에는 메시지 내용과 보낸 사람을 표시하지 않아요.',
  denied: '이 브라우저에서 알림이 차단되어 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요.',
  unsupported: '이 브라우저에서는 알림을 받을 수 없어요.',
  iosNotInstalled: '홈 화면에 추가하면 알림을 켤 수 있어요. 공유 버튼 → 「홈 화면에 추가」',
  turnOn: '알림 켜기',
  turningOn: '켜는 중…',
  turnOff: '알림 끄기',
  turningOff: '끄는 중…',
} as const;

const HELP: Record<PushRowState, string> = {
  off: COPY.off,
  on: COPY.on,
  denied: COPY.denied,
  unsupported: COPY.unsupported,
  'ios-not-installed': COPY.iosNotInstalled,
};

const FAILURE: Record<PushToggleFailure, string> = {
  'not-allowed': '알림 권한이 허용되지 않아 알림을 켜지 못했어요.',
  'failed-on': '알림을 켜지 못했어요. 다시 시도해 주세요.',
  'failed-off': '알림을 끄지 못했어요. 다시 시도해 주세요.',
};

/** 재는 동안의 자리 — 꺼짐(기본)의 두 줄을 보이지 않게 세워 높이만 지킨다. 화면 읽기에도 감춘다 */
function Reserved({ children }: { children: string }) {
  return (
    <span aria-hidden className="invisible">
      {children}
    </span>
  );
}

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
      const failed = pushToggleFailure(on, result);
      if (failed !== null) setFailure(FAILURE[failed]);
    });
  };

  return (
    <SettingsCard title="알림">
      <SettingsRow
        label={COPY.label}
        help={state === null ? <Reserved>{COPY.off}</Reserved> : HELP[state]}
        note={
          state === null ? <Reserved>{COPY.privacy}</Reserved> : pushPrivacyNoteShown(state) ? COPY.privacy : undefined
        }
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
        <FailureLine className="border-t border-border pt-4">{failure}</FailureLine>
      )}
    </SettingsCard>
  );
}
