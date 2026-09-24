'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { WARNING_ACKNOWLEDGE_LABEL } from '@/src/lib/account';

import { BUTTON_PRIMARY } from '../../ui/buttons';

import { acknowledgeWarning } from './actions';

/**
 * 「확인했습니다」 — 누르면 확인한 시각이 적히고 레이아웃이 다시 그려져 안내가 내려간다(다음 경고가 있으면 그것이 선다).
 * 못 적었으면 DB 가 쓴 문장을 그 자리에 세우고 안내는 그대로 둔다 — 안 읽은 채로 사라지면 「알렸는가」가 거짓이 된다.
 */
export function AcknowledgeWarning({ warningRef }: { warningRef: string }) {
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const acknowledge = () => {
    setFailure(null);
    startSaving(async () => {
      const result = await acknowledgeWarning(warningRef);
      if (result.ok) {
        router.refresh();
        return;
      }
      setFailure(result.message);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={acknowledge}
        disabled={saving}
        className={`${BUTTON_PRIMARY} self-start`}
      >
        {WARNING_ACKNOWLEDGE_LABEL}
      </button>
      {failure !== null && (
        <p role="alert" className="text-sm leading-6 text-danger">
          {failure}
        </p>
      )}
    </div>
  );
}
