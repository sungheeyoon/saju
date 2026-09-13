'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { setOptionalConsent } from '../actions';

/**
 * 여기서 켤 수 있게 하는 버튼 하나 — **문은 계정 관리와 같은 문이다.**
 *
 * `setOptionalConsent` 를 그대로 부른다. 이 화면만의 문을 따로 두면 켜는 자리가 둘이
 * 되고, 끄면 남긴 답이 함께 지워진다는 규칙(ADR 0022)이 한쪽에만 붙는 날이 온다.
 *
 * **끄는 버튼은 여기 안 세운다.** 끄는 것은 되돌릴 수 없는 지움을 데리고 오므로
 * (남긴 답이 함께 사라진다), 그 경고가 이미 서 있는 계정 관리 화면의 일이다.
 */
export function ConsentSwitch() {
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <button
        type="button"
        disabled={saving}
        onClick={() => {
          setFailure(null);
          startSaving(async () => {
            const result = await setOptionalConsent('improvement', true);
            if (result.ok) {
              router.refresh();
              return;
            }
            setFailure(result.message);
          });
        }}
        className="h-11 self-start rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-60"
      >
        {saving ? '켜는 중…' : '동의하고 설문 열기'}
      </button>
      <p className="text-xs leading-5 text-muted">
        계정 관리 화면에서 언제든 다시 끄실 수 있습니다. 끄시면 지금까지 남기신 설문 답도 함께
        지웁니다.
      </p>
      {failure !== null && (
        <p role="alert" className="text-sm text-danger">
          {failure}
        </p>
      )}
    </div>
  );
}
