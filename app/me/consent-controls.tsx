'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { OPTIONAL_CONSENTS } from '@/src/lib/consent';

import { setOptionalConsent } from './actions';

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
 */
export function ConsentControls({
  improvement,
  contact,
}: {
  improvement: boolean;
  contact: boolean;
}) {
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const now: Record<string, boolean> = { improvement, contact };

  const flip = (key: 'improvement' | 'contact', next: boolean) => {
    setFailure(null);
    startSaving(async () => {
      const result = await setOptionalConsent(key, next);
      if (result.ok) {
        router.refresh();
        return;
      }
      setFailure(result.message);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {OPTIONAL_CONSENTS.map((one) => {
        const on = now[one.key] === true;
        return (
          <div key={one.key} className="flex flex-col gap-2 border-t border-border pt-4 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{one.label}</p>
                <p className="mt-1 text-sm leading-6 text-secondary">{one.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => flip(one.key, !on)}
                disabled={saving}
                className={`h-10 shrink-0 rounded-xl px-4 text-sm font-semibold disabled:opacity-60 ${
                  on
                    ? 'border border-border-strong hover:border-danger hover:text-danger'
                    : 'bg-accent text-on-accent hover:bg-accent-strong'
                }`}
              >
                {on ? '끄기' : '켜기'}
              </button>
            </div>
            <p className="text-xs leading-5 text-muted">
              {on ? '지금 동의하고 계십니다.' : '지금은 동의하지 않으셨습니다.'}
              {one.key === 'improvement' && on && ' 끄시면 지금까지 남기신 설문 답도 함께 지웁니다.'}
            </p>
          </div>
        );
      })}

      {failure !== null && (
        <p role="alert" className="text-sm leading-6 text-danger">
          {failure}
        </p>
      )}
    </div>
  );
}
