'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { BirthFields } from '../birth-form';
import { DEFAULT_QUERY, missingAnswer, type Query } from '../query';
import { saveSelfPerson } from './actions';

/**
 * 자기 사주를 한 번 등록하는 화면.
 *
 * 익명 화면과 **같은 폼**을 쓴다(`BirthFields`). 저장하는 화면이라고 다른 폼을 두면
 * 한쪽만 고쳐져서 「같은 값을 넣었는데 다른 사주가 나오는」 상태가 생긴다.
 *
 * 여기서는 계산해 보여주지 않는다. 저장하면 그 자리에서 저장된 것으로 다시 그리므로,
 * 미리 계산해 보여주면 **저장된 것이 아닌 사주**를 저장된 것처럼 보여주게 된다.
 */
export function Onboarding() {
  const router = useRouter();
  const [query, setQuery] = useState<Query>({ ...DEFAULT_QUERY, name: '' });
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const missing = missingAnswer(query);

  const save = () => {
    setFailure(null);
    startSaving(async () => {
      const result = await saveSelfPerson(query);
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">내 사주 등록</h2>
        <p className="text-sm text-secondary">
          한 번 넣어 두면 다시 입력하지 않습니다. 나중에 고칠 수 있고, 고친 기록은 덮어쓰지
          않고 쌓입니다.
        </p>
      </header>

      <BirthFields value={query} onChange={setQuery} idPrefix="self" namePlaceholder="부를 이름" />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={missing !== null || saving}
          className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-60 sm:h-10"
        >
          {saving ? '저장하는 중…' : '내 사주로 저장'}
        </button>
        {/* 버튼을 잠근 이유를 그대로 말한다 — 잠긴 버튼만 있으면 왜인지 알 수 없다 */}
        {missing !== null && <span className="text-xs text-muted">{missing}</span>}
      </div>

      {failure !== null && <p className="text-sm text-muted">저장하지 못했습니다 — {failure}</p>}
    </section>
  );
}
