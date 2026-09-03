'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { NOTICE_ACK_NOTE, OPTIONAL_CONSENTS, OPTIONAL_CONSENT_NOTE } from '@/src/lib/consent';

import { acknowledgeNotice } from './actions';

/**
 * 안내를 확인하고 선택 답을 남기는 자리 — **한 번에 보낸다.**
 *
 * 갈라 보내면 확인만 하고 선택은 `null` 로 남는 사람이 생긴다. 그 사람은 물었는데 답을
 * 안 한 것인데 값은 안 물어본 것과 같아지고, 그러면 다시 물어야 할 사람을 못 고른다.
 *
 * **기본값은 꺼짐이다.** 미리 켜 두면 고른 것이 아니라 안 끈 것이 되고, 그것을 동의라고
 * 부를 수 없다.
 */
export function ConsentForm({
  version,
  scheduleId,
}: {
  version: string;
  scheduleId: number;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Record<string, boolean>>({
    improvement: false,
    contact: false,
  });
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const send = () => {
    setFailure(null);
    startSaving(async () => {
      const result = await acknowledgeNotice({
        version,
        /* 이 사람이 **본 안내의 줄**이다. 그 사이에 바뀌었으면 DB 가 거절한다 */
        scheduleId,
        improvement: chosen.improvement === true,
        contact: chosen.contact === true,
      });

      if (result.ok) {
        router.replace('/me');
        router.refresh();
        return;
      }
      setFailure(result.message);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-4">
        <legend className="float-left w-full text-base font-bold">고르실 수 있는 것</legend>
        <p className="mt-1 text-sm leading-6 text-secondary">{OPTIONAL_CONSENT_NOTE}</p>

        {OPTIONAL_CONSENTS.map((one) => (
          <label
            key={one.key}
            htmlFor={`consent-${one.key}`}
            className="flex cursor-pointer gap-3 rounded-2xl border border-border bg-surface p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-soft"
          >
            <input
              type="checkbox"
              id={`consent-${one.key}`}
              checked={chosen[one.key] === true}
              onChange={(event) =>
                setChosen((current) => ({ ...current, [one.key]: event.target.checked }))
              }
              className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-semibold">{one.label}</span>
              <span className="mt-1 block text-sm leading-6 text-secondary">{one.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className="text-sm leading-6 text-secondary">{NOTICE_ACK_NOTE}</p>

      {failure !== null && (
        <p role="alert" className="text-sm leading-6 text-danger">
          {failure}
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={send}
          disabled={saving}
          className="h-11 rounded-xl bg-accent px-6 text-sm font-semibold text-on-accent shadow-sm hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? '적는 중이에요…' : '확인하고 시작하기'}
        </button>
      </div>
    </div>
  );
}
